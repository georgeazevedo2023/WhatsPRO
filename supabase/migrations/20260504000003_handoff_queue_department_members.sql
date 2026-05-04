-- D30 Sprint A.2 — Fila Inteligente de Handoff
-- Atributos por membro: ordem manual (drag-drop), pause individual,
-- toggle "incluir gestor na fila" (Q6: gestor fora por default).

ALTER TABLE public.department_members
  ADD COLUMN IF NOT EXISTS queue_position INTEGER,
  ADD COLUMN IF NOT EXISTS queue_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS gestor_in_queue BOOLEAN NOT NULL DEFAULT false;

-- Index para o lookup do round-robin (R28: predicado IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_department_members_queue_lookup
  ON public.department_members (department_id, queue_position)
  WHERE queue_paused = false;

COMMENT ON COLUMN public.department_members.queue_position IS
  'D30: Ordem manual via drag-drop. NULL = nao posicionado (ordena por created_at).';
COMMENT ON COLUMN public.department_members.queue_paused IS
  'D30: Toggle pessoal Disponivel/Pausado no Helpdesk. true = sistema pula este membro.';
COMMENT ON COLUMN public.department_members.queue_paused_reason IS
  'D30: Motivo do pause (almoco, reuniao, etc.). Opcional, exibido no helpdesk.';
COMMENT ON COLUMN public.department_members.gestor_in_queue IS
  'D30: Para membros com role gerente, true = participa do round-robin. Default false (gestor fora por default).';

-- Backfill queue_position para membros existentes (espacado por 10 para drag-drop futuro).
-- Idempotente: WHERE queue_position IS NULL.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY department_id ORDER BY created_at, id
  ) * 10 AS pos
  FROM public.department_members
  WHERE queue_position IS NULL
)
UPDATE public.department_members dm
   SET queue_position = ranked.pos
  FROM ranked
 WHERE dm.id = ranked.id;
