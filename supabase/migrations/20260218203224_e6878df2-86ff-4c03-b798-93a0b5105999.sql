
-- Add expiration column to conversations (already has ai_summary from previous migration)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ai_summary_expires_at timestamptz DEFAULT NULL;

-- Enable pg_net and pg_cron extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Trigger function: auto-call summarize-conversation when status changes to 'resolvida'
CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Only fire when status changes TO 'resolvida'
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    v_url := current_setting('app.supabase_url', true) || '/functions/v1/auto-summarize';
    v_key := current_setting('app.service_role_key', true);
    
    -- Fire and forget via pg_net
    PERFORM extensions.net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('conversation_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on conversations
DROP TRIGGER IF EXISTS auto_summarize_on_resolve ON public.conversations;
CREATE TRIGGER auto_summarize_on_resolve
  AFTER UPDATE OF status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_summarize();

-- pg_cron: cleanup expired summaries every day at 3am UTC
SELECT cron.schedule(
  'cleanup-expired-summaries',
  '0 3 * * *',
  $$
    UPDATE public.conversations 
    SET ai_summary = NULL, ai_summary_expires_at = NULL 
    WHERE ai_summary_expires_at IS NOT NULL 
      AND ai_summary_expires_at < now() 
      AND ai_summary IS NOT NULL;
  $$
);

-- pg_cron: check for inactive conversations every hour and auto-summarize
-- (conversations with last_message_at > 1h ago, status != 'resolvida', ai_summary IS NULL)
-- This is handled by the auto-summarize edge function being called via cron
SELECT cron.schedule(
  'auto-summarize-inactive',
  '0 * * * *',
  $$
    SELECT extensions.net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/auto-summarize',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object('mode', 'inactive')
    );
  $$
);
