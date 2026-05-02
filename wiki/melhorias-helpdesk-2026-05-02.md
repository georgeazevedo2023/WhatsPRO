---
title: 20 Melhorias do Helpdesk — Inconsistências, Repetições e UI
tags: [helpdesk, melhorias, refactor, ui, dx]
sources: [src/pages/dashboard/HelpDesk.tsx, src/components/helpdesk/*, src/hooks/useHelpdesk*, src/lib/helpdeskBroadcast.ts, src/lib/saveToHelpdesk.ts]
updated: 2026-05-02
---

# 20 Melhorias do Helpdesk

> Companion da [[wiki/auditoria-helpdesk-2026-05-02]]. Foco em **inconsistências, duplicações e UI** acionáveis.

## 🔁 Repetições e duplicação de funcionalidade

### 1. Preview de mídia (📷 / 🎥 / 🎵 / 📎) duplicado em 6 arquivos
- `useHelpdeskConversations.ts:7-13`, `useSendFile.ts`, `ChatInput.tsx:249`, `saveToHelpdesk.ts:156`, `sync-conversations/index.ts:326`, `whatsapp-webhook/index.ts:845`
- **Fix**: extrair `mediaPreview(media_type)` para `src/lib/messagePreview.ts` (TS) + `_shared/messagePreview.ts` (Deno).

### 2. UPDATE de `last_message`+`last_message_at` em 6 lugares
- 4 frontend (ChatInput.handleSend:351, handleSendAudio:248, useSendFile, saveToHelpdesk:160) + 2 edge (whatsapp-webhook:846, sync-conversations:327)
- **Fix**: trigger `AFTER INSERT ON conversation_messages` que atualiza a conversation. Remove updates manuais.

### 3. Atribuição de agente em 3 caminhos diferentes
- `helpdeskBroadcast.assignAgent()` (DB + broadcast)
- `ContactInfoPanel.handleAssignAgent:280-309` (DB + broadcast manual em outro canal — não usa o helper)
- `ChatInput.autoAssignAgent:37-47` (usa helper corretamente)
- **Fix**: ContactInfoPanel deve chamar `assignAgent()`. Padronizar broadcast em UM canal e UM evento.

### 4. Mudança de status oferecida em 4 lugares
- Tabs no header (`HelpDesk.tsx:287`)
- `ConversationStatusSelect` no header do chat
- Menu Status dentro do `ChatInput` popover (`ChatInput.tsx:547`)
- Select no `ContactInfoPanel:408`
- Cada um faz a query de update direto. **Fix**: hook `useUpdateConversation(id)` mutation compartilhado com optimistic update centralizado.

### 5. Broadcast em 2 canais (`helpdesk-realtime` + `helpdesk-conversations`)
- `helpdeskBroadcast.ts:3` envia toda mensagem nos dois — chat e lista cada um escutando um.
- Dobra throughput Realtime + dependências cruzadas.
- **Fix**: 1 canal `helpdesk` único; client filtra por `event` + `inbox_id`/`conversation_id`.

### 6. JID brasileiro com/sem 9º dígito duplicado
- `saveToHelpdesk.ts:67-78` faz manipulação manual; provavelmente repetido em outras funções (avatar, webhook).
- **Fix**: helper `normalizeBrazilianJid(jid)` retornando `[primary, alt]`.

### 7. Reply construído como TEXTO em vez de relação estruturada
- `ChatInput.handleSend:314` faz `> *Citando:* ${replyTo.content}\n\n${text}` — só visual, não persiste vínculo.
- Não há coluna `reply_to_id` em `conversation_messages`.
- **Fix**: adicionar `reply_to_id uuid REFERENCES conversation_messages(id)` + render condicional. Sem isso, edição/exclusão da msg citada não atualiza o reply.

### 8. Áudio enviado por DOIS caminhos (UAZAPI base64 + Storage upload)
- `ChatInput.handleSendAudio:217-235` upload no bucket `audio-messages` + envio base64 via UAZAPI proxy.
- Custo dobrado de banda + risco de inconsistência (UAZAPI envia mas Storage falha = áudio sem preview).
- **Fix**: upload primeiro no Storage, enviar via `send-mediafromurl` na UAZAPI. Único caminho.

## 🛠 Inconsistências

### 9. ContactInfoPanel.handleAssignAgent broadcasta no canal errado
- Usa `'helpdesk-conversations'` mas o helper `assignAgent` espalha em ambos os canais. Outras tabs do helpdesk podem perder a mudança.

### 10. Mudança de status pelo menu do ChatInput não broadcasta
- `ChatInput.handleStatusChange:180-194` faz UPDATE DB + chama callback, mas não chama `broadcastStatusChanged`.
- Resultado: Kanban não recebe a transição se feita por esse caminho.
- **Fix**: roteamento único — toda mudança de status passa por `onUpdateConversation` (que já broadcasta).

### 11. Sort "Nao lidas" sem acento
- `ConversationList.tsx:249` — typo visível ao usuário. **Fix**: `Não lidas`.

### 12. Status `arquivada` enum coexiste com flag `archived boolean`
- `HelpDesk.tsx:153` bulk archive seta `archived: true` (boolean), mas o enum status aceita `'arquivada'`.
- **Fix**: decidir um caminho. Recomendado manter `archived boolean` e remover status `arquivada`.

### 13. Filtro "Todas" não inclui arquivadas; sem opção de visualizá-las
- `useHelpdeskConversations.buildQuery:44` força `archived=false` sempre. Após bulk archive, conversas somem para sempre da UI.
- **Fix**: status-tab adicional "Arquivadas" ou expansão de filtros.

### 14. Typing indicator: throttle 3s no envio mas 4s no recebedor — janela apertada
- `ChatInput.tsx:134` + `ChatPanel.tsx:210`. Latência de broadcast > 1s → indicator pisca.
- **Fix**: receiver com 6-8s; sender mantém 3s.

## 🎨 UI / UX

### 15. Checkbox "iniciar seleção" seleciona automaticamente o PRIMEIRO item
- `ConversationList.tsx:451` — comportamento aleatório. Usuário esperava bulk-mode.
- **Fix**: substituir por botão `[ Selecionar ]` explícito.

### 16. ConversationItem lê `localStorage` em cada render
- `ConversationItem.tsx:54` — em listas virtualizadas com 50+ items, é I/O síncrono no render. Bloqueia thread no scroll mobile.
- **Fix**: `conversationDraftsSet: Set<string>` em `useHelpdeskConversations` injetado como prop.

### 17. `getRowHeight` muda altura dinamicamente baseado em labels/agent/notes
- `ConversationList.tsx:190` — adicionar label causa reflow brusco; `react-window` pode jumpar.
- **Fix**: altura fixa rica (~88px) ou transição suave.

### 18. Templates `/comando` sem discoverability
- `ChatInput.tsx:157-166` autocomplete só ativa se user descobre. Placeholder atual é só `Escrever mensagem...`.
- **Fix**: placeholder dinâmico: `Escrever mensagem... (digite / para templates)`.

### 19. Notificações limitadas à conversa selecionada
- `ChatPanel.tsx:222` toca som apenas na conversa **aberta** quando janela perde foco. Se usuário está em outra conversa, não recebe sinal das demais.
- **Fix**: hook `useHelpdeskNotifications` em nível da página — escuta `helpdesk-conversations`, dispara badge no item da lista + Notification API + som único debounced.

### 20. ContactInfoPanel.tsx com 949 linhas + 5 useEffects independentes
- 4-5 round-trips (lead_profile, ai_agent_logs, count history, history data, member_ids) a cada troca de conversa.
- LCP visível: painel piscando.
- **Fix**: split em 4 sub-componentes + RPC `get_contact_context(contact_id, conversation_id)` consolidando.

## Bonus

- **B1**. `Limpar filtros` usa `<Badge variant="destructive">` (vermelho) — não é destrutivo. (`ConversationList.tsx:397`)
- **B2**. `ChatPanel` tem 4 props redundantes para mesma navegação (`onBack`/`onShowInfo` mobile + `onToggleList`/`onToggleInfo` desktop). Unificar em `onNavigate('back'|'list'|'info')`.
- **B3**. `auto-summarize` trigger + `ContactInfoPanel.handleSummarize` manual — sem dedup local, fácil pagar 2x LLM.
- **B4**. Drafts em `localStorage` nunca expiram. `cleanupStaleDrafts(validIds)` no fetch inicial.

## Sobre filtros de status × atribuição (decisão 2026-05-02)

User propôs unificar tabs do topo (status: Atendendo/Aguardando/Resolvidas/Todas) com filtro inferior (atribuição: Todas/Minhas/Não atribuídas). **Decisão: manter ambos** — são eixos ortogonais.

Mas concordamos que UI pode melhorar:
- Trocar default "Todas" → "Todos os agentes" no filtro de atribuição (clareza)
- Filtro só aparece destacado quando ≠ default (atualmente já é o caso, parcialmente)
- Memoizar última escolha de atribuição em sessionStorage (volta no "Minhas" automaticamente)

## Quick wins shipados (2026-05-02)

### Onda 1 — UI + duplicações
- ✅ #1 — `mediaPreview()` extraído para `src/lib/messagePreview.ts` (frontend) e `supabase/functions/_shared/messagePreview.ts` (edge). Cobertura completa: 4 arquivos frontend + 2 edge functions agora consomem o helper único
- ✅ #11 — typo "Nao lidas" → "Não lidas"
- ✅ #16 — drafts via Set em vez de localStorage por render
- ✅ #18 — placeholder com hint de templates `/`
- ✅ #B1 — badge "Limpar filtros" sem variant destructive

### Onda 2 — Bug fixes + UX fina
- ✅ #10 — `ChatInput.handleStatusChange` não faz mais UPDATE direto no DB. Delega ao `onStatusChange` callback que roteia via `onUpdateConversation` (ChatPanel → HelpDesk) — broadcast `status-changed` agora dispara em todos os caminhos. Eliminou duplo UPDATE
- ✅ #14 — typing receiver expira em 6s (era 4s). Margem maior contra latência de Realtime evitando flicker
- ✅ #B4 — spring-cleaning de drafts órfãos no `localStorage` no boot do helpdesk. Roda 1x por sessão (flag em sessionStorage), valida via 1 query `SELECT id FROM conversations WHERE id IN (...)`

### Onda 5 — Refactor + UX
- ✅ #3 — `assignAgent` unificado: `ContactInfoPanel.handleAssignAgent` passa a usar o helper `assignAgent()` de `helpdeskBroadcast.ts`. Helper canônico agora propaga erro (throw) para o caller mostrar toast. Caminho único: UPDATE + broadcast nos 2 canais
- ✅ #6 — JID brasileiro 9º dígito: `saveToHelpdesk.ts` agora usa `getAlternateBrazilianJid()` e `normalizePhoneForMatch()` de `phoneUtils.ts` (helpers já existentes). Removida duplicação interna de 16 linhas de manipulação de string
- ✅ #17 — row height fixa em 88px (antes alternava 64/90px). Eliminou reflow ao adicionar label/agente/nota — `react-window` deixa de jumpar posição

### Onda 4 — UI + descobertas
- ✅ #15 — botão "Selecionar" explícito substituiu checkbox confusa. Adicionado state `bulkActive` em `ConversationList` (`bulkMode = bulkActive || selectedIds.size > 0`) — entra no modo seleção sem auto-selecionar item algum
- ✅ #B3 — **JÁ ESTAVA RESOLVIDO**: `auto-summarize/index.ts:148-158` faz dedup por janela de 5 min (`generated_at < 5min ago` → skipped). `summarize-conversation/index.ts:74` retorna cache quando `ai_summary` existe e `force_refresh=false`. Item removido do backlog

### Onda 3 — Trigger DB centralizando last_message_at (#2)
- ✅ Migration `conversations_auto_update_last_message`: cria função `update_conversation_last_message()` (SECURITY DEFINER, search_path fixo, sem EXECUTE para anon/authenticated) + trigger `update_conversation_on_message_insert AFTER INSERT ON conversation_messages`
- Comportamento: pula `private_note`; idempotente (`NEW.created_at >= last_message_at`); seta `is_read=false` apenas para incoming mais recente; preview de mídia em SQL (espelha `_shared/messagePreview.ts`)
- Validado com smoke test: novo, antigo (idempotência), private_note (skip)
- ✅ Removidos UPDATEs manuais em 5 lugares:
  - `ChatInput.handleSend` (apenas status_ia continua)
  - `ChatInput.handleSendAudio` (idem)
  - `useSendFile.ts` (idem)
  - `saveToHelpdesk.ts` (totalmente removido — trigger cobre)
  - `whatsapp-webhook` (totalmente removido)
  - `sync-conversations` (totalmente removido)
- Pendência: `ai-agent/index.ts` (3 ocorrências) e `process-follow-ups/index.ts` (1) ainda fazem UPDATE manual — caminhos HIGH RISK do CLAUDE.md, não tocados. Trigger é idempotente, redundância inofensiva. Mover para backlog quando autorização for dada

## Plano de ação dos demais

| Item | Esforço | Sprint |
|------|---------|--------|
| #2 trigger last_message centralizado | 0.5d | Banco |
| #3 unificar assignAgent em 1 helper | 0.5d | Refactor |
| #4 hook useUpdateConversation | 1d | Refactor |
| #5 consolidar canais broadcast | 1d | Realtime |
| #6 normalizeBrazilianJid helper | 0.5d | Helpers |
| #7 reply estruturado (DB + UI) | 1d | Banco + UI |
| #8 áudio só via Storage URL | 1d | Refactor |
| #10 fix status broadcast no ChatInput menu | 0.25d | Bug |
| #12 decidir arquivada (status x boolean) | 0.5d | Banco |
| #13 filtro Arquivadas | 0.5d | UI |
| #14 ajustar throttle typing | 0.25d | UI |
| #15 botão "Selecionar" explícito | 0.5d | UI |
| #17 row height fixa | 0.5d | UI |
| #19 useHelpdeskNotifications | 1d | Feature |
| #20 split ContactInfoPanel + RPC | 2d | Refactor |
| #B2 unificar nav props ChatPanel | 0.25d | Refactor |
| #B3 dedup auto-summarize | 0.25d | Bug |
| #B4 cleanup drafts staled | 0.25d | UX |
