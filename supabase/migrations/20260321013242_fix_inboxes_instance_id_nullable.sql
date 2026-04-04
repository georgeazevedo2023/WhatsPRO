
-- Allow inboxes.instance_id to be NULL (required for ON DELETE SET NULL to work)
ALTER TABLE public.inboxes ALTER COLUMN instance_id DROP NOT NULL;
;
