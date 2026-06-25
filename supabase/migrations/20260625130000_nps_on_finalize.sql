-- =============================================================================
-- NPS-on-finalize (2026-06-25) — enquete 0-10 ao FINALIZAR a conversa + alerta
-- ao gestor (WhatsApp + painel) em nota baixa, com nome/número/atendente/resumo.
--
-- Estende a infra de poll/NPS (M17 F4/F5) que existia MORTA (job_queue sem worker,
-- triggerNpsIfEnabled sem caller). Behavior-preserving: defaults mantêm o legado.
-- =============================================================================

-- (1) Score numérico do voto (0-10) — parseado no webhook poll_update.
ALTER TABLE public.poll_responses
  ADD COLUMN IF NOT EXISTS numeric_score SMALLINT NULL;

-- (2) Atribuição ao ATENDENTE que finalizou + escala usada + idempotência do alerta.
ALTER TABLE public.poll_messages
  ADD COLUMN IF NOT EXISTS attendant_id UUID NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nps_scale TEXT NULL,
  ADD COLUMN IF NOT EXISTS bad_alert_sent_at TIMESTAMPTZ NULL;

-- Backfill: enquetes NPS antigas eram sempre categóricas.
UPDATE public.poll_messages SET nps_scale = 'categorical'
  WHERE is_nps = true AND nps_scale IS NULL;

-- (3) Guard anti-duplo-envio do disparo no finalize.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS nps_sent_at TIMESTAMPTZ NULL;

-- (4) Config por agente — defaults BEHAVIOR-PRESERVING (segue categórico/desligado).
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS poll_nps_scale TEXT NOT NULL DEFAULT 'categorical',
  ADD COLUMN IF NOT EXISTS poll_nps_low_score_threshold SMALLINT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS poll_nps_ask_found_product BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poll_nps_manager_alert_whatsapp BOOLEAN NOT NULL DEFAULT false;

-- (5) Breakdown por atendente pro painel do gestor (escala numérica 0-10).
CREATE OR REPLACE FUNCTION public.get_nps_by_attendant(
  p_instance_id TEXT,
  p_period_days INT DEFAULT 30
)
RETURNS TABLE (
  attendant_id UUID,
  attendant_name TEXT,
  votes BIGINT,
  avg_score NUMERIC,
  promoters BIGINT,
  detractors BIGINT,
  low_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pm.attendant_id,
    up.full_name AS attendant_name,
    COUNT(pr.id) AS votes,
    ROUND(AVG(pr.numeric_score)::numeric, 1) AS avg_score,
    COUNT(*) FILTER (WHERE pr.numeric_score >= 9) AS promoters,
    COUNT(*) FILTER (WHERE pr.numeric_score <= 6) AS detractors,
    COUNT(*) FILTER (WHERE pr.numeric_score < 5) AS low_count
  FROM public.poll_responses pr
  JOIN public.poll_messages pm ON pm.id = pr.poll_message_id
  LEFT JOIN public.user_profiles up ON up.id = pm.attendant_id
  WHERE pm.is_nps = true
    AND pm.nps_scale = 'numeric_0_10'
    AND pm.instance_id = p_instance_id
    AND pr.numeric_score IS NOT NULL
    AND pr.voted_at >= now() - make_interval(days => p_period_days)
  GROUP BY pm.attendant_id, up.full_name
  ORDER BY votes DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_nps_by_attendant(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nps_by_attendant(TEXT, INT) TO authenticated, service_role;
