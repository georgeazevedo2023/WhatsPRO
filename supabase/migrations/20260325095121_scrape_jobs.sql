
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'scanning' CHECK (status IN ('scanning', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  found_links JSONB DEFAULT '[]',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_agent ON public.scrape_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs(status) WHERE status IN ('scanning', 'processing');

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on scrape_jobs" ON public.scrape_jobs FOR ALL USING (true) WITH CHECK (true);
;
