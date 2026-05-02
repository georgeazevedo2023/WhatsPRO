---
title: Auditoria Profunda — Módulo Helpdesk + Banco
tags: [auditoria, helpdesk, banco, rls, performance, seguranca]
sources: [src/pages/dashboard/HelpDesk.tsx, src/components/helpdesk/*, src/hooks/useHelpdesk*, src/lib/helpdeskBroadcast.ts, src/lib/saveToHelpdesk.ts, supabase/functions/sync-conversations, supabase/functions/whatsapp-webhook, supabase advisors]
updated: 2026-05-02
---

# Auditoria Profunda — Helpdesk

## 1. Sumário Executivo

| Pilar | Nota | Observação |
|-------|------|-----------|
| Arquitetura & DX | 8.5/10 | Modularização excelente: 1 página + 3 hooks + 15 componentes, separação clara |
| Modelo de dados | 8.0/10 | Schema sólido, FKs corretos com CASCADE, RLS abrangente |
| Segurança / RLS | 7.5/10 | Cobertura completa, mas funções com `search_path` mutável e RPCs `SECURITY DEFINER` expostas a `anon`/`authenticated` |
| Performance | 6.5/10 | 144 violações `multiple_permissive_policies`, RLS reavalia `auth.uid()` por linha em todas tabelas, 8 índices nunca usados |
| Realtime / sincronização | 7.0/10 | 2 canais de broadcast bem orquestrados, mas há `setTimeout(500)` para refetch, dependência circular no useEffect, e duplicação de envio em 2 canais |
| Robustez & UX | 8.0/10 | Optimistic updates com rollback, drafts, retry, skeleton, scroll anchoring; fallback de timeout 10s |
| Cobertura de testes | 4.0/10 | Nenhum teste para hooks/componentes do helpdesk (só playground/admin) |
| **Nota global** | **7.4/10** | Módulo maduro, principal débito = otimização RLS + testes |

## 2. Inventário do Módulo

### 2.1 Frontend (5.697 linhas)
- **Página**: `src/pages/dashboard/HelpDesk.tsx` (536 linhas) — orquestração geral, layout 3 painéis, mobile/desktop, bulk actions, sync
- **Hooks** (3):
  - `useHelpdeskInboxes` (131L) — inboxes + permissões granulares por inbox (super-admin vs membro)
  - `useHelpdeskConversations` (234L) — fetch paginado (PAGE_SIZE=50), labels/notes, realtime broadcast
  - `useHelpdeskFilters` (98L) — busca por nome/telefone/mensagem (300ms debounce), filtros de label/atribuição/prioridade/depto, sort
- **Componentes** (15): ChatPanel (477L), ChatInput (632L), ConversationList (544L), ContactInfoPanel (949L), MessageBubble (447L), TicketResolutionDrawer (402L), GlobalSearchDialog (142L), ConversationItem, ConversationLabels, ManageLabelsDialog, LabelPicker, ContactAvatar, ConversationStatusSelect, NotesPanel, AudioPlayer
- **Libs**: `helpdeskBroadcast.ts` (70L), `saveToHelpdesk.ts` (209L)

### 2.2 Banco (9 tabelas core)
- `conversations` (17 rows) — status, priority, assigned_to, department_id, status_ia, ai_summary, tags[], archived, lead_msg_count, is_read, last_message, last_message_at
- `conversation_messages` (1.341 rows) — direction (incoming/outgoing/private_note), media_type, media_url, content, sender_id, external_id, transcription
- `conversation_labels` (0 rows) — N:N
- `inboxes` (1) — instance_id, webhook_url, webhook_outgoing_url
- `inbox_users` (1) — role enum (admin/gestor/agente), can_view_all, can_view_unassigned, can_view_all_in_dept, is_available
- `labels` (0) — color #6366f1 default
- `contacts` (37) — JID UNIQUE, phone, profile_pic_url, profile_pic_storage_path, ia_blocked_instances[]
- `departments` (1) — is_default, inbox_id, trigger garante 1 default por inbox
- `department_members` (1) — user_id × department_id (UK)

### 2.3 Edge functions relacionadas
- `whatsapp-webhook` — recebe mensagens, cria conversa/mensagem, dispara `status_ia`
- `sync-conversations` — sync histórico via UAZAPI (`/chat/find` + `/message/find`, limit 200/500)
- `auto-summarize` — chamada por trigger `auto_summarize_on_resolve`
- `summarize-conversation` — manual via UI
- `fire-outgoing-webhook` — dispara webhook configurado por inbox
- `transcribe-audio`, `uazapi-proxy`

## 3. RLS — Política por Tabela

Todas as 9 tabelas têm RLS **enabled** com policies. Cobertura:

| Tabela | SELECT | INSERT | UPDATE | DELETE | Helpers |
|--------|--------|--------|--------|--------|---------|
| conversations | `can_view_conversation()` (inbox_users + dept) | `has_inbox_access` | `can_view_conversation` | super_admin only | `can_view_conversation`, `is_super_admin` |
| conversation_messages | join via conversations + `has_inbox_access` | idem | — | só `private_note` | — |
| conversation_labels | join + `has_inbox_access` | idem | idem | idem | — |
| inboxes | `is_super_admin OR has_inbox_access` | super | admin/gestor | super | `get_inbox_role` |
| inbox_users | self + `is_inbox_member` | admin/gestor | idem | idem | — |
| labels | `has_inbox_access` | admin/gestor | idem | idem | — |
| contacts | join via conversations | `auth.uid() IS NOT NULL` | super | super | — |
| departments | `has_inbox_access` | super | super | super | — |
| department_members | join via departments | super | super | super | — |

**Função `can_view_conversation`** (gate principal): exige `inbox_users` AND (sem dept OR super OR admin/gestor OR `can_view_all` OR `department_members`). **Bem desenhada.**

## 4. Findings — Críticos / Altos / Médios

### CRÍTICOS
Nenhum bug crítico identificado (sem violação de RLS, sem dados órfãos, sem leak de dados entre tenants).

### ALTOS

**A1. Funções `SECURITY DEFINER` com `search_path` mutável** (5 funções)
- `is_inbox_member`, `is_super_admin`, `has_inbox_access`, `get_inbox_role` — sem `SET search_path`
- Risco: search_path hijacking se atacante com privilégios cria função com mesmo nome em schema antes de `public`
- **Fix**: `ALTER FUNCTION ... SET search_path = public, pg_temp;` em cada uma

**A2. RPCs `SECURITY DEFINER` expostas a `anon` e `authenticated`** (6 funções)
- `can_view_conversation`, `get_inbox_role`, `has_inbox_access`, `is_inbox_member`, `is_super_admin`, `trigger_auto_summarize` chamáveis via REST `/rest/v1/rpc/<name>`
- `is_super_admin` permite que **qualquer usuário** verifique se OUTRO usuário é super_admin (passando user_id arbitrário)
- **Fix**: `REVOKE EXECUTE ON FUNCTION public.<name> FROM anon, authenticated;` (mantém uso interno em RLS)
- `trigger_auto_summarize` é trigger — não deveria ter `EXECUTE` público em hipótese alguma

**A3. Performance RLS — `auth.uid()` reavaliado por linha** (28 violações)
- Padrão Supabase recomenda `(SELECT auth.uid())` em vez de `auth.uid()` direto
- Afeta TODAS policies das 9 tabelas, gerando overhead linear no count de rows
- Impacto cresce conforme `conversation_messages` (1.341 hoje, mas escala rápido)
- **Fix**: reescrever cada policy substituindo `auth.uid()` por `(SELECT auth.uid())`

**A4. Multiple permissive policies** (144 violações)
- Cada tabela tem 2-4 policies sobrepostas para `anon`/`authenticated` × `SELECT`/`INSERT`/`UPDATE`/`DELETE`
- Postgres executa TODAS para cada query (OR)
- Causa raiz: padrão "Inbox users can X" + "Super admins can manage all" sobrepostos
- **Fix**: combinar em policy única com `OR is_super_admin(auth.uid())` no `USING/WITH CHECK`

### MÉDIOS

**M1. FKs sem índice de cobertura** (5 tabelas)
- `conversation_labels.label_id` — JOIN em label-based queries
- `conversations.contact_id` — usado em `ContactInfoPanel.fetchHistory` (filtro `eq` + `neq id`)
- `departments.inbox_id` — listagem de departamentos
- `inboxes.instance_id` — sync-conversations lookup
- `labels.inbox_id` — listagem de labels
- **Fix**: criar `CREATE INDEX ON ... (col);` para cada

**M2. Realtime — debounced refetch via setTimeout(500)** (`useHelpdeskConversations.ts:182`)
- Quando broadcast de `new-message` chega para conversa não listada, agenda refetch — pode disparar refetch redundante se múltiplas mensagens chegam em rajada
- **Fix**: usar ref de timeout cancelável; ou trocar por `addOptimisticConversation` com lookup direto

**M3. Realtime — broadcast em DOIS canais** (`helpdeskBroadcast.ts:3`)
- Toda mensagem é enviada em `helpdesk-realtime` E `helpdesk-conversations`
- Razão histórica (chat panel × lista), mas dobra throughput de Realtime
- **Fix**: usar 1 canal único + filtro client-side por evento

**M4. `useHelpdeskFilters` define `statusFilter` localmente mas não é usado**
- `useHelpdeskFilters.ts:14` declara `statusFilter` mas o consumidor `HelpDesk.tsx:87` mantém o seu próprio
- Código morto no hook (state não exportado significativamente)
- **Fix**: remover state local do hook ou consolidar

**M5. `saveToHelpdesk.normalizePhone` usa `ilike '%suffix'`** (`saveToHelpdesk.ts:104`)
- Sem índice trigram em `phone`, full table scan em cada match — funciona com 37 contatos, mas escala mal
- Já existe `idx_contacts_phone btree` (não usado segundo advisors)
- **Fix**: armazenar `phone_suffix` como coluna gerada com índice; ou usar índice trigram em phone

**M6. Cliente Realtime não-determinístico após `disconnect`**
- `ChatPanel.tsx:286` faz `fetchMessages()` após 5s mas não tenta resubscribe explicitamente
- O canal continua em `disconnected`; só reconecta na próxima troca de conversa
- **Fix**: chamar `channel.subscribe()` novamente ou recriar canal

**M7. UPDATE em `last_message_at` faz race com webhook** 
- `ChatInput.handleSend` → INSERT message → UPDATE conversation. Em paralelo, webhook recebe ACK e tenta UPDATE também
- Sem optimistic locking → último write wins, mas pode mostrar preview defasado
- Improvável em produção mas possível
- **Fix**: trigger AFTER INSERT em `conversation_messages` que atualiza conversation (e remove updates manuais espalhados)

### BAIXOS

**B1. `idx_contacts_name_trgm`, `idx_contacts_phone`, `idx_conversations_status`, `idx_conversations_inbox_id`, `idx_conversations_priority`, `idx_conversations_department_id`, `idx_conversations_tags`, `idx_conversations_archived` — nunca usados**
- Banco com volume baixo. Alguns serão usados em produção (status, inbox_id) mas atualmente cobertos por `idx_conversations_inbox_status_active`
- **Fix**: aguardar carga de produção e re-avaliar com `pg_stat_user_indexes`

**B2. `conversations.tags[]` cresce sem TTL** — uso atual é heurístico (`motivo:`, `produto:`, `marca_indisponivel:`); risco de array > 1KB por conversa em sessões longas. Considerar normalizar em tabela `conversation_tags` no longo prazo.

**B3. `ConversationList.tsx:451` usa `Checkbox` "iniciar seleção" no item primeiro — UX confusa**, comportamento "seleciona um aleatório" via `conversations[0]`. Substituir por toggle de bulk-mode explícito.

**B4. `ContactInfoPanel.tsx:949` é o componente mais pesado** — múltiplos `useEffect` acionando queries (lead_profiles, ai_agent_logs, history, member_ids). Considerar batching em uma única RPC `get_contact_context(contact_id, conversation_id)`.

**B5. `audio-messages` upload via base64** (`ChatInput.tsx:228`) — converte blob→base64→envia para UAZAPI E faz upload no Storage. Pequeno overhead, mas dois caminhos para a mesma mídia (UAZAPI tem CDN, Storage é fallback). Documentar a razão (URL pública para preview imediato no helpdesk).

**B6. Channel name colidindo entre tabs** — `supabase.channel('helpdesk-realtime')` cria múltiplas subscriptions na mesma página (ChatPanel + outros). Funciona mas duplica handlers. Considerar singleton broadcaster.

## 5. Métricas de Saúde do Banco

```
conversations:        17 rows  | 0 órfãos
conversation_messages: 1.341 rows | 0 órfãos | 0 status inválido | 0 priority inválido
conversation_labels:    0 rows  | UK garante uniqueness
inboxes:                1 row
inbox_users:            1 row
labels:                 0 rows
contacts:              37 rows  | JID UNIQUE preservado
departments:            1 row
department_members:     1 row
```

Volumes baixos; banco saudável. **Nenhuma anomalia estrutural**.

## 6. Triggers e Automações

| Tabela | Trigger | Função | OK? |
|--------|---------|--------|-----|
| conversations | auto_summarize_on_resolve | `trigger_auto_summarize()` (chama edge function via pg_net) | OK, mas SECURITY DEFINER + search_path 'public' (correto) |
| conversations | update_conversations_updated_at | `update_updated_at_column()` | OK |
| departments | ensure_single_default_department | trigger plpgsql | OK |
| departments | update_departments_updated_at | idem | OK |

Não existe trigger central para atualizar `last_message_at`/`last_message` quando uma mensagem é inserida — está espalhado por 4 lugares (webhook, ChatInput.handleSend, ChatInput.handleSendAudio, useSendFile, saveToHelpdesk). **Recomendação**: trigger AFTER INSERT em `conversation_messages` centralizado.

## 7. Plano de Ação Recomendado (priorizado)

### Sprint 1 — Segurança (1 dia)
1. `ALTER FUNCTION ... SET search_path = public, pg_temp` para 5 funções (A1)
2. `REVOKE EXECUTE` em 6 RPCs `SECURITY DEFINER` para `anon`/`authenticated` (A2)

### Sprint 2 — Performance RLS (1-2 dias)
3. Reescrever 28 policies usando `(SELECT auth.uid())` (A3)
4. Consolidar policies sobrepostas em uma única por (table, role, action) (A4)

### Sprint 3 — Índices e Trigger (meio dia)
5. Adicionar 5 índices de FK (M1)
6. Criar trigger AFTER INSERT em `conversation_messages` para atualizar `last_message_at` + `last_message` em `conversations` (M7)
7. Remover updates manuais redundantes em ChatInput, saveToHelpdesk, webhook (mantém apenas trigger)

### Sprint 4 — Robustez Realtime (1 dia)
8. Cancelar setTimeout em `useHelpdeskConversations.ts:182` (M2)
9. Resubscribe explícito após disconnect em ChatPanel (M6)
10. Avaliar consolidação de canais (M3)

### Sprint 5 — Testes (2-3 dias)
11. Adicionar testes para `useHelpdeskFilters` (filtros, sort, search debounce)
12. Testes para `useHelpdeskConversations` (paginação, broadcast handlers)
13. Teste E2E de envio (text/audio/file) cobrindo broadcast + DB + webhook

### Sprint 6 — UX & limpeza (meio dia)
14. Remover Checkbox "iniciar seleção" confuso (B3)
15. Remover state morto `statusFilter` em `useHelpdeskFilters` (M4)
16. Considerar RPC consolidada `get_contact_context` (B4)

## 8. Notas Finais

- Módulo está **funcional e em produção**. Auditoria não identificou bug crítico ou vazamento de dados.
- Gaps são majoritariamente de **otimização** (RLS performance) e **endurecimento** (REVOKE EXECUTE, search_path).
- Nota geral: **7.4/10** — bom módulo, dívidas técnicas conhecidas e endereçáveis.
- Documentação Vault: completa após esta auditoria.
