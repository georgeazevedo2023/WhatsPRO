-- NPS-on-finalize: o breakdown por atendente passa a contar votos de QUALQUER escala
-- (categórico agora é pontuado por palavra-chave em 0-10 no webhook → numeric_score
-- populado também). Remove o filtro nps_scale='numeric_0_10'.
CREATE OR REPLACE FUNCTION public.get_nps_by_attendant(
  p_instance_id TEXT,
  p_period_days INT DEFAULT 30
)
RETURNS TABLE (
  attendant_id UUID,
  attendant_name TEXT,
  votes BIGINT,
  avg_score NUMERIC,
  promoters BIGINT,
  detractors BIGINT,
  low_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pm.attendant_id,
    up.full_name AS attendant_name,
    COUNT(pr.id) AS votes,
    ROUND(AVG(pr.numeric_score)::numeric, 1) AS avg_score,
    COUNT(*) FILTER (WHERE pr.numeric_score >= 9) AS promoters,
    COUNT(*) FILTER (WHERE pr.numeric_score <= 6) AS detractors,
    COUNT(*) FILTER (WHERE pr.numeric_score < 5) AS low_count
  FROM public.poll_responses pr
  JOIN public.poll_messages pm ON pm.id = pr.poll_message_id
  LEFT JOIN public.user_profiles up ON up.id = pm.attendant_id
  WHERE pm.is_nps = true
    AND pm.instance_id = p_instance_id
    AND pr.numeric_score IS NOT NULL
    AND pr.voted_at >= now() - make_interval(days => p_period_days)
  GROUP BY pm.attendant_id, up.full_name
  ORDER BY votes DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_nps_by_attendant(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nps_by_attendant(TEXT, INT) TO authenticated, service_role;
