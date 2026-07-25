-- =============================================================================
-- v7.108.0 — agenda o Resumo do dia (formato rico aprovado 2026-07-25).
-- Decisão do dono: relatório diário padrão, enviado pro número dele
-- (to_phone 5581993856099) — gestores ainda não têm personal_whatsapp.
-- Cadência = fechamento do expediente +30min (business_hours EletropisoV2):
--   seg-sex fecham 18:00 → 18:30 SP = 21:30 UTC (SP é UTC-3 fixo, sem DST)
--   sáb fecha 12:00     → 12:30 SP = 15:30 UTC
--   dom fechado         → relatório às 18:30 mesmo (registra msgs fora do horário)
-- cron.schedule com jobname é upsert (re-rodar a migration não duplica).
-- =============================================================================

select cron.schedule(
  'daily-manager-report-eletropisov2',
  '30 21 * * 0-5', -- dom-sex 18:30 America/Sao_Paulo
  $cmd$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/daily-manager-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'instance_id', 're662a6d32de7e0',
      'to_phone', '5581993856099')
  ) AS request_id;
  $cmd$
);

select cron.schedule(
  'daily-manager-report-eletropisov2-sab',
  '30 15 * * 6', -- sáb 12:30 America/Sao_Paulo (loja fecha 12:00)
  $cmd$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/daily-manager-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'instance_id', 're662a6d32de7e0',
      'to_phone', '5581993856099')
  ) AS request_id;
  $cmd$
);
