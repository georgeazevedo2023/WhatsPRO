-- =============================================================================
-- Dashboard do Gestor — "Sem atendimento" + Reatribuição (v7.63.0, 2026-05-31)
--
-- Estende a página /dashboard/fila (QueueDashboard) com:
--   1. get_unattended_handoff_leads — leads que a IA transbordou (status_ia='shadow')
--      e o atendente atribuído ainda NÃO respondeu.
--   2. manager_reassign_conversation — gestor reatribui um lead a outro atendente,
--      mantendo a fila coerente (resolve o evento de fila ativo).
--
-- Padrão herdado de 20260528000000_queue_dashboard_rpcs.sql:
--   SECURITY DEFINER + SET search_path=public + GRANT authenticated + multi-tenant
--   por inboxes.instance_id (text). Diferença: aqui há gate de papel explícito
--   (is_super_admin OU is_gerente) — get_unattended é leitura sensível e a
--   reatribuição é ESCRITA.
-- =============================================================================

-- 1) LEADS SEM ATENDIMENTO -----------------------------------------------------
-- Definição: transbordado p/ humano (status_ia='shadow'), com responsável
-- (assigned_to NOT NULL), conversa aberta, esperando há >= p_min_minutes_waiting,
-- atribuído nas últimas p_max_age_hours (0 = sem limite), e SEM resposta do
-- atendente desde o handoff.
--
-- p_max_age_hours (default 72h) foca em leads ACIONÁVEIS — handoffs antigos nunca
-- respondidos são leads frios (perdidos), não pendências de hoje.
--
-- "Resposta do atendente" = conversation_messages outgoing posterior ao handoff:
--   - sender_id NOT NULL  → atendente pelo Helpdesk web (conta na hora); ou
--   - sender_id NULL + created_at > assigned_at + 90s + não-sistema → takeover
--     pelo CELULAR (UAZAPI não traz id interno). A carência de 90s exclui a
--     mensagem-ponte do handoff (bot, sender_id NULL); o filtro de external_id
--     exclui OOF/abandono enviados por cron. private_note não conta (direction).
DROP FUNCTION IF EXISTS public.get_unattended_handoff_leads(text, integer);
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
          m.sender_id IS NOT NULL  -- atendente via Helpdesk web (imediato)
          OR (
            m.sender_id IS NULL
            AND m.created_at > c.assigned_at + interval '90 seconds'  -- exclui a ponte do handoff
            AND (m.external_id IS NULL
                 OR (m.external_id NOT LIKE 'queue_oof_%'
                     AND m.external_id NOT LIKE 'abandon_%'))          -- exclui cron OOF/abandono
          )
        )
    )
  ORDER BY c.assigned_at ASC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unattended_handoff_leads(text, integer, integer) TO authenticated;


-- 2) REATRIBUIR CONVERSA -------------------------------------------------------
-- Gestor reatribui um lead a outro atendente. Espelha src/lib/helpdeskBroadcast
-- › assignAgent (UPDATE assigned_to + evento ativo → manual_override), porém
-- server-side + role-gated: o gestor pode não ter RLS de UPDATE em conversations
-- de todos os inboxes; SECURITY DEFINER resolve.
--
-- NÃO mexe em status_ia (continua 'shadow' — o novo humano assume, IA passiva).
-- Reseta assigned_at = now() (o relógio do novo responsável começa agora).
-- Resolve o evento de fila ativo como 'manual_override' (não deixa stale apontando
-- pro atendente antigo + credita o stat "outro assumiu"). Se o novo responsável
-- também ignorar, o lead reaparece em get_unattended_handoff_leads — a aba é a
-- rede de segurança (não depende do evento de fila).
CREATE OR REPLACE FUNCTION public.manager_reassign_conversation(
  p_conversation_id uuid,
  p_assignee_id     uuid
)
RETURNS TABLE (assignee_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inbox_id    uuid;
  v_instance_id text;
  v_name        text;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_gerente(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: requires super_admin or gerente';
  END IF;

  SELECT c.inbox_id, i.instance_id
    INTO v_inbox_id, v_instance_id
  FROM conversations c
  JOIN inboxes i ON i.id = c.inbox_id
  WHERE c.id = p_conversation_id;

  IF v_inbox_id IS NULL THEN
    RAISE EXCEPTION 'conversation % not found', p_conversation_id;
  END IF;

  -- O novo responsável deve ser membro de fila (department_members) de algum
  -- departamento desta instância — mesmo conjunto mostrado no seletor da UI.
  IF NOT EXISTS (
    SELECT 1
    FROM department_members dm
    JOIN departments d ON d.id = dm.department_id
    JOIN inboxes ib    ON ib.id = d.inbox_id
    WHERE ib.instance_id = v_instance_id
      AND dm.user_id = p_assignee_id
  ) THEN
    RAISE EXCEPTION 'assignee % is not a queue member of this instance', p_assignee_id;
  END IF;

  UPDATE conversations
     SET assigned_to = p_assignee_id,
         assigned_at = now()
   WHERE id = p_conversation_id;

  UPDATE handoff_queue_events
     SET status = 'manual_override',
         resolved_at = now(),
         resolved_reason = 'manager_reassign'
   WHERE conversation_id = p_conversation_id
     AND status = 'active';

  SELECT up.full_name INTO v_name FROM user_profiles up WHERE up.id = p_assignee_id;
  RETURN QUERY SELECT COALESCE(v_name, 'atendente');
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_reassign_conversation(uuid, uuid) TO authenticated;
