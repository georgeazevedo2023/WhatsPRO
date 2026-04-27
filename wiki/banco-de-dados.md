---
title: Banco de Dados
tags: [supabase, banco-de-dados, rls, migrations, schema]
sources: [supabase/migrations, ARCHITECTURE.md, PRD.md]
updated: 2026-04-27
---

# Banco de Dados

## Provedor

Supabase (PostgreSQL 17) — projeto `wspro_v2` (ref: `euljumeflwtljegknawy`)

## Padrões Globais

- **RLS** em todas as tabelas; gates via `auth.uid()` + materialized views (`mv_user_inbox_roles`)
- **Tipos:** `npx supabase gen types` — NUNCA editar `src/integrations/supabase/types.ts` à mão (R5)
- **Datas:** `created_at`, `updated_at` com triggers automáticos
- **FKs:** `instances.id` é **TEXT** (não UUID — R24); `lead_profiles.contact_id` é FK para `contacts(id)` 1:1
- **Tags:** `TEXT[]` formato `key:value` em `conversations.tags` — NUNCA `[]` vazio (R9)
- **`.maybeSingle()`** sempre, NUNCA `.single()` em edge functions (R31, R42)

---

## Tabelas (60+)

### Multi-tenancy & Auth
- `tenants`, `profiles` (roles: super_admin, gerente, user), `user_instance_access`

### WhatsApp & Helpdesk
- `instances` (token NUNCA no frontend — R3/R4), `instance_connection_logs`
- `conversations` (labels, status_ia, archived, tags TEXT[])
- `conversation_messages`, `conversation_summaries`, `conversation_notes`
- `inboxes`, `inbox_users` (`can_view_all`, `can_view_unassigned`, `can_view_all_in_dept` — R73)
- `departments`, `message_templates`, `quick_replies`

### AI Agent (M10)
- `ai_agents` (config: `prompt_sections JSONB`, `business_info`, `tools_enabled`, `poll_nps_*`)
- `ai_agent_knowledge` (FAQ + docs)
- `ai_agent_validations` (validator log: score, PASS/REWRITE/BLOCK)
- `ai_agent_logs` (event-level audit)
- `ai_agent_products` / `ai_products` (catálogo, busca fuzzy via `search_products_fuzzy()`)
- `ai_debounce_queue` (atomic 10s grouping)
- `agent_profiles` (M17 F3 — pacotes prompt+handoff reutilizáveis)

### CRM & Leads
- `contacts` (telefones WhatsApp normalizados E.164)
- `lead_profiles` (25+ campos: full_name, city, interests, average_ticket, custom_fields JSONB)
- `lead_short_memory` (TTL 1h, RPC), `lead_long_memory` (perfil persistente — M18)
- `lead_score_history` (M19 S2)
- `kanban_boards`, `kanban_columns`, `kanban_cards` (FK contact_id), `kanban_fields`, `kanban_entities`

### Campanhas, Bio Link, Forms
- `utm_campaigns` (landing_mode, kanban_board_id, expires_at), `utm_visits`
- `bio_pages`, `bio_buttons`, `bio_lead_captures` (FK contact_id — M15), `bio_analytics`
- `whatsapp_forms`, `form_fields`, `form_sessions`, `form_submissions`

### Funis (M16)
- `funnels` (FKs para utm_campaigns, bio_pages, whatsapp_forms, kanban_boards, agent_profiles)
- `funnel_history` (eventos do funil)
- Tag `funil:SLUG` propagada em form-public, bio-public, whatsapp-webhook

### Automação & Enquetes (M17)
- `automation_rules` (funnel_id, trigger_type, condition_type, action_type, configs JSONB)
- `poll_messages` (com `is_nps` flag), `poll_responses`
- `notifications` (alertas para gerentes — nota ruim NPS, DB size)

### Fluxos v3.0 (M18)
- `flow_definitions`, `flow_steps`, `flow_triggers`, `flow_states`, `flow_events`
- `flow_step_executions`, `flow_followups` (cron-driven)
- `guided_sessions` (Conversa Guiada via gpt-4.1-mini)
- `flow_report_shares` (links públicos com token 30d)
- `instances.use_orchestrator` flag (migração gradual por instância)

### Métricas & Gestor (M19)
- `instance_goals` (metas configuráveis por período + métrica)
- `conversion_funnel_events` (S2)
- Views SQL agregadas (S2): `v_lead_metrics`, `v_agent_performance`, `v_handoff_details`, `v_vendor_activity`, `v_nps_by_seller`
- `assistant_sessions`, `assistant_messages` (M19 S5)

### DB Monitoring & Cleanup (M19 S8 / S8.1)
- `db_retention_policies` (6 seed, default OFF + dry_run=true — D25)
- `db_cleanup_log` (audit trail completo)
- `db_alert_state` (singleton para dedup de alertas — D23)
- `is_table_protected()` (whitelist 27 tabelas-núcleo — R74)
- Bucket privado `db-backups` (gzipped JSONL, retenção 365d)

### Infraestrutura
- `job_queue` (SKIP LOCKED via `claim_jobs` RPC + worker `process-jobs`)
- `admin_audit_log` (imutável, append-only, via `log_admin_action()`)
- `mv_user_inbox_roles` (materialized view, refresh periódico)
- `e2e_test_batches`, `e2e_test_runs` (M2 Agent QA Framework)

---

## RPCs / Functions

- `has_inbox_access_fast(uid, inbox_id)` — checa via materialized view
- `can_view_conversation(uid, inbox_id, dept_id)` — gate Helpdesk (R73)
- `check_rate_limit(...)` — rate limit atômico
- `search_products_fuzzy(...)` — pg_trgm, threshold 0.3, word-level similarity
- `increment_lead_msg_count(...)` — contador atômico
- `upsert_lead_short_memory()` / `upsert_lead_long_memory()` — RPC para evitar PostgREST `onConflict` (R36)
- `archive_old_conversations(days)` — soft archive
- `get_db_size_summary(threshold_mb)` — super_admin only (D22)
- `apply_retention_policy(_policy_id)` — dry-run + delete + log
- `apply_retention_after_backup(_policy_id, _path)` — DELETE + log + UPDATE last_backup_path
- `install_flow_template(...)` — RPC atômica com rollback (M18 S10)

## Cron Jobs (pg_cron)

- `aggregate-metrics-daily` — diário 04:00 UTC (M19 S2)
- `db-size-monitor` — diário 06:07 UTC (M19 S8 Camada 2)
- `db-cleanup-weekly` — dom 04:13 UTC (M19 S8 Camada 3)
- `db-cleanup-with-backup-weekly` — dom 05:23 UTC (M19 S8.1)
- `db-backup-retention-monthly` — dia 1 03:17 UTC (M19 S8.1)
- `process-flow-followups` — hourly (M18 S10)
- `e2e-scheduled` — configurável via system_settings (M2 F4)

## Migrations

60+ migrations em `supabase/migrations/`. Última (2026-04-25): `20260425000006_db_backup_retention_cron.sql`.

## Storage Buckets

- `bio-images` (público) — imagens de Bio Link
- `db-backups` (privado, RLS super_admin) — backups gzipped JSONL com retenção 365d
- Outros: avatars, message media (gerenciados via Storage API)

## Links

- [[wiki/ai-agent]] — Tabelas e fluxo do agente
- [[wiki/arquitetura]] — Stack completa
- [[wiki/casos-de-uso/db-retention-detalhado]] — DB Monitoring & Auto-Cleanup
- [[wiki/erros-e-licoes]] — Regras R3-R5, R9, R24, R31, R36, R42, R73-R77
