-- =============================================================================
-- Gap C — pg_cron job a cada 1min pra disparar escalate-stale-handoffs
-- Padrão idêntico ao handoff-queue-requeue (Sprint C D30).
-- =============================================================================

SELECT cron.schedule(
  'notify-vendor-escalation',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/escalate-stale-handoffs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
