-- =============================================================================
-- F1.6 — RPC pause_user_notifications
-- Permissão: super_admin pausa qualquer um. gerente só pausa quem é do mesmo dept.
-- _until = NULL reativa (limpa todos os campos de pause).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pause_user_notifications(
  _target_user_id UUID,
  _until TIMESTAMPTZ,
  _reason TEXT DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_super_admin BOOLEAN;
  v_is_gerente BOOLEAN;
  v_shares_dept BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'target_required');
  END IF;

  v_is_super_admin := public.is_super_admin(v_caller);

  IF NOT v_is_super_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'gerente'
    ) INTO v_is_gerente;

    IF NOT v_is_gerente THEN
      RETURN jsonb_build_object('error', 'forbidden');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.department_members dm1
      JOIN public.department_members dm2 ON dm1.department_id = dm2.department_id
      WHERE dm1.user_id = v_caller
        AND dm2.user_id = _target_user_id
    ) INTO v_shares_dept;

    IF NOT v_shares_dept THEN
      RETURN jsonb_build_object('error', 'forbidden_cross_dept');
    END IF;
  END IF;

  UPDATE public.user_profiles SET
    notifications_paused_until = _until,
    notifications_paused_by_user_id = CASE WHEN _until IS NULL THEN NULL ELSE v_caller END,
    notifications_paused_at = CASE WHEN _until IS NULL THEN NULL ELSE now() END,
    notifications_paused_reason = CASE WHEN _until IS NULL THEN NULL ELSE _reason END
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'paused_until', _until,
    'reactivated', _until IS NULL
  );
END $$;

REVOKE ALL ON FUNCTION public.pause_user_notifications(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_user_notifications(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON FUNCTION public.pause_user_notifications IS
  'Pausa (ou reativa) notificações de handoff pro vendedor _target_user_id. _until=NULL reativa. Permissão: super_admin ou gerente do mesmo dept.';
