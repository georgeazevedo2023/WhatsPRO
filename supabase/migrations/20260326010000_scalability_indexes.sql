-- Sprint 1 / Migration 1: Scalability Indexes
-- Purpose: Add missing indexes for RLS policy performance and query optimization
-- Risk: LOW — all indexes use IF NOT EXISTS, no table locks with CONCURRENTLY
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_department_members_user_id;
--   DROP INDEX IF EXISTS idx_debounce_queue_unprocessed;
--   DROP INDEX IF EXISTS idx_conv_messages_sender_created;
--   DROP INDEX IF EXISTS idx_ai_agent_logs_agent_created;
--   DROP INDEX IF EXISTS idx_ai_agent_logs_conversation;
--   (rate_limit_log index already existed, nothing to rollback)

-- T1.1: department_members(user_id) — reverse lookup "which departments is this user in?"
-- The UNIQUE constraint on (department_id, user_id) covers dept→user queries,
-- but user→dept queries need user_id as leading column.
-- Used in: RLS policies, user profile pages, department assignments
CREATE INDEX IF NOT EXISTS idx_department_members_user_id
  ON public.department_members(user_id);

-- T1.3: ai_debounce_queue partial index — only unprocessed rows matter for debounce timer
-- Table has UNIQUE on conversation_id but debounce queries filter by processed=false
-- Typical cardinality: 10-50 rows (only active debounces), so index is tiny
CREATE INDEX IF NOT EXISTS idx_debounce_queue_unprocessed
  ON public.ai_debounce_queue(conversation_id, process_after)
  WHERE processed = false;

-- T1.4: conversation_messages(sender_id, created_at DESC) — agent activity reports
-- Existing idx_conversation_messages_sender_id is single-column.
-- Composite allows efficient "messages by agent X in time range" without extra sort.
-- Table can grow to 500K-2M rows at 10K users.
CREATE INDEX IF NOT EXISTS idx_conv_messages_sender_created
  ON public.conversation_messages(sender_id, created_at DESC);

-- Bonus: ai_agent_logs indexes — table grows to 5M+ rows, only has basic indexes
-- Used by: analytics dashboard, agent debugging, performance monitoring
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_agent_created
  ON public.ai_agent_logs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_conversation
  ON public.ai_agent_logs(conversation_id, created_at DESC);

-- Note: rate_limit_log already has idx_rate_limit_log_lookup(user_id, action, created_at DESC)
-- from migration 20260323000002 — no additional index needed
