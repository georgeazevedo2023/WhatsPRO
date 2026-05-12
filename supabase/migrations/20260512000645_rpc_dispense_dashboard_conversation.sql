-- Dashboard F3.1: dispensar conversa das listas de pendência (botão limpar)
-- Tag dashboard:dispensed esconde do dashboard sem arquivar a conversa.

CREATE OR REPLACE FUNCTION public.dispense_conversation_from_dashboard(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET tags = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(tags, '{}'::text[]) || ARRAY['dashboard:dispensed']
      )
    )
  ),
  updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_conversation_to_dashboard(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET tags = array_remove(COALESCE(tags, '{}'::text[]), 'dashboard:dispensed'),
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispense_conversation_from_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_conversation_to_dashboard(uuid) TO authenticated;
COMMENT ON FUNCTION public.dispense_conversation_from_dashboard IS 'Dashboard F3.1: adiciona tag dashboard:dispensed para esconder a conversa das listas de pendência.';
COMMENT ON FUNCTION public.restore_conversation_to_dashboard IS 'Dashboard F3.1: remove tag dashboard:dispensed (undo do dispense).';

-- Atualiza as 3 RPCs de pendência pra filtrar OUT dashboard:dispensed
CREATE OR REPLACE FUNCTION public.get_unanswered_first_messages(
  p_instance_id text,
  p_days_lookback int DEFAULT 30
)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  first_incoming_at timestamptz,
  hours_waiting numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH instance_inboxes AS (SELECT id FROM public.inboxes WHERE instance_id = p_instance_id),
candidate_convs AS (
  SELECT cm.conversation_id,
    MIN(cm.created_at) FILTER (WHERE cm.direction = 'incoming') AS first_in_at,
    COUNT(*) FILTER (WHERE cm.direction = 'outgoing') AS out_count
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND COALESCE(c.archived, false) = false
    AND NOT ('dashboard:dispensed' = ANY(c.tags))
    AND cm.created_at >= now() - (p_days_lookback || ' days')::interval
  GROUP BY cm.conversation_id
)
SELECT cc.conversation_id, c.contact_id, ct.name, ct.phone, cc.first_in_at,
  ROUND(EXTRACT(EPOCH FROM (now() - cc.first_in_at)) / 3600.0, 1)::numeric
FROM candidate_convs cc
JOIN public.conversations c ON c.id = cc.conversation_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id
WHERE cc.out_count = 0 AND cc.first_in_at IS NOT NULL
ORDER BY cc.first_in_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_abandoned_conversations(
  p_instance_id text,
  p_hours_threshold int DEFAULT 24
)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  last_incoming_at timestamptz,
  hours_waiting numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH instance_inboxes AS (SELECT id FROM public.inboxes WHERE instance_id = p_instance_id),
last_msg AS (
  SELECT DISTINCT ON (cm.conversation_id) cm.conversation_id, cm.direction, cm.created_at
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND COALESCE(c.archived, false) = false
    AND NOT ('dashboard:dispensed' = ANY(c.tags))
  ORDER BY cm.conversation_id, cm.created_at DESC
)
SELECT lm.conversation_id, c.contact_id, ct.name, ct.phone, lm.created_at,
  ROUND(EXTRACT(EPOCH FROM (now() - lm.created_at)) / 3600.0, 1)::numeric
FROM last_msg lm
JOIN public.conversations c ON c.id = lm.conversation_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id
WHERE lm.direction = 'incoming'
  AND lm.created_at < now() - (p_hours_threshold || ' hours')::interval
ORDER BY lm.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_active_quotes(
  p_instance_id text
)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  assigned_to uuid,
  last_message_at timestamptz,
  hours_since_last_msg numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH instance_inboxes AS (SELECT id FROM public.inboxes WHERE instance_id = p_instance_id)
SELECT c.id, c.contact_id, ct.name, ct.phone, c.assigned_to, c.last_message_at,
  ROUND(EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 3600.0, 1)::numeric
FROM public.conversations c
LEFT JOIN public.contacts ct ON ct.id = c.contact_id
WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
  AND COALESCE(c.archived, false) = false
  AND 'motivo:orcamento' = ANY(c.tags)
  AND NOT ('venda:fechada' = ANY(c.tags))
  AND NOT ('venda:perdida' = ANY(c.tags))
  AND NOT ('dashboard:dispensed' = ANY(c.tags))
ORDER BY c.last_message_at DESC;
$$;
