-- D30 Sprint A.1 — Fila Inteligente de Handoff
-- Adiciona colunas de configuracao de fila no departamento.
-- Modo Fila ON: round-robin global com cursor `last_assignee_position`.
-- Modo Fila OFF (default): 100% para `default_assignee_id` (gestor-de-chao).

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS queue_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_mode_timeout_minutes INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS default_assignee_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_assignee_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_queue_timeout_chk,
  ADD CONSTRAINT departments_queue_timeout_chk
    CHECK (queue_mode_timeout_minutes BETWEEN 1 AND 60);

COMMENT ON COLUMN public.departments.queue_mode_enabled IS
  'D30: Modo Fila ON = round-robin global; OFF = 100% para default_assignee_id';
COMMENT ON COLUMN public.departments.queue_mode_timeout_minutes IS
  'D30: Timeout em minutos antes de avancar fila (1-60, default 5)';
COMMENT ON COLUMN public.departments.default_assignee_id IS
  'D30: Atendente padrao quando Modo Fila OFF (gestor-de-chao distribui manual)';
COMMENT ON COLUMN public.departments.last_assignee_position IS
  'D30: Cursor do round-robin atomico (queue_position do ultimo atribuido). pick_next_assignee usa SELECT FOR UPDATE.';
