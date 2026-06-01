-- =============================================================================
-- Dashboard de Fila "Sem atendimento" (v7.63.1, 2026-06-01)
--
-- Inverte a ordenação de get_unattended_handoff_leads: ASC (mais antigo primeiro)
-- → DESC (mais RECENTE primeiro). Pedido do dono: listar do transbordo mais
-- recente pro mais antigo por default. Bônus de robustez: como o resultado é
-- limitado a 200, o DESC garante que o cap guarda os 200 leads MAIS RECENTES
-- (os mais acionáveis) em vez dos 200 mais antigos.
--
-- A ordenação/filtro interativos (sort + por atendente) são client-side no
-- UnattendedLeadsTab; esta mudança só ajusta o default e o comportamento do cap.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_unattended_handoff_leads(
  p_instance_id         text,
  p_min_minutes_waiting integer DEFAULT 3,
  p_max_age_hours       integer DEFAULT 72
)
RETURNS TABLE (
  conversation_id     uuid,
  contact_name        text,
  contact_phone       text,
  contact_avatar_url  text,
  inbox_id            uuid,
  department_id       uuid,
  assigned_to         uuid,
  assignee_name       text,
  assignee_avatar_url text,
  assigned_at         timestamptz,
  last_message        text,
  last_message_at     timestamptz,
  seconds_waiting     integer,
  queue_event_active  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_gerente(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: requires super_admin or gerente';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    COALESCE(ct.name, 'Sem nome'),
    ct.phone,
    ct.profile_pic_url,
    c.inbox_id,
    c.department_id,
    c.assigned_to,
    up.full_name,
    up.avatar_url,
    c.assigned_at,
    c.last_message,
    c.last_message_at,
    GREATEST(0, extract(epoch FROM (now() - c.assigned_at)))::int,
    EXISTS (
      SELECT 1 FROM handoff_queue_events hqe
      WHERE hqe.conversation_id = c.id AND hqe.status = 'active'
    )
  FROM conversations c
  JOIN inboxes i        ON i.id = c.inbox_id
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN user_profiles up ON up.id = c.assigned_to
  WHERE i.instance_id = p_instance_id
    AND c.status_ia = 'shadow'
    AND c.assigned_to IS NOT NULL
    AND c.assigned_at IS NOT NULL
    AND COALESCE(c.archived, false) = false
    AND COALESCE(c.status, '') <> 'resolvida'
    AND c.assigned_at <= now() - make_interval(mins => GREATEST(0, p_min_minutes_waiting))
    AND (p_max_age_hours <= 0
         OR c.assigned_at >= now() - make_interval(hours => p_max_age_hours))
    AND NOT EXISTS (
      SELECT 1 FROM conversation_messages m
      WHERE m.conversation_id = c.id
        AND m.direction = 'outgoing'
        AND m.created_at > c.assigned_at
        AND (
          m.sender_id IS NOT NULL
          OR (
            m.sender_id IS NULL
            AND m.created_at > c.assigned_at + interval '90 seconds'
            AND (m.external_id IS NULL
                 OR (m.external_id NOT LIKE 'queue_oof_%'
                     AND m.external_id NOT LIKE 'abandon_%'))
          )
        )
    )
  ORDER BY c.assigned_at DESC   -- mais recente primeiro (era ASC)
  LIMIT 200;
END;
$$;
