-- =============================================================================
-- R113 — Recria 5 crons usando vault.CRON_AUTH_KEY (pattern correto pós-migração).
--
-- Causa raiz que motivou esta migration:
-- O gateway Supabase REESCREVE o Authorization header quando recebe um token
-- formato `sb_publishable_*`, transformando-o em um JWT (~444 chars `eyJ0...`).
-- Como `Deno.env.SUPABASE_ANON_KEY` dentro de uma Edge Function é o publishable
-- (46 chars `sb_p...`), comparação string-igual em verifyCronOrService nunca
-- bate. 401 garantido em todo cron que usa `Bearer <vault.SUPABASE_ANON_KEY>`.
--
-- Solução: usar a env var `INTERNAL_FUNCTION_KEY` (já configurada como secret
-- nas Edge Functions, formato neutro 64-chars que o gateway NÃO reescreve).
-- Vault entry `CRON_AUTH_KEY` foi populada manualmente com o mesmo valor de
-- `INTERNAL_FUNCTION_KEY` via edge function de bootstrap one-shot (ver wiki
-- erros-e-licoes R113 pro procedimento exato).
--
-- Pré-requisito: vault entry `CRON_AUTH_KEY` deve existir e bater com
-- `Deno.env.INTERNAL_FUNCTION_KEY` da Edge Function. Se ausente, esta migration
-- vai criar os crons mas as chamadas vão retornar 401 até o vault ser populado.
--
-- Idempotente: unschedule antes de re-schedule.
-- =============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='handoff-queue-requeue') THEN
    PERFORM cron.unschedule('handoff-queue-requeue');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='aggregate-metrics-hourly') THEN
    PERFORM cron.unschedule('aggregate-metrics-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='aggregate-metrics-daily-consolidation') THEN
    PERFORM cron.unschedule('aggregate-metrics-daily-consolidation');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='process-flow-followups') THEN
    PERFORM cron.unschedule('process-flow-followups');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='e2e-automated-tests') THEN
    PERFORM cron.unschedule('e2e-automated-tests');
  END IF;
END $$;

-- D30 Fila Inteligente — requeue de eventos expirados (1min)
SELECT cron.schedule('handoff-queue-requeue', '* * * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/requeue-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
$sql$);

-- Métricas — agregação horária (M19 Plataforma de Métricas)
SELECT cron.schedule('aggregate-metrics-hourly', '0 * * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/aggregate-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{"mode":"daily"}'::jsonb
  ) AS request_id;
$sql$);

-- Métricas — consolidação diária 00:30
SELECT cron.schedule('aggregate-metrics-daily-consolidation', '30 0 * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/aggregate-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{"mode":"daily_consolidation"}'::jsonb
  ) AS request_id;
$sql$);

-- Orchestrator — follow-ups de flow (S10 Sprint)
SELECT cron.schedule('process-flow-followups', '0 * * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/process-flow-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
$sql$);

-- E2E Tests — bateria automatizada a cada 6h
SELECT cron.schedule('e2e-automated-tests', '0 */6 * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/e2e-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
$sql$);
