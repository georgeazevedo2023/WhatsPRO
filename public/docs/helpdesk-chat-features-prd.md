# PRD — Helpdesk: Funcionalidades do Chat

**Módulo:** Helpdesk — Chat Input, Notas Privadas, Notificações e Gravação de Áudio
**Versão:** 1.0
**Data:** 2026-03-06
**Rota:** \`/dashboard/helpdesk\`

---

## 1. Visão Geral

Este documento detalha as funcionalidades de interação do chat do Helpdesk: envio de emojis, gerenciamento de status, envio de imagens e documentos, notas privadas com painel de notificação, e gravação/envio de áudio. Cada funcionalidade é descrita com seus endpoints, payloads JSON, componentes de UI e fluxos operacionais.

---

## 2. Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| **ChatInput** | \`src/components/helpdesk/ChatInput.tsx\` | Compositor principal: texto, emojis, notas, mídia, áudio, status, etiquetas |
| **ChatPanel** | \`src/components/helpdesk/ChatPanel.tsx\` | Container do chat: header, mensagens, input, painel de notas |
| **NotesPanel** | \`src/components/helpdesk/NotesPanel.tsx\` | Sheet lateral com listagem e exclusão de notas privadas |
| **EmojiPicker** | \`src/components/ui/emoji-picker.tsx\` | Seletor de emojis com categorias e busca |
| **MessageBubble** | \`src/components/helpdesk/MessageBubble.tsx\` | Renderização de cada mensagem (texto, mídia, notas) |
| **AudioPlayer** | \`src/components/helpdesk/AudioPlayer.tsx\` | Player de áudio customizado com controle de velocidade |

---

## 3. Menu de Ações (+)

O botão **+** (Plus) no ChatInput abre um **Popover** com as seguintes opções:

- **Nota privada** — ativa/desativa modo de nota
- **Enviar imagem** — abre seletor de arquivo (imagens)
- **Enviar documento** — abre seletor de arquivo (documentos)
- **Etiquetas** — submenu com labels da inbox
- **Status** — submenu com opções de status da conversa
- **Enviar Emojis** — abre EmojiPicker em popover aninhado

---

## 4. Enviar Emojis

### 4.1 Componente

**EmojiPickerContent** renderizado dentro de um Popover aninhado no menu +.

### 4.2 Categorias Disponíveis

- Smileys & Pessoas
- Gestos
- Corações
- Objetos
- Natureza
- Comida

### 4.3 Fluxo

1. Usuário clica em **"Enviar Emojis"** no menu +
2. Popover lateral abre com grid de emojis organizados por categoria
3. Ao clicar em um emoji, ele é **inserido no final do texto** do textarea
4. O emoji é enviado como parte da mensagem de texto normal

### 4.4 Implementação

\`\`\`typescript
// Inserção do emoji no texto
<EmojiPickerContent 
  onEmojiSelect={(emoji) => setText(prev => prev + emoji)} 
/>
\`\`\`

### 4.5 Endpoint de Envio

Os emojis são enviados como texto normal via \`uazapi-proxy\`:

\`\`\`json
{
  "action": "send-chat",
  "instance_id": "uuid-da-instancia",
  "jid": "5511999999999@s.whatsapp.net",
  "message": "Olá! 😊👍"
}
\`\`\`

---

## 5. Gerenciamento de Status

### 5.1 Opções de Status

| Status | Label | Cor |
|---|---|---|
| \`aberta\` | Aberta | bg-emerald-500 |
| \`pendente\` | Pendente | bg-yellow-500 |
| \`resolvida\` | Resolvida | bg-muted-foreground/50 |

### 5.2 Locais de Alteração

1. **Header do ChatPanel** — Select dropdown com dot colorido
2. **Menu + do ChatInput** — Submenu "Status" com opções e check no ativo

### 5.3 Endpoint

\`\`\`typescript
// Atualização direta no Supabase
await supabase
  .from('conversations')
  .update({ status: 'resolvida' })
  .eq('id', conversationId);
\`\`\`

### 5.4 Payload no Banco

\`\`\`json
{
  "table": "conversations",
  "operation": "UPDATE",
  "fields": {
    "status": "aberta | pendente | resolvida"
  },
  "filter": {
    "id": "uuid-da-conversa"
  }
}
\`\`\`

### 5.5 Feedback

- Toast \`"Status atualizado"\` em caso de sucesso
- Toast de erro em caso de falha
- Menu fecha automaticamente após seleção

---

## 6. Enviar Imagem

### 6.1 Fluxo Completo

1. Usuário clica **"Enviar imagem"** no menu +
2. Input file abre com \`accept=".jpg,.jpeg,.png,.gif,.webp"\`
3. Validação: máximo **20MB**
4. Upload para Supabase Storage bucket \`helpdesk-media\`
5. Conversão para base64 (data URI)
6. Envio via \`uazapi-proxy\` action \`send-media\`
7. Persistência em \`conversation_messages\`
8. Broadcast realtime para outros agentes
9. Webhook de saída disparado

### 6.2 Upload para Storage

\`\`\`typescript
const fileName = \`\${conversationId}/\${Date.now()}.\${ext}\`;
await supabase.storage
  .from('helpdesk-media')
  .upload(fileName, file, { contentType: file.type });
\`\`\`

### 6.3 Endpoint — uazapi-proxy (send-media)

**URL:** \`POST /functions/v1/uazapi-proxy\`

**Headers:**
\`\`\`json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
\`\`\`

**Body:**
\`\`\`json
{
  "action": "send-media",
  "instance_id": "uuid-da-instancia",
  "jid": "5511999999999@s.whatsapp.net",
  "mediaUrl": "data:image/jpeg;base64,/9j/4AAQ...",
  "mediaType": "image",
  "caption": ""
}
\`\`\`

### 6.4 Persistência no Banco

\`\`\`json
{
  "table": "conversation_messages",
  "operation": "INSERT",
  "fields": {
    "conversation_id": "uuid",
    "direction": "outgoing",
    "content": null,
    "media_type": "image",
    "media_url": "https://...supabase.co/storage/v1/object/public/helpdesk-media/conv-id/timestamp.jpg",
    "sender_id": "uuid-do-agente"
  }
}
\`\`\`

### 6.5 Atualização da Conversa

\`\`\`json
{
  "last_message_at": "2026-03-06T12:00:00Z",
  "last_message": "📷 Foto",
  "status_ia": "desligada"
}
\`\`\`

### 6.6 Broadcast Realtime

Canal: \`helpdesk-realtime\`, Evento: \`new-message\`

\`\`\`json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "direction": "outgoing",
  "media_type": "image",
  "content": null,
  "media_url": "https://...public-url",
  "created_at": "2026-03-06T12:00:00Z",
  "status_ia": "desligada"
}
\`\`\`

---

## 7. Enviar Documento

### 7.1 Fluxo

Idêntico ao envio de imagem, com diferenças:

- **Accept:** \`.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar\`
- **mediaType:** \`"document"\`
- **filename** enviado no payload (nome original do arquivo)
- **content** salvo com o nome do arquivo
- **last_message:** \`"📎 Documento"\`

### 7.2 Endpoint — uazapi-proxy (send-media para documento)

\`\`\`json
{
  "action": "send-media",
  "instance_id": "uuid-da-instancia",
  "jid": "5511999999999@s.whatsapp.net",
  "mediaUrl": "data:application/pdf;base64,JVBERi0...",
  "mediaType": "document",
  "filename": "relatorio-mensal.pdf",
  "caption": ""
}
\`\`\`

### 7.3 Persistência

\`\`\`json
{
  "conversation_id": "uuid",
  "direction": "outgoing",
  "content": "relatorio-mensal.pdf",
  "media_type": "document",
  "media_url": "https://...supabase.co/storage/v1/object/public/helpdesk-media/conv-id/timestamp.pdf",
  "sender_id": "uuid-do-agente"
}
\`\`\`

---

## 8. Nota Privada

### 8.1 Conceito

Notas privadas são mensagens internas visíveis apenas para os agentes. O cliente **não recebe** a nota — ela não é enviada via WhatsApp.

### 8.2 Ativação

1. Clicar no menu **+** > **"Nota privada"**
2. Banner amarelo aparece: *"📝 Escrevendo nota privada — o cliente não verá esta mensagem"*
3. Placeholder muda para *"Escrever nota privada..."*
4. Ao enviar, a nota é salva apenas no banco

### 8.3 Restrições no Modo Nota

- **Enviar imagem:** desabilitado
- **Enviar documento:** desabilitado
- **Gravar áudio:** desabilitado
- Apenas **texto** é permitido em notas

### 8.4 Persistência

\`\`\`json
{
  "table": "conversation_messages",
  "operation": "INSERT",
  "fields": {
    "conversation_id": "uuid",
    "direction": "private_note",
    "content": "Texto da nota privada",
    "media_type": "text",
    "sender_id": "uuid-do-agente"
  }
}
\`\`\`

### 8.5 Diferenças do Envio Normal

| Aspecto | Mensagem Normal | Nota Privada |
|---|---|---|
| direction | \`outgoing\` | \`private_note\` |
| Envia via WhatsApp | ✅ Sim | ❌ Não |
| Auto-assign agente | ✅ Sim | ❌ Não |
| Webhook de saída | ✅ Sim | ❌ Não |
| Broadcast realtime | ✅ Sim | ❌ Não (apenas refetch) |
| Visível para cliente | ✅ Sim | ❌ Não |

---

## 9. Notificação de Notas no Header

### 9.1 Badge de Contagem

No **header do ChatPanel**, quando existem notas privadas, aparece um botão com:

- Ícone **StickyNote** (amarelo/warning)
- Badge numérico com contagem de notas (ex: "3")
- Posicionado no canto superior direito do ícone

### 9.2 Implementação do Badge

\`\`\`typescript
{notes.length > 0 && (
  <Button variant="ghost" size="icon" onClick={() => setNotesOpen(true)}>
    <StickyNote className="w-4 h-4 text-warning" />
    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] 
      bg-primary text-primary-foreground text-[9px] font-bold rounded-full 
      flex items-center justify-center">
      {notes.length}
    </span>
  </Button>
)}
\`\`\`

### 9.3 Filtragem de Notas

\`\`\`typescript
// No ChatPanel, as notas são separadas das mensagens do chat
const notes = messages.filter(m => m.direction === 'private_note');
const chatMessages = messages.filter(m => m.direction !== 'private_note');
\`\`\`

> **Importante:** Notas privadas **NÃO aparecem** no fluxo de mensagens do chat. Elas são visíveis apenas no painel lateral de notas.

---

## 10. Painel de Notas Privadas (NotesPanel)

### 10.1 Componente

**Sheet** lateral (side="right") com largura de 320-384px.

### 10.2 Estrutura Visual

- **Header:** Ícone StickyNote + título "Notas Privadas" + contagem (ex: "3 notas")
- **Lista:** Cards com conteúdo, nome do agente (em cor primary), data/hora formatada
- **Estado vazio:** Ícone + "Nenhuma nota ainda"

### 10.3 Props

\`\`\`typescript
interface NotesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Message[];
  onNoteDeleted: (noteId: string) => void;
  agentNamesMap?: Record<string, string>;
}
\`\`\`

### 10.4 Card de Nota

Cada nota exibe:
- **Conteúdo** da nota (whitespace-pre-wrap)
- **Nome do agente** que criou (via agentNamesMap[sender_id])
- **Data/hora:** formatada como "dd/MM/yyyy 'às' HH:mm"
- **Botão excluir:** ícone lixeira, visível apenas no hover (group-hover)

### 10.5 Exclusão de Nota

\`\`\`typescript
// Endpoint de exclusão
await supabase
  .from('conversation_messages')
  .delete()
  .eq('id', noteId);
\`\`\`

**Payload:**
\`\`\`json
{
  "table": "conversation_messages",
  "operation": "DELETE",
  "filter": {
    "id": "uuid-da-nota"
  }
}
\`\`\`

### 10.6 Feedback

- Loading spinner no botão durante exclusão
- Toast \`"Nota excluída"\` em sucesso
- Toast \`"Erro ao excluir nota"\` em falha
- Callback \`onNoteDeleted\` remove a nota do state local imediatamente

---

## 11. Gravação e Envio de Áudio

### 11.1 Fluxo Completo

1. Usuário clica no ícone **microfone** (🎤) no ChatInput
2. Permissão do microfone é solicitada via \`navigator.mediaDevices.getUserMedia\`
3. UI muda para modo gravação: indicador pulsante vermelho + cronômetro + botões cancelar/enviar
4. Ao clicar **enviar**: blob é processado e enviado
5. Ao clicar **cancelar**: gravação é descartada

### 11.2 Formato de Áudio

Prioridade de codecs:
1. \`audio/ogg;codecs=opus\` (preferido — compatível com WhatsApp)
2. \`audio/webm;codecs=opus\` (fallback)
3. \`audio/webm\` (último recurso)

### 11.3 UI de Gravação

\`\`\`
[X Cancelar] [● 00:15 Gravando...] [➤ Enviar]
\`\`\`

- **Indicador pulsante:** ping animation vermelho (bg-destructive)
- **Cronômetro:** formato MM:SS, atualizado a cada segundo
- **Cancelar:** para gravação, descarta chunks, limpa stream
- **Enviar:** para gravação, processa blob, faz upload

### 11.4 Pipeline de Envio

\`\`\`
MediaRecorder → Blob (OGG/Opus)
  ↓
Upload → Supabase Storage (bucket: audio-messages)
  ↓
Blob → Base64 (data URI)
  ↓
POST → uazapi-proxy (action: send-audio)
  ↓
INSERT → conversation_messages (media_type: audio)
  ↓
Broadcast → helpdesk-realtime (new-message)
  ↓
Webhook → fire-outgoing-webhook
\`\`\`

### 11.5 Upload para Storage

\`\`\`typescript
const fileName = \`\${conversationId}/\${Date.now()}.ogg\`;
await supabase.storage
  .from('audio-messages')
  .upload(fileName, blob, { contentType: blob.type });
\`\`\`

### 11.6 Endpoint — uazapi-proxy (send-audio)

**URL:** \`POST /functions/v1/uazapi-proxy\`

**Body:**
\`\`\`json
{
  "action": "send-audio",
  "instance_id": "uuid-da-instancia",
  "jid": "5511999999999@s.whatsapp.net",
  "audio": "data:audio/ogg;codecs=opus;base64,T2dnUwAC..."
}
\`\`\`

### 11.7 Persistência

\`\`\`json
{
  "table": "conversation_messages",
  "operation": "INSERT",
  "fields": {
    "conversation_id": "uuid",
    "direction": "outgoing",
    "content": null,
    "media_type": "audio",
    "media_url": "https://...supabase.co/storage/v1/object/public/audio-messages/conv-id/timestamp.ogg",
    "sender_id": "uuid-do-agente"
  }
}
\`\`\`

### 11.8 Atualização da Conversa

\`\`\`json
{
  "last_message_at": "2026-03-06T12:00:00Z",
  "last_message": "🎵 Áudio",
  "status_ia": "desligada"
}
\`\`\`

### 11.9 Player de Áudio (AudioPlayer)

O componente \`AudioPlayer\` é utilizado para reproduzir áudios recebidos e enviados:

**Props:**
\`\`\`typescript
interface AudioPlayerProps {
  src: string;       // URL do áudio (signed URL ou public)
  direction: string; // 'incoming' | 'outgoing'
}
\`\`\`

**Funcionalidades:**
- Botão play/pause
- Barra de progresso com seek
- Timer no formato \`m:ss\`
- Controle de velocidade: **1x → 1.5x → 2x** (ciclo)
- Estilização diferenciada para incoming vs outgoing

**Implementação:**
\`\`\`typescript
const SPEEDS = [1, 1.5, 2];

const cycleSpeed = () => {
  const nextIndex = (SPEEDS.indexOf(playbackRate) + 1) % SPEEDS.length;
  const newSpeed = SPEEDS[nextIndex];
  setPlaybackRate(newSpeed);
  if (audioRef.current) audioRef.current.playbackRate = newSpeed;
};
\`\`\`

---

## 12. Webhook de Saída (fire-outgoing-webhook)

Toda mensagem enviada (exceto notas privadas) dispara um webhook de saída.

### 12.1 Endpoint

**URL:** \`POST /functions/v1/fire-outgoing-webhook\`

### 12.2 Payload Completo

\`\`\`json
{
  "webhook_url": "https://n8n.exemplo.com/webhook/helpdesk",
  "payload": {
    "timestamp": "2026-03-06T12:00:00-03:00",
    "instance_name": "WS Principal",
    "instance_id": "uuid",
    "inbox_name": "Suporte Geral",
    "inbox_id": "uuid",
    "contact_name": "João Silva",
    "remotejid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "agent_name": "Maria Atendente",
    "agent_id": "uuid-do-agente",
    "pausar_agente": "sim",
    "status_ia": "desligada",
    "message_type": "text | image | document | audio",
    "message": "Conteúdo textual ou null",
    "media_url": "URL da mídia ou null"
  }
}
\`\`\`

### 12.3 Mapeamento por Tipo

| Tipo | message_type | message | media_url |
|---|---|---|---|
| Texto | \`text\` | conteúdo | null |
| Imagem | \`image\` | null | URL pública |
| Documento | \`document\` | nome do arquivo | URL pública |
| Áudio | \`audio\` | null | URL pública |

---

## 13. Auto-Assign de Agente

Ao enviar qualquer mensagem (exceto nota privada), o sistema auto-atribui o agente logado à conversa.

### 13.1 Fluxo

1. Verifica se \`conversation.assigned_to !== user.id\`
2. Atualiza \`conversations.assigned_to\` no banco
3. Dispara callback local \`onAgentAssigned\` para UI imediata
4. Broadcast no canal \`helpdesk-conversations\` evento \`assigned-agent\`

### 13.2 Broadcast

\`\`\`json
{
  "type": "broadcast",
  "event": "assigned-agent",
  "payload": {
    "conversation_id": "uuid",
    "assigned_to": "uuid-do-agente"
  }
}
\`\`\`

---

## 14. Broadcast Realtime

Todas as mensagens enviadas (exceto notas) disparam dois broadcasts:

### 14.1 Canal: helpdesk-realtime

Atualiza o ChatPanel do agente que está com a conversa aberta.

\`\`\`json
{
  "event": "new-message",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "uuid",
    "direction": "outgoing",
    "media_type": "text | image | document | audio",
    "content": "texto ou null",
    "media_url": "url ou null",
    "created_at": "ISO timestamp",
    "status_ia": "desligada"
  }
}
\`\`\`

### 14.2 Canal: helpdesk-conversations

Atualiza a lista de conversas (ConversationList) para todos os agentes.

\`\`\`json
{
  "event": "new-message",
  "payload": {
    "conversation_id": "uuid",
    "inbox_id": "uuid",
    "content": "texto ou null",
    "media_type": "text | image | document | audio",
    "created_at": "ISO timestamp"
  }
}
\`\`\`

---

## 15. Etiquetas (Labels) via Menu +

### 15.1 Fluxo

1. Menu + > Etiquetas (disponível se inbox tem labels)
2. Submenu expande com checkboxes das labels da inbox
3. Toggle: adiciona ou remove \`conversation_labels\`

### 15.2 Adicionar Label

\`\`\`json
{
  "table": "conversation_labels",
  "operation": "INSERT",
  "fields": {
    "conversation_id": "uuid",
    "label_id": "uuid-da-label"
  }
}
\`\`\`

### 15.3 Remover Label

\`\`\`json
{
  "table": "conversation_labels",
  "operation": "DELETE",
  "filter": {
    "conversation_id": "uuid",
    "label_id": "uuid-da-label"
  }
}
\`\`\`

---

## 16. Buckets de Storage

| Bucket | Tipo | Uso |
|---|---|---|
| \`helpdesk-media\` | Privado | Imagens e documentos enviados/recebidos |
| \`audio-messages\` | Privado | Áudios gravados e recebidos |
| \`carousel-images\` | Público | Imagens de carrossel (broadcast) |

> **Acesso:** Arquivos em buckets privados são acessados via **signed URLs** temporárias usando o hook \`useSignedUrl\`.

---

## 17. Regras de Negócio

1. **Enter para enviar:** Enter envia; Shift+Enter quebra linha
2. **Nota privada:** Desabilita imagem, documento e áudio
3. **Auto-assign:** Primeira mensagem do agente atribui ele à conversa
4. **status_ia:** Toda mensagem enviada seta \`status_ia: 'desligada'\`
5. **Webhook:** Disparado para toda mensagem exceto notas privadas
6. **Limite de arquivo:** 20MB para imagens e documentos
7. **Codec de áudio:** Prioriza OGG/Opus para compatibilidade com WhatsApp
8. **Notas no chat:** Notas privadas são filtradas e NÃO aparecem no fluxo de mensagens
9. **Badge de notas:** Só aparece quando \`notes.length > 0\`
10. **Exclusão de nota:** Remove do banco e do state local simultaneamente