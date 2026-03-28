-- ============================================================
-- Audit security fixes: greeting dedup RPC + performance indexes
-- ============================================================

-- 1. Atomic greeting deduplication RPC (prevents race condition)
-- Uses advisory lock to ensure only one greeting is sent per conversation
CREATE OR REPLACE FUNCTION try_insert_greeting(
  p_conversation_id UUID,
  p_content TEXT,
  p_external_id TEXT DEFAULT NULL
) RETURNS TABLE(inserted BOOLEAN, message_id UUID) AS $$
DECLARE
  lock_key BIGINT := hashtext(p_conversation_id::text);
  v_id UUID;
BEGIN
  -- Acquire transaction-scoped advisory lock (blocks concurrent calls for same conversation)
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Check if an outgoing message was already sent in last 30 seconds
  IF EXISTS (
    SELECT 1 FROM conversation_messages
    WHERE conversation_id = p_conversation_id
      AND direction = 'outgoing'
      AND created_at > NOW() - INTERVAL '30 seconds'
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- No recent outgoing message — safe to insert
  INSERT INTO conversation_messages (conversation_id, direction, content, media_type, external_id)
  VALUES (p_conversation_id, 'outgoing', p_content, 'text', COALESCE(p_external_id, 'ai_greeting_' || extract(epoch from now())::text))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT TRUE, v_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Performance indexes for AI Agent queries
-- Composite index for counting incoming messages per conversation (ai-agent rate limit check)
CREATE INDEX IF NOT EXISTS idx_conv_msgs_conv_direction_created
  ON conversation_messages(conversation_id, direction, created_at);

-- Index for ai_agent_logs lookups by conversation+agent (handoff trigger check)
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_conv_agent_created
  ON ai_agent_logs(conversation_id, agent_id, created_at);

-- Partial index for product search (only enabled products per agent)
CREATE INDEX IF NOT EXISTS idx_ai_products_agent_enabled
  ON ai_agent_products(agent_id) WHERE enabled = true;

-- Index for debounce queue lookups
CREATE INDEX IF NOT EXISTS idx_ai_debounce_queue_conv_processed
  ON ai_debounce_queue(conversation_id) WHERE processed = false;
