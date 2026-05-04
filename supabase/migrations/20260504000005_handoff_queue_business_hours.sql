-- D30 Sprint A.4 — Fila Inteligente de Handoff
-- (1) ai_agents.extended_hours_until: toggle "Expediente Estendido" pelo gestor.
-- (2) business_hours_exceptions: calendario de excecoes (feriados, eventos especiais).
--     UI v2 — schema pronto para Sprint E.

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS extended_hours_until TIMESTAMPTZ;

COMMENT ON COLUMN public.ai_agents.extended_hours_until IS
  'D30: Quando preenchido, ignora business_hours ate esta data/hora. Toggle "Expediente Estendido" no admin.';

CREATE TABLE IF NOT EXISTS public.business_hours_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_exceptions_agent_date
  ON public.business_hours_exceptions (agent_id, exception_date);

ALTER TABLE public.business_hours_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage business hours exceptions"
  ON public.business_hours_exceptions;
CREATE POLICY "Super admins can manage business hours exceptions"
  ON public.business_hours_exceptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Inbox users can view business hours exceptions"
  ON public.business_hours_exceptions;
CREATE POLICY "Inbox users can view business hours exceptions"
  ON public.business_hours_exceptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_agents a
      JOIN public.inboxes ib ON ib.instance_id = a.instance_id
      WHERE a.id = business_hours_exceptions.agent_id
        AND public.has_inbox_access(auth.uid(), ib.id)
    )
  );

COMMENT ON TABLE public.business_hours_exceptions IS
  'D30: Calendario de excecoes ao business_hours (feriados, eventos especiais). UNIQUE(agent_id, date).';
