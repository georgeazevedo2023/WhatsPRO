-- Auto-cadastro de leads na base do Disparador, por instância.
--
-- Conserta de raiz a feature "Auto-add contact to instance lead database" do
-- whatsapp-webhook, que estava deployada porém 100% quebrada: a criação da base
-- usava upsert ON CONFLICT (instance_id) — mas o índice único de instance_id é
-- PARCIAL (WHERE instance_id IS NOT NULL) e o Postgres não infere índice parcial
-- sem predicado (erro 42P10). A exceção caía no catch fire-and-forget e nenhuma
-- base era criada (total_databases = 0 em PROD).
--
-- Solução: uma RPC SECURITY DEFINER atômica que (1) respeita um toggle por
-- instância (default OFF), (2) garante a base com o predicado correto e (3) faz
-- upsert do contato usando a UNIQUE (database_id, phone) que já existe. O webhook
-- passa a fazer uma única chamada a esta RPC.

-- Toggle por instância (default OFF). Vive em instance_settings (PK instance_id),
-- mesmo padrão do InstanceNotificationToggle / notifications_enabled.
ALTER TABLE public.instance_settings
  ADD COLUMN IF NOT EXISTS auto_enroll_broadcast_db boolean NOT NULL DEFAULT false;

-- Enrola um lead na base do Disparador da sua instância. No-op se o toggle da
-- instância estiver desligado (ou não existir). Idempotente por (database_id, phone).
CREATE OR REPLACE FUNCTION public.enroll_lead_in_instance_database(
  p_instance_id text,
  p_phone text,
  p_jid text,
  p_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_user_id uuid;
  v_instance_name text;
  v_db uuid;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  -- Toggle por instância — default OFF se não houver row de settings.
  SELECT auto_enroll_broadcast_db INTO v_enabled
  FROM instance_settings WHERE instance_id = p_instance_id;
  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Telefone precisa ter ao menos 10 dígitos (DDD + número).
  IF length(v_digits) < 10 THEN
    RETURN;
  END IF;

  -- Dono e nome da instância (fonte única — nome da base = nome da instância).
  SELECT user_id, name INTO v_user_id, v_instance_name
  FROM instances WHERE id = p_instance_id;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Garante a base da instância. O predicado WHERE instance_id IS NOT NULL casa
  -- o índice único parcial idx_lead_databases_instance_id (corrige o bug 42P10).
  INSERT INTO lead_databases (name, user_id, instance_id, leads_count)
  VALUES (coalesce(nullif(v_instance_name, ''), 'Instância ' || p_instance_id), v_user_id, p_instance_id, 0)
  ON CONFLICT (instance_id) WHERE instance_id IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_db;

  -- Upsert do contato — usa a UNIQUE (database_id, phone). Só atualiza nome/jid
  -- (não rebaixa nem sobrescreve source/verification de entradas pré-existentes).
  INSERT INTO lead_database_entries
    (database_id, phone, jid, name, source, is_verified, verification_status)
  VALUES (v_db, p_phone, p_jid, p_name, 'helpdesk', true, 'valid')
  ON CONFLICT (database_id, phone)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, lead_database_entries.name),
    jid  = EXCLUDED.jid;

  PERFORM recalc_lead_database_count(v_db);
END;
$$;

-- Service-only: chamada pelo whatsapp-webhook (role service_role). Postgres
-- concede EXECUTE a PUBLIC por padrão — revogar (lição v7.69.0: claim vazava
-- tokens p/ anon). Sem auth.uid() aqui; quem pode chamar é só o backend.
REVOKE EXECUTE ON FUNCTION public.enroll_lead_in_instance_database(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_lead_in_instance_database(text, text, text, text) TO service_role;

-- Liga o EletropisoV2 (re662a6d32de7e0). Demais instâncias permanecem OFF.
INSERT INTO public.instance_settings (instance_id, auto_enroll_broadcast_db)
VALUES ('re662a6d32de7e0', true)
ON CONFLICT (instance_id) DO UPDATE SET auto_enroll_broadcast_db = true;
