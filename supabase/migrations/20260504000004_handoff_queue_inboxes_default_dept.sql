-- D30 Sprint A.3 — Fila Inteligente de Handoff (sub-decisao D-alpha)
-- Fallback de departamento na resolucao do handoff:
--   profile.handoff_dept -> funnel.handoff_dept -> inbox.default_department_id -> falha.

ALTER TABLE public.inboxes
  ADD COLUMN IF NOT EXISTS default_department_id UUID
    REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inboxes_default_department_id
  ON public.inboxes (default_department_id)
  WHERE default_department_id IS NOT NULL;

COMMENT ON COLUMN public.inboxes.default_department_id IS
  'D30 (D-alpha): Fallback de departamento para handoff. Hierarquia: agent_profile.handoff_dept -> funnel.handoff_dept -> inbox.default_department_id -> falha (sino gestor).';
