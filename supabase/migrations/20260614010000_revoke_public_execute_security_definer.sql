-- =============================================================================
-- Risk #3 da auditoria 2026-06-14 — REVOKE EXECUTE FROM PUBLIC nas funções
-- SECURITY DEFINER de negócio/cron (advisor: 65 SECURITY DEFINER executáveis por
-- anon; RPCs dash_* vazavam métricas de negócio com a anon key, que é pública).
--
-- ESTRATÉGIA CIRÚRGICA (não é um REVOKE em massa — isso quebraria RLS/triggers/
-- páginas públicas):
--   - Grupo A (RPCs de dashboard/fila/admin/agente): REVOKE PUBLIC, mantém
--     `authenticated` (UI logada) + `service_role` (edge fns). Só anon perde acesso.
--   - Grupo B (cron/backup/manutenção, NÃO chamadas pela UI — verificado no src):
--     REVOKE PUBLIC, mantém só `service_role`.
--   - INTOCADOS (precisam de PUBLIC/anon): helpers de RLS (has_role, is_*, can_*,
--     get_inbox_role, has_inbox_access, has_feature_permission), triggers,
--     funções públicas (increment_bio_click/view, get_funnel_lead_count), e as que
--     já não têm grant a PUBLIC.
--
-- Idempotente: REVOKE de algo já revogado é no-op; GRANT é idempotente. Usa
-- oid::regprocedure → assinatura exata (cobre overloads sem digitar args à mão).
-- =============================================================================

DO $$
DECLARE
  r record;
  -- Grupo A: REVOKE PUBLIC, GRANT authenticated + service_role
  group_a text[] := ARRAY[
    'add_lead_score_event','append_ai_debounce_message','apply_retention_policy',
    'check_db_size_and_alert','create_flow_report_share',
    'dash_conversao_orcamento_venda','dash_cotacoes','dash_excluded_match',
    'dash_kpis_resumo','dash_marcas_nao_trabalhadas','dash_produtos_em_falta',
    'dash_sla_sem_resposta','dash_top_marcas_citadas','dash_top_objecoes',
    'dash_top_pagamentos','dash_top_produtos_citados','dash_top_tipos_cliente',
    'dash_vendas_por_vendedor','delete_inbox','dispense_conversation_from_dashboard',
    'find_abandoned_handoff_candidates','get_active_form_session','get_db_size_summary',
    'get_form_stats','get_kanban_board_counts','get_previous_e2e_batch',
    'get_queue_attendant_stats','get_queue_live_status','get_queue_lost_leads',
    'get_router_dashboard','get_unattended_handoff_leads','global_search_conversations',
    'increment_lead_msg_count','install_flow_template','manager_reassign_conversation',
    'restore_conversation_to_dashboard','search_products_fuzzy','set_contact_ia_blocked',
    'upsert_lead_long_memory','upsert_lead_short_memory'
  ];
  -- Grupo B: REVOKE PUBLIC, GRANT só service_role (cron/backup, não tocadas pela UI)
  group_b text[] := ARRAY[
    'apply_all_retention_policies','apply_retention_after_backup','backup_query',
    'cleanup_expired_lead_memory','cleanup_old_e2e_runs','dispatch_backup_cleanup',
    'dispatch_retention_with_backup','purge_system_logs_older_than_24h',
    'snapshot_platform_usage'
  ];
  n_a int := 0;
  n_b int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prosecdef AND p.proname = ANY(group_a)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    n_a := n_a + 1;
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prosecdef AND p.proname = ANY(group_b)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    n_b := n_b + 1;
  END LOOP;

  RAISE NOTICE 'SECURITY DEFINER hardening: grupo A (auth+service)=%, grupo B (service)=%', n_a, n_b;
END $$;
