---
title: Helpdesk — Comunicação e Mídia
tags: [helpdesk, templates, midia, rascunhos, emoji, reply]
sources: [src/components/helpdesk/, src/components/ui/emoji-picker.tsx]
updated: 2026-04-27
---

# Helpdesk — Comunicação e Mídia (5 Sub-Funcionalidades)

> Parte do **Helpdesk (M2)** — sub-página dedicada às ferramentas de **escrita e envio de mensagens**: templates por barra, tipos de mídia suportados, rascunhos automáticos, emoji e reply (citação). Para o índice geral e outras áreas, ver [[wiki/casos-de-uso/helpdesk-detalhado]].

---

## 1.11 Respostas Rapidas (Templates com "/")

**O que e:** Ao digitar a barra "/" na caixa de mensagem, aparece um menu suspenso com **respostas prontas** cadastradas. Funciona como atalhos para textos que o atendente usa o tempo todo.

**Como funciona:**
- Atendente digita **"/"** → menu aparece com ate 8 opcoes
- Continua digitando para filtrar: "/prop" mostra so templates que contem "prop"
- Navega com **setas do teclado**, **Enter** para selecionar, **Esc** para fechar
- O texto e inserido na caixa de mensagem — o atendente pode **editar antes de enviar**

**Cenarios:**
1. `/boas-vindas` → "Ola! Bem-vindo a nossa loja. Como posso ajudar?"
2. `/proposta` → "Segue nossa proposta comercial. O valor total e R$ [VALOR]."
3. `/horario` → "Nosso horario e de segunda a sexta, das 8h as 18h."
4. `/pix` → "Para pagamento via PIX, use a chave: empresa@email.com"

> **Tecnico:** Implementado em `ChatInput.tsx`. Fonte: `supabase.from('message_templates').select('*')`. Trigger: detecta `"/"` no onChange. Filtra por `name` e `content` case-insensitive. Max 8 resultados. Keyboard: ArrowUp/Down para navegar, Enter para selecionar (auto-selects primeiro), Esc para fechar. Template text-only (sem midia). Dropdown posicionado acima do input.

---

## 1.12 Tipos de Midia no Chat

**O que e:** Alem de texto, o chat exibe e permite enviar diversos tipos de conteudo — tudo que o WhatsApp suporta.

| Tipo | O que o atendente ve |
|------|----------------------|
| **Texto** | Mensagem normal, como no WhatsApp |
| **Imagem** | Foto que pode ser clicada para abrir em tamanho grande |
| **Audio** | Player de audio com botao play/pause e controle de velocidade (1x, 1.5x, 2x) |
| **Video** | Player de video com controles (play, pause, barra de progresso) |
| **Documento** | Icone do tipo de arquivo + nome + extensao + botao para baixar |
| **Sticker** | Figurinha do WhatsApp com fundo transparente |
| **Carrossel** | Cards deslizaveis com foto + texto + botoes |
| **Enquete** | Pergunta + opcoes clicaveis (tipo votacao) |
| **Contato (vCard)** | Cartao com nome, telefone, e-mail e botoes de acao |
| **Localizacao** | Dados de geolocalizacao |

**Para enviar arquivos:** O atendente pode usar o botao de anexar (icone de clip) ou simplesmente **arrastar e soltar** um arquivo sobre o chat — aparece a mensagem "Solte o arquivo aqui" com destaque visual.

> **Tecnico:** Renderizacao em `MessageBubble.tsx` com switch em `media_type`. Audio: `AudioPlayer.tsx` com HTMLAudioElement + playbackRate control (1/1.5/2). Carrossel: JSON.parse do content, cards com botoes tipo URL/CALL/REPLY. Enquete: `media_type='poll'` com BarChart3 icon + options cards. vCard: parse com regex de campos (N, TEL, EMAIL, ORG). Imagem: lazy loading + click → lightbox/window.open. Documento: signed URL resolution para Supabase Storage. Drag & drop: `onDragOver/onDragLeave/onDrop` no scroll container, dispatch `helpdesk-file-drop` CustomEvent. Upload via `useSendFile` hook.

---

## 1.17 Rascunhos (Drafts)

**O que e:** Se o atendente comeca a digitar uma resposta e troca de conversa **sem enviar**, o texto nao se perde — e salvo automaticamente na memoria do navegador.

**Como funciona:**
- Salva automaticamente a cada 300 milissegundos de digitacao
- Na lista de conversas, aparece um **badge "Rascunho"** na conversa que tem texto nao enviado
- Ao voltar para a conversa, o texto reaparece na caixa de mensagem

> **Tecnico:** Storage: `localStorage.getItem/setItem('helpdesk-draft-${conversationId}')`. Save debounce: 300ms no onChange do ChatInput. Badge "Rascunho" no ConversationItem: `const hasDraft = !!localStorage.getItem(...)`. Limpa apos enviar. Persistente entre sessoes (localStorage sobrevive reload).

---

## 1.24 Emoji

**O que e:** Botao com icone de carinha sorridente na caixa de mensagem. Abre seletor completo de emojis.

> **Tecnico:** Componente `src/components/ui/emoji-picker.tsx`. Integracao no ChatInput via Popover trigger (icone Smile). Insere emoji na posicao do cursor no textarea.

---

## 1.25 Responder Mensagem (Reply)

**O que e:** Botao de "responder" em cada mensagem. Cria citacao da mensagem original no campo de digitacao.

> **Tecnico:** Estado `replyTo: Message | null` no ChatPanel. Botao reply no MessageBubble (hover action). ChatInput exibe quote da mensagem referenciada. Limpa com `handleClearReply`. Mensagem enviada com referencia ao message_id original.

---

## Sub-páginas relacionadas

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-organizacao]] — Etiquetas, Tags, Notas, Status, Prioridade, Atribuição, Departamentos, Bulk
- [[wiki/casos-de-uso/helpdesk-ia]] — Toggle IA, Transcrição, Resumo, Finalização, Contexto do Lead
- [[wiki/casos-de-uso/helpdesk-ux]] — Layout, Typing, Tempo de Espera, Histórico, Busca Global, Filtros, Realtime
- [[wiki/casos-de-uso/helpdesk-permissoes]] — Permissões Granulares + Árvore de Componentes
