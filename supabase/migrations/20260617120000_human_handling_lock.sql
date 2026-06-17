-- =============================================================================
-- v7.94.0 — Trava de atendimento humano (human_handling_at)
--
-- Problema (auditoria 2026-06-17): um lead atendido por um vendedor era rotacionado
-- para outro a cada 10min (Jussara→Djavan→… 8 atendentes), e a IA voltava a
-- responder durante o atendimento humano. Causa-raiz:
--   • A rotação (requeue-conversations Case C / detectResponded) só reconhece
--     "atendente respondeu" quando a msg tem sender_id (Helpdesk). O vendedor
--     responde pelo CELULAR (sender_id NULL) → invisível → rotaciona pra sempre.
--   • Não há nenhum estado durável de "humano no controle": status_ia/tags são
--     voláteis (reabertura/handoff de fila/abandono regravam 'ligada' e apagam
--     os marcadores), então a IA re-arma sozinha.
--
-- Solução (decisão do dono): UMA fonte de verdade durável.
--   conversations.human_handling_at = momento em que um humano assumiu de fato
--   (1º reply do vendedor — Helpdesk OU celular). Enquanto preenchida:
--     RULE 1 → a fila NÃO rotaciona (congela no atendente);
--     RULE 2 → a IA fica em shadow (extrai, nunca responde).
--   Só é LIMPA por "Finalizar atendimento" ou "Ativar IA" manual (sem rede de
--   segurança automática — decisão explícita do dono: congela indefinidamente).
--
-- O lock é setado pela fonte confiável (webhook: fromMe && !wasSentByApi; e os
-- caminhos do Helpdesk já põem status_ia=desligada). NÃO usamos trigger por
-- external_id (eco de API via UAZAPI também é hex → falso-positivo).
-- =============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS human_handling_at timestamptz;

COMMENT ON COLUMN public.conversations.human_handling_at IS
  'v7.94.0: trava de atendimento humano. Setada no 1º reply genuíno do vendedor (Helpdesk OU celular via webhook fromMe+!wasSentByApi). Enquanto NOT NULL: a fila não rotaciona e a IA fica em shadow. Limpa só por Finalizar/Ativar IA. NULL = lead livre.';

-- Índice parcial: a rotação/abandono só precisam dos travados (minoria).
CREATE INDEX IF NOT EXISTS idx_conversations_human_handling_at
  ON public.conversations (human_handling_at)
  WHERE human_handling_at IS NOT NULL;

-- ── FIX 6: cron de abandono ignora conversa travada (cinto-e-suspensório) ──────
-- A RPC já exige assigned_to IS NULL AND status_ia='ligada' (uma conversa travada
-- está em shadow → já é excluída). Adiciona o filtro explícito por clareza/robustez.
-- DROP+CREATE mantendo a assinatura idêntica (20260601000001_inactivity_handoff).
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
    AND c.human_handling_at IS NULL
    AND c.last_message_at > now() - interval '36 hours'
    AND c.last_message_at < now() - interval '1 minute'
    AND (
      a.inactivity_handoff_enabled = true
      OR EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%')
    )
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.find_abandoned_handoff_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_abandoned_handoff_candidates(integer) TO service_role;
