-- v7.87.0 (2026-06-12): drawer "Reatribuir atendimento" mostrava GESTORES
-- (Josafá/Michelly, role=gerente) como candidatos a receber o lead.
-- O RPC devolve TODOS os membros do departamento DE PROPÓSITO (os cards de stats
-- do dashboard precisam de todo mundo); pra UI distinguir quem pode RECEBER
-- atendimento, expõe `is_manager` (user_roles gerente/super_admin — EXISTS cobre
-- usuário com múltiplas roles). O filtro fica no front (drawer), cards intactos.
-- DROP+CREATE porque RETURNS TABLE não aceita coluna nova via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.get_queue_attendant_stats(text, timestamptz, timestamptz);

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
  -- TODOS os membros (inclui gestor) das departments do tenant. Source of truth pros cards
  -- (mesmo quem ainda não recebeu evento no período aparece, com zeros).
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
  -- Eventos agregados por user dentro do período.
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
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = m.user_id AND ur.role IN ('gerente', 'super_admin')
    ) AS is_manager
  FROM members m
  LEFT JOIN ev ON ev.user_id = m.user_id
  ORDER BY received DESC, m.full_name ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_queue_attendant_stats(text, timestamptz, timestamptz) TO authenticated, service_role;
