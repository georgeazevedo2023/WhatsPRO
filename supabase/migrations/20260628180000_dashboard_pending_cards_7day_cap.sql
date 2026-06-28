-- Dashboard do Gestor — teto de recência de 7 dias nos cards de Atendimento (v7.101.0)
-- Decisão do dono: os cards "act now" devem mostrar só o que é RECENTE (últimos 7 dias),
-- não o backlog de 38-39 dias (ex.: "Sem resposta há +24h" tinha 282 pendentes antigos).
-- Mesma assinatura (CREATE OR REPLACE) — só adiciona uma condição de recência ao WHERE.
-- "Sem 1ª resposta ao lead" (get_unanswered_first_messages) já tem p_days_lookback → o
-- hook passa 7 (sem mudar a função).

-- 1) Sem resposta há +24h
CREATE OR REPLACE FUNCTION public.get_abandoned_conversations(p_instance_id text, p_hours_threshold integer DEFAULT 24)
 RETURNS TABLE(conversation_id uuid, contact_id uuid, contact_name text, contact_phone text, last_incoming_at timestamp with time zone, hours_waiting numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH instance_inboxes AS (
  SELECT id FROM public.inboxes WHERE instance_id = p_instance_id
),
last_msg AS (
  SELECT DISTINCT ON (cm.conversation_id)
    cm.conversation_id, cm.direction, cm.created_at
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND COALESCE(c.archived, false) = false
    AND NOT ('dashboard:dispensed' = ANY(c.tags))
  ORDER BY cm.conversation_id, cm.created_at DESC
)
SELECT
  lm.conversation_id,
  c.contact_id,
  ct.name AS contact_name,
  ct.phone AS contact_phone,
  lm.created_at AS last_incoming_at,
  ROUND(EXTRACT(EPOCH FROM (now() - lm.created_at)) / 3600.0, 1)::numeric AS hours_waiting
FROM last_msg lm
JOIN public.conversations c ON c.id = lm.conversation_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id
WHERE lm.direction = 'incoming'
  AND lm.created_at < now() - (p_hours_threshold || ' hours')::interval
  AND lm.created_at >= now() - interval '7 days'   -- teto de recência (últimos 7 dias)
ORDER BY lm.created_at ASC;
$function$;

-- 2) Sem resposta há +30min (SLA) — SECURITY DEFINER preservado
CREATE OR REPLACE FUNCTION public.dash_sla_sem_resposta(p_instance_id text, p_threshold_in_minutes integer DEFAULT 30)
 RETURNS TABLE(conversation_id uuid, contact_name text, contact_phone text, primeira_msg timestamp with time zone, minutos_sem_resposta integer, status_ia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH primeira AS (
    SELECT cm.conversation_id,
      MIN(cm.created_at) FILTER (WHERE cm.direction = 'incoming') AS primeira_in,
      MIN(cm.created_at) FILTER (WHERE cm.direction = 'outgoing') AS primeira_out
    FROM public.conversation_messages cm
    JOIN public.conversations c ON c.id = cm.conversation_id
    JOIN public.inboxes i ON i.id = c.inbox_id
    WHERE i.instance_id = p_instance_id
    GROUP BY cm.conversation_id
  )
  SELECT p.conversation_id, co.name, co.phone, p.primeira_in,
    (EXTRACT(EPOCH FROM (NOW() - p.primeira_in))::integer / 60), c.status_ia
  FROM primeira p
  JOIN public.conversations c ON c.id = p.conversation_id
  JOIN public.contacts co ON co.id = c.contact_id
  WHERE p.primeira_in IS NOT NULL
    AND (p.primeira_out IS NULL OR p.primeira_out < p.primeira_in)
    AND NOW() - p.primeira_in > (p_threshold_in_minutes || ' minutes')::interval
    AND p.primeira_in >= now() - interval '7 days'   -- teto de recência (últimos 7 dias)
    AND c.archived = false
  ORDER BY p.primeira_in ASC LIMIT 100;
$function$;

-- 3) Cotações em andamento
CREATE OR REPLACE FUNCTION public.get_active_quotes(p_instance_id text)
 RETURNS TABLE(conversation_id uuid, contact_id uuid, contact_name text, contact_phone text, assigned_to uuid, last_message_at timestamp with time zone, hours_since_last_msg numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH instance_inboxes AS (
  SELECT id FROM public.inboxes WHERE instance_id = p_instance_id
)
SELECT
  c.id AS conversation_id,
  c.contact_id,
  ct.name AS contact_name,
  ct.phone AS contact_phone,
  c.assigned_to,
  c.last_message_at,
  ROUND(EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 3600.0, 1)::numeric AS hours_since_last_msg
FROM public.conversations c
LEFT JOIN public.contacts ct ON ct.id = c.contact_id
WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
  AND COALESCE(c.archived, false) = false
  AND 'motivo:orcamento' = ANY(c.tags)
  AND NOT ('venda:fechada' = ANY(c.tags))
  AND NOT ('venda:perdida' = ANY(c.tags))
  AND NOT ('dashboard:dispensed' = ANY(c.tags))
  AND c.last_message_at >= now() - interval '7 days'   -- teto de recência (últimos 7 dias)
ORDER BY c.last_message_at DESC;
$function$;
