-- ────────────────────────────────────────────────────────────────────────────
-- user_feature_permissions — permissões granulares por feature
--
-- Modelo:
--   - super_admin: SEMPRE true (bypass — função has_feature_permission)
--   - gerente: TRUE por padrão (fallback no helper) — pode ser sobrescrito pra false
--   - user (atendente): FALSE por padrão — recebe permissão linha-a-linha
--
-- Features iniciais (feature_key):
--   manage_catalog              — Catálogo de produtos com foto
--   manage_faq                  — Base de conhecimento (FAQ + docs + mídias)
--   manage_qualification        — Categorias de atendimento (ServiceCategoriesConfig)
--   manage_excluded_products    — Produtos que NÃO vendemos
--   manage_blocked_numbers      — Números bloqueados (F2)
--
-- Cada user×feature pode ter can_view e can_edit. Atualmente só usamos can_edit
-- (a view é implícita quando edit=true). Mantém-se can_view pra futuro.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_feature_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  can_view    boolean NOT NULL DEFAULT true,
  can_edit    boolean NOT NULL DEFAULT false,
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_feature_permissions_user_feature_unique UNIQUE (user_id, feature_key),
  CONSTRAINT user_feature_permissions_feature_key_check CHECK (
    feature_key IN (
      'manage_catalog',
      'manage_faq',
      'manage_qualification',
      'manage_excluded_products',
      'manage_blocked_numbers'
    )
  )
);

CREATE INDEX IF NOT EXISTS user_feature_permissions_user_id_idx
  ON public.user_feature_permissions (user_id);

-- ─── Helper function: has_feature_permission(user, feature) ───
CREATE OR REPLACE FUNCTION public.has_feature_permission(
  p_user_id uuid,
  p_feature_key text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      -- super_admin sempre pode
      WHEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_user_id AND role = 'super_admin'
      ) THEN true
      -- override explícito por linha em user_feature_permissions
      WHEN EXISTS (
        SELECT 1 FROM user_feature_permissions
        WHERE user_id = p_user_id
          AND feature_key = p_feature_key
          AND can_edit = true
      ) THEN true
      -- gerente: padrão TRUE (a menos que tenha row dizendo false)
      WHEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_user_id AND role = 'gerente'
      ) AND NOT EXISTS (
        SELECT 1 FROM user_feature_permissions
        WHERE user_id = p_user_id
          AND feature_key = p_feature_key
          AND can_edit = false
      ) THEN true
      ELSE false
    END;
$$;

GRANT EXECUTE ON FUNCTION public.has_feature_permission(uuid, text) TO authenticated;

-- ─── RLS ───
ALTER TABLE public.user_feature_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê suas próprias permissões + super_admin/gerente vê todas
CREATE POLICY user_feature_permissions_select
  ON public.user_feature_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

-- INSERT/UPDATE/DELETE: só super_admin ou gerente
CREATE POLICY user_feature_permissions_insert
  ON public.user_feature_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

CREATE POLICY user_feature_permissions_update
  ON public.user_feature_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

CREATE POLICY user_feature_permissions_delete
  ON public.user_feature_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'gerente')
    )
  );

-- ─── Trigger para updated_at ───
CREATE OR REPLACE FUNCTION public.user_feature_permissions_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_feature_permissions_touch_updated_at_trg
  ON public.user_feature_permissions;
CREATE TRIGGER user_feature_permissions_touch_updated_at_trg
  BEFORE UPDATE ON public.user_feature_permissions
  FOR EACH ROW EXECUTE FUNCTION public.user_feature_permissions_touch_updated_at();

COMMENT ON TABLE public.user_feature_permissions IS
  'Permissões granulares por feature. Atendentes (role user) recebem feature por feature; gerente/super_admin têm tudo por padrão (pode-se revogar gerente via row can_edit=false).';
