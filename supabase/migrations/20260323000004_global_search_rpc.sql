-- Global Cross-Inbox Search (R12)
-- pg_trgm for fast ILIKE + RPC function

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_content_trgm
  ON public.conversation_messages USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.global_search_conversations(
  _query text,
  _limit int DEFAULT 20
)
RETURNS TABLE (
  conversation_id uuid, inbox_id uuid, inbox_name text,
  contact_id uuid, contact_name text, contact_phone text, contact_profile_pic_url text,
  status text, priority text, assigned_to uuid, last_message_at timestamptz, is_read boolean,
  match_type text, message_snippet text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _pattern text := '%' || _query || '%';
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  RETURN QUERY
  WITH accessible_inboxes AS (
    SELECT ib.id, ib.name FROM inboxes ib
    WHERE is_super_admin(_user_id) OR has_inbox_access(_user_id, ib.id)
  ),
  contact_matches AS (
    SELECT DISTINCT ON (cv.id)
      cv.id, cv.inbox_id, ai.name, ct.id, ct.name, ct.phone, ct.profile_pic_url,
      cv.status, cv.priority, cv.assigned_to, cv.last_message_at, cv.is_read,
      CASE WHEN ct.name ILIKE _pattern THEN 'contact_name' ELSE 'phone' END,
      NULL::text
    FROM conversations cv
    JOIN accessible_inboxes ai ON ai.id = cv.inbox_id
    JOIN contacts ct ON ct.id = cv.contact_id
    WHERE ct.name ILIKE _pattern OR ct.phone ILIKE _pattern
    ORDER BY cv.id, cv.last_message_at DESC NULLS LAST
    LIMIT _limit
  ),
  message_matches AS (
    SELECT DISTINCT ON (cv.id)
      cv.id, cv.inbox_id, ai.name, ct.id, ct.name, ct.phone, ct.profile_pic_url,
      cv.status, cv.priority, cv.assigned_to, cv.last_message_at, cv.is_read,
      'message'::text, LEFT(cm.content, 120)
    FROM conversation_messages cm
    JOIN conversations cv ON cv.id = cm.conversation_id
    JOIN accessible_inboxes ai ON ai.id = cv.inbox_id
    JOIN contacts ct ON ct.id = cv.contact_id
    WHERE cm.content ILIKE _pattern
    ORDER BY cv.id, cm.created_at DESC
    LIMIT _limit
  ),
  combined AS (SELECT * FROM contact_matches UNION ALL SELECT * FROM message_matches)
  SELECT DISTINCT ON (combined.conversation_id) combined.*
  FROM combined
  ORDER BY combined.conversation_id,
    CASE combined.match_type WHEN 'contact_name' THEN 0 WHEN 'phone' THEN 1 ELSE 2 END,
    combined.last_message_at DESC NULLS LAST
  LIMIT _limit;
END;
$$;
