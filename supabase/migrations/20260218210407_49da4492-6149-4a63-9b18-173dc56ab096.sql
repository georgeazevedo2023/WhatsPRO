
-- Tabela de configurações de relatório de turno
CREATE TABLE public.shift_report_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL,
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  recipient_number text NOT NULL,
  send_hour integer NOT NULL DEFAULT 18 CHECK (send_hour >= 0 AND send_hour <= 23),
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_report_configs ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage these configs
CREATE POLICY "Super admins can manage shift report configs"
  ON public.shift_report_configs
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_shift_report_configs_updated_at
  BEFORE UPDATE ON public.shift_report_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de logs de relatórios enviados
CREATE TABLE public.shift_report_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.shift_report_configs(id) ON DELETE CASCADE,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  conversations_total integer,
  conversations_resolved integer,
  error_message text,
  report_content text
);

ALTER TABLE public.shift_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view shift report logs"
  ON public.shift_report_logs
  FOR ALL
  USING (is_super_admin(auth.uid()));
