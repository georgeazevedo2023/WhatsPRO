-- Onda 1 da auditoria do AI Agent (2026-06-12): todo turno roda 2 COUNTs em
-- ai_agent_logs filtrando (conversation_id, agent_id, event IN (...) [, created_at])
-- pro greeting check (hasInteracted/hasEverInteracted, index.ts ~1290). Sem índice
-- composto isso varre o índice simples de conversation_id e filtra no heap.
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_conv_event_created
  ON public.ai_agent_logs (conversation_id, agent_id, event, created_at DESC);
