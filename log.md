---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

`npx supabase gen types typescript --project-id euljumeflwtljegknawy` → 5491 linhas. Diff de 658 linhas incorporou: novas colunas de `inbox_users`, `assistant_cache` + `assistant_conversations` (M19 S5), e tabelas das migrations 04-15 a 04-19.

### Pendente para fechar o ciclo

- Teste E2E: criar usuário sem inbox → confirmar empty state; admin libera 1 inbox → conversas aparecem
- Commit + atualizar wiki/casos-de-uso/helpdesk-detalhado.md

---

## 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright)

### 10 bugs corrigidos no Helpdesk (4 arquivos-chave)

**App.tsx — Auto-reload ao voltar à aba (3s):**
Supabase client (WebSocket + PostgREST) entra em estado quebrado após tab suspension. Refetch seletivo não funciona — `window.location.reload()` após 3s é a solução (padrão Slack/Discord). Removido `useQueryClient` (não mais necessário). React Router future flags adicionadas.

**ChatPanel.tsx — fetchMessages estabilizado:**
- Dependência de `conversationId` (string) em vez de `conversation` (objeto) — evita recriação do callback a cada evento realtime
- `AbortController` com timeout 10s + retry automático — nunca trava
- `setLoading(false)` incondicional no `finally` — nunca skeleton preso
- Removido `fetchIdRef` (era a causa raiz do skeleton infinito)

**useHelpdeskConversations.ts — loading inicia false:**
`useState(true)` + `selectedInboxId` vazio = loading travado para sempre. Fix: `useState(false)`, loading só ativa quando fetch realmente executa.

**client.ts — cleanup localStorage stale:**
Auto-remove tokens `sb-*-auth-token` de projetos Supabase antigos no boot.

**Outros fixes:** AvatarImage removido (403 CDN), AvatarFallback com iniciais, GlobalSearchDialog sem profile pics.

### Auditoria UAZAPI — `/contact/getProfilePic` não existe no v2

Testado diretamente contra `wsmart.uazapi.com`: endpoint retorna 405. `/profile/image` é para UPLOAD (não download). No UAZAPI v2, foto de perfil chega apenas via webhook (`imagePreview`) e sync (`image`). Hook simplificado: retorna URL válida ou null, sem chamadas de rede.

### Storage cleanup — 1.4 GB liberados

Projeto antigo "Novo WsmartQR" (`crzcpnczpuzwieyzbqev`): 2.667 arquivos deletados do bucket `helpdesk-media`. Storage org: 134% → <1%.

### Testes Playwright — 100% OK

Playwright v1.59.1 instalado. Login automatizado, 4 conversas testadas (George/Lívia/Wsmart/Wsmart Digital), tab switch com segunda aba. Resultado: 0 skeletons, 0 erros console, mensagens carregam em todas as trocas.

### Deploy

Edge function `uazapi-proxy` v18 deployada. CI/CD: 4 builds bem-sucedidos. Token atualizado.

### Regras adicionadas: R65-R72

---

> Entradas de M19 S3-S5 (2026-04-13) arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2 arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
