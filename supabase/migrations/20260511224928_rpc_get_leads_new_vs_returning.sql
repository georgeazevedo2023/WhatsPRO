-- Dashboard do Gestor F1: leads novos vs recorrentes por dia
-- Novo = primeira conversa do contato com a instância caiu dentro do período
-- Recorrente = contato já tinha conversa anterior ao período E voltou no período
CREATE OR REPLACE FUNCTION public.get_leads_new_vs_returning(
  p_instance_id text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  day date,
  novos bigint,
  recorrentes bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH instance_inboxes AS (
  SELECT id FROM public.inboxes WHERE instance_id = p_instance_id
),
contact_first_conv AS (
  SELECT c.contact_id, MIN(c.created_at) AS first_conv_at
  FROM public.conversations c
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND c.contact_id IS NOT NULL
  GROUP BY c.contact_id
),
contact_period_activity AS (
  SELECT c.contact_id, MIN(c.last_message_at) AS period_activity_at
  FROM public.conversations c
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND c.contact_id IS NOT NULL
    AND c.last_message_at >= p_start
    AND c.last_message_at < p_end
  GROUP BY c.contact_id
)
SELECT
  cpa.period_activity_at::date AS day,
  COUNT(*) FILTER (WHERE cfc.first_conv_at >= p_start)::bigint AS novos,
  COUNT(*) FILTER (WHERE cfc.first_conv_at <  p_start)::bigint AS recorrentes
FROM contact_period_activity cpa
JOIN contact_first_conv cfc ON cfc.contact_id = cpa.contact_id
GROUP BY cpa.period_activity_at::date
ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.get_leads_new_vs_returning(text, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_leads_new_vs_returning IS 'Dashboard do gestor: série diária de leads novos (primeira conversa no período) vs recorrentes (já existiam antes).';
