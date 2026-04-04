-- Migration F4: Ciclo Automatizado Teste → Ajuste → Re-teste
-- Adiciona colunas de regressão, seeds de configuração e ativa pg_cron

-- 1. Adicionar colunas de regressão em e2e_test_batches
ALTER TABLE public.e2e_test_batches
  ADD COLUMN IF NOT EXISTS is_regression BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regression_context JSONB,
  ADD COLUMN IF NOT EXISTS batch_id_text TEXT;

-- 2. Índice para busca de regressões
CREATE INDEX IF NOT EXISTS idx_e2e_batches_regression
  ON public.e2e_test_batches(is_regression, created_at DESC)
  WHERE is_regression = true;

-- 3. Seeds em system_settings para configuração do ciclo automatizado
INSERT INTO system_settings (key, value, description, is_secret) VALUES
  ('e2e_schedule_interval_hours', '6', 'Intervalo entre execuções automáticas de E2E (horas). Valores: 2, 6, 12, 24', false),
  ('e2e_healthy_pass_rate', '80', 'Taxa de aprovação considerada saudável (%). Abaixo disso é alerta.', false),
  ('e2e_regression_threshold', '10', 'Queda de score (pontos) que dispara flag de regressão entre batches.', false),
  ('e2e_alert_whatsapp_enabled', 'true', 'Habilitar alertas de falha via WhatsApp (true/false)', false),
  ('e2e_consecutive_below_threshold', '0', 'Contador interno: batches consecutivos abaixo do threshold. NAO editar manualmente.', false)
ON CONFLICT (key) DO NOTHING;

-- 4. RPC para buscar o batch anterior (usado pelo e2e-scheduled para comparação de regressão)
CREATE OR REPLACE FUNCTION get_previous_e2e_batch(
  p_agent_id UUID,
  p_exclude_batch_uuid UUID
)
RETURNS TABLE(
  batch_uuid UUID,
  composite_score NUMERIC,
  passed INTEGER,
  total INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, composite_score, passed, total, created_at
  FROM public.e2e_test_batches
  WHERE agent_id = p_agent_id
    AND id != p_exclude_batch_uuid
    AND status = 'complete'
    AND composite_score IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- 5. Ativar pg_cron para e2e-scheduled (a cada 6h)
SELECT cron.schedule(
  'e2e-automated-tests',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/e2e-scheduled',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. Ativar cleanup diário de runs antigos
SELECT cron.schedule(
  'e2e-cleanup-old-runs',
  '0 3 * * *',
  $$SELECT cleanup_old_e2e_runs();$$
);
