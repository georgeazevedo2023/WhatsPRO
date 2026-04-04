
-- Fix FK on inboxes: SET NULL when instance is deleted (inbox can exist without instance)
ALTER TABLE public.inboxes DROP CONSTRAINT IF EXISTS inboxes_instance_id_fkey;
ALTER TABLE public.inboxes ADD CONSTRAINT inboxes_instance_id_fkey 
  FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE SET NULL;

-- Fix FK on scheduled_messages: CASCADE when instance is deleted
ALTER TABLE public.scheduled_messages DROP CONSTRAINT IF EXISTS scheduled_messages_instance_id_fkey;
ALTER TABLE public.scheduled_messages ADD CONSTRAINT scheduled_messages_instance_id_fkey 
  FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE CASCADE;

-- Fix FK on kanban_boards: SET NULL when instance is deleted (board can exist without instance)
ALTER TABLE public.kanban_boards DROP CONSTRAINT IF EXISTS kanban_boards_instance_id_fkey;
ALTER TABLE public.kanban_boards ADD CONSTRAINT kanban_boards_instance_id_fkey 
  FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE SET NULL;
;
