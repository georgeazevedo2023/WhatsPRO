---
title: Helpdesk — Layout, Realtime e UX
tags: [helpdesk, layout, typing, espera, historico, busca-global, filtros, realtime]
sources: [src/components/helpdesk/, src/pages/dashboard/HelpDesk.tsx, src/hooks/useGlobalSearch.ts]
updated: 2026-04-27
---

# Helpdesk — Layout, Realtime e UX (7 Sub-Funcionalidades)

> Parte do **Helpdesk (M2)** — sub-página dedicada à **experiência de uso**: layout responsivo em 3 paineis, indicadores de tempo real (typing, espera), navegação no histórico, busca global Ctrl+K, filtros e ordenação, conexão Realtime + notificação sonora. Para o índice geral e outras áreas, ver [[wiki/casos-de-uso/helpdesk-detalhado]].

---

## 1.1 Layout em 3 Paineis

A tela do Helpdesk e dividida em 3 areas lado a lado, como um e-mail profissional (tipo Gmail):

- **Painel Esquerdo** — Lista de todas as conversas (como lista de e-mails). Cada conversa mostra nome do contato, ultima mensagem, data, badges de etiquetas, nome do atendente e indicador de nao lida.
- **Painel Central** — O chat aberto, onde as mensagens aparecem (como ler um e-mail). Tem cabecalho com nome, telefone, status, botao da IA, notas e botao de finalizar.
- **Painel Direito** — Informacoes do contato: etiquetas, status, prioridade, agente responsavel, departamento, resumo IA, historico de conversas, perfil do lead.

Os paineis laterais podem ser abertos/fechados com botoes (icones de seta). Em celular, funciona como telas separadas — toca na conversa e abre o chat; toca no nome e abre o perfil.

> **Tecnico:** Pagina principal `src/pages/dashboard/HelpDesk.tsx`. Componentes: `ConversationList.tsx` (esquerda), `ChatPanel.tsx` (centro), `ContactInfoPanel.tsx` (direita). Layout responsivo via Tailwind CSS flexbox. Mobile: nav stack com `onBack` callbacks. Desktop: 3 colunas com toggles `PanelLeftOpen/Close` e `PanelRightOpen/Close`.

---

## 1.15 Indicador de Digitacao (Typing Indicator)

**O que e:** Quando um atendente esta digitando numa conversa, os outros membros da equipe veem a mensagem **"Carlos esta digitando..."** com uma animacao pulsante. Assim ninguem responde ao mesmo tempo.

> **Tecnico:** Broadcast: `supabase.channel('helpdesk-realtime').send({ event: 'agent-typing', payload: { conversation_id, agent_id, agent_name } })`. Listener em ChatPanel: filtra `agent_id !== currentUserId` (self-exclusion). Timeout: `setTimeout(() => setTypingAgent(null), 4000)` (limpa apos 4s). Throttle: `broadcastTyping()` minimo 3s entre envios. UI: texto pulsante `animate-pulse` com nome do agente.

---

## 1.16 Indicador de Tempo de Espera

**O que e:** Na lista de conversas, ao lado da data, aparece ha quanto tempo o lead esta **esperando resposta**. Mostra "5m" (5 minutos), "2h30m" (2 horas e meia), "3d" (3 dias).

**Urgencia visual:** O indicador vai ficando mais visivel conforme o tempo passa:
- Menos de 15 minutos → bem discreto
- Entre 15 minutos e 1 hora → visibilidade media
- Mais de 1 hora → bem visivel

So aparece em conversas que nao foram resolvidas.

> **Tecnico:** Calculado em `ConversationItem.tsx` `getWaitInfo()`. Base: `Date.now() - new Date(conversation.last_message_at).getTime()`. Formato: `<60min` → Xm, `<1440min` → XhYm, `>=1440min` → Xd. Opacidade via classes: `opacity-50` (<15min), `opacity-70` (15-60min), `opacity-90` (>60min). Icone `Clock` w-2.5. Oculto quando `conversation.status === 'resolvida'` ou `!conversation.last_message_at`.

---

## 1.19 Historico de Conversas Passadas

**O que e:** No painel de informacoes (direita), lista de **todas as conversas anteriores** do mesmo cliente.

- Mostra ate **20 conversas** inicialmente. Botao "Carregar todas" expande para ate 200.
- Cada conversa: status, data, ultima mensagem
- Pode gerar resumo IA de cada conversa passada

> **Tecnico:** Query: `supabase.from('conversations').select('id, status, last_message_at, created_at, ai_summary, last_message').eq('contact_id', X).neq('id', currentId).order('last_message_at', { ascending: false }).limit(historyLimit)`. Count total via `.select('id', { count: 'exact', head: true })`. Load all: `setHistoryLimit(200)`. Resumo por conversa: `handleGenerateHistorySummary(convId)` → edgeFunctionFetch. Expansivel via `expandedSummaries: Set<string>`.

---

## 1.21 Busca Global (Ctrl+K)

**O que e:** Campo de busca que pesquisa em **todas as conversas de todas as caixas de entrada** ao mesmo tempo.

- Atalho: **Ctrl+K**
- Busca por: nome, telefone, conteudo de mensagens
- Resultados agrupados por inbox
- Minimo 3 caracteres, espera 500ms apos parar de digitar

> **Tecnico:** Componente `GlobalSearchDialog.tsx`. Hook `useGlobalSearch`. Match types: contact_name, phone, message. Full-text search no campo `content` com `ilike` + debounce 500ms. Resultados: `Record<inbox_id, Conversation[]>`. UI: Dialog + Command (cmdk pattern). Trigger: Ctrl+K global keydown listener.

---

## 1.22 Filtros e Ordenacao da Lista

**Filtros (combinaveis):**
- Atribuicao: Todas | Minhas | Nao atribuidas
- Prioridade: Todas | Alta | Media | Baixa
- Etiqueta: qualquer etiqueta criada
- Departamento: qualquer departamento
- Status: Aberta | Pendente | Resolvida | Todas

**Ordenacao:** Mais recentes | Nao lidas | Por prioridade

> **Tecnico:** Hook `useHelpdeskFilters.ts`. Filtros aplicados como query params no Supabase select. Assignment filter: `.eq('assigned_to', userId)` ou `.is('assigned_to', null)`. Priority/status: `.eq()`. Labels: join via `conversation_labels`. Sort: `.order('last_message_at')` ou `.order('priority')` ou `is_read` first. Componente ConversationList renderiza filter pills no topo.

---

## 1.23 Notificacao Sonora + Conexao em Tempo Real

**Notificacao sonora:** Som de alerta discreto quando mensagem chega e navegador esta em outra aba.

**Indicador de conexao:** Bolinha verde (conectado), amarelo pulsante (conectando), vermelho + icone Wi-Fi cortado (desconectado).

**Reconexao automatica:** 5 segundos apos desconexao.

> **Tecnico:** Som: `new Audio('data:audio/wav;base64,...')` com `volume = 0.3`, disparado quando `incomingCount > prevMsgCountRef.current && !document.hasFocus()`. Realtime: canal `helpdesk-realtime` com subscribe status callback: `SUBSCRIBED` → 'connected', `CLOSED` → 'disconnected'. Reconnect: `useEffect` com `setTimeout(fetchMessages, 5000)` quando `channelStatus === 'disconnected'`. Eventos: `new-message`, `transcription-updated`, `agent-typing`. UI: span com classes condicionais `bg-primary/bg-destructive/bg-warning` + `animate-pulse`.

---

## Sub-páginas relacionadas

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-organizacao]] — Etiquetas, Tags, Notas, Status, Prioridade, Atribuição, Departamentos, Bulk
- [[wiki/casos-de-uso/helpdesk-ia]] — Toggle IA, Transcrição, Resumo, Finalização, Contexto do Lead
- [[wiki/casos-de-uso/helpdesk-comunicacao]] — Templates `/`, Mídia, Rascunhos, Emoji, Reply
- [[wiki/casos-de-uso/helpdesk-permissoes]] — Permissões Granulares + Árvore de Componentes
