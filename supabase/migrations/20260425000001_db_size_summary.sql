-- M19 S8 Camada 1: DB Size Visibility
-- Função SQL que retorna sumário do tamanho do banco para o dashboard de gestão
-- Acesso restrito a super_admin (verificação dentro da função)

CREATE OR REPLACE FUNCTION public.get_db_size_summary(threshold_mb integer DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bytes bigint;
  v_threshold_bytes bigint;
  v_percent numeric;
  v_status text;
  v_top_tables jsonb;
BEGIN
  -- Gate: somente super_admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  v_total_bytes := pg_database_size(current_database());
  v_threshold_bytes := threshold_mb::bigint * 1024 * 1024;
  v_percent := ROUND((v_total_bytes::numeric / v_threshold_bytes::numeric) * 100, 1);

  -- Status semafórico (espelha thresholds do plano S8)
  v_status := CASE
    WHEN v_percent >= 90 THEN 'critical'
    WHEN v_percent >= 75 THEN 'red'
    WHEN v_percent >= 50 THEN 'yellow'
    ELSE 'green'
  END;

  -- Top 10 tabelas (incluindo índices via pg_total_relation_size)
  SELECT jsonb_agg(t)
  INTO v_top_tables
  FROM (
    SELECT
      schemaname || '.' || relname AS name,
      pg_total_relation_size(schemaname || '.' || relname) AS bytes,
      pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS pretty
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'auth', 'storage')
    ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'total_bytes', v_total_bytes,
    'total_pretty', pg_size_pretty(v_total_bytes),
    'threshold_mb', threshold_mb,
    'threshold_bytes', v_threshold_bytes,
    'percent_used', v_percent,
    'status', v_status,
    'top_tables', COALESCE(v_top_tables, '[]'::jsonb),
    'measured_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.get_db_size_summary IS 'M19 S8 Camada 1: retorna sumário do tamanho do banco para dashboard de gestão. Restrito a super_admin.';

GRANT EXECUTE ON FUNCTION public.get_db_size_summary(integer) TO authenticated;
