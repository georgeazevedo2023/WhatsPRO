-- Dashboard F3: leads cuja PRIMEIRA mensagem nunca foi respondida
-- (≥1 incoming, ZERO outgoing na conversa inteira)
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
GRANT EXECUTE ON FUNCTION public.get_unanswered_first_messages(text, int) TO authenticated;
COMMENT ON FUNCTION public.get_unanswered_first_messages IS 'Dashboard gestor F3: conversas com mensagem do lead que NUNCA foram respondidas (zero outgoing).';
