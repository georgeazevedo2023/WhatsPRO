
-- Fix all foreign keys referencing inboxes to use ON DELETE CASCADE

-- conversations
ALTER TABLE public.conversations DROP CONSTRAINT conversations_inbox_id_fkey;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE CASCADE;

-- departments
ALTER TABLE public.departments DROP CONSTRAINT departments_inbox_id_fkey;
ALTER TABLE public.departments ADD CONSTRAINT departments_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE CASCADE;

-- inbox_users
ALTER TABLE public.inbox_users DROP CONSTRAINT inbox_users_inbox_id_fkey;
ALTER TABLE public.inbox_users ADD CONSTRAINT inbox_users_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE CASCADE;

-- kanban_boards
ALTER TABLE public.kanban_boards DROP CONSTRAINT kanban_boards_inbox_id_fkey;
ALTER TABLE public.kanban_boards ADD CONSTRAINT kanban_boards_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE SET NULL;

-- labels
ALTER TABLE public.labels DROP CONSTRAINT labels_inbox_id_fkey;
ALTER TABLE public.labels ADD CONSTRAINT labels_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE CASCADE;

-- shift_report_configs
ALTER TABLE public.shift_report_configs DROP CONSTRAINT shift_report_configs_inbox_id_fkey;
ALTER TABLE public.shift_report_configs ADD CONSTRAINT shift_report_configs_inbox_id_fkey
  FOREIGN KEY (inbox_id) REFERENCES public.inboxes(id) ON DELETE CASCADE;
;
