---
title: Retenção de Dados (Detalhado)
tags: [monitoring, retention, cleanup, backup, db, super-admin]
sources: [.planning/m19-s8-PLAN.md, supabase/migrations/20260425000001-6_*]
updated: 2026-04-25
---

# Retenção de Dados — Guia Completo (M19 S8 + S8.1)

> Sistema de monitoramento e limpeza automática do banco PostgreSQL com 3 camadas: visibilidade, alertas e auto-cleanup com backup seletivo.

## Para leigos — em 1 minuto

O banco do WhatsPRO **não pode passar de 300 MB**. Para garantir que isso nunca aconteça:

1. 🟢 Um **vigia** roda todo dia e mede o tamanho. Se passar de 50%, te avisa pelo sino do app.
2. 🧹 Um **faxineiro** roda todo domingo de madrugada e apaga dados velhos das tabelas que você liberou.
3. 📦 Antes de apagar mensagens, ele faz uma **caixinha de segurança** (.jsonl.gz) no Storage. Você pode recuperar até 1 ano depois.
4. 🔒 Tabelas-núcleo (clientes, agentes, conversas) **nunca são tocadas** — uma trava de segurança bloqueia.

Você só precisa olhar o sistema **quando o sino tocar**. Tudo automatizado.

---

## Para devs — arquitetura

### 4 cron jobs ativos

| Job | Schedule (UTC) | Função |
|-----|---|---|
| `db-size-monitor` | `7 6 * * *` (diário 06:07) | `check_db_size_and_alert()` — mede + notifica super_admin se cruzar threshold |
| `db-cleanup-weekly` | `13 4 * * 0` (dom 04:13) | `apply_all_retention_policies()` — itera policies enabled sem backup |
| `db-cleanup-with-backup-weekly` | `23 5 * * 0` (dom 05:23) | `dispatch_retention_with_backup()` → POST edge fn `db-retention-backup` para policies com backup |
| `db-backup-retention-monthly` | `17 3 1 * *` (dia 1 do mês 03:17) | `dispatch_backup_cleanup()` → POST edge fn `db-cleanup-old-backups` (apaga JSONL >365d) |

### Tabelas

```
db_retention_policies
  ├─ id, table_name UNIQUE, days_to_keep, condition_sql
  ├─ enabled, dry_run, backup_before_delete (defaults: false, true, false)
  ├─ description, last_run_at, last_deleted_count, last_backup_path

db_cleanup_log
  ├─ policy_id FK, table_name, ran_at, was_dry_run
  ├─ candidate_count, deleted_count, deleted_bytes
  ├─ backup_path, duration_ms, error_message, ran_by

db_alert_state (singleton id=1)
  └─ last_status, last_size_bytes, last_checked_at, last_notified_at
```

### Funções SQL principais

- `get_db_size_summary(threshold_mb)` — JSONB com size, percent, status semafórico, top 10 tabelas. Restrita a super_admin.
- `is_table_protected(_table_name)` — IMMUTABLE, retorna true para 27 tabelas-núcleo.
- `apply_retention_policy(_policy_id)` — bloqueado se backup_required+não-dry-run; senão dry-run conta candidatos OU delete real.
- `apply_retention_after_backup(_policy_id, _backup_path, _ran_by)` — chamada pelo edge fn APÓS upload bem-sucedido.
- `apply_all_retention_policies()` — loop em policies WHERE enabled=true.
- `dispatch_retention_with_backup()` / `dispatch_backup_cleanup()` — chamadas por pg_cron, lançam HTTP POST via `net.http_post` para edge functions.
- `check_db_size_and_alert(threshold_mb)` — calcula severity, INSERT notifications no cruzamento de threshold.

### Edge functions

**`db-retention-backup`** (POST `/functions/v1/db-retention-backup` body `{policy_id}`):
1. Auth via `getJwtRole(req)` — service_role/anon trust, user JWT exige super_admin
2. Carrega policy, valida (enabled, backup_before_delete, table não protegida)
3. SELECT candidates `WHERE created_at < now() - interval`, max 50k rows
4. JSONL → CompressionStream gzip
5. Upload `db-backups/YYYY/MM/{table}_{ISO_timestamp}.jsonl.gz`
6. RPC `apply_retention_after_backup` → DELETE + log
7. Retorna `{ deleted_count, candidate_count, backup_path, backup_size_bytes }`

**`db-cleanup-old-backups`** (POST `/functions/v1/db-cleanup-old-backups`):
1. Auth idem
2. Lista bucket recursivo (YYYY/MM/*)
3. Filtra files com `created_at < now() - 365d`
4. Batch delete (100 por chunk)
5. Log em `db_cleanup_log` com policy_id=NULL e table_name='__backup_cleanup__'

### Bucket `db-backups`

- Privado (`public=false`)
- file_size_limit 100 MB
- mime: application/gzip, application/octet-stream
- RLS storage.objects: super_admin SELECT/DELETE
- INSERT/UPDATE somente via service_role (edge function)

### Frontend

**`/dashboard/gestao` — DbSizeCard** (super_admin only):
- Hook `useDbSize(threshold_mb=300)` chama RPC, refetch 5min
- Barra de progresso colorida por status
- Top 5 tabelas em details/summary
- Refresh manual

**Header global — NotificationBell** (super_admin only):
- Hook `useNotifications` poll 60s, lista últimas 20
- Popover com badge de unread, mark-as-read on click
- Click navega para `metadata.route`
- Severity color via `metadata.severity`

**`/dashboard/admin/retention` — AdminRetention**:
- Lista policies com toggles enabled/dry_run
- Input para days_to_keep
- Botão "Executar agora" — usa edge fn se backup_required, senão RPC
- Tabela de últimas 20 execuções com candidate/deleted counts

## Policies seed (estado atual)

| ID | Tabela | Manter | Condição extra | Backup | Status |
|----|---|---|---|---|---|
| 1 | ai_debounce_queue | 1d | processed=true | — | ✅ ON |
| 2 | instance_connection_logs | 30d | — | — | ✅ ON |
| 3 | ai_agent_logs | 30d | — | — | ✅ ON |
| 4 | flow_events | 60d | — | — | ✅ ON |
| 5 | shadow_metrics | 180d | — | — | ✅ ON |
| 6 | conversation_messages | 120d | conv.status='resolvida' | ✅ JSONL.gz | ✅ ON |

## Whitelist de tabelas protegidas (R74)

```
lead_profiles, contacts, ai_agents, conversations, inboxes, instances,
departments, inbox_users, department_members, user_profiles, user_roles,
user_instance_access, kanban_boards, kanban_columns, kanban_cards,
campaigns, forms, bio_pages, funnels, agent_profiles, automation_rules,
instance_goals, flows, db_retention_policies, db_cleanup_log,
db_alert_state, notifications
```

Adicionar nova entidade-núcleo? Editar `is_table_protected` em nova migration.

## Cenários reais

### Cenário 1: banco em 8% (atual)
- Vigia roda → green → silêncio
- Faxineiro roda → 5 policies sem backup limpam 21 logs/fila
- conversation_messages → 0 candidatos (mensagens novas)

### Cenário 2: banco crescendo (160 MB, 53%)
- Vigia detecta crossing green→yellow → INSERT 1 notification por super_admin
- Sino fica com badge vermelho
- Click → vai para /gestao
- Admin vê DbSizeCard yellow + qual tabela está crescendo
- Decide: liberar mais policies? aumentar `days_to_keep`?

### Cenário 3: cliente reclama "vocês apagaram nossa conversa de janeiro"
- Admin vai em Storage → bucket db-backups → 2026/01/conversation_messages_*.jsonl.gz
- Download → gunzip → JSONL com mensagens originais
- Importa de volta para conversation_messages se necessário

## Decisões aprovadas

[[wiki/decisoes-chave]] D22-D25 (limit 300 MB, super_admin-only, backup seletivo, default OFF)

## Erros documentados

[[wiki/erros-e-licoes]] R74-R77 (whitelist, JWT verify, storage delete bloqueio, vault key cron)

## Migrations

- `20260425000001_db_size_summary.sql` — Camada 1 visibility
- `20260425000002_db_size_alerts.sql` — Camada 2 alerts + cron diário
- `20260425000003_db_retention.sql` — Camada 3 schema + 6 policies seed
- `20260425000004_db_backup_bucket.sql` — Bucket + RLS + apply_retention_after_backup
- `20260425000005_db_backup_cron.sql` — dispatch_retention_with_backup + cron weekly
- `20260425000006_db_backup_retention_cron.sql` — dispatch_backup_cleanup + cron monthly

## Plano original

[[.planning/m19-s8-PLAN]]
