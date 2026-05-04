---
title: Auditoria Profunda — Módulo Helpdesk + Banco
tags: [auditoria, helpdesk, banco, rls, performance, seguranca]
sources: [src/pages/dashboard/HelpDesk.tsx, src/components/helpdesk/*, src/hooks/useHelpdesk*, src/lib/helpdeskBroadcast.ts, src/lib/saveToHelpdesk.ts, supabase/functions/sync-conversations, supabase/functions/whatsapp-webhook, supabase advisors]
updated: 2026-05-04
---

# Auditoria Profunda — Helpdesk

## 1. Sumário Executivo

| Pilar | Nota | Observação |
|-------|------|-----------|
| Arquitetura & DX | 8.5/10 | 1 página + 3 hooks + 15 componentes, separação clara |
| Modelo de dados | 8.0/10 | Schema sólido, FKs com CASCADE, RLS abrangente |
| Segurança / RLS | 7.5/10 | Cobertura completa, mas funções com `search_path` mutável e RPCs `SECURITY DEFINER` expostas a `anon`/`authenticated` |
| Performance | 6.5/10 | 144 violações `multiple_permissive_policies`, RLS reavalia `auth.uid()` por linha, 8 índices nunca usados |
| Realtime / sync | 7.0/10 | 2 canais bem orquestrados, mas `setTimeout(500)` para refetch, dependência circular em useEffect, duplicação em 2 canais |
| Robustez & UX | 8.0/10 | Optimistic updates com rollback, drafts, retry, skeleton, scroll anchoring, fallback timeout 10s |
| Cobertura de testes | 4.0/10 | Nenhum teste para hooks/componentes do helpdesk |
| **Nota global** | **7.4/10** | Módulo maduro, principal débito = otimização RLS + testes |

## 2. Inventário do Módulo

### 2.1 Frontend (5.697 linhas)
- **Página**: `HelpDesk.tsx` (536L) — orquestra layout 3 painéis, mobile/desktop, bulk actions, sync
- **Hooks (3)**: `useHelpdeskInboxes` (131L, permissões granulares), `useHelpdeskConversations` (234L, fetch paginado PAGE_SIZE=50, labels/notes, realtime), `useHelpdeskFilters` (98L, busca 300ms debounce, filtros, sort)
- **Componentes (15)**: ChatPanel (477L), ChatInput (632L), ConversationList (544L), ContactInfoPanel (949L), MessageBubble (447L), TicketResolutionDrawer (402L), GlobalSearchDialog (142L), ConversationItem, ConversationLabels, ManageLabelsDialog, LabelPicker, ContactAvatar, ConversationStatusSelect, NotesPanel, AudioPlayer
- **Libs**: `helpdeskBroadcast.ts` (70L), `saveToHelpdesk.ts` (209L)

### 2.2 Banco (9 tabelas core)
- `conversations` (17): status, priority, assigned_to, department_id, status_ia, ai_summary, tags[], archived, lead_msg_count, is_read, last_message, last_message_at
- `conversation_messages` (1.341): direction, media_type, media_url, content, sender_id, external_id, transcription
- `conversation_labels` (0, N:N) | `inboxes` (1, instance_id, webhook_url) | `inbox_users` (1, role enum, can_view_*, is_available)
- `labels` (0, color #6366f1) | `contacts` (37, JID UNIQUE, ia_blocked_instances[]) | `departments` (1, trigger 1 default/inbox) | `department_members` (1, UK)

### 2.3 Edge functions
`whatsapp-webhook` (recebe + cria + dispara status_ia), `sync-conversations` (UAZAPI `/chat/find` + `/message/find`), `auto-summarize` (trigger), `summarize-conversation` (manual), `fire-outgoing-webhook`, `transcribe-audio`, `uazapi-proxy`.

## 3. RLS — Política por Tabela

Todas as 9 tabelas têm RLS **enabled**. Cobertura:

| Tabela | SELECT | INSERT | UPDATE | DELETE | Helpers |
|--------|--------|--------|--------|--------|---------|
| conversations | `can_view_conversation()` | `has_inbox_access` | `can_view_conversation` | super only | `can_view_conversation`, `is_super_admin` |
| conversation_messages | join + `has_inbox_access` | idem | — | só `private_note` | — |
| conversation_labels | join + `has_inbox_access` | idem | idem | idem | — |
| inboxes | `is_super_admin OR has_inbox_access` | super | admin/gestor | super | `get_inbox_role` |
| inbox_users | self + `is_inbox_member` | admin/gestor | idem | idem | — |
| labels | `has_inbox_access` | admin/gestor | idem | idem | — |
| contacts | join via conversations | `auth.uid() IS NOT NULL` | super | super | — |
| departments | `has_inbox_access` | super | super | super | — |
| department_members | join via departments | super | super | super | — |

**`can_view_conversation`** (gate principal): exige `inbox_users` AND (sem dept OR super OR admin/gestor OR `can_view_all` OR `department_members`). **Bem desenhada.**

## 4. Findings — Críticos / Altos / Médios

### CRÍTICOS
Nenhum bug crítico (sem violação RLS, sem dados órfãos, sem leak entre tenants).

### ALTOS

**A1. Funções `SECURITY DEFINER` com `search_path` mutável** (5: `is_inbox_member`, `is_super_admin`, `has_inbox_access`, `get_inbox_role`)
- Risco: search_path hijacking se atacante cria função com mesmo nome em schema antes de `public`
- **Fix**: `ALTER FUNCTION ... SET search_path = public, pg_temp;`

**A2. RPCs `SECURITY DEFINER` expostas a `anon`/`authenticated`** (6: as acima + `can_view_conversation`, `trigger_auto_summarize`)
- Chamáveis via `/rest/v1/rpc/<name>`. `is_super_admin` permite que qualquer usuário verifique se OUTRO usuário é super_admin. `trigger_auto_summarize` é trigger — não deveria ter EXECUTE público
- **Fix**: `REVOKE EXECUTE ON FUNCTION public.<name> FROM anon, authenticated;`

**A3. Performance RLS — `auth.uid()` reavaliado por linha** (28 violações)
- Padrão Supabase: usar `(SELECT auth.uid())`. Afeta TODAS as policies das 9 tabelas, overhead linear no count de rows. Impacto cresce conforme `conversation_messages` (1.341 hoje, escala rápido)
- **Fix**: reescrever cada policy substituindo `auth.uid()` por `(SELECT auth.uid())`

**A4. Multiple permissive policies** (144 violações)
- 2-4 policies sobrepostas por tabela × role × ação; Postgres executa TODAS (OR). Causa: padrão "Inbox users can X" + "Super admins can manage all" sobrepostos
- **Fix**: combinar em policy única com `OR is_super_admin(auth.uid())` no `USING/WITH CHECK`

### MÉDIOS

**M1. FKs sem índice de cobertura** (5): `conversation_labels.label_id`, `conversations.contact_id` (usado em `ContactInfoPanel.fetchHistory`), `departments.inbox_id`, `inboxes.instance_id`, `labels.inbox_id`. **Fix**: `CREATE INDEX` em cada.

**M2. Realtime — debounced refetch via setTimeout(500)** (`useHelpdeskConversations.ts:182`) — broadcast de `new-message` para conversa não listada agenda refetch; rajadas disparam refetch redundante. **Fix**: ref de timeout cancelável ou `addOptimisticConversation` com lookup direto.

**M3. Realtime — broadcast em DOIS canais** (`helpdeskBroadcast.ts:3`) — toda mensagem vai em `helpdesk-realtime` E `helpdesk-conversations` (razão histórica chat × lista), dobra throughput. **Fix**: 1 canal único + filtro client-side.

**M4. `useHelpdeskFilters` define `statusFilter` localmente mas não é usado** (`useHelpdeskFilters.ts:14` declara, `HelpDesk.tsx:87` mantém o seu). Código morto. **Fix**: remover ou consolidar.

**M5. `saveToHelpdesk.normalizePhone` usa `ilike '%suffix'`** (`saveToHelpdesk.ts:104`) — sem índice trigram, full table scan; funciona com 37 contatos, escala mal. `idx_contacts_phone btree` não usado. **Fix**: coluna gerada `phone_suffix` com índice ou trigram em phone.

**M6. Cliente Realtime não-determinístico após `disconnect`** (`ChatPanel.tsx:286`) — fetchMessages após 5s mas não resubscribe; canal fica `disconnected` até troca de conversa. **Fix**: `channel.subscribe()` ou recriar canal.

**M7. UPDATE em `last_message_at` faz race com webhook** — `ChatInput.handleSend` → INSERT → UPDATE; em paralelo webhook UPDATE também. Sem optimistic locking → last write wins, preview defasado possível. **Fix**: trigger AFTER INSERT em `conversation_messages` (centralizado).

### BAIXOS

**B1. Índices nunca usados**: `idx_contacts_name_trgm`, `idx_contacts_phone`, `idx_conversations_{status,inbox_id,priority,department_id,tags,archived}`. Volume baixo; alguns serão usados em produção (cobertos por `idx_conversations_inbox_status_active`). **Fix**: re-avaliar com `pg_stat_user_indexes` após carga real.

**B2. `conversations.tags[]` sem TTL** — heurístico (`motivo:`, `produto:`, `marca_indisponivel:`); risco de array > 1KB. Considerar normalizar em `conversation_tags`.

**B3. `ConversationList.tsx:451` Checkbox "iniciar seleção" UX confusa** — seleciona `conversations[0]` aleatório. Substituir por toggle de bulk-mode explícito.

**B4. `ContactInfoPanel.tsx:949` é o componente mais pesado** — múltiplos `useEffect` (lead_profiles, ai_agent_logs, history, member_ids). Considerar batch via RPC `get_contact_context(contact_id, conversation_id)`.

**B5. `audio-messages` upload via base64** (`ChatInput.tsx:228`) — blob→base64→UAZAPI E Storage. Dois caminhos para mesma mídia (UAZAPI CDN, Storage fallback p/ preview imediato). Documentar a razão.

**B6. Channel name colidindo entre tabs** — `supabase.channel('helpdesk-realtime')` cria múltiplas subscriptions na mesma página (ChatPanel + outros). Duplica handlers. Considerar singleton broadcaster.

## 5. Métricas de Saúde do Banco

```
conversations:        17 rows  | 0 órfãos
conversation_messages: 1.341 rows | 0 órfãos | 0 status/priority inválido
conversation_labels:    0 rows  | UK ok
inboxes:                1 | inbox_users: 1 | labels: 0
contacts:              37 rows  | JID UNIQUE preservado
departments:            1 | department_members: 1
```

Volumes baixos; banco saudável. **Nenhuma anomalia estrutural**.

## 6. Triggers e Automações

| Tabela | Trigger | Função | OK? |
|--------|---------|--------|-----|
| conversations | auto_summarize_on_resolve | `trigger_auto_summarize()` (pg_net → edge fn) | OK, SECURITY DEFINER + search_path 'public' correto |
| conversations | update_conversations_updated_at | `update_updated_at_column()` | OK |
| departments | ensure_single_default_department | plpgsql | OK |
| departments | update_departments_updated_at | idem | OK |

**Não existe trigger central** para atualizar `last_message_at`/`last_message` em INSERT — espalhado por 4 lugares (webhook, ChatInput.handleSend, ChatInput.handleSendAudio, useSendFile, saveToHelpdesk). **Recomendação**: trigger AFTER INSERT em `conversation_messages` centralizado.

## 7. Plano de Ação Recomendado (priorizado)

### Sprint 1 — Segurança (1 dia)
1. `ALTER FUNCTION ... SET search_path = public, pg_temp` para 5 funções (A1)
2. `REVOKE EXECUTE` em 6 RPCs `SECURITY DEFINER` para `anon`/`authenticated` (A2)

### Sprint 2 — Performance RLS (1-2 dias)
3. Reescrever 28 policies usando `(SELECT auth.uid())` (A3)
4. Consolidar policies sobrepostas em uma única por (table, role, action) (A4)

### Sprint 3 — Índices e Trigger (meio dia)
5. Adicionar 5 índices de FK (M1)
6. Trigger AFTER INSERT em `conversation_messages` para atualizar `last_message_at` + `last_message` (M7)
7. Remover updates manuais redundantes em ChatInput, saveToHelpdesk, webhook

### Sprint 4 — Robustez Realtime (1 dia)
8. Cancelar setTimeout em `useHelpdeskConversations.ts:182` (M2)
9. Resubscribe explícito após disconnect em ChatPanel (M6)
10. Avaliar consolidação de canais (M3)

### Sprint 5 — Testes (2-3 dias)
11. Testes para `useHelpdeskFilters` (filtros, sort, search debounce)
12. Testes para `useHelpdeskConversations` (paginação, broadcast handlers)
13. Teste E2E de envio (text/audio/file) cobrindo broadcast + DB + webhook

### Sprint 6 — UX & limpeza (meio dia)
14. Remover Checkbox "iniciar seleção" confuso (B3)
15. Remover state morto `statusFilter` em `useHelpdeskFilters` (M4)
16. Considerar RPC consolidada `get_contact_context` (B4)

## 8. Notas Finais

- Módulo **funcional e em produção**. Auditoria não identificou bug crítico ou vazamento de dados.
- Gaps majoritariamente de **otimização** (RLS performance) e **endurecimento** (REVOKE EXECUTE, search_path).
- Nota geral: **7.4/10** — bom módulo, dívidas técnicas conhecidas e endereçáveis.
- Documentação Vault: completa após esta auditoria.

*Rev N (2026-05-04): Condensado de 219 para <=200 linhas (regra 14).*
