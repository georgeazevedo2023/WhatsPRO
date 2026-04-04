-- M10: AI Agent Module - Core Tables

CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL DEFAULT 'Assistente IA',
  greeting_message TEXT NOT NULL DEFAULT 'Olá! Como posso ajudá-lo?',
  personality TEXT DEFAULT 'Profissional, simpático e objetivo',
  system_prompt TEXT DEFAULT '',
  sub_agents JSONB DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  temperature FLOAT NOT NULL DEFAULT 0.7,
  max_tokens INT NOT NULL DEFAULT 1024,
  debounce_seconds INT NOT NULL DEFAULT 10,
  handoff_triggers TEXT[] DEFAULT ARRAY['atendente', 'humano', 'gerente', 'falar com pessoa'],
  handoff_cooldown_minutes INT NOT NULL DEFAULT 30,
  handoff_max_conversation_minutes INT NOT NULL DEFAULT 15,
  handoff_negative_sentiment BOOLEAN NOT NULL DEFAULT true,
  blocked_topics TEXT[] DEFAULT '{}',
  max_discount_percent FLOAT DEFAULT NULL,
  blocked_phrases TEXT[] DEFAULT '{}',
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  voice_max_text_length INT NOT NULL DEFAULT 150,
  context_short_messages INT NOT NULL DEFAULT 10,
  context_long_enabled BOOLEAN NOT NULL DEFAULT true,
  business_hours JSONB DEFAULT NULL,
  out_of_hours_message TEXT DEFAULT 'Estamos fora do horário de atendimento. Retornaremos em breve!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_agents_instance_unique UNIQUE (instance_id)
);

CREATE TABLE public.ai_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  event TEXT NOT NULL DEFAULT 'message_received',
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model TEXT,
  latency_ms INT DEFAULT 0,
  sub_agent TEXT,
  tool_calls JSONB DEFAULT NULL,
  error TEXT,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_debounce_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  process_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_debounce_queue_conv_unique UNIQUE (conversation_id)
);

CREATE TABLE public.lead_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  full_name TEXT, city TEXT, state TEXT, cpf TEXT,
  birth_date DATE, email TEXT, company TEXT, role TEXT,
  interests TEXT[] DEFAULT '{}',
  tags JSONB DEFAULT '{}'::jsonb,
  last_purchase TEXT,
  average_ticket DECIMAL(10,2),
  total_interactions INT NOT NULL DEFAULT 0,
  first_contact_at TIMESTAMPTZ DEFAULT now(),
  last_contact_at TIMESTAMPTZ DEFAULT now(),
  sentiment_history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_profiles_contact_unique UNIQUE (contact_id)
);

-- Indexes
CREATE INDEX idx_ai_agents_instance ON public.ai_agents(instance_id);
CREATE INDEX idx_ai_agent_logs_agent ON public.ai_agent_logs(agent_id);
CREATE INDEX idx_ai_agent_logs_created ON public.ai_agent_logs(created_at DESC);
CREATE INDEX idx_ai_debounce_process ON public.ai_debounce_queue(process_after) WHERE NOT processed;
CREATE INDEX idx_lead_profiles_contact ON public.lead_profiles(contact_id);

-- RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_debounce_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_ai_agents" ON public.ai_agents FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "user_view_ai_agents" ON public.ai_agents FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_instance_access WHERE instance_id = ai_agents.instance_id AND user_id = auth.uid()));

CREATE POLICY "sa_ai_logs" ON public.ai_agent_logs FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "all_debounce" ON public.ai_debounce_queue FOR ALL USING (true);
CREATE POLICY "sa_lead_profiles" ON public.lead_profiles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "user_view_leads" ON public.lead_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM contacts c JOIN conversations cv ON cv.contact_id = c.id WHERE c.id = lead_profiles.contact_id AND has_inbox_access(auth.uid(), cv.inbox_id)));

-- Auto-update triggers
CREATE TRIGGER ai_agents_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER lead_profiles_updated_at BEFORE UPDATE ON public.lead_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;
