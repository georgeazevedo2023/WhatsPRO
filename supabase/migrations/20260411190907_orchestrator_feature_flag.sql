-- =============================================================================
-- Fluxos v3.0 — Feature Flag do Orchestrator (S2)
-- USE_ORCHESTRATOR = false → todo tráfego vai para ai-agent-debounce (padrão)
-- USE_ORCHESTRATOR = true  → tráfego vai para orchestrator (dev/teste apenas)
-- Progressão: S2 flag global, S12 adiciona instances.use_orchestrator por instância
-- =============================================================================

INSERT INTO system_settings (key, value)
VALUES ('USE_ORCHESTRATOR', 'false')
ON CONFLICT (key) DO NOTHING;
