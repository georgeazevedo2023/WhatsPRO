-- Funil de conversão opção C (decisão do dono 2026-06-11):
-- 5 etapas contact → qualification → intention → handoff → conversion,
-- derivadas das TAGS DURÁVEIS da conversa (não mais do shadow extracted_data.tags,
-- que é JSON livre sem array tags — funil ficou 2 meses zerado).
-- + Conversão por origem lê eventos reais (tag 'venda:fechada' nunca existiu)
-- + tempo de resolução usa resolved_at real (não o proxy updated_at).

-- 1) Etapa 'handoff' no CHECK do funil
ALTER TABLE public.conversion_funnel_events
  DROP CONSTRAINT IF EXISTS conversion_funnel_events_stage_check;
ALTER TABLE public.conversion_funnel_events
  ADD CONSTRAINT conversion_funnel_events_stage_check
  CHECK (stage = ANY (ARRAY['contact'::text, 'qualification'::text, 'intention'::text, 'handoff'::text, 'conversion'::text]));

-- 2) Backfill resolved_at faltante (conversas resolvidas antes do drawer gravar)
UPDATE public.conversations
SET resolved_at = updated_at
WHERE status = 'resolvida' AND resolved_at IS NULL;

-- 3) get_conversion_by_origin: fechadas = leads com evento stage='conversion'
--    (antes: tag 'venda:fechada' em lead_profiles.tags — vocabulário que nunca existiu)
CREATE OR REPLACE FUNCTION public.get_conversion_by_origin(p_instance_id text, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(origin text, total_leads bigint, fechadas bigint, conversion_pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH leads_period AS (
  SELECT
    lead_id,
    COALESCE(origin, 'direto') AS origin
  FROM public.v_lead_metrics
  WHERE instance_id = p_instance_id
    AND lead_created_at >= p_start
    AND lead_created_at <  p_end
),
converted AS (
  SELECT DISTINCT lead_id
  FROM public.conversion_funnel_events
  WHERE instance_id = p_instance_id
    AND stage = 'conversion'
)
SELECT
  lp.origin,
  COUNT(*)::bigint AS total_leads,
  COUNT(*) FILTER (WHERE cv.lead_id IS NOT NULL)::bigint AS fechadas,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE cv.lead_id IS NOT NULL) / COUNT(*), 1)::numeric
    ELSE 0::numeric
  END AS conversion_pct
FROM leads_period lp
LEFT JOIN converted cv ON cv.lead_id = lp.lead_id
GROUP BY lp.origin
ORDER BY total_leads DESC;
$function$;

-- 4) v_vendor_activity: tempo de resolução com resolved_at real (fallback updated_at)
CREATE OR REPLACE VIEW public.v_vendor_activity AS
SELECT ib.instance_id,
    conv.assigned_to AS seller_id,
    date(conv.updated_at) AS activity_date,
    count(DISTINCT conv.id) AS conversations_handled,
    count(DISTINCT
        CASE
            WHEN conv.status = 'resolvida'::text THEN conv.id
            ELSE NULL::uuid
        END) AS resolved_count,
    count(DISTINCT
        CASE
            WHEN conv.status = 'pendente'::text THEN conv.id
            ELSE NULL::uuid
        END) AS pending_count,
    round(avg(
        CASE
            WHEN conv.status = 'resolvida'::text THEN EXTRACT(epoch FROM COALESCE(conv.resolved_at, conv.updated_at) - conv.created_at) / 60::numeric
            ELSE NULL::numeric
        END), 1) AS avg_resolution_minutes,
    count(DISTINCT ct.id) AS unique_contacts
   FROM conversations conv
     JOIN inboxes ib ON ib.id = conv.inbox_id
     JOIN contacts ct ON ct.id = conv.contact_id
  WHERE conv.assigned_to IS NOT NULL
  GROUP BY ib.instance_id, conv.assigned_to, (date(conv.updated_at));

-- 5) v_handoff_details: idem
CREATE OR REPLACE VIEW public.v_handoff_details AS
SELECT ib.instance_id,
    al.conversation_id,
    conv.assigned_to AS seller_id,
    al.created_at AS handoff_at,
    conv.created_at AS conversation_started_at,
    round(EXTRACT(epoch FROM al.created_at - conv.created_at) / 60::numeric, 1) AS minutes_before_handoff,
    al.metadata ->> 'reason'::text AS handoff_reason,
    al.metadata ->> 'trigger'::text AS handoff_trigger,
        CASE
            WHEN (al.metadata ->> 'trigger'::text) = ANY (ARRAY['lead_asked'::text, 'buy_confirm'::text, 'lead_request'::text]) THEN false
            ELSE true
        END AS evitavel,
        CASE
            WHEN conv.status = 'resolvida'::text THEN round(EXTRACT(epoch FROM COALESCE(conv.resolved_at, conv.updated_at) - al.created_at) / 60::numeric, 1)
            ELSE NULL::numeric
        END AS minutes_to_resolve_after_handoff,
    conv.status AS conversation_status,
        CASE
            WHEN conv.status = 'resolvida'::text THEN true
            ELSE false
        END AS converteu
   FROM ai_agent_logs al
     JOIN conversations conv ON conv.id = al.conversation_id
     JOIN inboxes ib ON ib.id = conv.inbox_id
  WHERE al.event = ANY (ARRAY['handoff'::text, 'handoff_to_human'::text, 'handoff_trigger'::text]);
