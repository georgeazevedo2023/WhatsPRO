-- D30 Sprint A.6 — RPC pick_next_assignee
-- Round-robin atomico do departamento. SELECT FOR UPDATE no cursor de
-- departments.last_assignee_position previne race condition (R91 candidata).
--
-- Regras:
--   - Pula queue_paused = true (Q7: pause individual)
--   - Pula gerentes quando gestor_in_queue = false (Q6: gestor fora por default)
--   - Pula skip_user_ids (ex.: previous_assignee em re-handoff)
--   - Q4: loop infinito — se nao acha apos cursor, volta ao inicio
--   - Atualiza last_assignee_position com queue_position do escolhido
-- Retorna NULL quando nenhum membro elegivel (caller deve tocar sino do gestor).

CREATE OR REPLACE FUNCTION public.pick_next_assignee(
  _department_id UUID,
  _skip_user_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _last_pos INTEGER;
  _next_user UUID;
  _next_pos INTEGER;
  _skip UUID[] := COALESCE(_skip_user_ids, '{}'::uuid[]);
  -- Sentinela para NULLs em queue_position no ORDER BY (PG14 nao suporta NULLS LAST em index).
  _SENTINEL CONSTANT INTEGER := 2147483647;
BEGIN
  -- Trava o cursor do departamento (atomicidade — GAP-2)
  SELECT last_assignee_position INTO _last_pos
  FROM public.departments
  WHERE id = _department_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 1a tentativa: proximo membro apos o cursor
  SELECT dm.user_id, COALESCE(dm.queue_position, _SENTINEL)
    INTO _next_user, _next_pos
  FROM public.department_members dm
  WHERE dm.department_id = _department_id
    AND dm.queue_paused = false
    AND NOT (dm.user_id = ANY(_skip))
    AND (
      NOT public.has_role(dm.user_id, 'gerente'::public.app_role)
      OR dm.gestor_in_queue = true
    )
    AND COALESCE(dm.queue_position, _SENTINEL) > _last_pos
  ORDER BY COALESCE(dm.queue_position, _SENTINEL) ASC, dm.created_at ASC
  LIMIT 1;

  -- 2a tentativa: volta ao inicio (Q4 — loop infinito)
  IF _next_user IS NULL THEN
    SELECT dm.user_id, COALESCE(dm.queue_position, _SENTINEL)
      INTO _next_user, _next_pos
    FROM public.department_members dm
    WHERE dm.department_id = _department_id
      AND dm.queue_paused = false
      AND NOT (dm.user_id = ANY(_skip))
      AND (
        NOT public.has_role(dm.user_id, 'gerente'::public.app_role)
        OR dm.gestor_in_queue = true
      )
    ORDER BY COALESCE(dm.queue_position, _SENTINEL) ASC, dm.created_at ASC
    LIMIT 1;
  END IF;

  -- Atualiza cursor (idempotente: se NULL nao mexe)
  IF _next_user IS NOT NULL THEN
    UPDATE public.departments
       SET last_assignee_position = _next_pos,
           updated_at = now()
     WHERE id = _department_id;
  END IF;

  RETURN _next_user;
END;
$$;

-- Endpoint sensivel: edge functions usam service_role.
REVOKE EXECUTE ON FUNCTION public.pick_next_assignee(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_next_assignee(UUID, UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pick_next_assignee(UUID, UUID[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.pick_next_assignee(UUID, UUID[]) TO service_role;

COMMENT ON FUNCTION public.pick_next_assignee(UUID, UUID[]) IS
  'D30: Round-robin atomico (SELECT FOR UPDATE em departments cursor). Pula paused, gerente sem gestor_in_queue, skip_user_ids. Q4 loop infinito. Retorna NULL se nenhum membro elegivel.';
