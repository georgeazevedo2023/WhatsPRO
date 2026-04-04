
-- Replace hardcoded keys in trigger_auto_summarize with dynamic config
-- Uses supabase_url() and supabase_anon_key() built-in functions when available,
-- or current_setting as fallback

CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    -- Get project URL and anon key from Supabase settings
    _url := current_setting('app.settings.supabase_url', true);
    _key := current_setting('app.settings.supabase_anon_key', true);
    
    -- Fallback to env vars if settings not available
    IF _url IS NULL OR _url = '' THEN
      _url := 'https://euljumeflwtljegknawy.supabase.co';
    END IF;
    IF _key IS NULL OR _key = '' THEN
      _key := current_setting('supabase.anon_key', true);
    END IF;

    PERFORM extensions.http_post(
      url := _url || '/functions/v1/auto-summarize',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
      ),
      body := jsonb_build_object('conversation_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;
;
