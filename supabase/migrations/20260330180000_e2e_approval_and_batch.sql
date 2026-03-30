-- Extend e2e_test_runs with approval workflow + batch support

-- 1. Add approval columns
ALTER TABLE e2e_test_runs
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'single'
    CHECK (run_type IN ('single', 'batch', 'manual')),
  ADD COLUMN IF NOT EXISTS approval text DEFAULT NULL
    CHECK (approval IN ('auto_approved', 'human_approved', 'human_rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_notes text,
  ADD COLUMN IF NOT EXISTS batch_id text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tools_used text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tools_missing text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prompt_hash text;

-- 2. Index for batch queries
CREATE INDEX IF NOT EXISTS idx_e2e_runs_batch ON e2e_test_runs(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_runs_approval ON e2e_test_runs(approval, created_at DESC);

-- 3. RLS policy for super_admin to update (approve/reject)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_update_e2e_runs' AND tablename = 'e2e_test_runs') THEN
    CREATE POLICY "super_admin_update_e2e_runs" ON e2e_test_runs
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;
