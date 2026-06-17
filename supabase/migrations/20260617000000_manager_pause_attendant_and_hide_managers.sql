-- =============================================================================
-- Gestor pausa/despausa atendentes + esconde gestores da lista de atendentes
-- (2026-06-17)
--
-- Pedido do dono na aba "Atendentes" do /dashboard/fila:
--   1. Poder PAUSAR/DESPAUSAR cada atendente direto do painel do gestor.
--   2. Tirar os GESTORES (Josafá/Michelly/Televendas, role=gerente) da lista —
--      eles são gestores, não atendentes.
--
-- Três mudanças (aditivas/behavior-preserving pros dados atuais):
--   A) set_queue_paused_for_user — RPC nova, gêmea de set_my_queue_paused, mas
--      mira um user-alvo, exige papel de gestor (super_admin || gerente) E é
--      ESCOPADA POR INSTÂNCIA (multi-tenant: o gestor só pausa quem é membro da
--      fila da instância informada; espelha o gate de manager_reassign_conversation).
--   B) get_queue_attendant_stats — refina is_manager: gestor que NÃO atende a fila
--      desta instância (gestor_in_queue=false) é gestor; gestor com
--      gestor_in_queue=true ENTRA na rotação (pick_next_assignee) e portanto conta
--      como atendente (is_manager=false) — some o resíduo de UI sem esconder quem
--      realmente atende.
--   C) get_queue_live_status — exclui das contagens Disponíveis/Pausados os mesmos
--      gestores-que-não-atendem, pro header bater com os cards.
--
-- Padrão herdado de 20260528000000 / 20260531000000 / 20260612000000:
--   SECURITY DEFINER + SET search_path=public + GRANT authenticated.
-- =============================================================================

-- A) PAUSAR/DESPAUSAR ATENDENTE PELO GESTOR (escopado por instância) -----------
-- Espelha set_my_queue_paused (mesma forma de retorno jsonb {rows_affected,
-- paused, user_id}). Diferenças: alvo explícito + gate de papel + ESCOPO de
-- instância. O UPDATE só toca os department_members do alvo cujas departments
-- pertencem à instância informada (dept_ids) — assim um gestor não mexe na fila
-- de OUTRA instância via user_id "cego", e a disponibilidade fica governada por
-- quem tem autoridade naquela instância. rows_affected=0 quando o alvo não é
-- membro de fila dessa instância → a UI mostra erro (sem pausa fantasma).
CREATE OR REPLACE FUNCTION public.set_queue_paused_for_user(
  p_user_id     uuid,
  p_instance_id text,
  p_paused      boolean,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_rows   integer;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated', 'rows_affected', 0);
  END IF;
  IF NOT (public.is_super_admin(v_actor) OR public.is_gerente(v_actor)) THEN
    RAISE EXCEPTION 'forbidden: requires super_admin or gerente';
  END IF;

  v_reason := CASE WHEN p_paused
                   THEN COALESCE(p_reason, 'Pausado pelo gestor no painel')
                   ELSE NULL END;

  WITH dept_ids AS (
    SELECT d.id
    FROM departments d
    JOIN inboxes i ON i.id = d.inbox_id
    WHERE i.instance_id = p_instance_id
  )
  UPDATE public.department_members dm
     SET queue_paused = p_paused,
         queue_paused_reason = v_reason
   WHERE dm.user_id = p_user_id
     AND dm.department_id IN (SELECT id FROM dept_ids);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('error', 'not_a_queue_member', 'rows_affected', 0, 'user_id', p_user_id);
  END IF;
  RETURN jsonb_build_object('rows_affected', v_rows, 'paused', p_paused, 'user_id', p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_queue_paused_for_user(uuid, text, boolean, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_queue_paused_for_user(uuid, text, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.set_queue_paused_for_user(uuid, text, boolean, text) IS
  'Gestor pausa/despausa um atendente na fila de UMA instância (escopo dept_ids). Gate super_admin||gerente. Espelha set_my_queue_paused.';


-- B) STATS POR ATENDENTE — is_manager respeita gestor_in_queue -----------------
-- DROP+CREATE não é necessário (colunas inalteradas) — só muda a expressão de
-- is_manager. Gestor que ENTROU na fila (gestor_in_queue=true em algum dept desta
-- instância) deixa de ser "manager" pra UI → aparece como atendente coerente com
-- a rotação. Gestor que não atende segue is_manager=true (some dos cards).
CREATE OR REPLACE FUNCTION public.get_queue_attendant_stats(p_instance_id text, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  queue_paused boolean,
  queue_position integer,
  received bigint,
  responded bigint,
  timed_out bigint,
  manual_override bigint,
  cancelled bigint,
  active bigint,
  avg_response_seconds integer,
  is_manager boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH dept_ids AS (
    SELECT d.id
    FROM departments d
    JOIN inboxes i ON i.id = d.inbox_id
    WHERE i.instance_id = p_instance_id
  ),
  members AS (
    SELECT DISTINCT
      dm.user_id,
      dm.queue_paused,
      dm.queue_position,
      up.full_name,
      up.avatar_url
    FROM department_members dm
    JOIN dept_ids d ON d.id = dm.department_id
    LEFT JOIN user_profiles up ON up.id = dm.user_id
  ),
  ev AS (
    SELECT
      hqe.assigned_user_id AS user_id,
      count(*)                                                                   AS received,
      count(*) FILTER (WHERE hqe.status = 'responded')                           AS responded,
      count(*) FILTER (WHERE hqe.status = 'timed_out')                           AS timed_out,
      count(*) FILTER (WHERE hqe.status = 'manual_override')                     AS manual_override,
      count(*) FILTER (WHERE hqe.status = 'cancelled')                           AS cancelled,
      count(*) FILTER (WHERE hqe.status = 'active')                              AS active,
      avg(extract(epoch FROM (hqe.resolved_at - hqe.created_at)))
          FILTER (WHERE hqe.status = 'responded' AND hqe.resolved_at IS NOT NULL)
        AS avg_response_seconds_num
    FROM handoff_queue_events hqe
    WHERE hqe.department_id IN (SELECT id FROM dept_ids)
      AND hqe.created_at >= p_from
      AND hqe.created_at <  p_to
      AND hqe.assigned_user_id IS NOT NULL
    GROUP BY hqe.assigned_user_id
  )
  SELECT
    m.user_id,
    COALESCE(m.full_name, 'Sem nome'),
    m.avatar_url,
    COALESCE(m.queue_paused, false),
    COALESCE(m.queue_position, 999999),
    COALESCE(ev.received, 0),
    COALESCE(ev.responded, 0),
    COALESCE(ev.timed_out, 0),
    COALESCE(ev.manual_override, 0),
    COALESCE(ev.cancelled, 0),
    COALESCE(ev.active, 0),
    COALESCE(ev.avg_response_seconds_num::int, 0),
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = m.user_id AND ur.role IN ('gerente', 'super_admin')
      )
      -- ...mas só conta como gestor se NÃO entrou na fila desta instância.
      AND NOT EXISTS (
        SELECT 1 FROM department_members dmq
        JOIN dept_ids di ON di.id = dmq.department_id
        WHERE dmq.user_id = m.user_id
          AND COALESCE(dmq.gestor_in_queue, false) = true
      )
    ) AS is_manager
  FROM members m
  LEFT JOIN ev ON ev.user_id = m.user_id
  ORDER BY received DESC, m.full_name ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_queue_attendant_stats(text, timestamptz, timestamptz) TO authenticated, service_role;


-- C) HEADER LIVE — contagens sem gestores-que-não-atendem ----------------------
-- Mesma assinatura. Exclui das contagens quem é gestor E não tem gestor_in_queue
-- na linha (espelha o is_manager refinado dos cards).
CREATE OR REPLACE FUNCTION public.get_queue_live_status(p_instance_id text)
RETURNS TABLE (
  active_count     bigint,
  available_count  bigint,
  paused_count     bigint,
  avg_wait_seconds integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dept_ids AS (
    SELECT d.id
    FROM departments d
    JOIN inboxes i ON i.id = d.inbox_id
    WHERE i.instance_id = p_instance_id
  ),
  active_ev AS (
    SELECT
      count(*) AS active_count,
      avg(extract(epoch FROM (now() - created_at)))::int AS avg_wait
    FROM handoff_queue_events
    WHERE department_id IN (SELECT id FROM dept_ids) AND status = 'active'
  ),
  members AS (
    SELECT
      count(*) FILTER (WHERE NOT COALESCE(dm.queue_paused, false)) AS available,
      count(*) FILTER (WHERE COALESCE(dm.queue_paused, false))     AS paused
    FROM department_members dm
    WHERE dm.department_id IN (SELECT id FROM dept_ids)
      -- Gestor que não atende a fila não conta (espelha is_manager dos cards).
      AND NOT (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = dm.user_id AND ur.role IN ('gerente', 'super_admin')
        )
        AND NOT COALESCE(dm.gestor_in_queue, false)
      )
  )
  SELECT
    COALESCE((SELECT active_count FROM active_ev), 0),
    COALESCE((SELECT available FROM members), 0),
    COALESCE((SELECT paused FROM members), 0),
    COALESCE((SELECT avg_wait FROM active_ev), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_live_status(text) TO authenticated;
