-- Fase 2 do Dashboard do Gestor — 4 métricas avançadas

-- 1) Tempo de 1ª resposta (P50 / P95 em segundos)
CREATE OR REPLACE FUNCTION public.get_response_time_percentiles(
  p_instance_id text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(p50_seconds numeric, p95_seconds numeric, sample_size bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH instance_inboxes AS (
  SELECT id FROM public.inboxes WHERE instance_id = p_instance_id
),
first_incoming AS (
  SELECT cm.conversation_id, MIN(cm.created_at) AS first_in_at
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.direction = 'incoming'
    AND c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND cm.created_at >= p_start
    AND cm.created_at <  p_end
  GROUP BY cm.conversation_id
),
first_response AS (
  SELECT fi.conversation_id, fi.first_in_at,
    (SELECT MIN(cm2.created_at) FROM public.conversation_messages cm2
     WHERE cm2.conversation_id = fi.conversation_id
       AND cm2.direction = 'outgoing'
       AND cm2.created_at > fi.first_in_at) AS first_out_at
  FROM first_incoming fi
),
deltas AS (
  SELECT EXTRACT(EPOCH FROM (first_out_at - first_in_at))::numeric AS dt
  FROM first_response WHERE first_out_at IS NOT NULL
)
SELECT
  COALESCE(percentile_cont(0.5)  WITHIN GROUP (ORDER BY dt), 0)::numeric,
  COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY dt), 0)::numeric,
  COUNT(*)::bigint
FROM deltas;
$$;
GRANT EXECUTE ON FUNCTION public.get_response_time_percentiles(text, timestamptz, timestamptz) TO authenticated;
COMMENT ON FUNCTION public.get_response_time_percentiles IS 'Dashboard gestor F2: P50/P95 do tempo entre 1ª msg do lead e 1ª resposta da casa (em segundos).';

-- 2) Conversas abandonadas (sem resposta há > N horas)
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
GRANT EXECUTE ON FUNCTION public.get_abandoned_conversations(text, int) TO authenticated;
COMMENT ON FUNCTION public.get_abandoned_conversations IS 'Dashboard gestor F2: conversas cuja última msg é do lead (incoming) e está sem resposta há > N horas.';

-- 3) Demanda vs cobertura por hora
CREATE OR REPLACE FUNCTION public.get_demand_vs_coverage_by_hour(
  p_instance_id text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(hour int, demand bigint, coverage bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH instance_inboxes AS (SELECT id FROM public.inboxes WHERE instance_id = p_instance_id),
agg AS (
  SELECT EXTRACT(HOUR FROM (cm.created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS h,
    COUNT(*) FILTER (WHERE cm.direction = 'incoming') AS demand,
    COUNT(*) FILTER (WHERE cm.direction = 'outgoing') AS coverage
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE c.inbox_id IN (SELECT id FROM instance_inboxes)
    AND cm.created_at >= p_start AND cm.created_at < p_end
  GROUP BY 1
),
hours AS (SELECT generate_series(0, 23) AS h)
SELECT hours.h::int, COALESCE(agg.demand, 0)::bigint, COALESCE(agg.coverage, 0)::bigint
FROM hours LEFT JOIN agg ON agg.h = hours.h ORDER BY hour;
$$;
GRANT EXECUTE ON FUNCTION public.get_demand_vs_coverage_by_hour(text, timestamptz, timestamptz) TO authenticated;
COMMENT ON FUNCTION public.get_demand_vs_coverage_by_hour IS 'Dashboard gestor F2: msgs incoming (demanda) vs outgoing (cobertura) por hora do dia (TZ America/Sao_Paulo).';

-- 4) Conversão por origem
CREATE OR REPLACE FUNCTION public.get_conversion_by_origin(
  p_instance_id text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(origin text, total_leads bigint, fechadas bigint, conversion_pct numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH leads_period AS (
  SELECT lead_id, COALESCE(origin, 'direto') AS origin, tags
  FROM public.v_lead_metrics
  WHERE instance_id = p_instance_id
    AND lead_created_at >= p_start AND lead_created_at < p_end
)
SELECT origin, COUNT(*)::bigint,
  COUNT(*) FILTER (WHERE tags ? 'venda:fechada' OR tags @> '["venda:fechada"]'::jsonb)::bigint,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE tags ? 'venda:fechada' OR tags @> '["venda:fechada"]'::jsonb) / COUNT(*), 1)::numeric
    ELSE 0::numeric END
FROM leads_period GROUP BY origin ORDER BY total_leads DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_conversion_by_origin(text, timestamptz, timestamptz) TO authenticated;
COMMENT ON FUNCTION public.get_conversion_by_origin IS 'Dashboard gestor F2: por origin, total de leads no período × leads com tag venda:fechada × taxa de conversão.';
