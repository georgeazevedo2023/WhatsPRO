-- Tabela principal de mensagens agendadas
CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id TEXT REFERENCES public.instances(id) ON DELETE CASCADE NOT NULL,
  
  -- Destinatario(s)
  group_jid TEXT NOT NULL,
  group_name TEXT,
  exclude_admins BOOLEAN DEFAULT false,
  recipients JSONB,
  
  -- Conteudo
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'ptt', 'document')),
  content TEXT,
  media_url TEXT,
  filename TEXT,
  
  -- Agendamento
  scheduled_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  
  -- Recorrencia
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'custom')),
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days INTEGER[],
  recurrence_end_at TIMESTAMPTZ,
  recurrence_count INTEGER,
  
  -- Controle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'paused')),
  executions_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indices para performance
CREATE INDEX idx_scheduled_messages_next_run ON scheduled_messages(next_run_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_messages_user ON scheduled_messages(user_id);
CREATE INDEX idx_scheduled_messages_instance ON scheduled_messages(instance_id);

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Usuarios podem gerenciar apenas seus proprios agendamentos
CREATE POLICY "Users can manage own scheduled messages" ON scheduled_messages
  FOR ALL USING (auth.uid() = user_id);

-- Super admins podem ver todos
CREATE POLICY "Super admins can view all scheduled messages" ON scheduled_messages
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabela de logs de execucao
CREATE TABLE public.scheduled_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID REFERENCES scheduled_messages(id) ON DELETE CASCADE NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  recipients_total INTEGER,
  recipients_success INTEGER,
  recipients_failed INTEGER,
  error_message TEXT,
  response_data JSONB
);

-- Index para logs
CREATE INDEX idx_scheduled_message_logs_message ON scheduled_message_logs(scheduled_message_id);

-- RLS para logs
ALTER TABLE scheduled_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON scheduled_message_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scheduled_messages sm 
      WHERE sm.id = scheduled_message_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all logs" ON scheduled_message_logs
  FOR SELECT USING (public.is_super_admin(auth.uid()));