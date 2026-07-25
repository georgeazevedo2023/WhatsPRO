-- =============================================================================
-- D6 (2026-07-25) — monolito do ai-agent APOSENTADO (v7.109.0).
-- O código não lê mais ai_agents.routing_mode: todo agente roda router +
-- specialists (único cérebro). A coluna fica no DB (histórico/rollback via
-- git), mas o DEFAULT muda pra 'router' pra agentes novos nascerem coerentes
-- com a realidade. Evidência pré-remoção: 30d de prod, 1.796 runs 100%
-- router+specialists, 0 fallbacks pro monolito.
-- =============================================================================

alter table public.ai_agents alter column routing_mode set default 'router';

comment on column public.ai_agents.routing_mode is
  'INERTE desde D6 (2026-07-25): o código não lê mais este flag — todo agente roda router+specialists. Mantido por histórico.';

-- Alinha os agentes existentes (todos já operavam como router).
update public.ai_agents set routing_mode = 'router' where routing_mode <> 'router';
