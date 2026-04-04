
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store the anon key in vault instead of hardcoding
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bGp1bWVmbHd0bGplZ2tuYXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjYzMTQsImV4cCI6MjA4OTU0MjMxNH0.TAem9XE_b7Sx-rlHpZiU40rXKvwYWCBnqwLlAFYetJk',
  'supabase_anon_key',
  'Supabase anon key for internal trigger calls'
);

-- Recreate trigger function using vault secret
CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _url text := 'https://euljumeflwtljegknawy.supabase.co';
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    -- Get key from vault
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;

    IF _key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _url || '/functions/v1/auto-summarize',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _key
        ),
        body := jsonb_build_object('conversation_id', NEW.id::text)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
;
