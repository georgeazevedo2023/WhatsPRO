-- =============================================================================
-- Notificação de Vendedor por WhatsApp no Handoff — schema MVP
-- Fases: F0.1 + F1.1 + F1.2 + F1.3 + F1.4
-- Data: 2026-05-07
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- F0.1 + F1.1 — user_profiles: handshake + personal_whatsapp + pause
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS personal_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_assignment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_handshake_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_session_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_paused_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notifications_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_paused_reason TEXT;

-- E.164 starts with + and 10-15 digits. Allow NULL.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_personal_whatsapp_e164;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_personal_whatsapp_e164
  CHECK (personal_whatsapp IS NULL OR personal_whatsapp ~ '^\+[1-9][0-9]{9,14}$');

-- Lookup index for webhook intercept (matching by personal_whatsapp).
-- Partial: most users won't have a personal number cadastrado.
CREATE INDEX IF NOT EXISTS idx_user_profiles_personal_whatsapp
  ON public.user_profiles(personal_whatsapp)
  WHERE personal_whatsapp IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.personal_whatsapp IS
  'Número WhatsApp pessoal do vendedor (E.164: +5511987654321). Cadastrado pelo admin pra receber notificações de handoff.';
COMMENT ON COLUMN public.user_profiles.notify_on_assignment IS
  'Opt-in geral: vendedor quer receber notif quando atribuído? Default true.';
COMMENT ON COLUMN public.user_profiles.whatsapp_handshake_at IS
  'Primeira vez que o vendedor mandou msg pro número da empresa (ativa o canal).';
COMMENT ON COLUMN public.user_profiles.whatsapp_session_until IS
  'Janela WhatsApp 24h: notif só dispara se now() < whatsapp_session_until. Renovado a cada msg do vendedor.';
COMMENT ON COLUMN public.user_profiles.notifications_paused_until IS
  'Pause temporário pelo admin/gestor. NULL = ativo. Futuro = pausado até essa data.';

-- ─────────────────────────────────────────────────────────────────────────────
-- F1.2 — conversations: assigned_at
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.conversations.assigned_at IS
  'Momento da atribuição do conv ao operador. Atualizado em cada UPDATE de assigned_to via assignHandoff(). NULL = nunca atribuído.';

-- ─────────────────────────────────────────────────────────────────────────────
-- F1.3 — instance_settings (substitui org_settings que não existe)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instance_settings (
  instance_id TEXT PRIMARY KEY REFERENCES public.instances(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.instance_settings IS
  'Configurações por instância. Multi-tenancy via instance_id (cada instância = um tenant na arquitetura atual).';
COMMENT ON COLUMN public.instance_settings.notifications_enabled IS
  'Feature flag de rollback: quando false, notify-vendor-assignment pula tudo silenciosamente.';

ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instance_settings_select" ON public.instance_settings;
CREATE POLICY "instance_settings_select"
  ON public.instance_settings FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_instance_access uia
      WHERE uia.instance_id = instance_settings.instance_id
        AND uia.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "instance_settings_modify" ON public.instance_settings;
CREATE POLICY "instance_settings_modify"
  ON public.instance_settings FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_instance_access uia
      WHERE uia.instance_id = instance_settings.instance_id
        AND uia.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_instance_access uia
      WHERE uia.instance_id = instance_settings.instance_id
        AND uia.user_id = auth.uid()
    )
  );

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION public.tg_instance_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instance_settings_updated_at ON public.instance_settings;
CREATE TRIGGER instance_settings_updated_at
  BEFORE UPDATE ON public.instance_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_instance_settings_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- F1.4 — notification_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  assigned_to_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  instance_id TEXT REFERENCES public.instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'error', 'skipped')),
  skip_reason TEXT,
  error_message TEXT,
  message_text TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_log_unique_assignment UNIQUE (conversation_id, assigned_to_id)
);

COMMENT ON TABLE public.notification_log IS
  'Auditoria de notificações de handoff enviadas pro WhatsApp pessoal do vendedor. UNIQUE(conv, vendor) garante idempotência — reatribuição usa UPSERT pra atualizar.';
COMMENT ON COLUMN public.notification_log.skip_reason IS
  'Quando status=skipped, qual guard falhou: skip_disabled, skip_optout, skip_no_number, skip_session_expired, skip_paused, skip_off_hours, skip_queue_paused, skip_rate_limited.';

-- Index parcial pra rate-limit query: count notifs sent na última 1h por vendedor.
CREATE INDEX IF NOT EXISTS idx_notification_log_rate_limit
  ON public.notification_log(assigned_to_id, sent_at)
  WHERE status = 'sent';

-- Index pra painel admin (filtros por instância/vendedor).
CREATE INDEX IF NOT EXISTS idx_notification_log_instance_sent
  ON public.notification_log(instance_id, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- RLS: super_admin vê tudo. Gerente vê do mesmo dept que o assigned_to.
-- INSERT só via service_role (edge function).
DROP POLICY IF EXISTS "notification_log_select" ON public.notification_log;
CREATE POLICY "notification_log_select"
  ON public.notification_log FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.department_members dm1
      JOIN public.department_members dm2 ON dm1.department_id = dm2.department_id
      JOIN public.user_roles ur ON ur.user_id = dm1.user_id
      WHERE dm1.user_id = auth.uid()
        AND dm2.user_id = notification_log.assigned_to_id
        AND ur.role = 'gerente'
    )
  );

-- INSERT/UPDATE/DELETE: nenhum cliente — service_role bypassa RLS.

-- =============================================================================
-- Done.
-- =============================================================================
