-- =============================================================================
-- Database Audit v2.9.0 — Indexes, Foreign Keys, Constraints, Triggers
-- Items R44-R50 from the audit roadmap
-- =============================================================================

-- =========================================
-- R44: CREATE 10 MISSING INDEXES
-- =========================================

-- 1. contacts.phone — used in sync, lead matching, lookups
CREATE INDEX IF NOT EXISTS idx_contacts_phone
  ON public.contacts (phone);

-- 2. conversations.assigned_to — filtered in helpdesk by agent
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to
  ON public.conversations (assigned_to);

-- 3. conversations.status — filtered in helpdesk tabs (aberta/pendente/resolvida)
CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON public.conversations (status);

-- 4. conversations.last_message_at — sorted in conversation list
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations (last_message_at DESC);

-- 5. Composite: conversations(inbox_id, status) — most common filter combo
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_status
  ON public.conversations (inbox_id, status);

-- 6. conversation_messages.sender_id — filter messages by sender
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender_id
  ON public.conversation_messages (sender_id);

-- 7. inbox_users.user_id — find all inboxes for a given user
CREATE INDEX IF NOT EXISTS idx_inbox_users_user_id
  ON public.inbox_users (user_id);

-- 8. departments.inbox_id — already has FK but no index
CREATE INDEX IF NOT EXISTS idx_departments_inbox_id
  ON public.departments (inbox_id);

-- 9. lead_database_entries.phone — used during lead import dedup
CREATE INDEX IF NOT EXISTS idx_lead_database_entries_phone
  ON public.lead_database_entries (phone);

-- 10. Composite: kanban_cards(board_id, column_id) — cards in a specific column
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_column
  ON public.kanban_cards (board_id, column_id);


-- =========================================
-- R45: ADD 7 MISSING FOREIGN KEYS
-- =========================================
-- Note: We reference auth.users(id) instead of user_profiles(id) because
-- user_profiles.id is the same as auth.users.id (set by trigger on_auth_user_created).
-- Using auth.users ensures the FK is valid even if user_profiles row is delayed.

-- 1. conversations.assigned_to → auth.users(id) ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_conversations_assigned_to'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT fk_conversations_assigned_to
      FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. conversation_messages.sender_id → auth.users(id) ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_conversation_messages_sender_id'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD CONSTRAINT fk_conversation_messages_sender_id
      FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. department_members.user_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_department_members_user_id'
  ) THEN
    ALTER TABLE public.department_members
      ADD CONSTRAINT fk_department_members_user_id
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. kanban_board_members.user_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_kanban_board_members_user_id'
  ) THEN
    ALTER TABLE public.kanban_board_members
      ADD CONSTRAINT fk_kanban_board_members_user_id
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. kanban_cards.assigned_to → auth.users(id) ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_kanban_cards_assigned_to'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT fk_kanban_cards_assigned_to
      FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. kanban_cards.contact_id — ADD COLUMN if missing + FK to contacts(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanban_cards' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_kanban_cards_contact_id ON public.kanban_cards (contact_id);
  END IF;
END $$;

-- 7. user_instance_access.user_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_user_instance_access_user_id'
  ) THEN
    ALTER TABLE public.user_instance_access
      ADD CONSTRAINT fk_user_instance_access_user_id
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


-- =========================================
-- R46: UNIQUE on lead_database_entries(database_id, phone)
-- =========================================
-- Prevents importing the same phone number twice into the same database
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_lead_entries_database_phone'
  ) THEN
    -- Remove duplicates first (keep the most recent one)
    DELETE FROM public.lead_database_entries a
    USING public.lead_database_entries b
    WHERE a.database_id = b.database_id
      AND a.phone = b.phone
      AND a.created_at < b.created_at;

    ALTER TABLE public.lead_database_entries
      ADD CONSTRAINT uq_lead_entries_database_phone
      UNIQUE (database_id, phone);
  END IF;
END $$;


-- =========================================
-- R47: UNIQUE on message_templates(user_id, name)
-- =========================================
-- Prevents creating duplicate template names per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_message_templates_user_name'
  ) THEN
    -- Remove duplicates first (keep the most recent one)
    DELETE FROM public.message_templates a
    USING public.message_templates b
    WHERE a.user_id = b.user_id
      AND a.name = b.name
      AND a.created_at < b.created_at;

    ALTER TABLE public.message_templates
      ADD CONSTRAINT uq_message_templates_user_name
      UNIQUE (user_id, name);
  END IF;
END $$;


-- =========================================
-- R48: CHECK constraints on conversations.status and priority
-- =========================================

-- Status must be one of the known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_conversations_status'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT chk_conversations_status
      CHECK (status IN ('aberta', 'pendente', 'resolvida'));
  END IF;
END $$;

-- Priority must be one of the known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_conversations_priority'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT chk_conversations_priority
      CHECK (priority IN ('alta', 'media', 'baixa'));
  END IF;
END $$;


-- =========================================
-- R49: Trigger to auto-update conversations.last_message_at
-- =========================================
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.created_at);
  RETURN NEW;
END;
$function$;

-- Drop and recreate to avoid duplicates
DROP TRIGGER IF EXISTS trg_update_last_message_at ON public.conversation_messages;
CREATE TRIGGER trg_update_last_message_at
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message_at();
