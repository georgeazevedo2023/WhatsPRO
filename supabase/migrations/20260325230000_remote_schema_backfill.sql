-- Backfill critical remote schema objects after migration history divergence.
-- This migration is intentionally idempotent and consolidates missing objects
-- that are already required by the deployed application runtime.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_lookup
  ON public.rate_limit_log (user_id, action, created_at DESC);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limit-log') THEN
      PERFORM cron.unschedule('cleanup-rate-limit-log');
    END IF;

    PERFORM cron.schedule(
      'cleanup-rate-limit-log',
      '*/15 * * * *',
      $cron$DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '1 hour';$cron$
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_content_trgm
  ON public.conversation_messages USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.global_search_conversations(
  _query text,
  _limit int DEFAULT 20
)
RETURNS TABLE (
  conversation_id uuid,
  inbox_id uuid,
  inbox_name text,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_profile_pic_url text,
  status text,
  priority text,
  assigned_to uuid,
  last_message_at timestamptz,
  is_read boolean,
  match_type text,
  message_snippet text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _pattern text := '%' || _query || '%';
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH accessible_inboxes AS (
    SELECT ib.id, ib.name
    FROM public.inboxes ib
    WHERE public.is_super_admin(_user_id) OR public.has_inbox_access(_user_id, ib.id)
  ),
  contact_matches AS (
    SELECT DISTINCT ON (cv.id)
      cv.id,
      cv.inbox_id,
      ai.name,
      ct.id,
      ct.name,
      ct.phone,
      ct.profile_pic_url,
      cv.status,
      cv.priority,
      cv.assigned_to,
      cv.last_message_at,
      cv.is_read,
      CASE
        WHEN ct.name ILIKE _pattern THEN 'contact_name'
        ELSE 'phone'
      END,
      NULL::text
    FROM public.conversations cv
    JOIN accessible_inboxes ai ON ai.id = cv.inbox_id
    JOIN public.contacts ct ON ct.id = cv.contact_id
    WHERE ct.name ILIKE _pattern OR ct.phone ILIKE _pattern
    ORDER BY cv.id, cv.last_message_at DESC NULLS LAST
    LIMIT _limit
  ),
  message_matches AS (
    SELECT DISTINCT ON (cv.id)
      cv.id,
      cv.inbox_id,
      ai.name,
      ct.id,
      ct.name,
      ct.phone,
      ct.profile_pic_url,
      cv.status,
      cv.priority,
      cv.assigned_to,
      cv.last_message_at,
      cv.is_read,
      'message'::text,
      LEFT(cm.content, 120)
    FROM public.conversation_messages cm
    JOIN public.conversations cv ON cv.id = cm.conversation_id
    JOIN accessible_inboxes ai ON ai.id = cv.inbox_id
    JOIN public.contacts ct ON ct.id = cv.contact_id
    WHERE cm.content ILIKE _pattern
    ORDER BY cv.id, cm.created_at DESC
    LIMIT _limit
  ),
  combined AS (
    SELECT * FROM contact_matches
    UNION ALL
    SELECT * FROM message_matches
  )
  SELECT DISTINCT ON (combined.conversation_id) combined.*
  FROM combined
  ORDER BY combined.conversation_id,
    CASE combined.match_type
      WHEN 'contact_name' THEN 0
      WHEN 'phone' THEN 1
      ELSE 2
    END,
    combined.last_message_at DESC NULLS LAST
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search_conversations(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_search_conversations(text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.append_ai_debounce_message(
  p_conversation_id uuid,
  p_instance_id uuid,
  p_message jsonb,
  p_process_after timestamptz,
  p_first_message_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  id uuid,
  messages jsonb,
  process_after timestamptz,
  processed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.ai_debounce_queue (
    conversation_id,
    instance_id,
    messages,
    first_message_at,
    process_after,
    processed
  )
  VALUES (
    p_conversation_id,
    p_instance_id,
    jsonb_build_array(p_message),
    COALESCE(p_first_message_at, now()),
    p_process_after,
    false
  )
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    messages = CASE
      WHEN public.ai_debounce_queue.processed THEN jsonb_build_array(p_message)
      ELSE COALESCE(public.ai_debounce_queue.messages, '[]'::jsonb) || p_message
    END,
    first_message_at = CASE
      WHEN public.ai_debounce_queue.processed THEN COALESCE(p_first_message_at, now())
      ELSE COALESCE(public.ai_debounce_queue.first_message_at, p_first_message_at, now())
    END,
    process_after = p_process_after,
    processed = false
  RETURNING
    public.ai_debounce_queue.id,
    public.ai_debounce_queue.messages,
    public.ai_debounce_queue.process_after,
    public.ai_debounce_queue.processed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_ai_debounce_message(uuid, uuid, jsonb, timestamptz, timestamptz) TO service_role;
