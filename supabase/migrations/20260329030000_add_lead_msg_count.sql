-- Add atomic lead message counter to conversations
-- Replaces the COUNT(*) query approach which had race conditions (DT-07)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_msg_count INTEGER NOT NULL DEFAULT 0;

-- Index for efficient lookup (already filtered by conversation_id PK, but useful for resets)
COMMENT ON COLUMN conversations.lead_msg_count IS 'Atomic counter of incoming lead messages in current session. Reset on ia_cleared.';

-- Atomic increment RPC for lead message count
CREATE OR REPLACE FUNCTION increment_lead_msg_count(p_conversation_id UUID)
RETURNS TABLE(lead_msg_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE conversations
  SET lead_msg_count = conversations.lead_msg_count + 1
  WHERE id = p_conversation_id
  RETURNING conversations.lead_msg_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
