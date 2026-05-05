-- D30 Sprint C — pg_cron schedule para requeue-conversations
-- Roda a cada 1min, processa eventos expirados e reativa pausados.
-- Idempotente: unschedule antes de rescheduler (evita duplicatas em re-apply).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'handoff-queue-requeue') THEN
    PERFORM cron.unschedule('handoff-queue-requeue');
  END IF;
END $$;

SELECT cron.schedule(
  'handoff-queue-requeue',
  '* * * * *',  -- a cada 1min
  $sql$
  SELECT net.http_post(
    url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/requeue-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $sql$
);
