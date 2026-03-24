
-- Drop and recreate the trigger function with hardcoded URL
-- The service role key will be read from vault or we use the anon key + service role via edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes TO 'resolvida'
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    PERFORM extensions.net.http_post(
      url := 'https://tjuokxdkimrtyqsbzskj.supabase.co/functions/v1/auto-summarize',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqdW9reGRraW1ydHlxc2J6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzA4OTcsImV4cCI6MjA4NDg0Njg5N30.h9ZobC1VXwM1_GMs1SWTSITb9dbdzZ3YEeX3nm6EgCw'
      ),
      body := jsonb_build_object('conversation_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update the cron jobs to use hardcoded URL
SELECT cron.unschedule('auto-summarize-inactive') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-summarize-inactive');

SELECT cron.schedule(
  'auto-summarize-inactive',
  '0 * * * *',
  $$
    SELECT extensions.net.http_post(
      url := 'https://tjuokxdkimrtyqsbzskj.supabase.co/functions/v1/auto-summarize',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqdW9reGRraW1ydHlxc2J6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzA4OTcsImV4cCI6MjA4NDg0Njg5N30.h9ZobC1VXwM1_GMs1SWTSITb9dbdzZ3YEeX3nm6EgCw"}'::jsonb,
      body := '{"mode": "inactive"}'::jsonb
    );
  $$
);
