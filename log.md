---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

### Estado D30
| Sprint | Status |
|---|---|
| A — DB schema + RPC | ✅ em prod |
| B — backend ai-agent + edge fn | ✅ em prod |
| C — cron + horário | ✅ em prod (jobid 12) |
| D — admin UI QueueConfig | ✅ em prod |
| **E — Modo Estendido** | ✅ shipped 2026-05-05 |
| F — helpdesk UI | ✅ em prod |
| G — tests + retention | ✅ em prod |
| H — wikis finais | ⏸ pendente (~2h) |

### Frase para retomar
"implementar fila inteligente Sprint H" — wikis finais + cross-refs (admin-detalhado ganha QueueConfig + ExtendedHoursConfig, R91/R92 viram entries formais em erros-e-licoes), arquivamento dos logs A-G em wiki separada (~2h).

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
- ✅ `apply_retention_policy(8)` dry-run: `candidate_count=0, deleted_count=0`, sem erro (0 events ainda — nenhum handoff real disparou desde A/B/C/F)
- ✅ Log persistido em `db_cleanup_log`

### Auditoria
- `npx tsc --noEmit` = 0 erros
- `npx vitest run` = **715 passam (+53 novos)**, 5 falhas pré-existentes em FormBuilder idênticas ao Sprint F (sem regressão)

### Estado D30 atualizado
| Sprint | Status |
|---|---|
| A — DB schema + RPC `pick_next_assignee` | ✅ em prod |
| B — backend ai-agent (6 paths) + edge fn `assign-handoff` | ✅ em prod (v174 + v1) |
| C — cron `requeue-conversations` | ✅ em prod (jobid 12) |
| D — admin UI (`QueueConfig` + select default_dept) | ✅ em prod |
| F — helpdesk UI (badge + pause toggle + cancel queue) | ✅ em prod |
| **G — tests + retention policy** | ✅ shipped 2026-05-05 |
| E — modo estendido (`extended_hours_until` UI) | ⏸ pendente (~2.5h) |
| H — wikis finais + cross-refs | ⏸ pendente (~2h) |

### SYNC RULE
banco ✅ (1 INSERT seed) | types.ts N/A | admin UI N/A (AdminRetention já lista todas via select * em db_retention_policies) | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅

### Frase para retomar
"implementar fila inteligente Sprint E" — Modo Estendido (`ai_agents.extended_hours_until` UI no AIAgentTab + ALLOWED_FIELDS update + system_settings defaults). ~2.5h. OU "Sprint H" — wikis finais + cross-refs decisoes/erros/handoff-fila + cleanup. ~2h.

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

### Frase para retomar
"implementar fila inteligente Sprint E" — Modo Estendido + ALLOWED_FIELDS + system_settings defaults (~2.5h), OU "Sprint G" — Vitest dos novos hooks + retention policy + smoke E2E.

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

### Pendente
- Push (frontend redeploya via webhook Portainer).
- Validação visual em prod após push.

### Frase para retomar
"implementar fila inteligente Sprint E" — Modo Estendido (extended_hours_until UI), ALLOWED_FIELDS, system_settings defaults. ~2.5h. OU pausar e validar visual primeiro.

---

> Sessões D30 Sprint A (DB), Sprint B (backend HIGH RISK), Sprint C (cron + R92 hotfix vault) — 2026-05-04 — arquivadas em:
> - [[wiki/log-arquivo-2026-05-04-d30-abc]]


## 2026-04-30 (resumo — entrada completa arquivada)

Sessão começou com auditoria do vault (5 fixes documentais — log rotation, roadmap, index, planning files), evoluiu pra investigação dos 3 handoffs duplicados na conversa Josafa (R85+R86), e terminou shipando feature D28 completa (Excluded Products) — UI editável pelo admin pra cadastrar produtos que a tenant não vende. Validada em prod com lead George ("tem caixa de correio?" → fallback automático sem transbordo).

**Resumo do que foi shipado:**
- **R85+R86** — fix 3 handoffs duplicados Josafa (guard SHADOW + reset counter em 5 paths)
- **D28 Excluded Products** (edge fn v171→v172) — schema JSONB editável + helper word-boundary + UI tab Qualificação + fallback automático + validado em prod com lead George
- **R88** — CHECK constraint silent fail descoberto via teste real (`excluded_product_match` whitelist)
- **R89** — UI controlled input com `.trim()` em onChange quebra digitação livre (KeywordsInput sub-componente)
- **D29 VALID_KEYS dinâmico** (edge fn v173) — `buildValidTagKeys()` em `_shared/serviceCategories.ts`, R84 RESOLVIDO em prod (Eletropiso `tipo_tinta`)
- **v7.18.0 Avatares em Storage** — bucket público + helper `avatarStorage.ts` + edge fn `refresh-avatar` + migration `20260430000002`. Pendência: deploy 3 fns + frontend.
- **47 testes (D28) + 9 (D29)** = 100% passam. Bundle prod `index-CFmkOcne.js`.

---

> Sessão 2026-04-29 (Eletropiso — 23 categorias + 7 fixes ai-agent v162→v169 + BusinessHoursEditor + audit) arquivada em:
> - [[wiki/log-arquivo-2026-04-29-eletropiso]]
>
> Sessões 2026-04-27 (M19-S10 v1+v2+v3) e 2026-04-28 (Deploy 16 commits represados → prod) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]]
>
> Sessão 2026-04-27 manhã (Auditoria geral + 210 melhorias documentadas) e 2026-04-26 (Refactor do Orquestrador CLAUDE.md/RULES.md) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-auditoria-geral]]
>
> Sessão maratona 2026-04-25 (Helpdesk inbox permissions + M19 S8 + S8.1) arquivada em:
> - [[wiki/log-arquivo-2026-04-25-s8-helpdesk]]
>
> Entrada de 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright):
> - `wiki/log-arquivo-2026-04-14-helpdesk-audit.md`
>
> Entradas de M19 S3-S5 (2026-04-13):
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
