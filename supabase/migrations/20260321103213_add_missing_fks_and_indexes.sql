
-- =============================================
-- 1. Missing Foreign Keys to auth.users
-- =============================================

-- conversations.assigned_to -> auth.users (SET NULL on delete - don't lose conversation)
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- kanban_cards.assigned_to -> auth.users (SET NULL on delete)
ALTER TABLE public.kanban_cards
  ADD CONSTRAINT kanban_cards_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- kanban_cards.created_by -> auth.users (SET NULL on delete)
ALTER TABLE public.kanban_cards
  ADD CONSTRAINT kanban_cards_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- department_members.user_id -> auth.users (CASCADE - remove membership on user delete)
ALTER TABLE public.department_members
  ADD CONSTRAINT department_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- kanban_board_members.user_id -> auth.users (CASCADE)
ALTER TABLE public.kanban_board_members
  ADD CONSTRAINT kanban_board_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- inbox_users.user_id -> auth.users (CASCADE)
ALTER TABLE public.inbox_users
  ADD CONSTRAINT inbox_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================
-- 2. Missing Indexes
-- =============================================

-- conversations: priority (used in filters)
CREATE INDEX IF NOT EXISTS idx_conversations_priority
  ON public.conversations (priority);

-- conversations: department_id (used in department filter)
CREATE INDEX IF NOT EXISTS idx_conversations_department_id
  ON public.conversations (department_id) WHERE department_id IS NOT NULL;

-- conversation_messages: direction (used in private_note filters)
CREATE INDEX IF NOT EXISTS idx_conversation_messages_direction
  ON public.conversation_messages (conversation_id, direction);

-- instances: user_id (list user's instances)
CREATE INDEX IF NOT EXISTS idx_instances_user_id
  ON public.instances (user_id);

-- instances: disabled (filter active instances)
CREATE INDEX IF NOT EXISTS idx_instances_disabled
  ON public.instances (disabled) WHERE disabled = false;
;
