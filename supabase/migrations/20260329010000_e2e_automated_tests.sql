-- E2E Automated Tests: table + pg_cron scheduling
-- Stores results from automated E2E test runs for monitoring/alerting

-- 1. Table for test run results
CREATE TABLE IF NOT EXISTS e2e_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  test_number text NOT NULL,
  scenario_id text NOT NULL,
  scenario_name text NOT NULL,
  total_steps int NOT NULL,
  passed boolean NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_e2e_runs_agent_created ON e2e_test_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_runs_passed_created ON e2e_test_runs(passed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_runs_scenario ON e2e_test_runs(scenario_id, created_at DESC);

-- 3. RLS
ALTER TABLE e2e_test_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_read_e2e_runs' AND tablename = 'e2e_test_runs') THEN
    CREATE POLICY "super_admin_read_e2e_runs" ON e2e_test_runs
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;

-- Service role can INSERT (edge function uses service_role_key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_insert_e2e_runs' AND tablename = 'e2e_test_runs') THEN
    CREATE POLICY "service_insert_e2e_runs" ON e2e_test_runs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 4. Retention: auto-delete runs older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_e2e_runs()
RETURNS void AS $$
BEGIN
  DELETE FROM e2e_test_runs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. pg_cron scheduling (requires pg_cron extension enabled)
-- E2E tests run every 6 hours
-- SELECT cron.schedule('e2e-automated-tests', '0 */6 * * *', $$
--   SELECT net.http_post(
--     url := '<SUPABASE_URL>/functions/v1/e2e-scheduled',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='supabase_anon_key')),
--     body := '{}'::jsonb
--   );
-- $$);
-- Cleanup old runs daily at 3am
-- SELECT cron.schedule('e2e-cleanup-old-runs', '0 3 * * *', $$SELECT cleanup_old_e2e_runs();$$);
