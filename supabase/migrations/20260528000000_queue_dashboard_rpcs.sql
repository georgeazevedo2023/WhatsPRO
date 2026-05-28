-- v7.57.x — Dashboard de Fila do Gestor
--
-- 3 RPCs SECURITY DEFINER pra alimentar /dashboard/fila:
--  1. get_queue_attendant_stats(p_instance_id, p_from, p_to) — stats por atendente no período
--  2. get_queue_live_status(p_instance_id)                  — snapshot atual da fila (header)
--  3. get_queue_lost_leads(p_instance_id, p_user_id, p_from, p_to) — drill-down dos perdidos
--
-- Dados: handoff_queue_events (D30) × department_members × user_profiles × conversations.

CREATE OR REPLACE FUNCTION public.get_queue_attendant_stats(
  p_instance_id text,
  p_from        timestamptz,
  p_to          timestamptz
)
RETURNS TABLE (
  user_id         uuid,
  full_name       text,
  avatar_url      text,
  queue_paused    boolean,
  queue_position  integer,
  received        bigint,
  responded       bigint,
  timed_out       bigint,
  manual_override bigint,
  cancelled       bigint,
  active          bigint,
  avg_response_seconds integer
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
    COALESCE(ev.avg_response_seconds_num::int, 0)
  FROM members m
  LEFT JOIN ev ON ev.user_id = m.user_id
  ORDER BY received DESC, m.full_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_attendant_stats(text, timestamptz, timestamptz) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_queue_live_status(p_instance_id text)
RETURNS TABLE (
  active_count          bigint,
  available_count       bigint,
  paused_count          bigint,
  avg_wait_seconds      integer
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
      count(*) FILTER (WHERE NOT COALESCE(queue_paused, false)) AS available,
      count(*) FILTER (WHERE COALESCE(queue_paused, false))     AS paused
    FROM department_members
    WHERE department_id IN (SELECT id FROM dept_ids)
  )
  SELECT
    COALESCE((SELECT active_count FROM active_ev), 0),
    COALESCE((SELECT available FROM members), 0),
    COALESCE((SELECT paused FROM members), 0),
    COALESCE((SELECT avg_wait FROM active_ev), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_live_status(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_queue_lost_leads(
  p_instance_id text,
  p_user_id     uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
RETURNS TABLE (
  conversation_id uuid,
  contact_name    text,
  contact_phone   text,
  status          text,
  lost_reason     text,
  next_assignee_name text,
  created_at      timestamptz,
  resolved_at     timestamptz
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
  )
  SELECT
    hqe.conversation_id,
    COALESCE(c.name, 'Sem nome'),
    c.phone,
    hqe.status,
    CASE
      WHEN hqe.status = 'timed_out'        THEN 'Tempo esgotado (não respondeu)'
      WHEN hqe.status = 'manual_override'  THEN 'Outro atendente assumiu'
      WHEN hqe.status = 'cancelled'        THEN 'Cancelado'
      ELSE hqe.status
    END,
    (SELECT up.full_name FROM handoff_queue_events hqe2
       JOIN user_profiles up ON up.id = hqe2.assigned_user_id
       WHERE hqe2.conversation_id = hqe.conversation_id
         AND hqe2.created_at > hqe.created_at
       ORDER BY hqe2.created_at ASC LIMIT 1),
    hqe.created_at,
    hqe.resolved_at
  FROM handoff_queue_events hqe
  LEFT JOIN conversations cv ON cv.id = hqe.conversation_id
  LEFT JOIN contacts c ON c.id = cv.contact_id
  WHERE hqe.department_id IN (SELECT id FROM dept_ids)
    AND hqe.assigned_user_id = p_user_id
    AND hqe.created_at >= p_from
    AND hqe.created_at <  p_to
    AND hqe.status IN ('timed_out', 'manual_override', 'cancelled')
  ORDER BY hqe.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_lost_leads(text, uuid, timestamptz, timestamptz) TO authenticated;
