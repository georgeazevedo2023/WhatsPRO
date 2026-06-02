-- =============================================================================
-- v7.66.0 — "Continuar atendendo fora-horário até o lead terminar / 15 interações"
--
-- Problema (caso George, EletropisoV2 PROD, fora-horário): ao qualificar um
-- produto OFFLINE (catálogo vazio), o agente transbordava por-produto assim que
-- batia o cap de enriquecimento (max_enrichment_questions=2) → status_ia=shadow →
-- parava de responder. A próxima pergunta do lead ("Tem trena?") caía no vazio
-- (e o cron requeue reenviava a mensagem de fora-horário).
--
-- Decisão do dono: FORA do horário, o agente deve CONTINUAR atendendo e ACUMULAR
-- o pedido (canos + trena + ...) e só transbordar no FIM (lead diz "é só isso" /
-- 15 interações / silêncio), com UMA mensagem fora-horário + resumo do pedido +
-- shadow. Dentro do horário (vendedor online) o comportamento atual é mantido.
--
-- Flag por-agente (default OFF) → PROD intocada até ligar no EletropisoV2.
-- =============================================================================

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS continue_outside_hours_until_done boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_agents.continue_outside_hours_until_done IS 'v7.66.0: quando ON e FORA do horário comercial, a IA não transborda por-produto ao bater o cap de enriquecimento — acumula o pedido (cart_items) e pergunta "quer mais alguma coisa?", transbordando só no fim (closer / max_lead_interactions / silêncio) com a mensagem fora-horário. Dentro do horário ou OFF: comportamento inalterado.';
