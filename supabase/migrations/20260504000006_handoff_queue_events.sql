-- D30 Sprint A.5 — Fila Inteligente de Handoff
-- Tabela de eventos da fila. Lifecycle:
--   active -> responded (assignee mandou outgoing)
--   active -> timed_out (cron requeue-conversations)
--   active -> manual_override (gestor reatribuiu)
--   active -> cancelled (conversa finalizada)
-- Em horario nao-comercial: paused_at set, expires_at congela.

CREATE TABLE IF NOT EXISTS public.handoff_queue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  department_id UUID NOT NULL
    REFERENCES public.departments(id) ON DELETE CASCADE,
  previous_assignee_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  position_in_queue INTEGER,
  rotation_number INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  paused_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  out_of_hours_msg_sent BOOLEAN NOT NULL DEFAULT false,
  resolved_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT handoff_queue_events_status_chk
    CHECK (status IN ('active','responded','timed_out','manual_override','cancelled'))
);

-- Indice principal do cron (R28: predicado IMMUTABLE — filtro now() vai na query)
CREATE INDEX IF NOT EXISTS idx_handoff_queue_events_active_expires
  ON public.handoff_queue_events (expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_handoff_queue_events_conversation
  ON public.handoff_queue_events (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_handoff_queue_events_assigned_active
  ON public.handoff_queue_events (assigned_user_id)
  WHERE status = 'active';

ALTER TABLE public.handoff_queue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage handoff queue events"
  ON public.handoff_queue_events;
CREATE POLICY "Super admins can manage handoff queue events"
  ON public.handoff_queue_events FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Atendentes / gestores podem ver eventos das conversas que tem acesso
-- (necessario para badge "Em fila — Lucas (3:42)" no helpdesk).
DROP POLICY IF EXISTS "Inbox users can view handoff queue events"
  ON public.handoff_queue_events;
CREATE POLICY "Inbox users can view handoff queue events"
  ON public.handoff_queue_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = handoff_queue_events.conversation_id
        AND public.has_inbox_access(auth.uid(), c.inbox_id)
    )
  );

COMMENT ON TABLE public.handoff_queue_events IS
  'D30: Eventos da Fila Inteligente de Handoff. Lifecycle: active -> responded|timed_out|manual_override|cancelled.';
COMMENT ON COLUMN public.handoff_queue_events.expires_at IS
  'D30: Quando assignee precisa responder. Em horario nao-comercial congela via paused_at; descongela com timeout completo (nao saldo).';
COMMENT ON COLUMN public.handoff_queue_events.rotation_number IS
  'D30: Quantas voltas na fila. Quando > tamanho_da_fila o gestor recebe sino (Q4: loop infinito).';
