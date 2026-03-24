
-- Fix trigger_auto_summarize: wrong Supabase project URL
CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when status changes TO 'resolvida'
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    PERFORM extensions.net.http_post(
      url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/auto-summarize',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4'
      ),
      body := jsonb_build_object('conversation_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$function$;
