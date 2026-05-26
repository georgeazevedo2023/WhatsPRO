-- =============================================================================
-- Sprint E.2 — Handoff por ABANDONO (transbordo automático por inatividade)
--
-- Problema: no fluxo offline/sem-resultado (v7.55.x) a IA grava a tag
-- `seller_handoff_pending:{categoria}`, faz UMA pergunta (marca) e fica esperando
-- o PRÓXIMO turno do lead pra forçar o handoff (pré-router). Se o lead SOME após
-- essa pergunta, a conversa nunca transborda — venda morre, vendedor nem sabe.
--
-- Solução (2 estágios, cron `handoff-abandoned-leads`):
--   Estágio 1 (cutucada): após `abandon_nudge_after_min` sem resposta, IA manda
--     uma mensagem leve perguntando se o lead ainda está aí (marca tag
--     `abandon_nudged:{epoch_ms}` pra não repetir e medir o estágio 2).
--   Estágio 2 (transbordo): após `abandon_handoff_after_min` da cutucada ainda sem
--     resposta, entrega o lead pro vendedor na fila + nota interna com o resumo.
--
-- Se o lead responder a qualquer momento, o pré-router já existente força o handoff
-- normal na resposta dele — a timeline de abandono é abortada (lead respondeu).
--
-- Feature toggle por agente (`abandon_handoff_enabled`, default OFF) — liga só
-- onde o dono quiser.
-- =============================================================================

-- ── Colunas de config por agente ────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS abandon_handoff_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abandon_nudge_after_min integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS abandon_handoff_after_min integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS abandon_nudge_message text;

COMMENT ON COLUMN public.ai_agents.abandon_handoff_enabled IS 'Sprint E.2: liga o transbordo automático por abandono (lead some após a pergunta da marca).';
COMMENT ON COLUMN public.ai_agents.abandon_nudge_after_min IS 'Sprint E.2: minutos sem resposta antes da cutucada (estágio 1).';
COMMENT ON COLUMN public.ai_agents.abandon_handoff_after_min IS 'Sprint E.2: minutos APÓS a cutucada antes de transbordar pro vendedor (estágio 2).';
COMMENT ON COLUMN public.ai_agents.abandon_nudge_message IS 'Sprint E.2: texto da cutucada (estágio 1). Vazio = usa default do código. O primeiro nome do lead é prefixado quando conhecido.';

-- ── RPC: candidatos a abandono ───────────────────────────────────────────────
-- Faz o scan pesado em SQL (prefix-match no array tags) + join agente/instância;
-- a decisão dos 2 estágios fica no edge function (testável). Retorna só conversas
-- de agentes com a feature LIGADA, IA ainda ativa (não transbordada) e sem
-- atendente atribuído. Janela de 12h evita ressuscitar conversa antiga.
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
    AND c.last_message_at > now() - interval '12 hours'
    AND EXISTS (
      SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%'
    )
  LIMIT p_limit;
$$;

-- ── Cron a cada 2min ─────────────────────────────────────────────────────────
-- Pattern R113: usa vault.CRON_AUTH_KEY (= INTERNAL_FUNCTION_KEY) que o gateway
-- NÃO reescreve. Idempotente.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='handoff-abandoned-leads') THEN
    PERFORM cron.unschedule('handoff-abandoned-leads');
  END IF;
END $$;

SELECT cron.schedule('handoff-abandoned-leads', '*/2 * * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/handoff-abandoned-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
$sql$);
