-- Create broadcast_logs table to store history of broadcasts
CREATE TABLE public.broadcast_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id TEXT NOT NULL,
  instance_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  groups_targeted INTEGER NOT NULL DEFAULT 0,
  recipients_targeted INTEGER NOT NULL DEFAULT 0,
  recipients_success INTEGER NOT NULL DEFAULT 0,
  recipients_failed INTEGER NOT NULL DEFAULT 0,
  exclude_admins BOOLEAN NOT NULL DEFAULT false,
  random_delay TEXT DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'completed',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_broadcast_logs_user_id ON public.broadcast_logs(user_id);
CREATE INDEX idx_broadcast_logs_created_at ON public.broadcast_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own broadcast logs
CREATE POLICY "Users can view own broadcast logs"
ON public.broadcast_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own broadcast logs
CREATE POLICY "Users can insert own broadcast logs"
ON public.broadcast_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Super admins can view all broadcast logs
CREATE POLICY "Super admins can view all broadcast logs"
ON public.broadcast_logs
FOR SELECT
USING (is_super_admin(auth.uid()));