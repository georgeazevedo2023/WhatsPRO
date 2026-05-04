---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-05-04 (Sprint A — Fila Inteligente de Handoff D30)

### Goal
Aterrissar o schema completo da Fila Inteligente de Handoff (D30) em prod sem tocar `ai-agent/index.ts` (HIGH RISK). Sprint A do plano de 8 sprints — só DB.

### O que foi shipado (6 migrations)

- **A.1** `20260504000002_handoff_queue_departments.sql` — `queue_mode_enabled bool=false`, `queue_mode_timeout_minutes int=5 CHECK 1-60`, `default_assignee_id uuid → auth.users`, `last_assignee_position int=0`.
- **A.2** `20260504000003_handoff_queue_department_members.sql` — `queue_position int` (drag-drop), `queue_paused bool=false`, `queue_paused_reason text`, `gestor_in_queue bool=false`. Index parcial `(department_id, queue_position) WHERE queue_paused=false`. **Backfill:** `queue_position` de membros existentes via `ROW_NUMBER() * 10` particionado por dept (espaçado para inserts futuros).
- **A.3** `20260504000004_handoff_queue_inboxes_default_dept.sql` — `inboxes.default_department_id uuid → departments` (D-α: fallback de dept). Index parcial em FK.
- **A.4** `20260504000005_handoff_queue_business_hours.sql` — `ai_agents.extended_hours_until timestamptz` + tabela `business_hours_exceptions` com RLS (super_admin manage + inbox users SELECT).
- **A.5** `20260504000006_handoff_queue_events.sql` — tabela `handoff_queue_events` com 5 status (active/responded/timed_out/manual_override/cancelled), 3 índices (incluindo o do cron `(expires_at) WHERE status='active'` — R28 IMMUTABLE), RLS (super_admin all + inbox users SELECT).
- **A.6** `20260504000007_handoff_queue_pick_next_assignee.sql` — RPC `pick_next_assignee(_department_id uuid, _skip_user_ids uuid[]) RETURNS uuid`, `SECURITY DEFINER SET search_path = public, pg_temp`, **`SELECT FOR UPDATE` no cursor (R91 mitigado)**. Pula paused, gerentes sem `gestor_in_queue`, skip_user_ids. Q4 loop infinito. REVOKE EXECUTE de PUBLIC/anon/authenticated, GRANT só para service_role.

### Smoke tests (em prod via mcp__supabase__execute_sql)

- ✅ Schema check: 13/13 objetos confirmados (4+4+1+1+1+1+1).
- ✅ `pick_next_assignee('00…0')` → `NULL` (dept inexistente).
- ✅ Rotação 8 chamadas no dept "Vendas" (6 membros, 1 gestor excluído por default): `f363→5300→6e18→4d79→d027→f363→5300→6e18` — 5 distintos + loop ao 1º.
- ✅ Reset de `last_assignee_position` aplicado após smoke.

### Auditoria

- `npx supabase gen types typescript` → `src/integrations/supabase/types.ts` regenerado (5803 linhas, 20 referências às novas keys).
- `npx tsc --noEmit` = 0 erros.
- 6 arquivos novos em `supabase/migrations/`.

### Pendências para Sprints B-H

- **Atenção:** wiki original dizia `conversations.assigned_user_id` — coluna real é `assigned_to`. Sprint B (`assign-handoff` edge fn + 6 paths em ai-agent) precisa usar `assigned_to`.
- Migration A.2 backfill destravou rotação imediata (não precisa drag-drop UI da Sprint D para round-robin funcionar).
- D30 status atualizado em `wiki/decisoes-chave.md` e `wiki/casos-de-uso/handoff-fila-detalhado.md`.

### Próximo (Sprint B)
`assign-handoff` edge function + integrar 6 paths em `ai-agent/index.ts` (HIGH RISK, fallback try/catch) + dept resolution (profile→funnel→inbox) + variável `{handoff_assignee_name}` em `prompt_sections.handoff_text`.

---

## 2026-05-04 (Auditoria de vault + Módulo Admin)

### Auditoria de vault (manhã)
8 commits empurrados: rotação log.md (354→201), particionamento de 15 wikis (decisoes-chave + 14 casos-de-uso), criação de 40+ sub-wikis. Vault ≤ 200 linhas em todos os arquivos críticos. PRD header sincronizado. AGENTS.md atualizado. 1 commit pendente pushado. Detalhe: vide commits 9401304 → a8c7d6a.

### Auditoria Módulo Admin (tarde)
3 agentes paralelos auditaram páginas/componentes/edge fns. Nota original 7.0/10. Auto-auditoria revelou severidades infladas — 6 "críticos" → 1 real. **Sprint 0 executado**:
- **0a** SQL na prod confirmou RLS rigorosa em `user_roles` — A2 (`confirmRoleChange` upsert direto) é **falso positivo**.
- **0b** Achado novo (cross-cutting): `is_super_admin` SECURITY DEFINER **sem `SET search_path`** — gatekeeper do admin todo. Mesma dívida das 5 funções já mapeadas em auditoria-helpdesk-2026-05-02. **C0 prioridade A1**.
- **0c** Wiki `casos-de-uso/admin-detalhado.md` criada (125 linhas) — fecha gap REGRA ZERO.

Relatório retificado em `wiki/auditoria-admin-2026-05-04.md` (198 linhas): 1 crítico real (R88 nas edge fns), 20 médios (incluindo M17 audit log faltante em `confirmRoleChange`, M18 mobile não auditado, M19 sem rate limit, M20 i18n), nota recalibrada **6.5/10**, plano de 7 sprints (~10 dias).

### Sprint 1 — Crítico real + Smoke tests (commit `24e1c29`)
- **C1 R88** corrigido em 3 edge fns + rollback do auth.user em falha de role insert.
- **ex-C3 sanear catch** nas 3 edge fns.
- **L10 TeamTab.tsx** deletado.
- **AdminPagesGate.test.tsx**: 18 smoke tests novos.
- **M11 parcial**: DELETE explícito de `inbox_users` + `department_members` em admin-delete-user.
- **Deploy em prod**: 3 edge fns redeployadas via Supabase CLI.

### Sprint 2 — Higiene de segurança (commit `3d3583a`)
- **ex-C4** Gate AdminRetention reorganizado: hooks no topo (Rules of Hooks), useEffect com guard `if (!isSuperAdmin) return`, early return após hooks. Não-admin não dispara round-trip.
- **M9** Substituí auth inline por `verifySuperAdmin(req)` helper de `_shared/auth.ts` nas 3 edge fns admin-* (~60 linhas a menos; comportamento mais robusto via serviceClient).
- **M17** Audit log em `confirmRoleChange` (UsersTab): promoções de papel agora registram `change_role` em `admin_audit_log` com `old_role` + `new_role` + email.
- **Auditoria**: tsc 0 / deno 0 / vitest 18/18 OK.
- **Deploy em prod**: 3 edge fns redeployadas.

**Pendências Sprint 3**: ex-C2 (role em update-user), M1 (RoadmapTab dead code), M4+M5 (`as any` → Database types), M19 (rate limit).

### Hotfix R90 — bug ativo "Erro ao alterar papel"
User reportou ao tentar trocar Lucas de Gerente → Atendente: toast "Erro ao alterar papel" + Network 400 em `user_roles?on_conflict=user_id`. Auditoria SQL em prod expôs: tabela `user_roles` tem PK em `id` (uuid próprio) **sem UNIQUE em `user_id`** — `upsert({...}, { onConflict: 'user_id' })` no `confirmRoleChange` falha pois PostgREST não acha a constraint (R36 ativo). Bonus: 1 user (george) tinha 2 roles (super_admin + user — segundo da trigger `handle_new_user`).

Migration `20260504000001_user_roles_unique_user_id`: (1) dedupe por hierarquia super_admin > gerente > user, (2) `ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id)`. Aplicada em prod via `apply_migration` MCP. R90 documentada em `erros-e-licoes.md`. Sem alteração de código frontend — `confirmRoleChange` original passou a funcionar. **User validou em prod ✅.**

### Sessão de design: Fila Inteligente de Handoff (D30 — especificada, não shippada)

User pediu feature para distribuir handoffs IA→humano automaticamente. Sessão de design completa em formato 1-pergunta-por-vez (regra `feedback_discussion_format`). 8 decisões fechadas + 3 sub-decisões + auto-auditoria do plano (3 gaps críticos descobertos: dept resolution, RR race condition, SYNC RULE incompleta).

**Resumo:** 2 modos por departamento (Fila ON = round-robin / OFF = 100% Lucas distribui manual). Timeout 5min com pausa em horário não-comercial (auto-envia `out_of_hours_message`). Modelo C de visibilidade (badge "Em fila"). Loop infinito com sino gestor. Drag-drop manual da ordem. Pause individual. Variável `{handoff_assignee_name}` no prompt. Toggle "Expediente Estendido" + calendário exceções.

**Schema:** 5 migrations (departments, department_members, inboxes.default_dept, ai_agents.extended_hours_until + business_hours_exceptions, handoff_queue_events) + RPC atômico `pick_next_assignee` com SELECT FOR UPDATE.

**Plano: 8 sprints (~26.5h, ~3-4 dias).** Wiki dedicada: [[wiki/casos-de-uso/handoff-fila-detalhado]] (193 linhas, completa). D30 em [[wiki/decisoes-chave]].

**Frase para retomar:** "**implementar fila inteligente Sprint A**" — abre o plano e começa pelas migrations.

---

> Sessões 2026-05-02 (Auditoria Profunda Helpdesk + 9 ondas + trigger DB last_message_at) e 2026-05-03 (Top tabs viram ESCOPO + Header mobile-first + Equipe gerenciar deptos inline) arquivadas em:
> - [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]]


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
