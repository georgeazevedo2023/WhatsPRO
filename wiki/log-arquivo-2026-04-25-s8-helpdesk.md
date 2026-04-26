---
title: Log Archive — Sessão Maratona 2026-04-25 (Helpdesk + S8 + S8.1)
type: log-archive
period: 2026-04-25
---

## 2026-04-25 (M19 S8 — DB Monitoring & Auto-Cleanup SHIPADO + Helpdesk fechado)

### Sessão maratona — 8 commits, 3 features

**Helpdesk permissões de inbox (3 commits):**
- feat: 5 src files + migration 20260416000004 + types.ts regen
- docs: D21 (least-privilege) + R73 (permissão soft frontend-only)
- chore: planning S8 + add playwright dep

**M19 S8 DB Monitoring (3 commits):**
- Camada 1 (Visibility): get_db_size_summary RPC + DbSizeCard com
  semáforo + integração ManagerDashboard. Threshold 300 MB.
  Status atual: 24 MB / 300 MB (8% — green).
- Camada 2 (Alerts): tabela db_alert_state singleton +
  check_db_size_and_alert + pg_cron 06:07 UTC + NotificationBell
  super_admin-only (Desktop+Mobile). Dedup por status (sem spam).
- Camada 3 (Auto-Cleanup slice seguro): db_retention_policies +
  db_cleanup_log + is_table_protected (27 tabelas) +
  apply_retention_policy + apply_all_retention_policies +
  pg_cron weekly + AdminRetention UI + 6 policies seed (todas OFF).

### Decisões da sessão
- D21: negar-por-padrão para Helpdesk
- D22: 300 MB hard limit (não 200), thresholds 50/75/90%
- D23: Notifications de DB só para super_admin
- D24: Backup JSONL deferido para S8.1 (deferred); conversation_messages
  policy bloqueada até S8.1 shipar
- D25: Default OFF + dry_run=true em todas as policies de retenção

### Migrations aplicadas em produção
- 20260425000001_db_size_summary
- 20260425000002_db_size_alerts
- 20260425000003_db_retention

### pg_cron jobs novos
- db-size-monitor (daily 06:07 UTC) — alertas
- db-cleanup-weekly (sunday 04:13 UTC) — retenção (todas OFF)

### Commits (mais novo no topo)
8ce1fe3 feat(monitoring): Camada 3 retention policies (slice seguro)
4e40dc3 feat(monitoring): Camada 2 alerts + NotificationBell
7075b25 feat(monitoring): Camada 1 DB Size visibility
67b51f3 chore(planning): M19 S8 plan
86566d0 docs(vault): D21 + R73 + roadmap S8/S9
69437d1 feat(helpdesk): permissões granulares de inbox
36a681c chore(deps): add playwright

### 5 retention policies ATIVADAS (automáticas a partir de agora)

Após dry-run de validação, as 5 policies sem requisito de backup
foram habilitadas (`enabled=true, dry_run=false`):

| Policy | Manter | Risco |
|---|---|---|
| ai_debounce_queue | 1 dia (processed) | 🟢 zero |
| instance_connection_logs | 30 dias | 🟢 baixo |
| ai_agent_logs | 30 dias | 🟡 médio |
| flow_events | 60 dias | 🟡 médio |
| shadow_metrics | 180 dias | 🟡 médio |

Primeira execução manual (apply_all_retention_policies) deletou
21 registros: 17 + 1 + 3 + 0 + 0. Próxima execução automática:
domingo 04:13 UTC pelo pg_cron 'db-cleanup-weekly'.

`conversation_messages` permanece BLOQUEADA até S8.1.

### S8.1 SHIPPED (mesma sessão!)

Backup JSONL integration completa:
- Migration 20260425000004: bucket db-backups (privado, RLS
  super_admin) + função apply_retention_after_backup
- Migration 20260425000005: dispatch_retention_with_backup +
  cron db-cleanup-with-backup-weekly (dom 05:23 UTC)
- Migration 20260425000006: dispatch_backup_cleanup + cron
  db-backup-retention-monthly (dia 1 às 03:17 UTC)
- Edge function db-retention-backup: SELECT → JSONL →
  CompressionStream gzip → upload → RPC delete
- Edge function db-cleanup-old-backups: lista bucket,
  filtra >365d, batch delete
- AdminRetention UI: bloqueio removido, banner verde, runNow
  roteia para edge fn quando precisa de backup
- SUPABASE_ANON_KEY adicionado ao vault para cron→edge

E2E validado: 5 rows tabela teste → 132B gzip → upload →
delete → log com path. Cleanup do teste OK.

Policy conversation_messages: enabled=true, dry_run=false.

### 4 cron jobs DB ativos
1. db-size-monitor — daily 06:07 UTC (alertas)
2. db-cleanup-weekly — sunday 04:13 UTC (5 policies)
3. db-cleanup-with-backup-weekly — sunday 05:23 UTC
   (conversation_messages com backup)
4. db-backup-retention-monthly — dia 1 às 03:17 UTC
   (limpa JSONL >365d)

### Pendente E2E (não bloqueador)
- Teste manual em browser das permissões de inbox (criar usuário sem
  inbox → ver empty state; admin libera → atende)
- Teste manual do DbSizeCard no /gestao
- Teste manual do AdminRetention dry-run

---

## 2026-04-25 (Helpdesk — Permissões de Inbox por Atendente: Empty State)

### Política "negar por padrão" formalizada

Atendente sem nenhum vínculo em `inbox_users` agora recebe **empty state amigável** em vez de tela em branco. Decisão D21: negar por padrão (princípio least privilege).

### Mudanças

**`useHelpdeskInboxes.ts`** — exposto `inboxesLoading` (boolean) para distinguir estado "carregando" de "sem acesso". `setInboxes()` movido para fora do `if (inboxData.length > 0)` para garantir que o array vazio seja persistido. `selectedInboxId` e `departmentFilter` resetam quando não há acesso.

**`HelpDesk.tsx`** — após `inboxesLoading=false` e `inboxes.length === 0`, renderiza `EmptyState` com mensagens diferenciadas:
- Super admin → "Nenhuma caixa disponível — conecte uma instância"
- Atendente → "Sem acesso — solicite ao administrador" (ícone Lock)

Funciona em mobile e desktop, antes de qualquer layout normal.

### O que já existia (do trabalho anterior — ainda não comitado)

- Migration `20260416000004_inbox_users_visibility_permissions.sql`: 3 colunas em `inbox_users` (`can_view_all`, `can_view_unassigned`, `can_view_all_in_dept`) + função RLS `can_view_conversation` com gate obrigatório por `inbox_users`
- `UsersTab.tsx`: UI inline para admin marcar/desmarcar inboxes por usuário, controlar permissões granulares por checkbox

### Validação

`npx tsc --noEmit` = 0 erros (antes e depois do regen de types).

### Migration já estava aplicada em produção

Surpresa positiva ao auditar: `20260416000004` já constava em ambas as colunas Local/Remote do `migration list`. Schema confirmado via `gen types`:
- `inbox_users.can_view_all` (boolean)
- `inbox_users.can_view_all_in_dept` (boolean)
- `inbox_users.can_view_unassigned` (boolean)
- Função `can_view_conversation` ativa

### Types.ts regenerado (estava 12 dias defasado)

`npx supabase gen types typescript --project-id euljumeflwtljegknawy` → 5491 linhas.

### Pendente para fechar o ciclo

- Teste E2E em browser
- Commit + atualizar wiki/casos-de-uso/helpdesk-detalhado.md
