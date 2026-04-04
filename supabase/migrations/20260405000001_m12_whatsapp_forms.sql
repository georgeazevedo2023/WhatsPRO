-- Migration M12: WhatsApp Forms — Formulários via conversa WhatsApp

-- 1. Tabela principal de formulários
CREATE TABLE public.whatsapp_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  welcome_message TEXT NOT NULL DEFAULT 'Olá! Vou te fazer algumas perguntas rápidas. 😊',
  completion_message TEXT NOT NULL DEFAULT 'Obrigado pelas suas respostas! Entraremos em contato em breve. ✅',
  webhook_url TEXT,
  max_submissions INTEGER,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug único por agente (não global, pois slugs podem ser reutilizados por agentes diferentes)
CREATE UNIQUE INDEX idx_whatsapp_forms_agent_slug ON public.whatsapp_forms(agent_id, slug);

-- 2. Campos do formulário
CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.whatsapp_forms(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  field_type TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  validation_rules JSONB,
  error_message TEXT,
  skip_if_known BOOLEAN NOT NULL DEFAULT false,
  field_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_fields_form_id ON public.form_fields(form_id, position);

-- 3. Sessões ativas de formulário por conversa
CREATE TABLE public.form_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.whatsapp_forms(id),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id),
  contact_id UUID REFERENCES public.contacts(id),
  current_field_index INTEGER NOT NULL DEFAULT 0,
  collected_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  retries INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_sessions_conversation ON public.form_sessions(conversation_id, status);
CREATE INDEX idx_form_sessions_form_status ON public.form_sessions(form_id, status, started_at DESC);

-- 4. Submissões completas
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.whatsapp_forms(id),
  session_id UUID REFERENCES public.form_sessions(id),
  contact_id UUID REFERENCES public.contacts(id),
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submissions_form_id ON public.form_submissions(form_id, submitted_at DESC);

-- 5. RLS Policies

-- whatsapp_forms: admin lê/escreve os próprios; service role acesso total
ALTER TABLE public.whatsapp_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forms_select_own" ON public.whatsapp_forms
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "forms_insert_own" ON public.whatsapp_forms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "forms_update_own" ON public.whatsapp_forms
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "forms_delete_own" ON public.whatsapp_forms
  FOR DELETE USING (auth.uid() = created_by);

-- form_fields: herda acesso do form via join
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_fields_select" ON public.form_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_forms f
      WHERE f.id = form_fields.form_id AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "form_fields_insert" ON public.form_fields
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_forms f
      WHERE f.id = form_fields.form_id AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "form_fields_update" ON public.form_fields
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_forms f
      WHERE f.id = form_fields.form_id AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "form_fields_delete" ON public.form_fields
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_forms f
      WHERE f.id = form_fields.form_id AND f.created_by = auth.uid()
    )
  );

-- form_sessions e form_submissions: apenas service role (edge function form-bot)
ALTER TABLE public.form_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Admin pode ver submissões dos próprios formulários
CREATE POLICY "submissions_select_own" ON public.form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_forms f
      WHERE f.id = form_submissions.form_id AND f.created_by = auth.uid()
    )
  );

-- 6. RPC para buscar sessão ativa de uma conversa
CREATE OR REPLACE FUNCTION public.get_active_form_session(p_conversation_id UUID)
RETURNS SETOF public.form_sessions
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM public.form_sessions
  WHERE conversation_id = p_conversation_id
    AND status = 'in_progress'
  LIMIT 1;
$$;

-- 7. RPC para stats de submissões
CREATE OR REPLACE FUNCTION public.get_form_stats(p_form_id UUID)
RETURNS TABLE(total BIGINT, today BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE submitted_at >= CURRENT_DATE)::BIGINT AS today
  FROM public.form_submissions
  WHERE form_id = p_form_id;
$$;
