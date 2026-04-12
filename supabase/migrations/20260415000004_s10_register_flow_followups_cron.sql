-- =============================================================================
-- S10: Registra cron hourly para process-flow-followups
-- Roda a cada hora para enviar follow-ups agendados em flow_states.step_data
-- Padrão: net.http_post com URL hardcoded (mesmo padrão do security_audit_fixes)
-- =============================================================================

-- Remove agendamento anterior (idempotente)
SELECT cron.unschedule('process-flow-followups');

-- Registra cron a cada hora
SELECT cron.schedule(
  'process-flow-followups',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/process-flow-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
