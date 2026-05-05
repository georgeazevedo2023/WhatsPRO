-- D30 Sprint G: retention policy seed para handoff_queue_events.
--
-- 90 dias eh suficiente para trail de auditoria (debug de duplicidade,
-- forense de timeout, telemetria de fila). Mais que isso polui pg_stat
-- e cresce o vacuum.
--
-- Mantemos enabled=false + dry_run=true como TODAS as policies-seed do M19 S8
-- (R74 — admin precisa habilitar via UI conscientemente).
--
-- backup_before_delete=false: trail puro, sem dado de cliente. Nao precisa do
-- pipeline JSONL (S8.1).

INSERT INTO public.db_retention_policies
  (table_name, days_to_keep, condition_sql, backup_before_delete, description)
VALUES
  (
    'handoff_queue_events',
    90,
    NULL,
    false,
    'Trail de auditoria da fila de handoff (D30). Eventos active/responded/timed_out/manual_override/cancelled. Sem PII direta — referencia conversation_id e user_id. 90 dias eh suficiente pra forense.'
  )
ON CONFLICT (table_name) DO NOTHING;
