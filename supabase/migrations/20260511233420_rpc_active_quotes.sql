-- Dashboard F3: cotações em andamento (tag motivo:orcamento sem venda:fechada/perdida)
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
ORDER BY c.last_message_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_quotes(text) TO authenticated;
COMMENT ON FUNCTION public.get_active_quotes IS 'Dashboard gestor F3: conversas com cotação em andamento (motivo:orcamento sem venda:fechada/perdida).';
