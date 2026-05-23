-- Sprint C3 (2026-05-23): Feature flag `ai_agents.routing_mode` pra coexistência
-- monolito vs router durante POC do Sprint C.
--
-- Valores:
--   'monolith' (default) → pipeline atual (todos os agents em prod, zero impacto)
--   'router'             → novo pipeline: classifyIntent (gpt-5-nano) → specialist
--
-- Mudança gradual: admin habilita por agent. Após 7d de métricas OK em sandbox,
-- migração em massa (Sprint D). Após 30d sem rollback, coluna removida.

ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS routing_mode TEXT NOT NULL DEFAULT 'monolith'
    CHECK (routing_mode IN ('monolith', 'router'));

COMMENT ON COLUMN ai_agents.routing_mode IS
  'Sprint C POC: monolith=pipeline atual, router=classifyIntent+specialist (feature flag).';

-- Index defensivo pra queries de monitoramento ("quantos agents em router?")
CREATE INDEX IF NOT EXISTS idx_ai_agents_routing_mode
  ON ai_agents (routing_mode)
  WHERE routing_mode <> 'monolith';
