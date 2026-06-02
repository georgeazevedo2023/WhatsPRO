-- Auditoria de paridade Agente IA ↔ Painel Admin (2026-06-02)
-- Cruzou ai_agents (schema) × ALLOWED_FIELDS (UI) × reads do backend e achou 3 gaps.
--
-- Gap #1 — `max_lead_messages` estava no ALLOWED_FIELDS, tinha input editável no
-- RulesConfig e era lido pelo backend (index.ts), mas a COLUNA NUNCA FOI CRIADA.
-- Efeito: editar o campo na UI quebrava o auto-save inteiro (PostgREST: "column
-- does not exist") e o backend sempre caía no default. Cria a coluna.
--
-- IMPORTANTE: nullable, SEM default. O backend usa `agent.max_lead_messages ?? 8`
-- no caminho `apos_n_msgs` mas `?? 40` no `so_se_pedir` (qualify-first). Um default
-- 8 forçaria so_se_pedir a transbordar em 8 msgs — exatamente o bug que o comentário
-- do index.ts (linhas ~1473-1484) corrigiu subindo pra 40. NULL preserva a semântica.
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_lead_messages integer;

COMMENT ON COLUMN public.ai_agents.max_lead_messages IS
  'Handoff por contagem de mensagens (caminho apos_n_msgs/so_se_pedir). NULL = usa fallback do backend (8/40). Auditoria paridade 2026-06-02.';

-- Gaps #2 e #3 — `handoff_negative_sentiment` e `handoff_max_conversation_minutes`
-- tinham controle na UI mas eram TOGGLES MORTOS (o backend nunca lia o flag). Agora
-- o backend passa a ENFORCÁ-LOS. Como os defaults antigos (true / 15) estão gravados
-- em TODOS os agentes, religar a leitura sem reset faria toda conversa com +15min ou
-- com palavra negativa transbordar de uma vez, em todos os tenants.
--
-- Rollout seguro (igual v7.65/66): default OFF + reset dos rows existentes pro estado
-- seguro. As features ficam disponíveis e são ligadas explicitamente por agente
-- (EletropisoV2), com OK do dono.
ALTER TABLE public.ai_agents
  ALTER COLUMN handoff_max_conversation_minutes SET DEFAULT 0;
ALTER TABLE public.ai_agents
  ALTER COLUMN handoff_negative_sentiment SET DEFAULT false;

-- Reset dos rows existentes pro estado seguro (a feature nunca funcionou, então
-- nenhum valor gravado reflete uma intenção real de uso).
UPDATE public.ai_agents
  SET handoff_max_conversation_minutes = 0
  WHERE handoff_max_conversation_minutes IS DISTINCT FROM 0;
UPDATE public.ai_agents
  SET handoff_negative_sentiment = false
  WHERE handoff_negative_sentiment IS DISTINCT FROM false;
