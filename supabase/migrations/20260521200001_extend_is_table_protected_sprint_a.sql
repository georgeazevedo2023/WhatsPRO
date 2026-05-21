-- Sprint A #8 (Auditoria 2026-05-21): adicionar 6 tabelas críticas
-- na whitelist is_table_protected.
--
-- Tabelas surgidas após 2026-04-25 (criação original da whitelist) que
-- guardam dados críticos:
--   - user_feature_permissions: permissões granulares D36
--   - business_hours_exceptions: feriados/exceções configurados pelo admin
--   - handoff_queue_events: trilha de fila de transbordo (retention 90d ok)
--   - e2e_test_batches / e2e_test_runs: histórico de regressão Agent QA
--   - notification_log: histórico de notificações de handoff vendor
--
-- (db_alert_state e db_cleanup_log já estavam na lista original.)

CREATE OR REPLACE FUNCTION public.is_table_protected(_table_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT _table_name = ANY(ARRAY[
    'lead_profiles', 'contacts', 'ai_agents', 'conversations',
    'inboxes', 'instances', 'departments', 'inbox_users',
    'department_members', 'user_profiles', 'user_roles',
    'user_instance_access', 'kanban_boards', 'kanban_columns',
    'kanban_cards', 'campaigns', 'forms', 'bio_pages', 'funnels',
    'agent_profiles', 'automation_rules', 'instance_goals',
    'flows', 'db_retention_policies', 'db_cleanup_log',
    'db_alert_state', 'notifications',
    -- Sprint A 2026-05-21
    'user_feature_permissions', 'business_hours_exceptions',
    'handoff_queue_events', 'e2e_test_batches', 'e2e_test_runs',
    'notification_log'
  ]);
$function$;
