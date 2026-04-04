
-- =====================================================
-- Performance Indexes
-- =====================================================

-- conversations: heavily queried by inbox_id in RLS policies and helpdesk
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id 
  ON public.conversations (inbox_id);

-- conversations: filtered by assigned_to for agent workload
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to 
  ON public.conversations (assigned_to) 
  WHERE assigned_to IS NOT NULL;

-- conversations: filtered by status frequently
CREATE INDEX IF NOT EXISTS idx_conversations_status 
  ON public.conversations (status);

-- conversations: sorted by last_message_at in helpdesk list
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
  ON public.conversations (last_message_at DESC);

-- conversations: composite for common helpdesk query pattern
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_status 
  ON public.conversations (inbox_id, status);

-- conversation_messages: ordered by created_at within conversation
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_created 
  ON public.conversation_messages (conversation_id, created_at DESC);

-- lead_database_entries: lookup by phone (used in webhook auto-add)
CREATE INDEX IF NOT EXISTS idx_lead_database_entries_phone 
  ON public.lead_database_entries (phone);

-- lead_database_entries: composite for dedup check in webhook
CREATE INDEX IF NOT EXISTS idx_lead_entries_database_phone 
  ON public.lead_database_entries (database_id, phone);

-- contacts: lookup by phone
CREATE INDEX IF NOT EXISTS idx_contacts_phone 
  ON public.contacts (phone);

-- shift_report_configs: cron query pattern
CREATE INDEX IF NOT EXISTS idx_shift_report_configs_enabled_hour 
  ON public.shift_report_configs (enabled, send_hour) 
  WHERE enabled = true;

-- =====================================================
-- Foreign Key Constraints (missing)
-- =====================================================

-- user_instance_access: add FK to auth.users with CASCADE delete
ALTER TABLE public.user_instance_access 
  ADD CONSTRAINT fk_user_instance_access_user 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_instance_access: add FK to instances with CASCADE delete
ALTER TABLE public.user_instance_access 
  ADD CONSTRAINT fk_user_instance_access_instance 
  FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE CASCADE;

-- =====================================================
-- CHECK Constraints for enum-like fields
-- =====================================================

-- conversations.status: validate allowed values
ALTER TABLE public.conversations 
  ADD CONSTRAINT chk_conversations_status 
  CHECK (status IN ('aberta', 'pendente', 'em_andamento', 'resolvida'));

-- conversations.priority: validate allowed values
ALTER TABLE public.conversations 
  ADD CONSTRAINT chk_conversations_priority 
  CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'));
;
