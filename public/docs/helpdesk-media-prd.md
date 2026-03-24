# PRD — Helpdesk: Recebimento e Renderização de Mídia

**Módulo:** Helpdesk / Atendimento  
**Versão:** 1.0  
**Última atualização:** 2026-03-06  

---

## 1. Visão Geral

Este documento detalha como o Helpdesk do WsmartQR **recebe, processa, armazena e renderiza** mensagens de diferentes tipos de mídia (texto, imagem, áudio, vídeo, documento, figurinha, contato e carrossel) vindas do WhatsApp via UAZAPI.

### Pipeline Resumido

\`\`\`
WhatsApp → UAZAPI → whatsapp-webhook (Edge Function)
    ↓
  Normaliza payload → Obtém link persistente (UAZAPI /message/download)
    ↓
  Upload para Storage (helpdesk-media) → Salva URL no banco
    ↓
  Broadcast Realtime → Frontend renderiza com player específico
\`\`\`

---

## 2. Payload do Webhook (Entrada)

### 2.1 Formato do Payload UAZAPI

A Edge Function \`whatsapp-webhook\` recebe payloads via POST. O payload pode vir em diferentes formatos (direto, array, encapsulado por n8n):

\`\`\`json
{
  "EventType": "messages",
  "instanceName": "minha-instancia",
  "owner": "5511999999999",
  "message": {
    "messageid": "3EB0A1B2C3D4E5F6",
    "chatid": "5511888888888@s.whatsapp.net",
    "sender": "5511888888888@s.whatsapp.net",
    "fromMe": false,
    "isGroup": false,
    "messageTimestamp": 1709500000000,
    "text": "Olá!",
    "caption": "",
    "mediaType": "text",
    "type": "text",
    "fileURL": "",
    "mediaUrl": "",
    "fileName": "",
    "senderName": "João",
    "content": "Olá!"
  },
  "chat": {
    "wa_contactName": "João Silva",
    "name": "João Silva"
  }
}
\`\`\`

### 2.2 Unwrapping do Payload

O webhook aplica unwrapping para compatibilidade com n8n:

1. Se \`payload\` é array → usa \`payload[0]\`
2. Se possui \`body\` ou \`Body\` → extrai inner
3. Verifica \`EventType\` ou \`eventType\` no nível correto

\`\`\`typescript
let unwrapped = rawPayload;
if (Array.isArray(unwrapped)) unwrapped = unwrapped[0];
const inner = unwrapped?.body || unwrapped?.Body;
let payload = (inner?.EventType || inner?.eventType) ? inner : unwrapped;
\`\`\`

### 2.3 Payloads por Tipo de Mídia

#### Texto
\`\`\`json
{
  "message": {
    "mediaType": "text",
    "text": "Conteúdo da mensagem",
    "content": "Conteúdo da mensagem"
  }
}
\`\`\`

#### Imagem
\`\`\`json
{
  "message": {
    "mediaType": "image",
    "caption": "Legenda da foto",
    "fileURL": "https://wsmart.uazapi.com/files/temp/abc123.jpg",
    "fileName": "foto.jpg"
  }
}
\`\`\`

#### Áudio / PTT (Push-to-Talk)
\`\`\`json
{
  "message": {
    "mediaType": "audio",
    "type": "ptt",
    "fileURL": "https://wsmart.uazapi.com/files/temp/xyz789.ogg",
    "text": ""
  }
}
\`\`\`

#### Vídeo
\`\`\`json
{
  "message": {
    "mediaType": "video",
    "caption": "Veja este vídeo",
    "fileURL": "https://wsmart.uazapi.com/files/temp/video123.mp4"
  }
}
\`\`\`

#### Documento
\`\`\`json
{
  "message": {
    "mediaType": "document",
    "fileName": "contrato.pdf",
    "fileURL": "https://wsmart.uazapi.com/files/temp/doc456.pdf",
    "content": { "URL": "https://..." }
  }
}
\`\`\`

#### Figurinha (Sticker)
\`\`\`json
{
  "message": {
    "mediaType": "sticker",
    "fileURL": "https://wsmart.uazapi.com/files/temp/sticker.webp"
  }
}
\`\`\`

#### Contato (vCard)
\`\`\`json
{
  "message": {
    "mediaType": "contact",
    "content": {
      "displayName": "Maria Santos",
      "vcard": "BEGIN:VCARD\\nVERSION:3.0\\nFN:Maria Santos\\nTEL;waid=5511777777777:+55 11 77777-7777\\nEND:VCARD"
    }
  }
}
\`\`\`

---

## 3. Normalização de Tipo de Mídia

A função \`normalizeMediaType\` converte strings variadas do UAZAPI para tipos padronizados:

\`\`\`typescript
function normalizeMediaType(raw: string): string {
  if (!raw || raw === '') return 'text';
  const lower = raw.toLowerCase();
  if (lower.includes('image'))    return 'image';
  if (lower.includes('video'))    return 'video';
  if (lower.includes('audio') || lower.includes('ptt')) return 'audio';
  if (lower.includes('document') || lower.includes('pdf')) return 'document';
  if (lower.includes('sticker'))  return 'sticker';
  if (lower.includes('contact'))  return 'contact';
  return 'text';
}
\`\`\`

### Tipos Suportados

| Tipo DB        | Origem UAZAPI                     | Descrição                  |
|----------------|-----------------------------------|----------------------------|
| \`text\`        | \`text\`, vazio, não reconhecido    | Mensagem de texto simples  |
| \`image\`       | \`image\`, \`imageMessage\`          | Foto/imagem                |
| \`audio\`       | \`audio\`, \`ptt\`, \`audioMessage\`  | Áudio gravado ou PTT       |
| \`video\`       | \`video\`, \`videoMessage\`          | Vídeo                      |
| \`document\`    | \`document\`, \`pdf\`               | Documento/arquivo          |
| \`sticker\`     | \`sticker\`, \`stickerMessage\`     | Figurinha animada/estática |
| \`contact\`     | \`contact\`, \`contactMessage\`     | Cartão de contato vCard    |
| \`carousel\`    | Salvo via broadcast (JSON)        | Carrossel interativo       |

---

## 4. Obtenção de Link Persistente (UAZAPI)

URLs temporárias do UAZAPI expiram. O webhook obtém links persistentes via:

\`\`\`
POST https://wsmart.uazapi.com/message/download
Headers: { "token": "<instance_token>" }
Body: {
  "id": "<messageid>",
  "return_base64": false,
  "return_link": true,
  "generate_mp3": true  // apenas para áudio
}
\`\`\`

### Resposta UAZAPI

\`\`\`json
{
  "link": "https://wsmart.uazapi.com/files/persistent/abc.jpg",
  "mp3Link": "https://wsmart.uazapi.com/files/persistent/abc.mp3",
  "mimetype": "image/jpeg"
}
\`\`\`

- Para **áudio**: prioriza \`mp3Link\` (conversão OGG→MP3 automática)
- Para **outros**: usa \`link\` || \`url\` || \`fileUrl\` || \`fileURL\`

---

## 5. Upload para Supabase Storage

### 5.1 Pipeline de Upload (Não-Áudio)

Mídia não-áudio (imagem, vídeo, documento, sticker) é baixada da UAZAPI e re-uploadada para o bucket privado \`helpdesk-media\`:

\`\`\`typescript
// 1. Download do link persistente
const mediaResponse = await fetch(mediaUrl);
const fileBuffer = await mediaResponse.arrayBuffer();

// 2. Gerar path único
const storagePath = \`webhook/\${Date.now()}_\${random}.{ext}\`;

// 3. Upload para Storage
await supabase.storage
  .from('helpdesk-media')
  .upload(storagePath, fileBuffer, { contentType: mime });

// 4. Obter URL pública (usada como referência no DB)
const { data } = supabase.storage
  .from('helpdesk-media')
  .getPublicUrl(storagePath);
mediaUrl = data.publicUrl;
\`\`\`

### 5.2 Áudio — Tratamento Especial

Áudio **NÃO é re-uploadado** no webhook. A URL persistente da UAZAPI (\`mp3Link\`) é salva diretamente no banco. O motivo é que o player de áudio do frontend consome a URL diretamente.

Para **áudio enviado pelo atendente** (ChatInput), o fluxo é diferente:
1. Grava OGG/Opus via MediaRecorder
2. Upload para bucket \`audio-messages\` (privado)
3. Converte para base64 e envia via \`uazapi-proxy\` (action: \`send-audio\`)

### 5.3 Buckets de Storage

| Bucket            | Público | Uso                                          |
|-------------------|---------|----------------------------------------------|
| \`helpdesk-media\`  | Não     | Imagens, vídeos, documentos, stickers recebidos |
| \`audio-messages\`  | Não     | Áudios gravados por atendentes               |
| \`carousel-images\` | Sim     | Imagens de cards de carrossel                 |

### 5.4 Signed URLs (Buckets Privados)

O hook \`useSignedUrl\` gera URLs temporárias assinadas (1h) para buckets privados:

\`\`\`typescript
// Regex para detectar URLs de Storage
const STORAGE_PUBLIC_REGEX = /\\/storage\\/v1\\/object\\/public\\/([^/]+)\\/(.+)/;

export function useSignedUrl(url: string | null): string | null {
  // 1. Detecta bucket e path da URL
  // 2. Se bucket !== 'carousel-images' → gera signed URL
  // 3. supabase.storage.from(bucket).createSignedUrl(path, 3600)
  // 4. Retorna signed URL ou URL original como fallback
}
\`\`\`

---

## 6. Modelo de Dados (conversation_messages)

\`\`\`sql
CREATE TABLE conversation_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  direction    TEXT NOT NULL DEFAULT 'incoming',  -- 'incoming' | 'outgoing' | 'private_note'
  content      TEXT,                              -- texto da mensagem ou nome do arquivo
  media_type   TEXT NOT NULL DEFAULT 'text',      -- tipo normalizado
  media_url    TEXT,                              -- URL do Storage ou JSON (carousel/contact)
  external_id  TEXT,                              -- ID original da UAZAPI (deduplicação)
  sender_id    UUID,                              -- ID do atendente (outgoing)
  transcription TEXT,                             -- transcrição de áudio (Whisper)
  created_at   TIMESTAMPTZ DEFAULT now()
);
\`\`\`

### Campos por Tipo de Mídia

| Tipo        | \`content\`              | \`media_url\`                         | \`media_type\` |
|-------------|------------------------|--------------------------------------|---------------|
| Texto       | Texto da mensagem      | NULL                                 | \`text\`        |
| Imagem      | Legenda ou NULL        | URL Storage (helpdesk-media)         | \`image\`       |
| Áudio       | NULL                   | URL UAZAPI (mp3Link) ou Storage      | \`audio\`       |
| Vídeo       | Legenda ou NULL        | URL Storage (helpdesk-media)         | \`video\`       |
| Documento   | Nome do arquivo        | URL Storage (helpdesk-media)         | \`document\`    |
| Figurinha   | NULL                   | URL Storage (helpdesk-media)         | \`sticker\`     |
| Contato     | Nome do contato        | JSON: \`{ displayName, vcard }\`      | \`contact\`     |
| Carrossel   | NULL                   | JSON: \`{ message, cards[] }\`        | \`carousel\`    |

---

## 7. Renderização no Frontend (MessageBubble)

### 7.1 Componente Principal

\`MessageBubble.tsx\` é o componente responsável por renderizar cada mensagem no chat. Ele detecta o \`media_type\` e renderiza o player/visualizador adequado.

### 7.2 Players e Visualizadores por Tipo

#### 📝 Texto
- Renderiza \`<p>\` com \`whitespace-pre-wrap break-words\`
- Suporta conteúdo string direto

#### 🖼️ Imagem
- Tag \`<img>\` com link clicável (\`<a target="_blank">\`)
- Fallback em caso de erro: ícone + link "Abrir imagem"
- Classes: \`rounded-lg max-w-full cursor-pointer hover:opacity-90\`

#### 🎵 Áudio — AudioPlayer Customizado
- **Componente:** \`AudioPlayer.tsx\` (player customizado, NÃO usa \`<audio controls>\` nativo)
- **Elemento HTML:** \`<audio ref={audioRef} src={src} preload="metadata" />\` (oculto)
- **Controles visuais:**
  - Botão Play/Pause circular (ícones Lucide: \`Play\`, \`Pause\`)
  - Barra de progresso customizada (\`<div>\` com width dinâmico + \`<input type="range">\` invisível)
  - Display de tempo: \`currentTime / duration\` no formato \`m:ss\`
  - Botão de velocidade: cicla entre \`1x\`, \`1.5x\`, \`2x\`
- **API usada:** \`HTMLAudioElement\` com eventos \`loadedmetadata\`, \`timeupdate\`, \`ended\`
- **Estilização:** Cores diferenciadas por direção (outgoing: emerald, incoming: primary)
- **Transcrição:** Exibida abaixo do player com ícone 📝 (via Whisper/Groq)
- **Indicador de transcrição:** Se incoming e sem transcrição, mostra spinner "Transcrevendo..."

\`\`\`typescript
interface AudioPlayerProps {
  src: string;      // URL do áudio (signed URL ou UAZAPI)
  direction: string; // 'incoming' | 'outgoing'
}

// Velocidades disponíveis
const SPEEDS = [1, 1.5, 2];

// Formatação de tempo
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return \`\${m}:\${s.toString().padStart(2, '0')}\`;
};
\`\`\`

#### 🎥 Vídeo
- Tag \`<video controls>\` nativa do navegador
- Classes: \`rounded-lg max-w-full\`
- Sem player customizado — usa controles nativos do browser

#### 📎 Documento
- **Card clicável** com ícone \`FileText\`, nome do arquivo e extensão
- **Download inteligente:**
  1. URLs de Storage → \`fetch\` direto + \`createObjectURL\` + download programático
  2. URLs UAZAPI legadas → proxy via \`uazapi-proxy\` (action: \`download-media\`)
  3. Fallback → \`window.open(url, '_blank')\`
- **Nome amigável:** Se o nome parece hash (64+ hex chars), substitui por "Documento.{ext}"
- **Loading state:** Spinner durante download

#### 🎨 Figurinha (Sticker)
- Tag \`<img>\` sem background (transparente)
- Tamanho máximo: \`180x180px\`
- Fallback: card com texto "Figurinha"
- Sem borda ou fundo de bolha

#### 👤 Contato (vCard)
- **Card estilo WhatsApp** com parsing do vCard:
  - Header: avatar + nome do contato
  - Botões: "Conversar" (link wa.me) + "Adicionar"
- Sem fundo de bolha (transparente)
- Parsing de campos: \`FN\`, \`TEL\`, \`ORG\`, \`EMAIL\`, \`URL\`

\`\`\`typescript
// Parsing do vCard
const contactData = JSON.parse(message.media_url);
// contactData = { displayName: "Maria", vcard: "BEGIN:VCARD..." }
// Extrai: phone (TEL), org (ORG), email (EMAIL)
\`\`\`

#### 🎠 Carrossel
- **ScrollArea horizontal** com cards deslizáveis
- Cada card: imagem (aspect 4:3) + texto + botões (URL/REPLY/CALL)
- Dados em \`media_url\` como JSON
- Ícones por tipo de botão: \`Link\`, \`Phone\`, \`MessageSquare\`

\`\`\`typescript
// Estrutura do JSON do carrossel
interface CarouselData {
  message?: string;  // Texto principal acima dos cards
  cards: Array<{
    id?: string;
    text?: string;
    image?: string;   // URL da imagem (carousel-images bucket)
    buttons?: Array<{
      type: 'URL' | 'REPLY' | 'CALL';
      label: string;
      value?: string;
    }>;
  }>;
}
\`\`\`

---

## 8. Transcrição de Áudio

### Pipeline de Transcrição

1. Webhook detecta \`mediaType === 'audio'\` e \`direction === 'incoming'\`
2. Dispara chamada assíncrona para \`transcribe-audio\` Edge Function
3. Edge Function:
   - Baixa o áudio da URL
   - Envia para Groq Whisper API (\`whisper-large-v3\`, idioma: \`pt\`)
   - Salva transcrição em \`conversation_messages.transcription\`
   - Broadcast realtime: evento \`transcription-updated\`

\`\`\`json
// Chamada para transcribe-audio
{
  "messageId": "uuid-da-mensagem",
  "audioUrl": "https://...",
  "conversationId": "uuid-da-conversa"
}
\`\`\`

### Renderização da Transcrição

- Se \`message.transcription\` existe → mostra texto em itálico abaixo do player
- Se incoming e sem transcrição → mostra spinner "Transcrevendo..."
- Atualização em tempo real via broadcast \`transcription-updated\`

---

## 9. Envio de Mídia pelo Atendente (ChatInput)

### 9.1 Texto
- \`uazapi-proxy\` action: \`send-chat\`
- Payload: \`{ chatId, text }\`

### 9.2 Arquivo (Imagem/Documento)
1. Upload para \`helpdesk-media\` bucket
2. Obter URL pública
3. \`uazapi-proxy\` action: \`send-media\`
4. Inserir em \`conversation_messages\` com \`direction: 'outgoing'\`

### 9.3 Áudio Gravado
1. \`MediaRecorder\` captura OGG/Opus
2. Upload para \`audio-messages\` bucket
3. Converter blob para base64
4. \`uazapi-proxy\` action: \`send-audio\` com \`{ chatId, audio: base64, ptt: true }\`
5. Inserir mensagem com \`media_type: 'audio'\`

---

## 10. Broadcast Realtime

Após processar qualquer mensagem, o webhook faz broadcast para 2 tópicos:

\`\`\`typescript
const topics = ['helpdesk-realtime', 'helpdesk-conversations'];
// Evento: 'new-message'
const broadcastPayload = {
  conversation_id,
  inbox_id,
  message_id,
  direction,
  content,
  media_type,
  media_url,
  created_at,
  status_ia  // se presente
};
\`\`\`

O frontend escuta esses canais em \`ChatPanel.tsx\` para atualizar mensagens em tempo real.

---

## 11. Mapeamento de MIME Types para Extensões

O webhook utiliza um mapa de MIME types para gerar nomes de arquivo e extensões corretas:

| MIME Type                                                          | Extensão |
|--------------------------------------------------------------------|----------|
| \`application/pdf\`                                                  | pdf      |
| \`application/msword\`                                               | doc      |
| \`application/vnd.openxmlformats-officedocument.wordprocessingml.document\` | docx     |
| \`application/vnd.ms-excel\`                                         | xls      |
| \`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\` | xlsx     |
| \`application/vnd.ms-powerpoint\`                                    | ppt      |
| \`application/vnd.openxmlformats-officedocument.presentationml.presentation\` | pptx     |
| \`text/plain\`                                                       | txt      |
| \`text/csv\`                                                         | csv      |
| \`image/jpeg\`                                                       | jpg      |
| \`image/png\`                                                        | png      |
| \`image/webp\`                                                       | webp     |
| \`image/gif\`                                                        | gif      |
| \`video/mp4\`                                                        | mp4      |

---

## 12. Deduplicação de Mensagens

O webhook previne duplicatas em 2 níveis:

1. **Query prévia:** Busca \`external_id\` no banco antes de inserir
2. **Unique index:** Constraint \`23505\` captura duplicatas concorrentes

\`\`\`typescript
// Normalização do external_id
const externalId = rawExternalId.includes(':')
  ? rawExternalId.split(':').pop()!
  : rawExternalId;

// Busca duplicata (suporta formato com e sem prefixo owner)
const { data: existing } = await supabase
  .from('conversation_messages')
  .select('id')
  .or(\`external_id.eq.\${externalId},external_id.eq.\${owner}:\${externalId}\`)
  .maybeSingle();
\`\`\`

---

## 13. Notas Privadas

Além de mídia, o Helpdesk suporta **notas privadas** entre atendentes:
- \`direction: 'private_note'\`
- Renderizadas com fundo amarelo e ícone 📝
- Visíveis apenas para membros da inbox
- Podem ser deletadas pelo atendente

---

## 14. Diagrama de Fluxo Completo

\`\`\`
RECEBIMENTO (Incoming):
WhatsApp → UAZAPI Webhook → whatsapp-webhook Edge Function
  ├── normalizeMediaType() → tipo padronizado
  ├── getMediaLink() → link persistente UAZAPI
  ├── Upload Storage (não-áudio) → URL pública
  ├── Upsert Contact → contacts table
  ├── Find/Create Conversation → conversations table
  ├── Insert Message → conversation_messages table
  ├── Broadcast Realtime → helpdesk-realtime + helpdesk-conversations
  └── Trigger Transcription (áudio incoming) → transcribe-audio

ENVIO (Outgoing):
ChatInput → Upload Storage → uazapi-proxy (send-chat/send-media/send-audio)
  ├── Insert Message → conversation_messages (direction: 'outgoing')
  ├── Update Conversation → last_message, last_message_at
  ├── Broadcast Realtime → new-message
  └── Fire Outgoing Webhook → fire-outgoing-webhook → n8n
\`\`\`

---

## 15. Edge Functions Envolvidas

| Função                | Responsabilidade                                        |
|-----------------------|---------------------------------------------------------|
| \`whatsapp-webhook\`    | Recebe e processa mensagens do UAZAPI                   |
| \`uazapi-proxy\`        | Proxy autenticado para envio de mensagens                |
| \`transcribe-audio\`    | Transcrição de áudio via Groq Whisper                    |
| \`fire-outgoing-webhook\`| Encaminha mensagens de saída para webhook externo (n8n) |

---

## 16. Secrets Necessários

| Secret                     | Uso                                    |
|----------------------------|----------------------------------------|
| \`SUPABASE_URL\`             | URL do projeto Supabase                |
| \`SUPABASE_SERVICE_ROLE_KEY\`| Acesso admin ao banco                  |
| \`SUPABASE_ANON_KEY\`        | Broadcast realtime                     |
| \`GROQ_API_KEY\`             | API de transcrição Whisper             |
| \`UAZAPI_SERVER_URL\`        | URL base da API UAZAPI                 |

---

## 17. Componentes Frontend Envolvidos

| Componente              | Arquivo                                   | Responsabilidade                          |
|-------------------------|-------------------------------------------|-------------------------------------------|
| \`MessageBubble\`         | \`helpdesk/MessageBubble.tsx\`              | Renderiza cada mensagem com player correto |
| \`AudioPlayer\`           | \`helpdesk/AudioPlayer.tsx\`                | Player de áudio customizado               |
| \`ChatPanel\`             | \`helpdesk/ChatPanel.tsx\`                  | Painel de chat com lista de mensagens      |
| \`ChatInput\`             | \`helpdesk/ChatInput.tsx\`                  | Compositor de mensagens com envio de mídia |
| \`useSignedUrl\`          | \`hooks/useSignedUrl.ts\`                   | Gera signed URLs para buckets privados    |

---

## 18. Regras de Negócio

1. **Áudio incoming:** Sempre dispara transcrição automática (Whisper)
2. **Áudio outgoing:** NÃO é transcrito
3. **Sticker e Contato:** Renderizados sem fundo de bolha (transparente)
4. **Documento sem nome:** Nome gerado como "Documento.{ext}" baseado no MIME type
5. **URLs temporárias UAZAPI:** Sempre substituídas por link persistente ou Storage URL
6. **Signed URLs:** Expiram em 1 hora, regeneradas automaticamente pelo hook
7. **Carrossel:** Dados armazenados como JSON em \`media_url\`, não como arquivo
8. **Contato vCard:** Dados armazenados como JSON em \`media_url\`, parseados no frontend
9. **Deduplicação:** Por \`external_id\` com suporte a formato \`owner:id\`
10. **Mensagens de grupo:** Ignoradas pelo webhook (\`isGroup === true\` → skip)