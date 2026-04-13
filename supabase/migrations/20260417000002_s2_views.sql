-- =============================================================================
-- M19 S2: Views SQL — Métricas consultáveis por instância
-- T2: 6 views com instance_id obrigatório no filtro do chamador
-- Todas usam security_barrier para respeitar RLS das tabelas base
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- v_lead_metrics — métricas por lead com instance_id
-- Join: lead_profiles → contacts → conversations → inboxes (instance_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_lead_metrics
  WITH (security_barrier = true)
AS
SELECT
  lp.id                                            AS lead_id,
  ib.instance_id,
  lp.full_name,
  lp.origin,
  lp.current_score,
  lp.average_ticket,
  lp.tags,
  lp.metadata,
  COUNT(DISTINCT conv.id)                          AS total_conversations,
  MIN(conv.created_at)                             AS first_contact_at,
  MAX(conv.created_at)                             AS last_contact_at,
  COUNT(DISTINCT CASE WHEN conv.assigned_to IS NOT NULL THEN conv.id END) AS handoff_count,
  COUNT(DISTINCT CASE WHEN conv.status = 'resolved' THEN conv.id END)     AS resolved_count,
  lp.created_at                                    AS lead_created_at
FROM lead_profiles lp
JOIN contacts ct ON ct.id = lp.contact_id
LEFT JOIN conversations conv ON conv.contact_id = ct.id
LEFT JOIN inboxes ib ON ib.id = conv.inbox_id
GROUP BY
  lp.id, ib.instance_id, lp.full_name, lp.origin,
  lp.current_score, lp.average_ticket, lp.tags, lp.metadata, lp.created_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- v_vendor_activity — atividade diária por vendedor
-- Seller = conversations.assigned_to (auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_vendor_activity
  WITH (security_barrier = true)
AS
SELECT
  ib.instance_id,
  conv.assigned_to                                         AS seller_id,
  DATE(conv.updated_at)                                    AS activity_date,
  COUNT(DISTINCT conv.id)                                  AS conversations_handled,
  COUNT(DISTINCT CASE WHEN conv.status = 'resolved' THEN conv.id END) AS resolved_count,
  COUNT(DISTINCT CASE WHEN conv.status = 'pending' THEN conv.id END)  AS pending_count,
  ROUND(
    AVG(
      CASE WHEN conv.status = 'resolved'
        THEN EXTRACT(EPOCH FROM (conv.updated_at - conv.created_at)) / 60
      END
    )::NUMERIC, 1
  )                                                        AS avg_resolution_minutes,
  COUNT(DISTINCT ct.id)                                    AS unique_contacts
FROM conversations conv
JOIN inboxes ib ON ib.id = conv.inbox_id
JOIN contacts ct ON ct.id = conv.contact_id
WHERE conv.assigned_to IS NOT NULL
GROUP BY ib.instance_id, conv.assigned_to, DATE(conv.updated_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- v_handoff_details — detalhes de cada transbordo (motivo, tempo, pickup)
-- Fonte: ai_agent_logs onde event='handoff_to_human'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_handoff_details
  WITH (security_barrier = true)
AS
SELECT
  ib.instance_id,
  al.conversation_id,
  conv.assigned_to                                            AS seller_id,
  al.created_at                                               AS handoff_at,
  conv.created_at                                             AS conversation_started_at,
  ROUND(
    EXTRACT(EPOCH FROM (al.created_at - conv.created_at)) / 60, 1
  )                                                           AS minutes_before_handoff,
  al.metadata->>'reason'                                      AS handoff_reason,
  al.metadata->>'trigger'                                     AS handoff_trigger,
  CASE
    WHEN conv.status = 'resolved'
    THEN ROUND(
      EXTRACT(EPOCH FROM (conv.updated_at - al.created_at)) / 60, 1
    )
  END                                                         AS minutes_to_resolve_after_handoff,
  conv.status                                                 AS conversation_status
FROM ai_agent_logs al
JOIN conversations conv ON conv.id = al.conversation_id
JOIN inboxes ib ON ib.id = conv.inbox_id
WHERE al.event = 'handoff_to_human';

-- ─────────────────────────────────────────────────────────────────────────────
-- v_agent_performance — performance diária do agente IA por instância
-- Fonte: ai_agent_logs + ai_agents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_agent_performance
  WITH (security_barrier = true)
AS
SELECT
  ag.instance_id,
  DATE(al.created_at)                                                              AS activity_date,
  COUNT(CASE WHEN al.event = 'response_sent' THEN 1 END)                          AS responses_sent,
  COUNT(CASE WHEN al.event = 'handoff_to_human' THEN 1 END)                       AS handoffs,
  COUNT(CASE WHEN al.event = 'error' THEN 1 END)                                  AS errors,
  COUNT(CASE WHEN al.event LIKE 'shadow_%' THEN 1 END)                            AS shadow_events,
  COUNT(CASE WHEN al.event = 'shadow_skipped_trivial' THEN 1 END)                 AS shadow_skipped,
  COALESCE(SUM(al.input_tokens + al.output_tokens), 0)                            AS total_tokens,
  ROUND(AVG(CASE WHEN al.event = 'response_sent' THEN al.latency_ms END)::NUMERIC, 0)
                                                                                   AS avg_response_latency_ms,
  -- Custo estimado gpt-4.1-mini (input $0.40/1M, output $1.60/1M)
  ROUND(
    COALESCE(SUM(al.input_tokens * 0.0000004 + al.output_tokens * 0.0000016), 0)::NUMERIC, 6
  )                                                                                AS cost_usd_approx
FROM ai_agent_logs al
JOIN ai_agents ag ON ag.id = al.agent_id
GROUP BY ag.instance_id, DATE(al.created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- v_conversion_funnel — leads por etapa do funil por instância/dia
-- Fonte: conversion_funnel_events (populada pelo aggregate-metrics)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_conversion_funnel
  WITH (security_barrier = true)
AS
SELECT
  instance_id,
  DATE(created_at)              AS event_date,
  stage,
  COUNT(DISTINCT lead_id)       AS unique_leads,
  COUNT(*)                      AS total_events
FROM conversion_funnel_events
GROUP BY instance_id, DATE(created_at), stage;

-- ─────────────────────────────────────────────────────────────────────────────
-- v_ia_vs_vendor — comparativo IA vs vendedor por instância/dia
-- Combina v_agent_performance (IA) + v_vendor_activity (vendedor)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ia_vs_vendor
  WITH (security_barrier = true)
AS
SELECT
  ap.instance_id,
  ap.activity_date,
  -- Métricas IA
  ap.responses_sent            AS ia_responses,
  ap.handoffs                  AS ia_handoffs,
  ap.avg_response_latency_ms   AS ia_avg_latency_ms,
  ap.total_tokens              AS ia_tokens,
  ap.cost_usd_approx           AS ia_cost_usd,
  -- Métricas vendedor (agregadas por instância/dia)
  va_agg.total_conversations   AS vendor_conversations,
  va_agg.resolved_count        AS vendor_resolved,
  va_agg.avg_resolution_minutes AS vendor_avg_resolution_minutes,
  va_agg.active_sellers        AS vendor_active_sellers,
  -- Taxa de cobertura IA (respostas IA / total de msgs que passou pela IA)
  CASE
    WHEN (ap.responses_sent + ap.handoffs) > 0
    THEN ROUND(
      (ap.responses_sent::NUMERIC / (ap.responses_sent + ap.handoffs)) * 100, 1
    )
  END                          AS ia_coverage_pct
FROM v_agent_performance ap
LEFT JOIN (
  SELECT
    instance_id,
    activity_date,
    SUM(conversations_handled) AS total_conversations,
    SUM(resolved_count)        AS resolved_count,
    ROUND(AVG(avg_resolution_minutes)::NUMERIC, 1) AS avg_resolution_minutes,
    COUNT(DISTINCT seller_id)  AS active_sellers
  FROM v_vendor_activity
  GROUP BY instance_id, activity_date
) va_agg ON va_agg.instance_id = ap.instance_id
        AND va_agg.activity_date = ap.activity_date;
