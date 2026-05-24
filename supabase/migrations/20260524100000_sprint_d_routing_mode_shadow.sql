-- Sprint D (2026-05-24): adiciona 'shadow' ao CHECK de ai_agents.routing_mode.
--
-- shadow = router classifica a intent e loga em ai_agent_runs, mas NÃO envia ao
-- lead; o monolith responde. Coleta accuracy do router em tráfego real sem risco
-- (best practice: shadow → canary → % gradual antes de migrar default).
--
-- Default segue 'monolith' (prod intocada). Migração de EletropisoV2 → 'router'
-- só após E2E 7/7 + janela shadow limpa.

ALTER TABLE ai_agents
  DROP CONSTRAINT IF EXISTS ai_agents_routing_mode_check;

ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_routing_mode_check
    CHECK (routing_mode IN ('monolith', 'router', 'shadow'));

COMMENT ON COLUMN ai_agents.routing_mode IS
  'monolith=pipeline LLM mega (default); router=classifyIntent+specialist dedicado; shadow=router classifica+loga mas monolith responde (coleta regressão).';
