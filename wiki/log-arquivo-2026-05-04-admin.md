---
title: Log Arquivo — 2026-05-04 manhã (Auditoria Vault + Auditoria Admin Sprint 0+1+2 + R90 hotfix)
type: log-archive
source: log.md
archived: 2026-05-04
---

# Log arquivado — Sessão da manhã 2026-05-04 (Auditoria Vault + Módulo Admin)

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


