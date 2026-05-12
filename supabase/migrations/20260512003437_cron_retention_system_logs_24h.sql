-- Retention 24h dos logs internos (pg_net + pg_cron) — banco -30 MB
-- Esses logs crescem ~3 MB/hora sem cleanup. Job horário apaga >24h.

CREATE OR REPLACE FUNCTION public.purge_system_logs_older_than_24h()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, cron
AS $$
DECLARE
  v_net_deleted int := 0;
  v_cron_deleted int := 0;
BEGIN
  DELETE FROM net._http_response WHERE created < now() - interval '24 hours';
  GET DIAGNOSTICS v_net_deleted = ROW_COUNT;

  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '24 hours';
  GET DIAGNOSTICS v_cron_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'net_http_response_deleted', v_net_deleted,
    'cron_job_run_details_deleted', v_cron_deleted
  );
END;
$$;

COMMENT ON FUNCTION public.purge_system_logs_older_than_24h IS
  'Apaga registros >24h de net._http_response e cron.job_run_details. Chamado por cron horário.';

-- Remove job antigo se existir (idempotente)
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'purge_system_logs_24h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'purge_system_logs_24h',
  '0 * * * *',
  $cmd$SELECT public.purge_system_logs_older_than_24h();$cmd$
);
