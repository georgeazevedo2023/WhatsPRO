
-- Enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'user', 'gerente');
CREATE TYPE public.inbox_role AS ENUM ('admin', 'gestor', 'agente');
CREATE TYPE public.kanban_field_type AS ENUM ('text', 'currency', 'date', 'select', 'entity_select');
CREATE TYPE public.kanban_visibility AS ENUM ('shared', 'private');

-- Tables in dependency order

CREATE TABLE public.instances (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  owner_jid text,
  profile_pic_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  jid text NOT NULL,
  name text,
  profile_pic_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.inboxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id text NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  webhook_url text,
  webhook_outgoing_url text,
  PRIMARY KEY (id),
  CONSTRAINT inboxes_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id)
);

CREATE TABLE public.labels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  inbox_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT labels_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id)
);

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  inbox_id uuid NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT departments_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id)
);

CREATE TABLE public.department_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT department_members_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT department_members_department_id_user_id_key UNIQUE (department_id, user_id)
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  priority text NOT NULL DEFAULT 'media',
  assigned_to uuid,
  is_read boolean NOT NULL DEFAULT false,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message text,
  status_ia text,
  ai_summary jsonb,
  ai_summary_expires_at timestamptz,
  department_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT conversations_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id),
  CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT conversations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);

CREATE TABLE public.conversation_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  direction text NOT NULL DEFAULT 'incoming',
  content text,
  media_type text NOT NULL DEFAULT 'text',
  media_url text,
  sender_id uuid,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  transcription text,
  PRIMARY KEY (id),
  CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);

CREATE TABLE public.conversation_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  label_id uuid NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT conversation_labels_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT conversation_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id)
);

CREATE TABLE public.inbox_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.inbox_role NOT NULL DEFAULT 'agente',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT inbox_users_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id)
);

CREATE TABLE public.user_instance_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.instance_connection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id text NOT NULL,
  event_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  PRIMARY KEY (id)
);

CREATE TABLE public.kanban_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  visibility public.kanban_visibility NOT NULL DEFAULT 'shared',
  inbox_id uuid,
  instance_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_boards_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id),
  CONSTRAINT kanban_boards_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id)
);

CREATE TABLE public.kanban_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  automation_message text,
  automation_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_columns_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id)
);

CREATE TABLE public.kanban_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_entities_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id)
);

CREATE TABLE public.kanban_entity_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_entity_values_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.kanban_entities(id)
);

CREATE TABLE public.kanban_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  name text NOT NULL,
  field_type public.kanban_field_type NOT NULL DEFAULT 'text',
  options jsonb,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  show_on_card boolean NOT NULL DEFAULT false,
  entity_id uuid,
  PRIMARY KEY (id),
  CONSTRAINT kanban_fields_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id),
  CONSTRAINT kanban_fields_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.kanban_entities(id)
);

CREATE TABLE public.kanban_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  column_id uuid NOT NULL,
  title text NOT NULL,
  assigned_to uuid,
  created_by uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  PRIMARY KEY (id),
  CONSTRAINT kanban_cards_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id),
  CONSTRAINT kanban_cards_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.kanban_columns(id)
);

CREATE TABLE public.kanban_card_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  field_id uuid NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_card_data_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.kanban_cards(id),
  CONSTRAINT kanban_card_data_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.kanban_fields(id)
);

CREATE TABLE public.kanban_board_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT kanban_board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id)
);

CREATE TABLE public.lead_databases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  leads_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  instance_id text,
  PRIMARY KEY (id)
);

CREATE TABLE public.lead_database_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  jid text NOT NULL,
  is_verified boolean DEFAULT false,
  verified_name text,
  verification_status text,
  source text DEFAULT 'paste',
  group_name text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT lead_database_entries_database_id_fkey FOREIGN KEY (database_id) REFERENCES public.lead_databases(id)
);

CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  media_url text,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category text,
  carousel_data jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE public.scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id text NOT NULL,
  group_jid text NOT NULL,
  group_name text,
  exclude_admins boolean DEFAULT false,
  recipients jsonb,
  message_type text NOT NULL,
  content text,
  media_url text,
  filename text,
  scheduled_at timestamptz NOT NULL,
  next_run_at timestamptz NOT NULL,
  is_recurring boolean DEFAULT false,
  recurrence_type text,
  recurrence_interval integer DEFAULT 1,
  recurrence_days integer[],
  recurrence_end_at timestamptz,
  recurrence_count integer,
  status text NOT NULL DEFAULT 'pending',
  executions_count integer DEFAULT 0,
  last_executed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  random_delay text DEFAULT 'none',
  PRIMARY KEY (id),
  CONSTRAINT scheduled_messages_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id)
);

CREATE TABLE public.scheduled_message_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_message_id uuid NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  recipients_total integer,
  recipients_success integer,
  recipients_failed integer,
  error_message text,
  response_data jsonb,
  PRIMARY KEY (id),
  CONSTRAINT scheduled_message_logs_scheduled_message_id_fkey FOREIGN KEY (scheduled_message_id) REFERENCES public.scheduled_messages(id)
);

CREATE TABLE public.broadcast_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id text NOT NULL,
  instance_name text,
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  groups_targeted integer NOT NULL DEFAULT 0,
  recipients_targeted integer NOT NULL DEFAULT 0,
  recipients_success integer NOT NULL DEFAULT 0,
  recipients_failed integer NOT NULL DEFAULT 0,
  exclude_admins boolean NOT NULL DEFAULT false,
  random_delay text DEFAULT 'none',
  status text NOT NULL DEFAULT 'completed',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  group_names text[] DEFAULT '{}',
  carousel_data jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE public.shift_report_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  inbox_id uuid NOT NULL,
  instance_id text NOT NULL,
  recipient_number text NOT NULL,
  send_hour integer NOT NULL DEFAULT 18,
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT shift_report_configs_inbox_id_fkey FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id)
);

CREATE TABLE public.shift_report_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  conversations_total integer,
  conversations_resolved integer,
  error_message text,
  report_content text,
  PRIMARY KEY (id),
  CONSTRAINT shift_report_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.shift_report_configs(id)
);
;
