-- =============================================================================
-- Sprint E.2 (ajuste) — janela do scan de abandono 12h → 36h.
--
-- Decisão do dono: o cron só atua DENTRO do horário comercial (gate no edge
-- function). Logo um lead que abandona à noite/fim de semana precisa SOBREVIVER
-- na janela de candidatos até o expediente reabrir às 8h. 12h não cobria o
-- overnight (abandono 17h → 8h do dia seguinte = 15h). 36h cobre overnight e
-- segunda-feira após sábado curto; leads mais antigos que isso são considerados
-- frios (não cutuca nem transborda — vira lead de follow-up, não de abandono).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_abandoned_handoff_candidates(p_limit integer DEFAULT 50)
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
  abandon_nudge_after_min integer,
  abandon_handoff_after_min integer,
  abandon_nudge_message text
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
    a.abandon_nudge_after_min,
    a.abandon_handoff_after_min,
    a.abandon_nudge_message
  FROM conversations c
  JOIN inboxes ib   ON ib.id = c.inbox_id
  JOIN instances inst ON inst.id = ib.instance_id
  JOIN ai_agents a  ON a.instance_id = ib.instance_id AND a.enabled = true
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  WHERE a.abandon_handoff_enabled = true
    AND c.assigned_to IS NULL
    AND c.status_ia = 'ligada'
    AND c.last_message_at > now() - interval '36 hours'
    AND EXISTS (
      SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%'
    )
  LIMIT p_limit;
$$;
