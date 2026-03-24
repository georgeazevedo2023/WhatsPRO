
-- Add instance_id to lead_databases to link auto-generated databases to instances
ALTER TABLE public.lead_databases ADD COLUMN instance_id text;

-- Create unique index so each instance has at most one auto-generated database
CREATE UNIQUE INDEX idx_lead_databases_instance_id ON public.lead_databases (instance_id) WHERE instance_id IS NOT NULL;
