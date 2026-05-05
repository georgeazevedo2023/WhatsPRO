---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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
