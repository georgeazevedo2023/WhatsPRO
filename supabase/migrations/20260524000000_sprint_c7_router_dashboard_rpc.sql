-- Sprint C7 (2026-05-24) — Dashboard admin "Roteamento".
-- RPC SECURITY DEFINER que agrega ai_agent_runs (telemetria por hop do router +
-- specialists). ai_agent_runs NÃO tem policy authenticated (evita leak entre
-- tenants); todo acesso do dashboard passa por esta RPC, guardada por is_super_admin.
--
-- Retorna um único jsonb com todas as seções que o dashboard consome (1 round-trip):
--   overview              — totais, hop loops, confiança média, custo estimado
--   intent_distribution   — pizza de intents (saída do router)
--   specialist_latency    — P50/P95 + tokens por specialist
--   model_usage           — runs/tokens por modelo
--   daily_volume          — série diária de runs (tendência)
--
-- _days   janela em dias (default 7)
-- _agent_id  filtra um agent; NULL = todos (visão super_admin cross-tenant)

CREATE OR REPLACE FUNCTION public.get_router_dashboard(
  _days INT DEFAULT 7,
  _agent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _since TIMESTAMPTZ := now() - (_days || ' days')::INTERVAL;
  _result JSONB;
BEGIN
  -- Guard: só super_admin. Sem isso, retornar dados cross-tenant vazaria entre clientes.
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only';
  END IF;

  WITH base AS (
    SELECT * FROM ai_agent_runs
    WHERE created_at >= _since
      AND (_agent_id IS NULL OR agent_id = _agent_id)
  ),
  -- Custo estimado por modelo (US$/1M tokens, aproximação 2026).
  costed AS (
    SELECT
      *,
      CASE model
        WHEN 'gpt-4.1'      THEN input_tokens * 2.0/1e6  + output_tokens * 8.0/1e6
        WHEN 'gpt-4.1-mini' THEN input_tokens * 0.4/1e6  + output_tokens * 1.6/1e6
        WHEN 'gpt-4.1-nano' THEN input_tokens * 0.1/1e6  + output_tokens * 0.4/1e6
        WHEN 'gpt-5-mini'   THEN input_tokens * 0.25/1e6 + output_tokens * 2.0/1e6
        WHEN 'gpt-5-nano'   THEN input_tokens * 0.05/1e6 + output_tokens * 0.4/1e6
        ELSE input_tokens * 0.5/1e6 + output_tokens * 1.5/1e6
      END AS est_cost
    FROM base
  )
  SELECT jsonb_build_object(
    'period_days', _days,
    'overview', (
      SELECT jsonb_build_object(
        'total_runs', count(*),
        'total_turns', count(DISTINCT turn_id),
        'total_conversations', count(DISTINCT conversation_id),
        'hop_loops', count(*) FILTER (WHERE metadata->>'event' = 'loop_detected'),
        'avg_confidence', round(avg(confidence) FILTER (WHERE specialist = 'router'), 3),
        'avg_latency_ms', round(avg(latency_ms))::int,
        'est_cost_usd', round(sum(est_cost)::numeric, 4)
      ) FROM costed
    ),
    'intent_distribution', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('intent', intent, 'count', n) ORDER BY n DESC)
      FROM (
        SELECT intent, count(*) n FROM base
        WHERE specialist = 'router' AND intent IS NOT NULL
        GROUP BY intent
      ) t
    ), '[]'::jsonb),
    'specialist_latency', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'specialist', specialist,
        'runs', n,
        'p50_ms', p50, 'p95_ms', p95,
        'avg_input_tokens', avg_in, 'avg_output_tokens', avg_out
      ) ORDER BY n DESC)
      FROM (
        SELECT specialist,
          count(*) n,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int p95,
          round(avg(input_tokens))::int avg_in,
          round(avg(output_tokens))::int avg_out
        FROM base WHERE latency_ms IS NOT NULL
        GROUP BY specialist
      ) t
    ), '[]'::jsonb),
    'model_usage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'model', model, 'runs', n,
        'input_tokens', in_t, 'output_tokens', out_t, 'est_cost_usd', cost
      ) ORDER BY n DESC)
      FROM (
        SELECT model, count(*) n, sum(input_tokens) in_t, sum(output_tokens) out_t,
               round(sum(est_cost)::numeric, 4) cost
        FROM costed WHERE model IS NOT NULL GROUP BY model
      ) t
    ), '[]'::jsonb),
    'daily_volume', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d, 'runs', n) ORDER BY d)
      FROM (
        SELECT date_trunc('day', created_at)::date d, count(*) n
        FROM base GROUP BY 1
      ) t
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_router_dashboard(INT, UUID) TO authenticated;
