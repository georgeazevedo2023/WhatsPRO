---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-05-05 (R94 — Header/painel direito stale ao trocar assignee em background)

### Bug detectado durante Teste 7 do D30 (testes ao vivo)
Cron `requeue-conversations` (n8n) processou timeout do queue_event do Alberto e fez round-robin pra Jussara → Djavan → Slone. O DB atualizou `conversations.assigned_to` corretamente. **Mas** header da conversa e painel direito "Agente Responsável" continuaram mostrando o nome anterior (Jussara) — só a badge da lista esquerda atualizou (porque `useActiveQueueEvents` tem Realtime).

### Causa
`HelpDesk.tsx > setSelectedConversation` só atualiza local state quando o **próprio frontend** chama `handleAgentAssigned`. Mudanças em background (cron / outra aba) ficam invisíveis ao React.

### Fix
useEffect em `HelpDesk.tsx` observando `queueEvents` (do `useActiveQueueEvents`). Quando muda (sinal indireto do broadcast `queue-update`), faz fetch leve `select('assigned_to').eq('id', selectedConversation.id)` e sincroniza `conversations` + `selectedConversation` se difere. Cleanup com `cancelled = true` no return do effect.

### Auditoria
- `npx tsc --noEmit` = 0 erros
- Teste manual em prod: aguardando user (precisa F5 ou hot-reload do localhost)

### Documentação
- R94 adicionada à tabela em `wiki/erros-e-licoes.md`

---

## 2026-05-05 (R93 — QueuePauseToggle: UPDATE direto bloqueado pela RLS silente)

### Bug detectado durante Teste 5 do D30 (testes ao vivo)
Lucas (atendente) clicou "Disponível" no helpdesk, UI virou "Pausado" + toast "Você está pausado". Mas SQL ao vivo mostrou `queue_paused = false` no banco. Bug silencioso — RLS de `department_members` permite só `is_super_admin()` para UPDATE; PostgREST retornou 200 + 0 rows ao invés de erro.

### Diagnóstico
- `pg_policy` em `department_members`: 2 policies (SELECT pra inbox users, ALL pra super_admin). Atendente caiu em "0 rows updated, sem erro".
- `QueuePauseToggle.handleToggle` fazia `.update().eq('user_id', user.id)` direto, sem `.select()` pra checar count.

### Fix em 3 frentes
1. **Migration `rpc_set_my_queue_paused_d30_r93`** — função SECURITY DEFINER com escopo limitado (só `queue_paused` + `queue_paused_reason`). GRANT pra `authenticated`. Atualiza TODOS os deptos do `auth.uid()` (mantém comportamento global do toggle).
2. **`QueuePauseToggle.tsx`** — substitui UPDATE direto por `supabase.rpc('set_my_queue_paused', ...)` + valida `result.rows_affected > 0` antes de toast verde. Handler do catch lê `.message` de objetos não-Error (PostgrestError tem `.message`).
3. **`__tests__/QueuePauseToggle.test.tsx` (NOVO, 8 testes)**: render (sem dept / available / paused), toggle (avail→paused / paused→avail), R93 regression (rows_affected=0 → toast erro), erro RPC (`{error:{message}}`), erro payload (`{data:{error:'unauthenticated'}}`).

### Auditoria
- `npx tsc --noEmit` = 0 erros
- `npx vitest run src/components/helpdesk/__tests__/QueuePauseToggle.test.tsx` = 8/8

### Documentação
- R93 adicionada à tabela de regras preventivas em `wiki/erros-e-licoes.md`

---

## 2026-05-05 (Plano "Free Forever" — 4 camadas shipped)

### Goal
Garantir que o projeto WhatsPRO **nunca passe de 70%** de qualquer dimensão do plano grátis Supabase (db_size, storage, mau, edge invocations, realtime, bandwidth, disk IO).

### Camadas
| Camada | O quê | Status |
|---|---|---|
| **1** Alívio imediato | Cron `handoff-queue-requeue` (1min) → n8n na VPS WSMARTvps + VACUUM FULL `net._http_response` (−2.7 MB) | ✅ |
| **2** Retention automática | Policy 8 (`handoff_queue_events` 90d) habilitada. Policies 1-6 já estavam ON em sessões anteriores | ✅ |
| **3** Monitoring proativo | Migration `platform_usage_history` + `snapshot_platform_usage()` + cron jobid 13 (06:11 UTC diário, SQL puro sem HTTP). Notifica super_admins em `notifications` quando ≥60% (orange/red/critical, dedupe 20h) | ✅ |
| **4** Playbook | `wiki/free-forever-playbook.md` (169 linhas) com escalation por nível 50/60/70/85% e ações por dimensão | ✅ |

### Validações
- ✅ Smoke `snapshot_platform_usage()`: snapshot id=2 com db 5.34%, storage 0.43%, mau 0% → green
- ✅ Smoke `apply_retention_policy(8)` (handoff_queue_events): retornou OK, 0 candidates, log persistiu
- ✅ Smoke notification ORANGE: INSERT em notifications funcionou, RLS para super_admins OK (cleanup feito)
- ✅ db total: 29 MB → 26.6 MB (5.32% de 500 MB) — folga de 94%

### Crons agora
| jobid | nome | schedule | onde |
|:-:|---|---|---|
| 12 (DELETED) | handoff-queue-requeue | — | migrado pro n8n VPS |
| 13 (NOVO) | platform-usage-snapshot | 11 6 * * * | pg_cron (SQL puro) |

### SYNC RULE
banco ✅ (2 migrations) | types.ts N/A | admin UI N/A (próximo passo opcional: card no Admin) | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅

### Edge function logs (sanity)
- `requeue-conversations` chamado pelo n8n cada ~60s, 200 OK, todos green
- `event-processor` 404 a cada 10s — bug pré-existente não relacionado, anotado
- `process-jobs` 401 a cada 1min — outra vítima do R92, fix futuro

---

## 2026-05-05 (Sprint H — Fila Inteligente D30, Wikis Finais — D30 100% completo)

### Goal
Fechar D30 documentalmente: admin-detalhado ganha seção Fila Inteligente, R91 (RR concorrência) e R92 (vault rotation) viram entries históricos formais em `wiki/erros-e-licoes`, logs Sprint D+F+G+E arquivados em wiki separada, log.md enxugado.

### Arquivos
- **NOVO**: `wiki/log-arquivo-2026-05-05-d30-defg-e.md` — agrega logs Sprints D (Admin UI) + F (Helpdesk UI) + G (Tests + Retention) + E (Modo Estendido) numa página só. Preserva goal/arquivos/SYNC/auditoria de cada sprint.
- **MODIFICADO**: `wiki/casos-de-uso/admin-detalhado.md` — nova seção "D30 — Fila Inteligente" (entre SYNC RULE e Sidebar) com 3 superfícies: QueueConfig dialog em DepartmentsTab, select default_dept inline em InboxesTab (D-α), ExtendedHoursConfig na tab Segurança do AIAgentTab. Cross-ref para [[wiki/casos-de-uso/handoff-fila-detalhado]]. ALLOWED_FIELDS menciona `extended_hours_until`. Links incluem D30/R91/R92/handoff-fila.
- **MODIFICADO**: `wiki/erros-e-licoes.md` — entries históricos detalhados de **R91** (RR concorrência: SELECT FOR UPDATE no cursor, edge case de `queue_position=NULL` saturando sentinela, smoke 8 chamadas paralelas em prod) e **R92** (vault.SUPABASE_ANON_KEY rotacionado pelo Supabase, JWT legacy quebrou silenciosamente TODOS os crons que usavam Bearer da vault — `process-jobs`/`process-flow-followups`/`aggregate-metrics`/`e2e-scheduled` — `cron.job_run_details` mostra "succeeded" porque SQL command rodou; status real só em `net._http_response`).
- **ESVAZIADO**: `log.md` mantém apenas esta entrada Sprint H + ref pra arquivos.

### SYNC RULE
banco N/A | types.ts N/A | admin UI N/A | ALLOWED_FIELDS N/A | backend N/A | prompt N/A | system_settings N/A | docs ✅ (admin-detalhado + erros-e-licoes + handoff-fila-detalhado + decisoes-chave + roadmap + index + memory + PRD)

### Auditoria
- `npx tsc --noEmit` = 0 erros
- `npx vitest run` = 728 passam (sem deltas — só docs)

### Estado D30 final
| Sprint | Status |
|---|---|
| A — DB schema + RPC `pick_next_assignee` | ✅ em prod |
| B — backend ai-agent + edge fn `assign-handoff` | ✅ em prod (v174 + v1) |
| C — cron `requeue-conversations` | ✅ em prod (jobid 12) |
| D — admin UI QueueConfig + default_dept | ✅ em prod |
| E — Modo Estendido (`ExtendedHoursConfig`) | ✅ em prod |
| F — helpdesk UI (badge + pause + cancel queue) | ✅ em prod |
| G — 53 testes + retention policy 90d | ✅ em prod (id=8) |
| **H — wikis finais + cross-refs** | ✅ shipped 2026-05-05 |

**D30 100% shipped.** 26.5h totais entregues em 2 dias. Único bloqueio externo: 1 handoff real via WhatsApp pra fechar E2E no helpdesk (gap aceito desde Sprint B).

### Frase para retomar
D30 fechado. Se houver novo trabalho, pode partir pra próximas frentes: M19 S6/S7 (NPS automático + alertas proativos pendentes) ou outras melhorias.

---

> Sessões D30 Sprint A (DB), Sprint B (backend HIGH RISK), Sprint C (cron + R92 hotfix vault) — 2026-05-04 — arquivadas em:
> - [[wiki/log-arquivo-2026-05-04-d30-abc]]
>
> Sessões D30 Sprints D (Admin UI), F (Helpdesk UI), G (Tests + Retention), E (Modo Estendido) — 2026-05-04/05 — arquivadas em:
> - [[wiki/log-arquivo-2026-05-05-d30-defg-e]]

---

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
