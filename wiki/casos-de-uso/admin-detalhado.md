---
title: Admin — Painel de Configuração (Documentação Detalhada)
tags: [admin, super-admin, painel, gating, rls, edge-functions, sync-rule]
sources: [src/pages/dashboard/Admin*.tsx, src/components/admin/, supabase/functions/admin-*]
updated: 2026-05-04
---

# Admin — Painel de Configuração da Plataforma

> O Admin é a área **só do super_admin** onde se configura a plataforma inteira: **caixas (inboxes), equipe (usuários), departamentos, agente de IA, secrets, retenção de dados, backup, documentação, roadmap**. Sem ele, nenhum atendente entra, nenhum departamento existe, nenhum agente IA atende.
>
> Princípio: **explicit-allow / default-deny**. Ninguém é admin por default — só quem está em `user_roles WHERE role='super_admin'`.

---

## Como o Admin é Protegido (3 Camadas de Defesa)

| Camada | Onde | O que faz |
|--------|------|-----------|
| **Roteamento** | `<AdminRoute>` em `src/App.tsx:158-176` | Bloqueia URL `/dashboard/admin/*` se `!isSuperAdmin` — redirect para `/dashboard` |
| **Componente** | `if (!isSuperAdmin) <Navigate>` em cada `Admin*.tsx` | Defesa em profundidade — guard local mesmo dentro da rota gateada |
| **RLS no Supabase** | `is_super_admin(auth.uid())` em policies de tabelas sensíveis (`user_roles`, etc) | Barreira final — bypass de UI ainda é bloqueado pelo banco |

A camada que de fato **fecha a porta** é a RLS. As outras 2 são UX/DX. Tentativa de curl direto contra `user_roles` por user normal é bloqueada pela policy "Super admin can manage all roles" (`USING is_super_admin(auth.uid())`).

---

## As 9 Páginas do Admin

| Rota | Arquivo | O que faz |
|------|---------|-----------|
| `/dashboard/admin` | `AdminPanel.tsx` | Redirect para `/dashboard/admin/inboxes` (página inicial do admin) |
| `/dashboard/admin/inboxes` | `AdminInboxes.tsx` → `InboxesTab` | Cadastrar caixas (inboxes) e atribuir instâncias WhatsApp |
| `/dashboard/admin/users` | `AdminUsers.tsx` → `UsersTab` | Convidar/editar/remover membros, atribuir caixas + departamentos + permissões granulares |
| `/dashboard/admin/departments` | `AdminDepartments.tsx` → `DepartmentsTab` | Cadastrar departamentos por inbox (Vendas, Suporte, Financeiro) |
| `/dashboard/admin/secrets` | `AdminSecrets.tsx` → `SecretsTab` | Gerenciar API keys (Gemini, OpenAI, Groq, etc) sem expô-las no frontend |
| `/dashboard/admin/docs` | `AdminDocs.tsx` → `DocumentationTab` | Documentação interna (PRDs, guias) renderizada com markdown viewer |
| `/dashboard/admin/roadmap` | `AdminRoadmap.tsx` → `RoadmapTab` | Roadmap visual + changelog versionado das releases |
| `/dashboard/admin/backup` | `AdminBackup.tsx` → `BackupModule` | Restaurar conversas a partir dos JSONL backups (D24) |
| `/dashboard/admin/retention` | `AdminRetention.tsx` (monolítico) | Configurar policies de retenção de dados (D25) — toggles por tabela com dry-run |

> Rotas legadas duplicadas: `/dashboard/{docs,roadmap,backup}` apontam para os mesmos componentes (decisão de canon pendente — ver auditoria-admin-2026-05-04).

---

## UsersTab — A Página Mais Complexa

860 linhas. Faz 3 coisas distintas:

1. **CRUD de usuários** — convida (chama `admin-create-user`), edita (chama `admin-update-user`), remove (chama `admin-delete-user`)
2. **Atribuição de caixas e departamentos** — toggles inline em `inbox_users` e `department_members`
3. **Mudança de papel** — `confirmRoleChange()` faz upsert direto em `user_roles` (RLS bloqueia se não-admin)

### Permissões granulares por inbox (D21)

Quando um membro é vinculado a uma caixa, 3 toggles definem o que ele vê dentro dela:

- `can_view_unassigned` — ver conversas não atribuídas a ninguém
- `can_view_all_in_dept` — ver TODAS as conversas do(s) seu(s) departamento(s)
- `can_view_all` — ver tudo da caixa (bypass de departamento)

> ⚠️ R73: as 2 primeiras são **soft (frontend-only)**. RLS no backend só enforça `can_view_all`. Hardening agendado em M19 S9.

---

## Edge Functions admin-* (3)

| Função | O que faz | Segurança |
|--------|-----------|-----------|
| `admin-create-user` | Cria user no auth + define role + audit log | `verify_jwt=false` + auth manual super_admin via `user_roles` |
| `admin-update-user` | Atualiza email/senha/full_name (NÃO atualiza role — gap) | Idem |
| `admin-delete-user` | Cascata: `user_instance_access` → `user_roles` → `user_profiles` → `auth.deleteUser`. Bloqueia self-deletion | Idem |

**Padrão comum:**
- CORS dinâmico via `getDynamicCorsHeaders(req)` — handle preflight OPTIONS
- Auth manual (não usa helper `verifySuperAdmin` de `_shared/auth.ts` — duplicação de ~25 linhas cada)
- `log_admin_action` RPC chamado para audit trail (non-blocking)
- Erro retornado via `errorResponse(corsHeaders, msg, status)` helper

> ⚠️ Mudança de role NÃO passa por edge function — UsersTab faz upsert direto em `user_roles`. RLS protege, mas não há audit log dessa ação.

---

## SYNC RULE no AIAgentTab

`AIAgentTab.tsx:57-87` mantém `ALLOWED_FIELDS` — whitelist de campos do agente que podem ser auto-saved. **Toda nova feature do AI Agent (D28 excluded_products, D29 dynamic VALID_KEYS, service_categories, prompt_sections, tts_fallback_providers, poll_nps_*, etc) DEVE ser adicionada aqui** (item 4 do SYNC RULE).

Auditoria 2026-05-04 confirmou: SYNC RULE íntegra ✅.

---

## Como o Sidebar Mostra o Admin

`src/components/dashboard/Sidebar.tsx` filtra itens admin com `isSuperAdmin`. Atualmente linka 5 das 9 páginas — `admin/docs`, `admin/roadmap`, `admin/backup`, `admin` (panel raiz) usam as rotas legadas (`/dashboard/{docs,roadmap,backup}`). Inconsistência.

---

## Tabelas do Banco (admin-relacionadas)

| Tabela | Propósito |
|--------|-----------|
| `user_roles` | Mapping user → role (`super_admin`, `gerente`, `user`). RLS rigorosa: só super_admin escreve |
| `user_profiles` | Profile estendido (full_name, avatar, etc) |
| `user_instance_access` | Quais instâncias um user tem acesso |
| `inbox_users` | Vínculo user ↔ inbox + permissões granulares (D21) |
| `department_members` | Vínculo user ↔ departamento (organização interna da inbox) |
| `system_settings` | Secrets, defaults globais (`default_prompt_sections`, `KNOWN_SECRETS`) |
| `db_retention_policies` | 6 policies seed OFF + dry-run (D25) |
| `db_cleanup_log` | Audit trail de cleanup runs |
| `admin_audit_log` | Log imutável de ações destrutivas via `log_admin_action()` RPC |

---

## Links Relacionados

- [[wiki/auditoria-admin-2026-05-04]] — Auditoria profunda 2026-05-04 (nota 6.5/10 recalibrada, 6 sprints)
- [[wiki/auditoria-helpdesk-2026-05-02]] — Auditoria similar do Helpdesk
- [[wiki/casos-de-uso/ai-agent-detalhado]] — AI Agent (configurado via AIAgentTab)
- [[wiki/decisoes-chave]] — D21 (permissões inbox), D24/D25 (retention)
- [[wiki/erros-e-licoes]] — R73 (soft permissions), R88 (CHECK constraint silent fail)
- [[RULES.md]] — SYNC RULE 8 itens, CORS, padrões edge fn

---

*Documentado em: 2026-05-04 — Sprint 0b da auditoria do módulo admin (REGRA ZERO de CLAUDE.md).*
