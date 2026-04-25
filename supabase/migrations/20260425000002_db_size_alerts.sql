-- M19 S8 Camada 2: Alertas Proativos de Tamanho do Banco
-- Daily pg_cron job que detecta cruzamento de threshold e notifica super_admins
-- Dedup: 1 notification por cruzamento (sem spam)

-- Estado singleton: armazena último status conhecido para detectar transições
CREATE TABLE IF NOT EXISTS public.db_alert_state (
  id smallint PRIMARY KEY DEFAULT 1,
  last_status text NOT NULL DEFAULT 'green',
  last_size_bytes bigint NOT NULL DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz,
  CONSTRAINT db_alert_state_singleton CHECK (id = 1),
  CONSTRAINT db_alert_state_status_check CHECK (last_status IN ('green', 'yellow', 'red', 'critical'))
);

INSERT INTO public.db_alert_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.db_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view db_alert_state"
  ON public.db_alert_state FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Severity rank para detecção de "ficou pior"
CREATE OR REPLACE FUNCTION public.db_alert_severity_rank(_status text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _status
    WHEN 'green' THEN 0::smallint
    WHEN 'yellow' THEN 1::smallint
    WHEN 'red' THEN 2::smallint
    WHEN 'critical' THEN 3::smallint
    ELSE 0::smallint
  END;
$$;

-- Função principal: chamada por pg_cron diariamente
CREATE OR REPLACE FUNCTION public.check_db_size_and_alert(threshold_mb integer DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bytes bigint;
  v_threshold_bytes bigint;
  v_percent numeric;
  v_status text;
  v_state record;
  v_top_table text;
  v_top_pretty text;
  v_severity smallint;
  v_was_severity smallint;
  v_notified_count integer := 0;
  v_super_admin_id uuid;
BEGIN
  v_total_bytes := pg_database_size(current_database());
  v_threshold_bytes := threshold_mb::bigint * 1024 * 1024;
  v_percent := ROUND((v_total_bytes::numeric / v_threshold_bytes::numeric) * 100, 1);

  v_status := CASE
    WHEN v_percent >= 90 THEN 'critical'
    WHEN v_percent >= 75 THEN 'red'
    WHEN v_percent >= 50 THEN 'yellow'
    ELSE 'green'
  END;

  SELECT * INTO v_state FROM db_alert_state WHERE id = 1;

  v_severity := db_alert_severity_rank(v_status);
  v_was_severity := db_alert_severity_rank(v_state.last_status);

  -- Detectar maior tabela (para mensagem informativa)
  SELECT
    schemaname || '.' || relname,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname))
  INTO v_top_table, v_top_pretty
  FROM pg_stat_user_tables
  WHERE schemaname IN ('public', 'auth', 'storage')
  ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC
  LIMIT 1;

  -- Cruzou para PIOR? Notificar super_admins
  IF v_severity > v_was_severity THEN
    FOR v_super_admin_id IN
      SELECT user_id FROM user_roles WHERE role = 'super_admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        v_super_admin_id,
        'db_size_alert',
        CASE v_status
          WHEN 'critical' THEN 'URGENTE: banco em estado crítico'
          WHEN 'red' THEN 'Banco perto do limite'
          WHEN 'yellow' THEN 'Atenção: banco passou de 50%'
          ELSE 'Status do banco atualizado'
        END,
        FORMAT(
          'Banco com %s (%s%% de %s MB). Maior consumidor: %s (%s).',
          pg_size_pretty(v_total_bytes),
          v_percent::text,
          threshold_mb::text,
          COALESCE(v_top_table, 'n/a'),
          COALESCE(v_top_pretty, 'n/a')
        ),
        jsonb_build_object(
          'severity', v_status,
          'percent_used', v_percent,
          'total_bytes', v_total_bytes,
          'threshold_mb', threshold_mb,
          'top_table', v_top_table,
          'route', '/dashboard/gestao'
        )
      );
      v_notified_count := v_notified_count + 1;
    END LOOP;

    UPDATE db_alert_state
       SET last_status = v_status,
           last_size_bytes = v_total_bytes,
           last_checked_at = now(),
           last_notified_at = now()
     WHERE id = 1;
  ELSE
    -- Mesmo nível ou MELHOROU: só atualiza estado (sem notification)
    UPDATE db_alert_state
       SET last_status = v_status,
           last_size_bytes = v_total_bytes,
           last_checked_at = now()
     WHERE id = 1;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'previous_status', v_state.last_status,
    'crossed', v_severity > v_was_severity,
    'percent_used', v_percent,
    'total_bytes', v_total_bytes,
    'notified_count', v_notified_count
  );
END;
$$;

COMMENT ON FUNCTION public.check_db_size_and_alert IS 'M19 S8 Camada 2: chamada por pg_cron diariamente. Notifica super_admins apenas no cruzamento para pior.';

-- Schedule: diariamente às 06:07 UTC (off-peak, off-minute)
SELECT cron.unschedule('db-size-monitor') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'db-size-monitor'
);

SELECT cron.schedule(
  'db-size-monitor',
  '7 6 * * *',
  $$SELECT check_db_size_and_alert(300)$$
);
