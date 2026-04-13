-- =============================================================================
-- M19 S2: Cron jobs para aggregate-metrics
-- T5: hourly (daily mode) + daily (consolidation mode)
-- Padrão: net.http_post com Authorization Bearer (mesmo padrão do projeto)
-- =============================================================================

-- Remove agendamentos anteriores (idempotente)
SELECT cron.unschedule('aggregate-metrics-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'aggregate-metrics-hourly'
);
SELECT cron.unschedule('aggregate-metrics-daily-consolidation') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'aggregate-metrics-daily-consolidation'
);

-- Cron hourly: processa extrações do dia → shadow_metrics daily
-- Executa no minuto 0 de cada hora
SELECT cron.schedule(
  'aggregate-metrics-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/aggregate-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{"mode":"daily"}'::jsonb
  ) AS request_id;
  $$
);

-- Cron daily: consolida diários em weekly/monthly
-- Executa às 00:30 UTC (01:30 BRT / 21:30 PST) — após o processamento do dia anterior
SELECT cron.schedule(
  'aggregate-metrics-daily-consolidation',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/aggregate-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{"mode":"daily_consolidation"}'::jsonb
  ) AS request_id;
  $$
);
