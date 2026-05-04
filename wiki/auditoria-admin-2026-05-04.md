---
title: Auditoria Profunda — Módulo Admin (2026-05-04)
tags: [auditoria, admin, super-admin, edge-functions, sync-rule, rls, r88]
sources: [src/pages/dashboard/Admin*.tsx, src/components/admin/, supabase/functions/admin-*]
updated: 2026-05-04
---

# Auditoria Profunda — Módulo Admin

> Auditoria 3 agentes paralelos + auto-auditoria + Sprint 0 (RLS check). Inclui retificações pós auto-crítica. Sem alterações de código — só análise.

## Sumário Executivo

Módulo admin é **funcional e seguro no caminho feliz**, com gating defense-in-depth (`AdminRoute` + guards locais + RLS). Auto-auditoria revelou: severidades infladas no relatório original (6 "críticos" → só 1 real), achado A2 (escalation via `confirmRoleChange`) **descartado após Sprint 0** — RLS de `user_roles` é rigorosa. Dívidas reais: R88 nas edge fns admin-* (silent failure em criação/deleção), `is_super_admin` SECURITY DEFINER **sem `SET search_path`** (já mapeado em auditoria-helpdesk), TeamTab dead, RoadmapTab com ~150 linhas mortas, `as any` em campos tipados, helper `verifySuperAdmin` reimplementado 3x. Test coverage para Admin* = **zero**.

**Nota global recalibrada: 6.5/10** (era 7.0 inflado).

---

## Inventário

| Camada | Arquivos | LOC | Testes |
|---|---|---|---|
| Páginas `Admin*.tsx` | 9 | ~480 | 1 (não cobre Admin*) |
| Componentes `admin/*.tsx` (raiz) | 8 | 3.274 | 1 |
| Componentes `admin/ai-agent/*` | ~25 | — | 4 |
| Edge functions `admin-*` | 3 | 317 | 0 |

Detalhe em [[wiki/casos-de-uso/admin-detalhado]].

---

## Sprint 0 — Achados (executado 2026-05-04)

### 0a. RLS de `user_roles` — A2 RESOLVIDO ✅

Auditoria via SQL direto na prod confirmou 3 policies:

| Policy | Comando | USING |
|--------|---------|-------|
| Super admin can manage all roles | ALL | `is_super_admin(auth.uid())` |
| Super admin can view all roles | SELECT | `is_super_admin(auth.uid())` |
| Users can view own roles | SELECT | `auth.uid() = user_id` |

`UsersTab.tsx:367-369` (`confirmRoleChange` upsert direto no frontend) **NÃO é exploitable** — apenas super_admin passa pela policy "ALL". A2 era falso positivo da auditoria original.

### 0b. Achado novo — `is_super_admin` sem `SET search_path` 🔴

```sql
CREATE FUNCTION is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql
STABLE SECURITY DEFINER  -- ⚠️ falta SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;
```

Mesma dívida das outras 5 funções SECURITY DEFINER reportadas em [[wiki/auditoria-helpdesk-2026-05-02]]. **`is_super_admin` é a função-gatekeeper** do módulo admin inteiro — adicionar `SET search_path = public, pg_temp` deveria ter prioridade A1 da auditoria de banco do Helpdesk.

### 0c. Wiki criada ✅

`wiki/casos-de-uso/admin-detalhado.md` (125 linhas) — fecha gap REGRA ZERO.

---

## 🔴 Críticos (1, recalibrado)

| # | Onde | O que | Severidade |
|---|------|-------|------------|
| C1 | `admin-create-user/index.ts:72-74`, `admin-delete-user/index.ts:63-78` | **R88 violado** — INSERT/DELETE em `user_roles` sem `{error}` check; user pode ficar criado no auth sem role | 🔴 crítico operacional |
| C0 (DB) | `is_super_admin()` | SECURITY DEFINER sem `SET search_path` — gatekeeper do admin todo | 🔴 (escopo: auditoria de banco, não admin frontend) |

---

## 🟡 Médios (rebatizados de "críticos")

| # | Onde | O que |
|---|------|-------|
| ex-C2 | `admin-update-user` | Não atualiza `role`. **Verificado: UsersTab.tsx:349 não passa `role` no payload — gap de feature, não regressão.** Defesa em profundidade |
| ex-C3 | 3 edge fns admin-* | Catch retorna `error.message` cru. Endpoint admin-only — não é breach, é higiene |
| ex-C4 | `AdminRetention.tsx:43-65,132` | Gate posicionado depois dos hooks. RLS bloqueia no backend, mas vaza queries desnecessárias |
| ex-C5 | `__tests__/AdminGuards.test.tsx` | Cobre 0 das 9 `Admin*.tsx` — débito, não bug |
| M1 | `RoadmapTab.tsx:29-181` | ~150 linhas de constantes sombreadas (`_LEGACY_MODULES`, `ROADMAP_ITEMS`, `CHANGELOG`, `INSIGHTS`, `INFRA`) — risco de drift |
| M2 | `App.tsx:238-244` | Rotas duplicadas `/dashboard/{docs,roadmap,backup}` E `/dashboard/admin/{docs,roadmap,backup}` |
| M3 | `Sidebar.tsx:716-778` | 4 das 9 admin pages não aparecem no sidebar |
| M4 | `UsersTab.tsx:177,251` | `as any` em `inbox_users.can_view_*` |
| M5 | `AIAgentTab.tsx:42` | `interface AIAgent { [key: string]: any }` anula tipagem |
| M6 | `InboxesTab.tsx:163` | `console.error` solto + `JSON.stringify(e)` em toast |
| M7 | 8 das 9 páginas | Redirect defensivo aponta para `/dashboard` (DashboardHome admin-only) — padronizar para `/dashboard/helpdesk` |
| M8 | `AdminRetention.tsx` (300 LOC) | Quebra padrão (wrapper fino + `*Tab`). Extrair `RetentionTab.tsx` |
| M9 | 3 edge fns admin-* | Não usam `verifySuperAdmin` de `_shared/auth.ts` — reimplementam ~25 linhas cada |
| M10 | `admin-create-user` vs `admin-update-user` | Senha mínima inconsistente (sem mínimo vs ≥6) |
| M11 | `admin-delete-user` | Cascata sem DELETE explícito em `inbox_users` (confia em FK CASCADE) |
| M12 | 3 edge fns admin-* | Sem validação UUID `user_id` nem regex de email |
| M13 | `UsersTab.fetchUsers` | 8 queries paralelas + montagem em memória — pesa em tenants 1000+ users |
| M14 | `AIAgentTab.tsx:139` | `useCallback(fetchAgents, [selectedAgentId])` + `useEffect([])` — closure stale risk |
| M15 | `DocumentViewer.tsx` (275 linhas) | Parser markdown caseiro frágil + `codeBlockLang` dead |
| M16 | `InboxesTab.tsx:99,126` | Duplica fetch de `instances` (já existe `useInstances()`) |
| M17 | `confirmRoleChange` (UsersTab) | Não chama `log_admin_action` — promoções de role sem audit trail |
| M18 (novo) | 8 das 9 páginas | Mobile responsivo NÃO auditado (só UsersTab teve redesign v7.20.3) |
| M19 (novo) | Edge fns admin-* | Sem rate limit; super_admin pode fazer 1000 deletes/seg |
| M20 (novo) | i18n | Mensagens de erro misturam PT/EN ("Forbidden:", "Failed to assign role") |

---

## 🟢 Baixo / Trivial

| # | O que |
|---|-------|
| L1 | Magic string `/dashboard` repetida em 8 páginas |
| L2 | Comentários PT/EN misturados em AdminRetention |
| L3 | `as never` em `supabase.rpc('apply_retention_policy' as never)` |
| L4 | `... as RetentionPolicy[]` casts |
| L5 | `key={index}` em mapping de RoadmapTab |
| L6 | `KNOWN_SECRETS` hard-coded em SecretsTab |
| L7 | `<AvatarImage>` sem `alt` em UsersTab |
| L8 | Comentário-trecho após `}` final em AIAgentTab |
| L9 (resolvido) | ~~Wiki admin-detalhado.md~~ ✅ criada em Sprint 0b |
| L10 | TeamTab.tsx (2 linhas) — dead, deletar |

---

## ✅ Pontos Fortes

Gating defense-in-depth (`AdminRoute` + guards + RLS), CORS dinâmico + preflight, `verify_jwt=false` + auth manual, SYNC RULE íntegra, auto-save com `pendingSaveRef`, self-deletion bloqueada, audit log em 3 edge fns (falta em `confirmRoleChange` — M17), RLS de `user_roles` rigorosa ✅.

---

## Plano de Ação (RETIFICADO — 7 sprints, ~10 dias)

### Sprint 0 ✅ — concluído
- [x] Auditar RLS de user_roles → A2 falso positivo
- [x] Criar `admin-detalhado.md`

### Sprint 1 ✅ — concluído (commit `24e1c29`, 2026-05-04)
- [x] C1 (R88) em 3 edge fns + rollback auth.user
- [x] ex-C3 sanear catch nas 3 edge fns
- [x] L10 deletar TeamTab (0 refs confirmadas)
- [x] 18 smoke tests novos (`AdminPagesGate.test.tsx`)
- [x] M11 parcial: DELETE explícito de inbox_users + department_members
- Auditoria: tsc 0 / deno 0 / vitest 662 (+18 novos; 5 pré-existentes FormBuilder)

### Sprint 2 (1.5 dias) — Higiene de segurança
- ex-C3 (sanear catch), ex-C4 (mover gate AdminRetention)
- M9 (substituir auth inline por `verifySuperAdmin`)
- M11 (DELETE explícito de inbox_users)
- M17 (audit log em `confirmRoleChange`) — fecha gap mais relevante que `update-user role`
- M19 (rate limit nas 3 edge fns admin-*)

### Sprint 3 (1 dia) — Tipos e dead code
- M1 (limpar RoadmapTab — 150 linhas)
- M4+M5 (remover `as any` — usar Database types)
- ex-C2 (suporte a role em update-user)
- M20 (padronizar i18n PT-BR)

### Sprint 4 (3 dias) — Refactors maiores
- M8 (extrair RetentionTab) + M14 (deps useCallback) + M16 (consolidar useInstances)
- M15 (substituir DocumentViewer por react-markdown) — 1 dia sozinho
- M18 (auditar mobile das 8 páginas restantes) — pode incluir redesign

### Sprint 5 (1.5 dias) — Validação e UX
- M10+M12 (validação email/UUID/senha consistente)
- M2 (decidir canon docs/roadmap/backup; redirect das duplicadas)
- M3 (linkar 4 páginas faltantes no Sidebar)
- M7 (padronizar redirect destino para `/dashboard/helpdesk`)
- M13 (avaliar RPC `get_admin_users_overview` — só se métricas justificarem)

### Sprint 6 (0.5 dia) — Polish
- L1-L8 (constants, magic strings, alt, comentários)
- Atualizar `wiki/casos-de-uso/admin-detalhado.md` com mudanças

### Tarefa cross-cutting (auditoria de banco — não admin)
- C0 (`is_super_admin` + 4 outras funções sem `SET search_path`) — pertence ao plano de ação da auditoria-helpdesk, prioridade A1

**Total: ~10 dias** efetivos (vs 5-6 estimados originalmente).

---

## Comparativo Original vs Retificada

| Aspecto | Original → Retificada |
|---------|------|
| Críticos | 6 → 1 (+ 1 cross-cutting C0) |
| Médios | 16 → 20 (+M17 audit log, M18 mobile, M19 rate limit, M20 i18n) |
| Sprint 0 achados | — → A2 falso positivo, C0 descoberto |
| Esforço | 5-6 → ~10 dias |
| Nota | 7.0 → **6.5/10** |

## Notas Finais (regra 13)

- (a) **Conteúdo: 9.5/10** — auto-auditoria + Sprint 0 expuseram falsos positivos e achados novos; severidades calibradas com base em RLS real
- (b) **Orquestração: 9.5/10** — `wiki/casos-de-uso/admin-detalhado.md` agora existe (REGRA ZERO); cruzamento com auditoria-helpdesk via C0
- (c) **Vault: 9/10** — relatório com 195 linhas (regra 14 ok), frontmatter completo, links cruzados

## Links Relacionados

- [[wiki/casos-de-uso/admin-detalhado]] — Documentação detalhada do módulo (criada Sprint 0b)
- [[wiki/auditoria-helpdesk-2026-05-02]] — Auditoria similar (cross-cut: SECURITY DEFINER sem search_path)
- [[wiki/erros-e-licoes]] — R73 (soft permissions), R88 (silent fail)
- [[wiki/decisoes-chave]] — D21 permissões inbox
- [[RULES.md]] — SYNC RULE 8 itens, CORS, padrões edge fn
