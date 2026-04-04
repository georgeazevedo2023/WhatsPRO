-- Create e2e_test_batches parent table
CREATE TABLE IF NOT EXISTS public.e2e_test_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_type TEXT NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled', 'regression')),
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  composite_score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  prompt_hash TEXT
);

-- Add non-destructive FK column to e2e_test_runs (preserves existing batch_id TEXT)
ALTER TABLE public.e2e_test_runs
  ADD COLUMN IF NOT EXISTS batch_uuid UUID REFERENCES public.e2e_test_batches(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.e2e_test_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can manage e2e_test_batches"
  ON public.e2e_test_batches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_e2e_test_batches_agent_id ON public.e2e_test_batches(agent_id);
CREATE INDEX IF NOT EXISTS idx_e2e_test_batches_created_at ON public.e2e_test_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_test_runs_batch_uuid ON public.e2e_test_runs(batch_uuid);
