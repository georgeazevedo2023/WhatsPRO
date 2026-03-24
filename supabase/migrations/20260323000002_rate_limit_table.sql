-- Rate limit log table for per-user throttling on expensive endpoints
-- Used by _shared/rateLimit.ts

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups by user + action + time window
CREATE INDEX idx_rate_limit_log_lookup
  ON public.rate_limit_log (user_id, action, created_at DESC);

-- Auto-cleanup: delete entries older than 1 hour (run every 15 min)
SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '*/15 * * * *',
  $$DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '1 hour';$$
);

-- RLS: service role only (edge functions use service role key)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
