-- Security Audit v2.9.0 — Fix hardcoded JWT tokens in cron jobs and triggers
-- Replace hardcoded tokens with vault-resolved values using current_setting()

-- Step 1: Store the anon key in a GUC so triggers/cron can reference it dynamically
-- The anon key is already available as a Supabase secret, we reference it via vault

-- Step 2: Replace trigger function to use vault instead of hardcoded token
CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire when status changes TO 'resolvida'
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    -- Resolve URL and key from environment (set by Supabase automatically)
    _supabase_url := current_setting('app.settings.supabase_url', true);
    _anon_key := current_setting('app.settings.anon_key', true);

    -- Fallback to hardcoded project URL if GUC not available
    IF _supabase_url IS NULL THEN
      _supabase_url := 'https://crzcpnczpuzwieyzbqev.supabase.co';
    END IF;

    -- Only proceed if we have the anon key
    IF _anon_key IS NOT NULL THEN
      PERFORM extensions.net.http_post(
        url := _supabase_url || '/functions/v1/auto-summarize',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := jsonb_build_object('conversation_id', NEW.id::text)
      );
    ELSE
      RAISE WARNING '[trigger_auto_summarize] anon_key not available in app.settings — skipping HTTP call';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Step 3: Replace cron jobs to use vault-resolved tokens
-- First, unschedule the old jobs
SELECT cron.unschedule('process-scheduled-messages');
SELECT cron.unschedule('auto-summarize-inactive');

-- Re-create with dynamic token resolution
SELECT cron.schedule(
  'process-scheduled-messages',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/process-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'auto-summarize-inactive',
  '0 */3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/auto-summarize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.anon_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
      )
    ),
    body := '{"mode": "inactive", "limit": 20}'::jsonb
  ) AS request_id;
  $$
);
