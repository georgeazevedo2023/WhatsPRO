
-- conversation_labels -> conversations
ALTER TABLE public.conversation_labels DROP CONSTRAINT conversation_labels_conversation_id_fkey;
ALTER TABLE public.conversation_labels ADD CONSTRAINT conversation_labels_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- conversation_labels -> labels
ALTER TABLE public.conversation_labels DROP CONSTRAINT conversation_labels_label_id_fkey;
ALTER TABLE public.conversation_labels ADD CONSTRAINT conversation_labels_label_id_fkey
  FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;

-- conversation_messages -> conversations
ALTER TABLE public.conversation_messages DROP CONSTRAINT conversation_messages_conversation_id_fkey;
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- conversations -> departments (SET NULL, department can be removed without deleting conversation)
ALTER TABLE public.conversations DROP CONSTRAINT conversations_department_id_fkey;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- conversations -> contacts
ALTER TABLE public.conversations DROP CONSTRAINT conversations_contact_id_fkey;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- department_members -> departments
ALTER TABLE public.department_members DROP CONSTRAINT department_members_department_id_fkey;
ALTER TABLE public.department_members ADD CONSTRAINT department_members_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

-- kanban_board_members -> kanban_boards
ALTER TABLE public.kanban_board_members DROP CONSTRAINT kanban_board_members_board_id_fkey;
ALTER TABLE public.kanban_board_members ADD CONSTRAINT kanban_board_members_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- kanban_card_data -> kanban_cards
ALTER TABLE public.kanban_card_data DROP CONSTRAINT kanban_card_data_card_id_fkey;
ALTER TABLE public.kanban_card_data ADD CONSTRAINT kanban_card_data_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.kanban_cards(id) ON DELETE CASCADE;

-- kanban_card_data -> kanban_fields
ALTER TABLE public.kanban_card_data DROP CONSTRAINT kanban_card_data_field_id_fkey;
ALTER TABLE public.kanban_card_data ADD CONSTRAINT kanban_card_data_field_id_fkey
  FOREIGN KEY (field_id) REFERENCES public.kanban_fields(id) ON DELETE CASCADE;

-- kanban_cards -> kanban_boards
ALTER TABLE public.kanban_cards DROP CONSTRAINT kanban_cards_board_id_fkey;
ALTER TABLE public.kanban_cards ADD CONSTRAINT kanban_cards_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- kanban_cards -> kanban_columns
ALTER TABLE public.kanban_cards DROP CONSTRAINT kanban_cards_column_id_fkey;
ALTER TABLE public.kanban_cards ADD CONSTRAINT kanban_cards_column_id_fkey
  FOREIGN KEY (column_id) REFERENCES public.kanban_columns(id) ON DELETE CASCADE;

-- kanban_columns -> kanban_boards
ALTER TABLE public.kanban_columns DROP CONSTRAINT kanban_columns_board_id_fkey;
ALTER TABLE public.kanban_columns ADD CONSTRAINT kanban_columns_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- kanban_entities -> kanban_boards
ALTER TABLE public.kanban_entities DROP CONSTRAINT kanban_entities_board_id_fkey;
ALTER TABLE public.kanban_entities ADD CONSTRAINT kanban_entities_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- kanban_entity_values -> kanban_entities
ALTER TABLE public.kanban_entity_values DROP CONSTRAINT kanban_entity_values_entity_id_fkey;
ALTER TABLE public.kanban_entity_values ADD CONSTRAINT kanban_entity_values_entity_id_fkey
  FOREIGN KEY (entity_id) REFERENCES public.kanban_entities(id) ON DELETE CASCADE;

-- kanban_fields -> kanban_boards
ALTER TABLE public.kanban_fields DROP CONSTRAINT kanban_fields_board_id_fkey;
ALTER TABLE public.kanban_fields ADD CONSTRAINT kanban_fields_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE;

-- kanban_fields -> kanban_entities (SET NULL)
ALTER TABLE public.kanban_fields DROP CONSTRAINT kanban_fields_entity_id_fkey;
ALTER TABLE public.kanban_fields ADD CONSTRAINT kanban_fields_entity_id_fkey
  FOREIGN KEY (entity_id) REFERENCES public.kanban_entities(id) ON DELETE SET NULL;

-- lead_database_entries -> lead_databases
ALTER TABLE public.lead_database_entries DROP CONSTRAINT lead_database_entries_database_id_fkey;
ALTER TABLE public.lead_database_entries ADD CONSTRAINT lead_database_entries_database_id_fkey
  FOREIGN KEY (database_id) REFERENCES public.lead_databases(id) ON DELETE CASCADE;

-- scheduled_message_logs -> scheduled_messages
ALTER TABLE public.scheduled_message_logs DROP CONSTRAINT scheduled_message_logs_scheduled_message_id_fkey;
ALTER TABLE public.scheduled_message_logs ADD CONSTRAINT scheduled_message_logs_scheduled_message_id_fkey
  FOREIGN KEY (scheduled_message_id) REFERENCES public.scheduled_messages(id) ON DELETE CASCADE;

-- shift_report_logs -> shift_report_configs
ALTER TABLE public.shift_report_logs DROP CONSTRAINT shift_report_logs_config_id_fkey;
ALTER TABLE public.shift_report_logs ADD CONSTRAINT shift_report_logs_config_id_fkey
  FOREIGN KEY (config_id) REFERENCES public.shift_report_configs(id) ON DELETE CASCADE;
;
