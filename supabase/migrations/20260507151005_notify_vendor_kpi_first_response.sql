-- =============================================================================
-- Gap F — KPI tempo médio até 1ª resposta do vendedor após handoff
-- Usado pelo NotificationLogPanel pra mostrar avg/p50/p90 nos últimos N dias.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kpi_avg_first_response_minutes(_days INTEGER DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_minutes NUMERIC;
  v_count BIGINT;
  v_p50 NUMERIC;
  v_p90 NUMERIC;
BEGIN
  WITH first_replies AS (
    SELECT
      c.id AS conversation_id,
      c.assigned_to,
      c.assigned_at,
      MIN(cm.created_at) AS first_response_at
    FROM public.conversations c
    JOIN public.conversation_messages cm
      ON cm.conversation_id = c.id
      AND cm.direction = 'outgoing'
      AND cm.sender_id = c.assigned_to
      AND cm.created_at > c.assigned_at
    WHERE c.assigned_at IS NOT NULL
      AND c.assigned_at >= now() - (_days || ' days')::interval
    GROUP BY c.id, c.assigned_to, c.assigned_at
  ),
  diffs AS (
    SELECT EXTRACT(EPOCH FROM (first_response_at - assigned_at))/60.0 AS minutes
    FROM first_replies
  )
  SELECT
    AVG(minutes),
    COUNT(*),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY minutes)
  INTO v_avg_minutes, v_count, v_p50, v_p90
  FROM diffs;

  RETURN jsonb_build_object(
    'days_window', _days,
    'sample_size', COALESCE(v_count, 0),
    'avg_minutes', ROUND(COALESCE(v_avg_minutes, 0), 2),
    'p50_minutes', ROUND(COALESCE(v_p50, 0), 2),
    'p90_minutes', ROUND(COALESCE(v_p90, 0), 2)
  );
END $$;

REVOKE ALL ON FUNCTION public.kpi_avg_first_response_minutes(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kpi_avg_first_response_minutes(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.kpi_avg_first_response_minutes IS
  'Gap F KPI: avg/p50/p90 do tempo (em min) até a primeira resposta do vendedor após handoff. Janela = _days dias.';
