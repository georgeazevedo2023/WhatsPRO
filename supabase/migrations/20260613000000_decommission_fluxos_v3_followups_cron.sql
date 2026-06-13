-- Descomissionamento Fluxos v3.0 (v7.90.0, 2026-06-13)
--
-- O runtime `orchestrator` foi removido (commits da v7.90.0): use_orchestrator=false
-- em todas as instancias + global; 0 flow_states historicos; superado pelo router do
-- ai-agent. A edge fn `process-flow-followups` operava EXCLUSIVAMENTE sobre
-- flow_states/flow_steps (populados so pelo orchestrator), entao seu cron horario
-- (jobid 32) virou no-op perpetuo (disparava 24x/dia processando 0 linhas).
--
-- Aqui removemos o agendamento. As migrations 20260415000004 e 20260507000001 que
-- criaram/recriaram esse cron sao historicas (append-only) e NAO devem ser editadas;
-- esta migration NOVA as supersede desativando o job.

DO $$
BEGIN
  PERFORM cron.unschedule('process-flow-followups');
  RAISE NOTICE 'cron process-flow-followups desagendado';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron process-flow-followups ja removido ou inexistente (no-op)';
END $$;
