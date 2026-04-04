
-- Follow-up cadence fields on ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS follow_up_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS follow_up_rules JSONB DEFAULT '[]';
-- follow_up_rules format: [{ "days": 3, "message": "Olá {nome}..." }, { "days": 7, "message": "..." }]

-- Follow-up execution tracking
CREATE TABLE IF NOT EXISTS public.follow_up_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  instance_id TEXT REFERENCES public.instances(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  step INTEGER NOT NULL DEFAULT 1,
  message_sent TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'replied')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  replied_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_conv ON public.follow_up_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_contact ON public.follow_up_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_agent ON public.follow_up_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_executions(status) WHERE status = 'sent';

-- RLS
ALTER TABLE public.follow_up_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on follow_up_executions"
  ON public.follow_up_executions FOR ALL
  USING (true) WITH CHECK (true);
;
