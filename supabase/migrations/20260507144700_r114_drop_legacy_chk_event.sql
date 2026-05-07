-- Existiam 2 CHECK constraints com mesma lógica e nomes diferentes em ai_agent_logs:
--   'ai_agent_logs_event_check' (já corrigido na migration 20260507143000)
--   'chk_ai_agent_logs_event' (legacy, não foi atualizado — bloqueava inserts)
-- Drop o legacy: o outro já cobre os events novos.
-- Descoberto durante reteste R114 G3 sandbox sessão 4.

ALTER TABLE public.ai_agent_logs DROP CONSTRAINT IF EXISTS chk_ai_agent_logs_event;
