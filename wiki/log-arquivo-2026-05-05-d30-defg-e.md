---
title: Log Arquivo — D30 Fila Inteligente Sprints D+F+G+E (2026-05-04 a 05-05)
type: log-archive
source: log.md
archived: 2026-05-05
---

# Log arquivado — D30 Fila Inteligente Sprints D+F+G+E

Sequência: Admin UI → Helpdesk UI → Tests/Retention → Modo Estendido. Sprints A+B+C estão em [[wiki/log-arquivo-2026-05-04-d30-abc]].

---

## 2026-05-04 (Sprint D — Fila Inteligente de Handoff D30, Admin UI)

### Goal
Destravar a fila pro super_admin configurar via UI — sem isso, A+B+C funcionam mas ninguém liga Modo ON nem reordena.

### Arquivos
- **NOVO**: `src/components/admin/queue/QueueConfig.tsx` (~330 linhas) — dialog modal com Switch Modo Fila, Slider timeout (1-15min), Select default_assignee (Modo OFF), drag-drop membros com `@dnd-kit/sortable`, toggle queue_paused, toggle gestor_in_queue (só para role gerente). Salva em transação lógica + RPC `log_admin_action` `update_dept_queue_config`. Reset cursor RR ao salvar.
- **MODIFICADO**: `src/components/dashboard/DepartmentsTab.tsx` — botão "Fila" (ícone ListOrdered) em cada card; renderiza QueueConfig dialog.
- **MODIFICADO**: `src/components/admin/InboxesTab.tsx` — select inline "Departamento padrão (handoff)" auto-save → `inboxes.default_department_id` (D-α); audit log `set_inbox_default_dept`.

### SYNC RULE auditada
Banco N/A | types.ts N/A | admin UI ✅ | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅

### Auditoria
- tsc 0 erros.
- vitest 662 passam, 5 falhas pré-existentes em FormBuilder (sem regressão).

---

## 2026-05-05 (Sprint F — Fila Inteligente D30, Helpdesk UI)

### Goal
Entregar a fila pro atendente: badge "Em fila — Lucas (3:42)" com countdown ao vivo, pause toggle pessoal e cancelamento de queue_event em reatribuição manual.

### Arquivos novos
- `src/hooks/useActiveQueueEvents.ts` — mantém em memória todos os `handoff_queue_events` ativos. Tick 1s pra countdown. Subscribe `queue-update` (cron Sprint C + override do Sprint F). Lookup nome via `user_profiles.full_name` (primeiro nome). `secondsRemaining()` retorna `null` quando paused (relógio congela).
- `src/components/helpdesk/QueuePauseToggle.tsx` — toggle no header pessoal Disponível/Pausado. Persiste em `department_members.queue_paused` para TODOS os deptos do user (single global). Não renderiza se user não pertence a nenhum dept.

### Arquivos modificados
- `ConversationItem.tsx` — novo prop `queueBadge` renderiza pill âmbar com Hourglass/Pause icon + countdown.
- `ConversationList.tsx` — encadeia `queueBadgesMap` via rowProps memoized.
- `HelpDesk.tsx` — usa `useActiveQueueEvents`, monta map filtrando próprio user, inclui `QueuePauseToggle` no header da row do inbox select.
- `helpdeskBroadcast.ts` — `assignAgent` marca queue_events ativos como `manual_override` + broadcast `queue-update`.

### Smoke ao vivo (Playwright + SQL)
- ✅ QueuePauseToggle renderizou ("Disponível", aria-label "Pausar e sair da fila")
- ✅ Click → texto "Pausado", DB `queue_paused=true` + reason persistidos
- ✅ Badge "Em fila — Lucas (3:44)" apareceu para conversa com queue_event sintético
- ✅ Countdown decrementou 3:44 → 3:32 em 5s real (tick 1s) — countdown ao vivo OK
- ✅ Console limpo (0 erros)

### Auditoria
- tsc 0 erros, vitest 662 passam (5 pré-existentes em FormBuilder)

---

## 2026-05-05 (Sprint G — Fila Inteligente D30, Tests + Retention Policy)

### Goal
Destravar cobertura dos artefatos novos antes de Sprint E mexer em estado: 53 testes Vitest novos (helpers backend + hook frontend) + entrada de retention policy `handoff_queue_events` (90 dias, OFF/dry_run por defesa).

### Arquivos novos
- `supabase/functions/_shared/__tests__/handoffDepartment.test.ts` — 6 testes (cascade D-α, edge cases null/undefined/string vazia).
- `supabase/functions/_shared/__tests__/businessHours.test.ts` — 17 testes (extended override, weekly open=true/false, faixa normal vs invertida atravessa-meia-noite, legacy, 24/7). TZ-safe via `vi.useFakeTimers + setSystemTime` em UTC; SP wall-clock derivado pelo Intl.
- `supabase/functions/_shared/__tests__/handoffQueue.test.ts` — 20 testes (`assignHandoff` Modo OFF/ON/D-β + falha + `applyAssigneeNameTemplate`).
- `src/hooks/__tests__/useActiveQueueEvents.test.ts` — 10 testes (fetch + secondsRemaining paused/zero/positivo + realtime subscribe + formatCountdown).
- `supabase/migrations/20260505000001_handoff_queue_retention_policy.sql` — seed policy id=8 (90d, enabled=false, dry_run=true, backup=false).

### Smoke em prod
- ✅ `apply_migration` da policy: id=8 inserida
- ✅ `is_table_protected('handoff_queue_events')` = `false` (não-core)
- ✅ 3 índices + pkey na tabela (`active_expires`, `assigned_active`, `conversation`)
- ✅ `apply_retention_policy(8)` dry-run: `candidate_count=0, deleted_count=0`, sem erro
- ✅ Log persistido em `db_cleanup_log`

### Auditoria
- `npx tsc --noEmit` = 0 erros
- `npx vitest run` = **715 passam (+53 novos)**, 5 falhas pré-existentes em FormBuilder (sem regressão)

### SYNC RULE
banco ✅ (1 INSERT seed) | types.ts N/A | admin UI N/A (AdminRetention já lista todas via select * em db_retention_policies) | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅

---

## 2026-05-05 (Sprint E — Fila Inteligente D30, Modo Estendido)

### Goal
Override pontual do horário comercial via UI — admin estende expediente sem editar `business_hours` nem cron. Schema `ai_agents.extended_hours_until` já existia (Sprint A); helper `_shared/businessHours.ts` já consumia (Sprint C, testado em Sprint G); faltava só a porta de entrada.

### Arquivos
- **NOVO**: `src/components/admin/ai-agent/ExtendedHoursConfig.tsx` (~210 linhas) — Card com status (Ativo até DD/MM às HH:mm OU Não ativado), 4 quick actions (+1h, +2h, Resto do dia, Até amanhã 23:59), custom datetime input com Aplicar (disabled em vazio/passado), botão Cancelar agora (visível só quando ativo).
- **NOVO**: `src/components/admin/ai-agent/__tests__/ExtendedHoursConfig.test.tsx` (13 testes verdes — status, quick actions, cancel, custom).
- **MODIFICADO**: `src/components/admin/AIAgentTab.tsx` — `extended_hours_until` em `ALLOWED_FIELDS`.
- **MODIFICADO**: `src/components/admin/ai-agent/RulesConfig.tsx` — renderiza `<ExtendedHoursConfig>` abaixo de `<BusinessHoursEditor>`.

### SYNC RULE
banco N/A (schema A) | types.ts N/A | admin UI ✅ | ALLOWED_FIELDS ✅ | backend N/A (helper C já consome) | prompt N/A | system_settings N/A (per-agent) | docs ✅

### Auditoria
- `npx tsc --noEmit` = 0 erros
- `npx vitest run` = **728 passam (+13 vs Sprint G=715)**, 5 pré-existentes em FormBuilder
