---
title: Inventário Eletropiso — Onda 0 da migração
tags: [migracao, eletropiso, inventario, onda-0, auditoria]
sources: [MCP supabase exec_sql + list_tables + list_migrations + list_edge_functions, projeto antigo euljumeflwtljegknawy]
updated: 2026-05-06
---

# Inventário Eletropiso — Onda 0

> Snapshot read-only do projeto antigo (`euljumeflwtljegknawy`) tirado em 2026-05-06 madrugada. Referência pra Fase B (migração 8 ondas) — números devem ser re-confirmados imediatamente antes do cutover.

## Identificação da tenant

| Campo | Valor |
|---|---|
| `instance_id` | `r466a98889b5809` |
| Nome | Eletropiso |
| Owner JID | `558181696546` |
| Status | `connected` |
| Disabled | `false` |
| Created | 2026-03-21 01:47 UTC |

**Outras 5 instâncias do projeto antigo (TODAS `disabled=true`, descartar na clean migration):**
- `r2a7cb6b2b47164` Agricultor_LJ01_Consultorio
- `rdb88f561b4fa8e` Ibirajuba
- `rfa16dbec248274` Agricultor Loja 03
- `rdef65c48caa3c9` NeoBlindados
- `re69a7cf1b5d4af` VendaMais

## Auth users (7 — TODOS migram)

| Email | Role | Acesso |
|---|---|---|
| `george.azevedo2023@gmail.com` | super_admin | Eletropiso + VendaMais (descartar VendaMais) |
| `josafa@eletropiso.com.br` | gerente | Eletropiso |
| `alberto@eletropiso.com.br` | user | Eletropiso |
| `djavan@eletropiso.com.br` | user | Eletropiso |
| `jussara@eletropiso.com.br` | user | Eletropiso |
| `lucas@eletropiso.com.br` | user | Eletropiso |
| `slone@eletropiso.com.br` | user | Eletropiso |

`auth.users` total: 7. Match perfeito com `user_profiles`.

## Contagens de dados (escopadas Eletropiso)

### Core multi-tenant
| Tabela | Rows |
|---|---:|
| instances | 1 |
| inboxes | 1 |
| departments | 1 |
| department_members | 6 |
| inbox_users | 6 |
| user_instance_access | 7 |

### Conversas e contatos
| Tabela | Rows |
|---|---:|
| conversations | 17 |
| conversation_messages | **1.341** |
| conversation_labels | 0 |
| contacts (escopo Eletropiso) | 15 |
| lead_profiles | 13 |
| lead_score_history | 5 |
| lead_memory | 2 |
| handoff_queue_events | 11 |

### AI Agent
| Tabela | Rows |
|---|---:|
| ai_agents | 1 |
| ai_agent_products | 7 |
| ai_agent_knowledge | 13 |
| ai_agent_validations | **274** |
| ai_agent_logs | 0 |
| agent_profiles | 4 |
| business_hours_exceptions | 0 |

### CRM / Funis / Forms
| Tabela | Rows |
|---|---:|
| kanban_boards | 1 |
| kanban_columns | 8 |
| lead_databases | 1 |
| lead_database_entries | 5 |
| utm_campaigns | 0 |
| utm_visits | 0 |
| whatsapp_forms | 6 |
| form_fields | 25 |
| bio_pages | 0 |
| bio_buttons | 0 |

### Fluxos v3
| Tabela | Rows |
|---|---:|
| flows | 1 |
| flow_steps | 2 |
| flow_triggers | 1 |
| flow_states | 2 |
| flow_events | 12 |

### Globais (não-multitenant — migrar 100%)
| Tabela | Rows |
|---|---:|
| system_settings | 13 |
| admin_audit_log | 17 |
| notifications | 7 |
| db_retention_policies | 7 |
| platform_usage_history | 4 |

**Total estimado de rows na migração:** ~1.900 (dominado por `conversation_messages` e `ai_agent_validations`).

## Storage objects (4 total)

| Bucket | Objects |
|---|---:|
| `contact-avatars` | 1 |
| `bio-images` | 3 |

Migração via `supabase storage` ou cópia direta entre buckets — volume pequeno, viável manual se preciso.

## Vault secrets (2)

| Nome | Tamanho | Uso |
|---|---:|---|
| `supabase_anon_key` | 208 chars | JWT legacy (cron antigo `e2e-automated-tests`) |
| `SUPABASE_ANON_KEY` | 46 chars | Publishable `sb_publishable_*` (crons novos pós-R92) |

Ambos precisam ser re-criados no projeto novo com as **chaves do projeto novo** (não copiar valor — copiar nome+propósito).

## pg_cron jobs (12 ativos)

| jobid | Nome | Schedule | Tipo |
|---:|---|---|---|
| 1 | e2e-automated-tests | `0 */6 * * *` | HTTP → e2e-scheduled |
| 2 | e2e-cleanup-old-runs | `0 3 * * *` | SQL `cleanup_old_e2e_runs()` |
| 3 | process-flow-followups | `0 * * * *` | HTTP → process-flow-followups |
| 4 | aggregate-metrics-hourly | `0 * * * *` | HTTP → aggregate-metrics |
| 5 | aggregate-metrics-daily-consolidation | `30 0 * * *` | HTTP → aggregate-metrics |
| 6 | cleanup-assistant-cache | `15 * * * *` | SQL DELETE |
| 7 | keep_alive_daily | `0 4 * * *` | SQL INSERT |
| 8 | db-size-monitor | `7 6 * * *` | SQL `check_db_size_and_alert(300)` |
| 9 | db-cleanup-weekly | `13 4 * * 0` | SQL `apply_all_retention_policies()` |
| 10 | db-cleanup-with-backup-weekly | `23 5 * * 0` | SQL `dispatch_retention_with_backup()` |
| 11 | db-backup-retention-monthly | `17 3 1 * *` | SQL `dispatch_backup_cleanup()` |
| 13 | platform-usage-snapshot | `11 6 * * *` | SQL `snapshot_platform_usage()` |

**Atenção na re-criação no novo projeto:** jobs 1, 3, 4, 5 têm URL hardcoded `https://euljumeflwtljegknawy.supabase.co/functions/v1/...` — atualizar para `https://prfcbfumyrrycsrcrvms.supabase.co/...` antes de ativar.

**Já fora do pg_cron (cuidado pra não duplicar):**
- `requeue-conversations` (D30 Sprint A): cron desabilitado em 2026-05-05 (migration `disable_handoff_queue_cron_n8n_takeover`); n8n chama no novo cluster.

## Edge Functions (43 active no projeto antigo)

Lista completa via `mcp__supabase__list_edge_functions`. **Decisão por fn:**
- ✅ Migrar: 41 fns que estão no repo (`supabase/functions/*/index.ts`).
- ❌ NÃO migrar: `apply-env-secrets` (órfã — sem código no repo, P2-8 da auditoria).
- ❌ NÃO migrar: `e2e-test`, `e2e-scheduled` se quisermos descontar custo Free Tier (revisar antes do cutover).

`activate-ia` foi re-deployada com `verify_jwt=false` na Sprint 3 (commit e682971) — versão atual no antigo é v12 alinhada com config.toml.

HIGH RISK fns (exigem aprovação por commit):
- `ai-agent/index.ts`
- `ai-agent/types.ts`
- `e2e-test/index.ts`
- `ai-agent-playground/index.ts`

## Migrations no histórico

160 migrations aplicadas (de `20260124170541` até `20260506013743`). Última: `form_fks_on_delete_set_null` (Sprint 1 da auditoria, commit e4def62).

**Estratégia da migração de schema (Onda 1):** replay completo das 160 migrations no novo projeto, em ordem por `version`. Auditável e idempotente. Se alguma quebrar (FK em ordem trocada, function dependency), corrigir antes de avançar.

## Bloqueios potenciais identificados

1. **`keep_alive` sem RLS (P2-7):** já replicada no projeto novo via `keepalive` (singular sem underscore). Decidir nome final antes da Onda 1.
2. **`apply-env-secrets` órfã:** decidir delete vs versionar no repo antes de migrar (P2-8).
3. **Vault secrets nomes duplicados:** `supabase_anon_key` (lower) + `SUPABASE_ANON_KEY` (upper). No novo projeto, usar só `SUPABASE_ANON_KEY` (publishable) — limpar legado.
4. **JWT legacy em `e2e-automated-tests` cron (jobid 1):** usa `vault.decrypted_secrets WHERE name = 'supabase_anon_key'` (lowercase). Atualizar pra `SUPABASE_ANON_KEY` na re-criação.

## Cobertura desta Onda 0

- ✅ instance_id Eletropiso identificada
- ✅ Contagens por tabela escopadas (40+ tabelas)
- ✅ Lista users + roles + acesso por instância
- ✅ Storage objects + buckets
- ✅ Vault secrets (nome, propósito)
- ✅ pg_cron jobs ativos + URLs a atualizar
- ✅ Migrations no histórico (160)
- ✅ Edge Functions (lista da Sprint 3 + decisão por fn)

**Não coberto (requer outra onda):**
- ❌ Roles/policies RLS no detalhe (Onda 1 vai fazer replay direto, então não precisa snapshot)
- ❌ Realtime publications (re-criadas via migration `enable_realtime_publications`)
- ❌ Dump real dos dados (Onda 2 vai fazer COPY ou pg_dump)
- ❌ Frontend env vars (Onda 6 — Docker rebuild)
- ❌ n8n workflows e UAZAPI webhook URL (Onda 7 — usuário no painel)

## Próximo passo

Antes da Onda 1 (replay schema):
1. Confirmar com usuário se as 5 instâncias disabled vão ser **realmente** descartadas (sem clones de teste).
2. Decidir nome final da tabela `keep_alive` vs `keepalive`.
3. Decidir destino da fn `apply-env-secrets` (delete ou versionar).
4. Confirmar nomes de buckets do Storage.
5. Listar env vars das edge functions em prod (não vai aparecer no MCP — usuário precisa abrir Settings → Edge Functions → Secrets no painel antigo).

## Links

- [[wiki/migracao-eletropiso-handoff]] — handoff geral da migração
- [[wiki/auditoria-completa-2026-05-05]] — plano que precede a migração
- [[wiki/free-forever-playbook]] — referência pra crons + retention no novo projeto
