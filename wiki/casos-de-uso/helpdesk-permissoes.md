---
title: Helpdesk — Permissões Granulares e Árvore de Componentes
tags: [helpdesk, permissoes, inbox, rls, decisao-d21, componentes]
sources: [src/components/helpdesk/, src/components/admin/UsersTab.tsx, supabase/migrations/]
updated: 2026-04-27
---

# Helpdesk — Permissões e Árvore de Componentes

> Parte do **Helpdesk (M2)** — sub-página dedicada ao **modelo de permissões granulares** (Decisão D21, 2026-04-25) e à **árvore completa de componentes** que compõem o módulo. Para o índice geral e outras áreas, ver [[wiki/casos-de-uso/helpdesk-detalhado]].

---

## 1.26 Permissões Granulares de Inbox por Atendente (D21, 2026-04-25)

**O que e (didático):** Cada atendente só vê as caixas de entrada (inboxes) que o admin liberou para ele. Política de "negar por padrão" — atendente sem nenhum vínculo NÃO vê o helpdesk: aparece um empty state amigável pedindo para solicitar acesso ao admin. Super_admin sempre vê tudo.

**Como o admin libera:** Em `/dashboard/admin/users` → expand do usuário → seção "Caixas de Entrada" → checkbox por inbox. Cada vínculo tem 3 permissões granulares por checkbox:
- **Não atribuídas** (`can_view_unassigned`): ver conversas sem agente nos seus departamentos
- **Todas no depto** (`can_view_all_in_dept`): ver todas (não só as suas) nos seus departamentos
- **Outros deptos** (`can_view_all`): ver conversas de departamentos onde não é membro

**Hierarquia:** Instância → Inbox → Departamento → Atendente. Permissão é por **inbox** (não por departamento). Departamento continua sendo organização interna.

> **Técnico — Backend:**
> - Migration `20260416000004_inbox_users_visibility_permissions`: adiciona 3 colunas booleanas em `inbox_users` (defaults: `can_view_all=false`, `can_view_unassigned=true`, `can_view_all_in_dept=true`)
> - Função RLS `can_view_conversation(_user_id, _inbox_id, _department_id)` SECURITY DEFINER: gate obrigatório `EXISTS inbox_users` (sem vínculo = bloqueio total), depois OR de [`_department_id IS NULL`, `is_super_admin`, `role IN admin/gestor`, `can_view_all=true`, `member of department`]

> **Técnico — Frontend:**
> - `useHelpdeskInboxes`: para super_admin pega `inboxes` direto; para outros faz JOIN `inbox_users` filtrando por `user_id=auth.uid()`. Expõe `inboxesLoading` para distinguir "carregando" de "sem acesso". Mantém map de permissões por inbox em `permissionsMapRef`.
> - `HelpDesk.tsx`: quando `!inboxesLoading && inboxes.length === 0` → renderiza `EmptyState` (mobile + desktop) com ícone Lock e mensagem diferenciada por role.
> - `ConversationList.visibleAssignmentOptions`: useMemo esconde opção "Todas" quando `!canViewAllInDept && !canViewAll` e "Não atribuídas" quando `!canViewUnassigned`.
> - `defaultAssignmentFilter`: super_admin='todas', outros='minhas'.
> - `UsersTab.tsx`: handleToggleVisibility com optimistic update + rollback em erro.

> **Limitação conhecida (R73 — hardening agendado em S9):** `can_view_unassigned` e `can_view_all_in_dept` são **SOFT** (frontend-only). Apenas `can_view_all` é enforçado pela função RLS. Atendente avançado pode bypass via curl. Aceito como dívida no cenário B2B (atendentes contratados). S9 estende RLS para enforçar as 3 colunas.

**Decisão D21:** [[wiki/decisoes-chave]]. Plano de hardening: roadmap M19 S9.

---

## Árvore de Componentes (apêndice)

Estrutura completa dos componentes que compõem o Helpdesk:

```
HelpDesk.tsx (pagina principal)
+-- ConversationList.tsx
|   +-- Search + Sort + Filter pills
|   +-- Bulk action bar (acoes em massa)
|   +-- ConversationItem.tsx (cada conversa na lista)
|       +-- ContactAvatar + bolinha de prioridade
|       +-- ConversationLabels (badges de etiquetas)
|       +-- Badges: departamento, agente, nota, rascunho
|       +-- Tempo de espera (relogio)
+-- ChatPanel.tsx
|   +-- Header linha 1: avatar, nome, telefone, agente, conexao
|   +-- Header linha 2: status, toggle IA, badge notas, botao Finalizar
|   +-- Divisores de data + lista de mensagens
|   |   +-- MessageBubble.tsx (10 tipos de midia)
|   |   +-- AudioPlayer.tsx (player com velocidade)
|   |   +-- Transcricao inline
|   +-- Indicador de digitacao
|   +-- ChatInput.tsx
|   |   +-- Campo de texto + rascunho automatico
|   |   +-- Anexar imagem/documento + drag & drop
|   |   +-- Gravar audio
|   |   +-- Menu de templates (/)
|   |   +-- Seletor de emoji
|   |   +-- Modo nota privada
|   |   +-- Citacao de resposta (reply)
|   +-- NotesPanel.tsx (painel lateral de notas)
|   +-- TicketResolutionDrawer.tsx (painel de finalizacao)
+-- ContactInfoPanel.tsx
    +-- Avatar + nome + telefone
    +-- Secao de etiquetas (LabelPicker + ManageLabelsDialog)
    +-- Dropdown de status (ConversationStatusSelect)
    +-- Dropdown de prioridade
    +-- Dropdown de agente responsavel
    +-- Dropdown de departamento (useDepartments)
    +-- Resumo IA (summarize-conversation edge function)
    +-- Contexto do Lead (lead_profiles + ai_agent_logs)
    +-- Historico de conversas passadas (ate 200)
    +-- GlobalSearchDialog.tsx (Ctrl+K)
```

---

## Sub-páginas relacionadas

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-organizacao]] — Etiquetas, Tags, Notas, Status, Prioridade, Atribuição, Departamentos, Bulk
- [[wiki/casos-de-uso/helpdesk-ia]] — Toggle IA, Transcrição, Resumo, Finalização, Contexto do Lead
- [[wiki/casos-de-uso/helpdesk-comunicacao]] — Templates `/`, Mídia, Rascunhos, Emoji, Reply
- [[wiki/casos-de-uso/helpdesk-ux]] — Layout, Typing, Tempo de Espera, Histórico, Busca Global, Filtros, Realtime
- [[wiki/decisoes-chave]] — D21 (Permissões), R73 (limitação RLS atual)
- [[wiki/roadmap]] — M19 S9 (hardening RLS agendado)
