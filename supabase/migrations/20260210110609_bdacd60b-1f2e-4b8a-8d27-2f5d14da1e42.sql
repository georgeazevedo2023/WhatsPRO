
-- Create instance_connection_logs table
CREATE TABLE public.instance_connection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id text NOT NULL,
  event_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid
);

-- Enable RLS
ALTER TABLE public.instance_connection_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs of their instances (via user_instance_access)
CREATE POLICY "Users can view logs of assigned instances"
ON public.instance_connection_logs
FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_instance_access
    WHERE user_instance_access.instance_id = instance_connection_logs.instance_id
    AND user_instance_access.user_id = auth.uid()
  )
);

-- Users can insert logs for assigned instances
CREATE POLICY "Users can insert logs for assigned instances"
ON public.instance_connection_logs
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_instance_access
    WHERE user_instance_access.instance_id = instance_connection_logs.instance_id
    AND user_instance_access.user_id = auth.uid()
  )
);

-- Create trigger function to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_instance_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.instance_connection_logs (instance_id, event_type, description, metadata, user_id)
    VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'connected' THEN 'connected' ELSE 'disconnected' END,
      CASE WHEN NEW.status = 'connected'
        THEN 'Conectado ao WhatsApp'
        ELSE 'Desconectado do WhatsApp'
      END,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'owner_jid', NEW.owner_jid
      ),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on instances table
CREATE TRIGGER on_instance_status_change
BEFORE UPDATE ON public.instances
FOR EACH ROW
EXECUTE FUNCTION public.log_instance_status_change();

-- Seed: insert 'created' event for each existing instance
INSERT INTO public.instance_connection_logs (instance_id, event_type, description, metadata, user_id, created_at)
SELECT id, 'created', 'Instância criada no sistema', jsonb_build_object('name', name), user_id, created_at
FROM public.instances;

-- Create index for faster queries
CREATE INDEX idx_instance_connection_logs_instance_id ON public.instance_connection_logs (instance_id);
CREATE INDEX idx_instance_connection_logs_created_at ON public.instance_connection_logs (created_at DESC);
