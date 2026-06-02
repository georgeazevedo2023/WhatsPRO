-- =============================================================================
-- v7.65.1 — Transbordo por INATIVIDADE em 2 estágios (cutucada → transbordo)
--
-- Decisão do dono: o transbordo por inatividade genérica deixa de ser DIRETO e
-- passa a ter cutucada antes (igual ao fluxo pendente). Cutucada após N min
-- (default 3) → transbordo após M min da cutucada (default +3, total 6min).
--
-- `inactivity_handoff_after_min` muda de semântica: era "min de silêncio antes do
-- transbordo direto"; agora é "min APÓS a cutucada antes do transbordo". O valor
-- default (3) e o do EletropisoV2 (3) seguem válidos — nenhuma migração de dado.
-- =============================================================================

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS inactivity_nudge_after_min integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.ai_agents.inactivity_nudge_after_min IS 'v7.65.1: minutos sem resposta do lead antes da cutucada (estágio 1 do transbordo por inatividade). Default 3.';
COMMENT ON COLUMN public.ai_agents.inactivity_handoff_after_min IS 'v7.65.1: minutos APÓS a cutucada antes de transbordar pro vendedor (estágio 2 do transbordo por inatividade). Default 3 (total 6min com a cutucada).';

-- RPC: agora também retorna inactivity_nudge_after_min. DROP+CREATE (assinatura mudou).
DROP FUNCTION IF EXISTS public.find_abandoned_handoff_candidates(integer);

CREATE FUNCTION public.find_abandoned_handoff_candidates(p_limit integer DEFAULT 50)
RETURNS TABLE (
  conversation_id uuid,
  inbox_id uuid,
  contact_id uuid,
  department_id uuid,
  inbox_default_department_id uuid,
  tags text[],
  cart_items jsonb,
  last_message_at timestamptz,
  contact_jid text,
  instance_token text,
  agent_id uuid,
  business_hours jsonb,
  extended_hours_until timestamptz,
  handoff_message text,
  handoff_message_outside_hours text,
  notify_outside_hours_on_handoff boolean,
  abandon_handoff_enabled boolean,
  abandon_nudge_after_min integer,
  abandon_handoff_after_min integer,
  abandon_nudge_message text,
  inactivity_handoff_enabled boolean,
  inactivity_nudge_after_min integer,
  inactivity_handoff_after_min integer,
  has_pending_handoff boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.inbox_id,
    c.contact_id,
    c.department_id,
    ib.default_department_id,
    c.tags,
    c.cart_items,
    c.last_message_at,
    ct.jid,
    inst.token,
    a.id,
    a.business_hours,
    a.extended_hours_until,
    a.handoff_message,
    a.handoff_message_outside_hours,
    a.notify_outside_hours_on_handoff,
    a.abandon_handoff_enabled,
    a.abandon_nudge_after_min,
    a.abandon_handoff_after_min,
    a.abandon_nudge_message,
    a.inactivity_handoff_enabled,
    a.inactivity_nudge_after_min,
    a.inactivity_handoff_after_min,
    EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%') AS has_pending_handoff
  FROM conversations c
  JOIN inboxes ib   ON ib.id = c.inbox_id
  JOIN instances inst ON inst.id = ib.instance_id
  JOIN ai_agents a  ON a.instance_id = ib.instance_id AND a.enabled = true
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  WHERE (a.abandon_handoff_enabled = true OR a.inactivity_handoff_enabled = true)
    AND c.assigned_to IS NULL
    AND c.status_ia = 'ligada'
    AND c.last_message_at > now() - interval '36 hours'
    AND c.last_message_at < now() - interval '1 minute'
    AND (
      a.inactivity_handoff_enabled = true
      OR EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%')
    )
  LIMIT p_limit;
$$;
