
-- Indexes
CREATE INDEX idx_broadcast_logs_created_at ON public.broadcast_logs USING btree (created_at DESC);
CREATE INDEX idx_broadcast_logs_user_id ON public.broadcast_logs USING btree (user_id);
CREATE UNIQUE INDEX contacts_jid_key ON public.contacts USING btree (jid);
CREATE UNIQUE INDEX conversation_labels_conversation_id_label_id_key ON public.conversation_labels USING btree (conversation_id, label_id);
CREATE UNIQUE INDEX idx_conversation_messages_normalized_external_id ON public.conversation_messages USING btree (conversation_id, normalize_external_id(external_id)) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX inbox_users_inbox_id_user_id_key ON public.inbox_users USING btree (inbox_id, user_id);
CREATE UNIQUE INDEX inbox_users_user_id_inbox_id_key ON public.inbox_users USING btree (user_id, inbox_id);
CREATE INDEX idx_instance_connection_logs_created_at ON public.instance_connection_logs USING btree (created_at DESC);
CREATE INDEX idx_instance_connection_logs_instance_id ON public.instance_connection_logs USING btree (instance_id);
CREATE UNIQUE INDEX kanban_board_members_board_id_user_id_key ON public.kanban_board_members USING btree (board_id, user_id);
CREATE INDEX idx_kanban_card_data_card_id ON public.kanban_card_data USING btree (card_id);
CREATE UNIQUE INDEX kanban_card_data_card_id_field_id_key ON public.kanban_card_data USING btree (card_id, field_id);
CREATE INDEX idx_kanban_cards_assigned_to ON public.kanban_cards USING btree (assigned_to);
CREATE INDEX idx_kanban_cards_board_id ON public.kanban_cards USING btree (board_id);
CREATE INDEX idx_kanban_cards_column_id ON public.kanban_cards USING btree (column_id);
CREATE INDEX idx_kanban_cards_created_by ON public.kanban_cards USING btree (created_by);
CREATE INDEX idx_kanban_columns_board_id ON public.kanban_columns USING btree (board_id);
CREATE INDEX idx_kanban_fields_board_id ON public.kanban_fields USING btree (board_id);
CREATE INDEX idx_lead_entries_database ON public.lead_database_entries USING btree (database_id);
CREATE UNIQUE INDEX idx_lead_databases_instance_id ON public.lead_databases USING btree (instance_id) WHERE instance_id IS NOT NULL;
CREATE INDEX idx_message_templates_category ON public.message_templates USING btree (category);
CREATE INDEX idx_scheduled_message_logs_message ON public.scheduled_message_logs USING btree (scheduled_message_id);
CREATE INDEX idx_scheduled_messages_instance ON public.scheduled_messages USING btree (instance_id);
CREATE INDEX idx_scheduled_messages_next_run ON public.scheduled_messages USING btree (next_run_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_messages_user ON public.scheduled_messages USING btree (user_id);
CREATE INDEX idx_user_instance_access_instance_id ON public.user_instance_access USING btree (instance_id);
CREATE INDEX idx_user_instance_access_user_id ON public.user_instance_access USING btree (user_id);
CREATE UNIQUE INDEX user_instance_access_user_id_instance_id_key ON public.user_instance_access USING btree (user_id, instance_id);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);

-- Triggers
CREATE TRIGGER auto_summarize_on_resolve
  AFTER UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_summarize();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_instance_status_change
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.log_instance_status_change();

CREATE TRIGGER update_instances_updated_at
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_boards_updated_at
  BEFORE UPDATE ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_databases_updated_at
  BEFORE UPDATE ON public.lead_databases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_report_configs_updated_at
  BEFORE UPDATE ON public.shift_report_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER ensure_single_default_department
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_department();
;
