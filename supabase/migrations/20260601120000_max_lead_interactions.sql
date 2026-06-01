-- =============================================================================
-- Feature 5b (2026-06-01) — teto ABSOLUTO de interações do lead por sessão.
--
-- Política do dono: a IA atende até o fim do atendimento OU o lead estar satisfeito
-- OU atingir MÁX N interações do lead na mesma sessão. Ao atingir N, envia a msg de
-- transbordo, entra em SHADOW e NÃO responde mais.
--
-- Diferente de max_lead_messages (que é derivado de handoff_rule: 'so_se_pedir'→40,
-- 'nunca'→Infinity), este é um teto de SEGURANÇA absoluto que VENCE qualquer
-- handoff_rule (decisão do dono). Configurável por agente; 0 = desligado (opt-out
-- p/ quem quer atendimento consultivo ilimitado).
--
-- "Interação" = mensagem recebida do lead = conversations.lead_msg_count (contador
-- atômico já existente, resetado no handoff R86 e no ia_cleared:).
-- =============================================================================

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_lead_interactions integer NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.ai_agents.max_lead_interactions IS
  'Feature 5b: teto absoluto de interações (mensagens) do lead por sessão. Ao atingir, força handoff + shadow. Vence handoff_rule. 0 = desligado. Default 15.';
