-- Free Forever: fecha o gap de retenção do Storage (helpdesk-media crescia ~100MB/semana sem limpeza).
-- cleanup-old-media apaga mídia >30d de helpdesk-media + audio-messages (mensagens/transcrições ficam; retenção delas é 120d).
select cron.schedule(
  'cleanup-old-media-daily',
  '35 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/cleanup-old-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Higiene: cron.job_run_details cresce sem teto (~24 jobs, vários por minuto). Mantém 7 dias de histórico.
select cron.schedule(
  'purge-cron-run-history-daily',
  '45 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
