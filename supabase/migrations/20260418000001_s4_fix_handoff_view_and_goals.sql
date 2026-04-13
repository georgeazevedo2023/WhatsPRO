-- Migration: M19-S4 Plano 1 — Corrigir views de handoff + criar tabela instance_goals
-- Problema: v_handoff_details e v_agent_performance filtram 'handoff_to_human'
--           mas ai-agent insere event='handoff'. Resultado: ZERO linhas em producao.
-- Solucao: ampliar filtro para IN ('handoff', 'handoff_to_human', 'handoff_trigger')

-- =============================================================================
-- Parte A: Corrigir v_handoff_details
-- =============================================================================
-- Nota: DROP + CREATE necessario pois CREATE OR REPLACE nao permite reordenar
--       colunas em views ja existentes (PostgreSQL SQLSTATE 42P16).

DROP VIEW IF EXISTS v_handoff_details CASCADE;

CREATE VIEW v_handoff_details
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
  -- Campo evitavel: handoffs iniciados pelo lead nao sao evitaveis
  CASE
    WHEN al.metadata->>'trigger' IN ('lead_asked', 'buy_confirm', 'lead_request')
    THEN false
    ELSE true
  END                                                         AS evitavel,
  CASE
    WHEN conv.status = 'resolved'
    THEN ROUND(
      EXTRACT(EPOCH FROM (conv.updated_at - al.created_at)) / 60, 1
    )
  END                                                         AS minutes_to_resolve_after_handoff,
  conv.status                                                 AS conversation_status,
  -- Campo converteu: resolved = considerado convertido
  CASE WHEN conv.status = 'resolved' THEN true ELSE false END AS converteu
FROM ai_agent_logs al
JOIN conversations conv ON conv.id = al.conversation_id
JOIN inboxes ib ON ib.id = conv.inbox_id
-- CORRIGIDO: event pode ser 'handoff' (padrao atual do ai-agent),
--            'handoff_to_human' (legado) ou 'handoff_trigger' (futuro)
WHERE al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger');

-- =============================================================================
-- Parte B: Corrigir v_agent_performance (mesmo bug de event name)
-- =============================================================================
-- Nota: DROP + CREATE necessario pelo mesmo motivo que Parte A.

DROP VIEW IF EXISTS v_agent_performance CASCADE;

CREATE VIEW v_agent_performance
  WITH (security_barrier = true)
AS
SELECT
  ag.instance_id,
  DATE(al.created_at)                                                              AS activity_date,
  COUNT(CASE WHEN al.event = 'response_sent' THEN 1 END)                          AS responses_sent,
  -- CORRIGIDO: contar todos os eventos de handoff
  COUNT(CASE WHEN al.event IN ('handoff', 'handoff_to_human', 'handoff_trigger') THEN 1 END) AS handoffs,
  COUNT(CASE WHEN al.event = 'error' THEN 1 END)                                  AS errors,
  COUNT(CASE WHEN al.event LIKE 'shadow_%' THEN 1 END)                            AS shadow_events,
  COUNT(CASE WHEN al.event = 'shadow_skipped_trivial' THEN 1 END)                 AS shadow_skipped,
  COALESCE(SUM(al.input_tokens + al.output_tokens), 0)                            AS total_tokens,
  ROUND(AVG(CASE WHEN al.event = 'response_sent' THEN al.latency_ms END)::NUMERIC, 0)
                                                                                   AS avg_response_latency_ms,
  ROUND(
    COALESCE(SUM(al.input_tokens * 0.0000004 + al.output_tokens * 0.0000016), 0)::NUMERIC, 6
  )                                                                                AS cost_usd_approx
FROM ai_agent_logs al
JOIN ai_agents ag ON ag.id = al.agent_id
GROUP BY ag.instance_id, DATE(al.created_at);

-- Nota: DROP CASCADE em v_agent_performance derruba v_ia_vs_vendor.
--       Recriar v_ia_vs_vendor abaixo para restaurar a dependencia.

CREATE VIEW v_ia_vs_vendor
  WITH (security_barrier = true)
AS
SELECT
  ap.instance_id,
  ap.activity_date,
  -- Metricas IA
  ap.responses_sent            AS ia_responses,
  ap.handoffs                  AS ia_handoffs,
  ap.avg_response_latency_ms   AS ia_avg_latency_ms,
  ap.total_tokens              AS ia_tokens,
  ap.cost_usd_approx           AS ia_cost_usd,
  -- Metricas vendedor (agregadas por instancia/dia)
  va_agg.total_conversations   AS vendor_conversations,
  va_agg.resolved_count        AS vendor_resolved,
  va_agg.avg_resolution_minutes AS vendor_avg_resolution_minutes,
  va_agg.active_sellers        AS vendor_active_sellers,
  -- Taxa de cobertura IA
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

-- =============================================================================
-- Parte C: Criar tabela instance_goals (metas por instancia + metrica + periodo)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.instance_goals (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  TEXT         NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  metric_key   TEXT         NOT NULL
    CHECK (metric_key IN ('conversion_rate', 'nps_avg', 'handoff_rate', 'response_time_min', 'ia_cost_usd', 'avg_ticket')),
  target_value NUMERIC      NOT NULL,
  period       TEXT         NOT NULL DEFAULT 'monthly'
    CHECK (period IN ('daily', 'weekly', 'monthly')),
  created_by   UUID         REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (instance_id, metric_key, period)
);

CREATE INDEX IF NOT EXISTS idx_instance_goals_instance ON public.instance_goals(instance_id);

-- RLS: super_admin gerencia metas, gerente apenas le
ALTER TABLE public.instance_goals ENABLE ROW LEVEL SECURITY;

-- Usando funcoes helper is_super_admin/is_gerente (padrao do projeto)
CREATE POLICY "Super admin manages goals"
  ON public.instance_goals FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Gerente reads goals"
  ON public.instance_goals FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_gerente(auth.uid()));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER set_instance_goals_updated_at
  BEFORE UPDATE ON public.instance_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
