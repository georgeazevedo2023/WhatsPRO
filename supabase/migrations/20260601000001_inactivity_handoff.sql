-- =============================================================================
-- v7.65.0 — Transbordo por INATIVIDADE genérica (Sprint E.2, extensão)
--
-- Problema: o transbordo automático (v7.56.0) só pegava conversas com a tag
-- `seller_handoff_pending:*` (a IA já tinha decidido transbordar e esperava a
-- resposta da marca). Lead que simplesmente PARA de responder no meio da conversa
-- ficava parado pra sempre — venda esfriava sem ninguém saber.
--
-- Decisão do dono: QUALQUER lead que ficar N min (default 3) sem responder à IA
-- vai DIRETO pra fila do vendedor (sem cutucada). Guarda-corpos no edge function:
--   • só transborda quem já interagiu ao menos 1x (não pega lead frio que nunca
--     respondeu nem template de abertura);
--   • ignora conversas que terminaram em despedida (obrigado/valeu/tchau/…), pra
--     não inundar o vendedor com conversa concluída.
--
-- Feature toggle próprio (`inactivity_handoff_enabled`, default OFF) — independente
-- do fluxo pendente. Liga só onde o dono quiser (v7.65.0: só EletropisoV2).
-- =============================================================================

-- ── Colunas de config por agente ────────────────────────────────────────────
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS inactivity_handoff_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inactivity_handoff_after_min integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.ai_agents.inactivity_handoff_enabled IS 'v7.65.0: liga o transbordo automático por INATIVIDADE genérica (qualquer lead que para de responder à IA). Independe do fluxo pendente (abandon_handoff_enabled).';
COMMENT ON COLUMN public.ai_agents.inactivity_handoff_after_min IS 'v7.65.0: minutos sem resposta do lead antes do transbordo DIRETO pro vendedor (sem cutucada). Default 3.';

-- ── RPC: candidatos a abandono/inatividade ───────────────────────────────────
-- Retorna conversas de agentes com QUALQUER um dos dois fluxos ligado (pendente
-- OU inatividade), IA ativa, sem atendente, dentro da janela de 36h. A coluna
-- `has_pending_handoff` informa ao edge function qual caminho aplicar; a decisão
-- dos estágios fica no edge (testável). Pré-filtro de 1min corta conversas
-- recém-ativas. DROP+CREATE porque a assinatura (RETURNS TABLE) mudou.
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
    AND c.last_message_at > now() - interval '36 hours'
    AND c.last_message_at < now() - interval '1 minute'
    AND (
      a.inactivity_handoff_enabled = true
      OR EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE t LIKE 'seller_handoff_pending:%')
    )
  LIMIT p_limit;
$$;

-- ── Cron a cada 1min (era 2min) ──────────────────────────────────────────────
-- Limiar de 3min exige varredura mais fina pra mirar o tempo com precisão.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='handoff-abandoned-leads') THEN
    PERFORM cron.unschedule('handoff-abandoned-leads');
  END IF;
END $$;

SELECT cron.schedule('handoff-abandoned-leads', '* * * * *', $sql$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/handoff-abandoned-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
$sql$);
