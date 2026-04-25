-- M19 S8.1: Cron mensal para limpar backups JSONL > 365 dias
-- Roda no primeiro domingo do mês às 03:17 UTC (off-peak, off-minute)

CREATE OR REPLACE FUNCTION public.dispatch_backup_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anon_key text;
  v_request_id bigint;
BEGIN
  v_anon_key := coalesce(
    current_setting('app.settings.anon_key', true),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
  );

  IF v_anon_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_ANON_KEY not found in vault';
  END IF;

  SELECT net.http_post(
    url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/db-cleanup-old-backups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN jsonb_build_object('request_id', v_request_id, 'ran_at', now());
END;
$$;

COMMENT ON FUNCTION public.dispatch_backup_cleanup IS 'M19 S8.1: chamada pelo cron mensal. Dispara edge fn db-cleanup-old-backups que apaga JSONL > 365 dias.';

-- Cron mensal: dia 1 do mês às 03:17 UTC
SELECT cron.unschedule('db-backup-retention-monthly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'db-backup-retention-monthly'
);

SELECT cron.schedule(
  'db-backup-retention-monthly',
  '17 3 1 * *',
  $$SELECT dispatch_backup_cleanup()$$
);
