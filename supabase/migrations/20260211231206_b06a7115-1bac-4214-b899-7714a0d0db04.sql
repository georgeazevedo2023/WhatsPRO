
-- Function to normalize external_id
CREATE OR REPLACE FUNCTION public.normalize_external_id(ext_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN ext_id LIKE '%:%' THEN split_part(ext_id, ':', 2)
    ELSE ext_id
  END
$$;

-- Remove ALL duplicates keeping only the one with the smallest id
DELETE FROM conversation_messages a
USING conversation_messages b
WHERE a.conversation_id = b.conversation_id
  AND a.external_id IS NOT NULL
  AND b.external_id IS NOT NULL
  AND public.normalize_external_id(a.external_id) = public.normalize_external_id(b.external_id)
  AND a.id <> b.id
  AND a.id > b.id;

-- Unique functional index
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_normalized_external_id
ON conversation_messages (conversation_id, public.normalize_external_id(external_id))
WHERE external_id IS NOT NULL;
