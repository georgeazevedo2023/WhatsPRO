# UAZAPI Expert - Documentação Completa da API WhatsApp

Você é um especialista em UAZAPI WhatsApp API v2 (baseada em Go, substitui v1 Baileys). Use este conhecimento como referência definitiva ao trabalhar com WhatsApp no WhatsPRO.

> **Documentação oficial**: https://docs.uazapi.com/
> **Servidor**: `https://wsmart.uazapi.com`
> **Versão**: v2.0 (uazapiGO)
> **Postman v2**: https://www.postman.com/augustofcs/uazapi-v2/

---

## 1. ARQUITETURA & AUTENTICAÇÃO

### Arquitetura no WhatsPRO
```
Frontend (uazapiClient.ts)
  → Supabase Edge Function (uazapi-proxy/index.ts)
    → UAZAPI Server (https://wsmart.uazapi.com)

UAZAPI Server → Webhook → whatsapp-webhook Edge Function → Supabase DB
```

### Autenticação
| Header | Uso | Escopo |
|--------|-----|--------|
| `token` | Token da instância | Operações por instância (send, group, chat, etc.) |
| `admintoken` | Token admin global | Operações globais (list all, create, delete instance) |

**No WhatsPRO**: Tokens NUNCA vão ao frontend. O `uazapi-proxy` resolve o token server-side via DB após verificar acesso do usuário.

### Variáveis de Ambiente
```
UAZAPI_SERVER_URL=https://wsmart.uazapi.com
UAZAPI_ADMIN_TOKEN=<admin_token>
```

### Arquivos-Chave do Projeto
| Arquivo | Função |
|---------|--------|
| `supabase/functions/uazapi-proxy/index.ts` | Proxy central — 17 actions |
| `supabase/functions/whatsapp-webhook/index.ts` | Receptor de webhook — processa mensagens |
| `src/lib/uazapiClient.ts` | Client wrapper (uazapiProxy / uazapiProxyRaw) |
| `src/types/uazapi.ts` | Types, normalizers (extractGroupsArray, etc.) |
| `src/lib/uazapiUtils.ts` | QR code extraction, connection check |
| `src/lib/broadcastSender.ts` | Funções de envio para broadcast |
| `supabase/functions/sync-conversations/index.ts` | Sync bulk de chats/mensagens |
| `supabase/functions/send-shift-report/index.ts` | Relatório de turno via WhatsApp |

---

## 2. ENDPOINTS DA API — REFERÊNCIA COMPLETA

### 2.1 INSTÂNCIA

#### `POST /instance/create` — Criar instância
```
Headers: { admintoken: "<admin_token>" }
Body: { "instanceName": "minha-empresa", "token": "<optional_custom_token>" }
Response: { "id": "uuid", "instanceName": "minha-empresa", "token": "generated_token", ... }
```
**Status no proxy**: ✅ Implementado (action: `create-instance`)

#### `POST /instance/connect` — Gerar QR Code para conexão
```
Headers: { token: "<instance_token>" }
Body: {}
Response: { "qrcode": "data:image/png;base64,...", "status": "qr" }
         ou { "status": "connected", "jid": "5511999@s.whatsapp.net" }
```
**Status no proxy**: ✅ Implementado (action: `connect`)
**Nota**: Resposta pode conter QR como base64, URL, ou objeto com propriedade `qrcode`/`QrCode`/`base64`

#### `GET /instance/status` — Status da conexão
```
Headers: { token: "<instance_token>" }
Response: { "status": "connected", "jid": "5511999@s.whatsapp.net", "name": "Empresa" }
         ou { "status": "disconnected" }
         ou { "status": "qr" }
```
**Status no proxy**: ✅ Implementado (action: `status`)

#### `GET /instance/all` — Listar todas as instâncias (admin)
```
Headers: { admintoken: "<admin_token>" }
Response: [
  { "id": "uuid", "instanceName": "emp1", "status": "connected", "owner": "5511@s.whatsapp.net", ... },
  ...
]
```
**Status no proxy**: ✅ Implementado (action: `list`)

#### `POST /instance/disconnect` — Desconectar instância
```
Headers: { token: "<instance_token>" }
Body: {}
Response: { "status": "disconnected" }
```
**Status no proxy**: ✅ Implementado (action: `disconnect`)

#### `POST /instance/delete` — Excluir instância
```
Headers: { admintoken: "<admin_token>" }
Body: { "instanceId": "uuid", "instanceName": "minha-empresa" }
Response: { "deleted": true }
```
**Status no proxy**: ✅ Implementado (action: `delete-instance`)

#### `POST /instance/restart` — Reiniciar instância
```
Headers: { token: "<instance_token>" }
Body: {}
Response: { "status": "restarting" }
```
**Status no proxy**: ❌ Não implementado

#### `POST /instance/logout` — Logout (desvincula telefone)
```
Headers: { token: "<instance_token>" }
Body: {}
Response: { "status": "logged_out" }
```
**Status no proxy**: ❌ Não implementado

---

### 2.2 ENVIO DE MENSAGENS

#### `POST /send/text` — Enviar texto simples
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999@s.whatsapp.net",  // ou "5511999999999" ou JID de grupo
  "text": "Olá, tudo bem?"
}
Response: {
  "messageId": "3EB0ABC123...",
  "status": "sent",
  "jid": "5511999999999@s.whatsapp.net"
}
```
**Status no proxy**: ✅ Implementado (actions: `send-message`, `send-chat`)
**Limites**: Max 4096 caracteres
**Formatos de número aceitos**:
- `5511999999999` (apenas dígitos)
- `5511999999999@s.whatsapp.net` (JID individual)
- `120363012345678@g.us` (JID de grupo)

#### `POST /send/media` — Enviar mídia (imagem, vídeo, áudio, documento, sticker)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "type": "image",           // image | video | audio | document | ptt | sticker
  "file": "https://example.com/photo.jpg",  // URL pública ou base64
  "text": "Legenda opcional",  // caption
  "docName": "arquivo.pdf"     // nome do arquivo (apenas para document)
}
Response: { "messageId": "3EB0ABC123...", "status": "sent" }
```
**Status no proxy**: ✅ Implementado (actions: `send-media`, `send-audio`)
**Tipos de mídia**:
| type | Formatos | Max size |
|------|----------|----------|
| `image` | JPEG, PNG, GIF, WebP | 10MB |
| `video` | MP4 | 10MB |
| `audio` | MP3, OGG, WAV | 10MB |
| `ptt` | OGG (push-to-talk/voice note) | 12MB |
| `document` | PDF, DOC, XLS, etc. | 10MB |
| `sticker` | WebP | 500KB |

**Base64**: Se `file` começa com `data:`, o proxy extrai o base64 puro (remove o prefixo)

#### `POST /send/carousel` — Enviar carrossel interativo
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",        // ou groupjid, phone, chatId
  "message": "Confira nossas opções:",  // ou text
  "carousel": [                     // ou cards
    {
      "text": "Produto 1 - R$ 99,90",
      "image": "https://example.com/img1.jpg",  // URL ou base64
      "buttons": [
        { "id": "comprar_1", "text": "Comprar", "type": "REPLY" },
        { "id": "https://loja.com/p1", "text": "Ver detalhes", "type": "URL" }
      ]
    },
    {
      "text": "Produto 2 - R$ 149,90",
      "image": "https://example.com/img2.jpg",
      "buttons": [
        { "id": "comprar_2", "text": "Comprar", "type": "REPLY" },
        { "id": "+5511999999999", "text": "Ligar", "type": "CALL" }
      ]
    }
  ]
}
```
**Status no proxy**: ✅ Implementado (action: `send-carousel`)
**Limites**: Max 10 cards por carrossel
**Tipos de botão**:
| type | id contém | Exemplo |
|------|-----------|---------|
| `REPLY` | texto/id da resposta | `{ "id": "opt1", "text": "Opção 1", "type": "REPLY" }` |
| `URL` | URL completa | `{ "id": "https://site.com", "text": "Abrir", "type": "URL" }` |
| `CALL` | número telefone | `{ "id": "+5511999", "text": "Ligar", "type": "CALL" }` |
| `COPY` | texto a copiar | `{ "id": "CUPOM10", "text": "Copiar cupom", "type": "COPY" }` |

**⚠️ IMPORTANTE — Carousel Retry Strategy**: O endpoint é instável com nomes de campo. O proxy tenta 4 variantes:
1. `{ groupjid, message, carousel }` (grupos)
2. `{ chatId, message, carousel }` (alt grupo)
3. `{ phone, message, carousel }` (individual)
4. `{ number, text, carousel }` (alt individual)

Se resposta contém "missing required fields", tenta a próxima variante.

#### `POST /send/template` — Enviar template com variáveis
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "template": "hello_world",
  "language": "pt_BR",
  "components": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "João" },
        { "type": "text", "text": "Pedido #1234" }
      ]
    }
  ]
}
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M10 (Funis) — templates aprovados pelo WhatsApp Business

#### `POST /send/quickreply` — Enviar botões de resposta rápida
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "text": "Como posso ajudar?",
  "buttons": [
    { "id": "vendas", "text": "Vendas" },
    { "id": "suporte", "text": "Suporte" },
    { "id": "financeiro", "text": "Financeiro" }
  ]
}
Response: { "messageId": "...", "status": "sent" }
```
**Status no proxy**: ❌ Não implementado
**Limites**: Max 3 botões
**Uso futuro**: M10 (Funis), M12 (Formulários) — perguntas com opções rápidas

#### `POST /send/list` — Enviar lista interativa com seções
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "title": "Menu de Opções",
  "text": "Escolha uma opção abaixo:",
  "buttonText": "Ver opções",
  "sections": [
    {
      "title": "Produtos",
      "rows": [
        { "id": "prod_1", "title": "Camiseta", "description": "R$ 89,90" },
        { "id": "prod_2", "title": "Calça", "description": "R$ 149,90" }
      ]
    },
    {
      "title": "Serviços",
      "rows": [
        { "id": "serv_1", "title": "Consultoria", "description": "R$ 200/hora" },
        { "id": "serv_2", "title": "Suporte", "description": "Gratuito" }
      ]
    }
  ]
}
```
**Status no proxy**: ❌ Não implementado
**Limites**: Max 10 seções, max 10 rows por seção, max 1 lista por mensagem
**Uso futuro**: M10 (Funis), M11 (E-commerce) — catálogo, M12 (Formulários) — select com muitas opções

#### `POST /send/location` — Enviar localização
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "name": "Escritório Central",
  "address": "Av. Paulista, 1000 - São Paulo"
}
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M11 (E-commerce) — localização de entrega/loja

#### `POST /send/contact` — Compartilhar contato (vCard)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "contact": {
    "displayName": "João Silva",
    "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:João Silva\nTEL:+5511999999999\nEND:VCARD"
  }
}
```
**Status no proxy**: ❌ Não implementado (webhook processa contacts recebidos)
**Uso futuro**: M2 (Helpdesk) — compartilhar contato de agente

#### `POST /send/sticker` — Enviar sticker/figurinha
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "file": "https://example.com/sticker.webp"  // WebP, max 500KB
}
```
**Status no proxy**: ❌ Não implementado (via send/media com type=sticker)

#### `POST /send/reaction` — Reagir a uma mensagem
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "messageId": "3EB0ABC123...",
  "reaction": "👍"               // emoji ou "" para remover reação
}
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M2 (Helpdesk) — agente reage a mensagem do cliente

#### `POST /send/link` — Enviar texto com preview de URL
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "text": "Confira nosso site: https://example.com",
  "linkPreview": true
}
```
**Status no proxy**: ❌ Não implementado (usa send/text sem preview)

---

### 2.3 GRUPOS

#### `GET /group/list` — Listar grupos da instância
```
Headers: { token: "<instance_token>" }
Query: ?noparticipants=false
Response: [
  {
    "JID": "120363012345678@g.us",     // ou "jid"
    "Name": "Grupo Vendas",            // ou "name", "Subject", "subject"
    "Size": 45,                        // ou "size"
    "Participants": [...],             // ou "participants"
    "Owner": "5511999@s.whatsapp.net"
  }, ...
]
```
**Status no proxy**: ✅ Implementado (action: `groups`)
**⚠️ Normalização**: Resposta pode vir como array direto, `{ groups: [] }`, ou `{ data: [] }`

#### `POST /group/info` — Detalhes de um grupo
```
Headers: { token: "<instance_token>" }
Body: { "groupjid": "120363012345678@g.us" }
Response: {
  "JID": "120363012345678@g.us",
  "Name": "Grupo Vendas",
  "Description": "Grupo para equipe de vendas",
  "Owner": "5511999@s.whatsapp.net",
  "Participants": [
    {
      "JID": "5511888@s.whatsapp.net",       // ou "jid"
      "PhoneNumber": "5511888888888",         // ou "phoneNumber"
      "PushName": "Maria",                    // ou "pushName", "DisplayName", "Name"
      "IsAdmin": false,                       // ou "isAdmin"
      "IsSuperAdmin": false                   // ou "isSuperAdmin"
    }, ...
  ]
}
```
**Status no proxy**: ✅ Implementado (actions: `group-info`, `resolve-lids`)
**⚠️ LID Participants**: Participantes com `·` no JID têm telefone mascarado (indisponível)

#### `POST /group/create` — Criar grupo
```
Headers: { token: "<instance_token>" }
Body: {
  "name": "Novo Grupo",
  "participants": ["5511999999999", "5511888888888"]
}
Response: { "groupJid": "120363012345678@g.us" }
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M13 (Cursos) — criar grupo de alunos automaticamente

#### `POST /group/invite` — Obter link de convite
```
Headers: { token: "<instance_token>" }
Body: { "groupjid": "120363012345678@g.us" }
Response: { "inviteLink": "https://chat.whatsapp.com/ABC123..." }
```
**Status no proxy**: ❌ Não implementado

#### `POST /group/add` — Adicionar participante ao grupo
```
Headers: { token: "<instance_token>" }
Body: {
  "groupjid": "120363012345678@g.us",
  "participants": ["5511999999999"]
}
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M13 (Cursos) — adicionar aluno ao grupo do curso

#### `POST /group/remove` — Remover participante do grupo
```
Headers: { token: "<instance_token>" }
Body: {
  "groupjid": "120363012345678@g.us",
  "participants": ["5511999999999"]
}
```
**Status no proxy**: ❌ Não implementado

#### `POST /group/promote` — Promover a admin
```
Headers: { token: "<instance_token>" }
Body: { "groupjid": "...", "participants": ["5511999999999"] }
```
**Status no proxy**: ❌ Não implementado

#### `POST /group/demote` — Remover admin
```
Headers: { token: "<instance_token>" }
Body: { "groupjid": "...", "participants": ["5511999999999"] }
```
**Status no proxy**: ❌ Não implementado

#### `POST /group/leave` — Sair do grupo
```
Headers: { token: "<instance_token>" }
Body: { "groupjid": "120363012345678@g.us" }
```
**Status no proxy**: ❌ Não implementado

#### `POST /group/update` — Atualizar grupo (nome, descrição, foto)
```
Headers: { token: "<instance_token>" }
Body: {
  "groupjid": "120363012345678@g.us",
  "name": "Novo Nome",              // opcional
  "description": "Nova descrição",   // opcional
  "photo": "base64_or_url"          // opcional
}
```
**Status no proxy**: ❌ Não implementado

---

### 2.4 CONTATOS & CHAT

#### `POST /chat/check` — Verificar números WhatsApp
```
Headers: { token: "<instance_token>" }
Body: { "numbers": ["5511999999999", "5511888888888", "5511777777777"] }
Response: {
  "Users": [                          // ou "users" ou "data"
    { "number": "5511999999999", "exists": true, "jid": "5511999999999@s.whatsapp.net" },
    { "number": "5511888888888", "exists": true, "jid": "5511888888888@s.whatsapp.net" },
    { "number": "5511777777777", "exists": false }
  ]
}
```
**Status no proxy**: ✅ Implementado (action: `check-numbers`)
**Limites**: Max 500 números por request

#### `GET /chat/list` — Listar conversas recentes
```
Headers: { token: "<instance_token>" }
Query: ?limit=20&offset=0
Response: [
  {
    "jid": "5511999999999@s.whatsapp.net",
    "name": "João",
    "lastMessage": "Olá!",
    "lastMessageTime": 1711036800000,
    "unreadCount": 3
  }, ...
]
```
**Status no proxy**: ❌ Não implementado (usado via sync-conversations)

#### `GET /contact/list` — Listar contatos
```
Headers: { token: "<instance_token>" }
Query: ?limit=20&offset=0
Response: [
  {
    "jid": "5511999999999@s.whatsapp.net",
    "name": "João Silva",
    "pushName": "João",
    "phone": "5511999999999"
  }, ...
]
```
**Status no proxy**: ❌ Não implementado

#### `GET /contact/info` — Info de um contato
```
Headers: { token: "<instance_token>" }
Query: ?jid=5511999999999@s.whatsapp.net
Response: {
  "jid": "5511999999999@s.whatsapp.net",
  "name": "João Silva",
  "pushName": "João",
  "profilePicUrl": "https://...",
  "status": "Disponível"
}
```
**Status no proxy**: ❌ Não implementado

#### `POST /contact/block` — Bloquear contato
```
Headers: { token: "<instance_token>" }
Body: { "jid": "5511999999999@s.whatsapp.net" }
```
**Status no proxy**: ❌ Não implementado

#### `POST /contact/unblock` — Desbloquear contato
```
Headers: { token: "<instance_token>" }
Body: { "jid": "5511999999999@s.whatsapp.net" }
```
**Status no proxy**: ❌ Não implementado

---

### 2.5 MENSAGENS

#### `POST /message/download` — Download de mídia (link persistente)
```
Headers: { token: "<instance_token>" }
Body: {
  "id": "3EB0ABC123...",        // messageId
  "return_base64": false,
  "return_link": true,
  "generate_mp3": true           // opcional — converte áudio para MP3
}
Response: {
  "link": "https://wsmart.uazapi.com/files/...",    // ou "url", "fileUrl", "fileURL"
  "mp3Link": "https://wsmart.uazapi.com/files/...", // se generate_mp3=true
  "mimetype": "audio/ogg",                           // ou "mimeType"
  "size": 123456
}
```
**Status no proxy**: ✅ Implementado (action: `download-media` + webhook usa internamente)
**⚠️ IMPORTANTE**: URLs de mídia da UAZAPI são TEMPORÁRIAS. Sempre usar `/message/download` com `return_link: true` para obter link persistente. No webhook, fazemos upload para Supabase Storage.

#### `POST /message/delete` — Deletar mensagem (para todos)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999@s.whatsapp.net",
  "messageId": "3EB0ABC123..."
}
```
**Status no proxy**: ❌ Não implementado
**Uso futuro**: M2 (Helpdesk) — agente apaga mensagem enviada por engano

#### `POST /message/star` — Favoritar/desfavoritar mensagem
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999@s.whatsapp.net",
  "messageId": "3EB0ABC123...",
  "star": true
}
```
**Status no proxy**: ❌ Não implementado

#### `GET /message/list` — Listar mensagens de um chat
```
Headers: { token: "<instance_token>" }
Query: ?jid=5511999999999@s.whatsapp.net&limit=50&offset=0
Response: [
  {
    "id": "3EB0ABC123...",
    "fromMe": false,
    "text": "Olá!",
    "timestamp": 1711036800000,
    "type": "text",
    "mediaUrl": null
  }, ...
]
```
**Status no proxy**: ❌ Não implementado (usado via sync-conversations)

---

### 2.6 PERFIL

#### `GET /profile/info` — Info do perfil da instância
```
Headers: { token: "<instance_token>" }
Response: {
  "name": "Empresa",
  "status": "Atendimento 9h-18h",
  "profilePicUrl": "https://...",
  "jid": "5511999999999@s.whatsapp.net"
}
```
**Status no proxy**: ❌ Não implementado

#### `POST /profile/name` — Alterar nome do perfil
```
Headers: { token: "<instance_token>" }
Body: { "name": "Novo Nome da Empresa" }
```
**Status no proxy**: ❌ Não implementado

#### `POST /profile/status` — Alterar status/recado
```
Headers: { token: "<instance_token>" }
Body: { "status": "Atendimento de seg-sex 9h-18h" }
```
**Status no proxy**: ❌ Não implementado

#### `POST /profile/photo` — Alterar foto do perfil
```
Headers: { token: "<instance_token>" }
Body: { "photo": "base64_or_url" }
```
**Status no proxy**: ❌ Não implementado

---

### 2.7 WEBHOOK

#### `POST /webhook/set` — Configurar webhook URL
```
Headers: { token: "<instance_token>" }
Body: {
  "webhookUrl": "https://your-project.supabase.co/functions/v1/whatsapp-webhook",
  "events": ["messages", "status", "connection", "group", "call", "presence"]
}
```
**Status no proxy**: ❌ Não implementado (configurado manualmente ou via n8n)

#### `GET /webhook/get` — Ver webhook atual
```
Headers: { token: "<instance_token>" }
Response: { "webhookUrl": "https://...", "events": [...] }
```
**Status no proxy**: ❌ Não implementado

---

### 2.8 SESSÃO (alternativo a /instance)

#### `POST /session/start` — Iniciar sessão
```
Headers: { token: "<instance_token>" }
Body: {}
Response: { "sessionId": "...", "status": "starting" }
```

#### `GET /session/status` — Status da sessão
```
Headers: { token: "<instance_token>" }
Response: { "status": "connected" | "disconnected" | "qr" }
```

#### `GET /session/qrcode` — Obter QR code
```
Headers: { token: "<instance_token>" }
Response: { "qrcode": "data:image/png;base64,..." }
```

**Status no proxy**: ❌ Endpoints de sessão não implementados (usamos /instance/*)

---

## 3. WEBHOOK EVENTS — Eventos Recebidos

### Formato do payload
```json
{
  "EventType": "messages",         // tipo do evento
  "instanceName": "5511999999999", // ou owner JID
  "owner": "5511999999999",
  "message": { ... },              // dados da mensagem
  "chat": { ... }                  // dados do contato/chat
}
```

### Tipos de evento

#### `messages` — Mensagem recebida/enviada
```json
{
  "EventType": "messages",
  "instanceName": "5511999999999",
  "message": {
    "messageid": "3EB0ABC123...",    // ou "id"
    "chatid": "5511888@s.whatsapp.net",  // ou "sender"
    "fromMe": false,
    "text": "Olá!",                  // ou "caption" para mídia
    "messageTimestamp": 1711036800000,
    "mediaType": "text",             // text|image|video|audio|document|sticker|contact
    "fileURL": "https://...",        // URL temporária da mídia
    "fileName": "foto.jpg",
    "isGroup": false,
    "senderName": "João",
    "sender_pn": "5511888@s.whatsapp.net",
    "content": {                     // para contatos, conteúdo estruturado
      "text": "...",
      "URL": "...",
      "vcard": "...",
      "displayName": "..."
    }
  },
  "chat": {
    "wa_contactName": "João",
    "name": "João",
    "imagePreview": "https://...",
    "image": "https://..."
  }
}
```
**Processado no webhook**: ✅ Completo

#### `status` — Status de entrega
```json
{
  "EventType": "status",
  "message": {
    "messageId": "3EB0ABC123...",
    "status": "sent" | "delivered" | "read" | "failed",
    "chatid": "5511888@s.whatsapp.net"
  }
}
```
**Processado no webhook**: ❌ Ignorado (eventType !== 'messages')

#### `connection` — Conexão/desconexão
```json
{
  "EventType": "connection",
  "status": "connected" | "disconnected" | "qr",
  "instanceName": "5511999999999"
}
```
**Processado no webhook**: ❌ Ignorado

#### `group` — Mudanças em grupos
```json
{
  "EventType": "group",
  "action": "join" | "leave" | "promote" | "demote" | "create" | "update",
  "groupJid": "120363012345678@g.us",
  "participant": "5511888@s.whatsapp.net"
}
```
**Processado no webhook**: ❌ Ignorado

#### `call` — Chamada recebida
```json
{
  "EventType": "call",
  "from": "5511888@s.whatsapp.net",
  "callType": "voice" | "video",
  "status": "ringing" | "missed" | "rejected"
}
```
**Processado no webhook**: ❌ Ignorado

#### `presence` — Online/offline/digitando
```json
{
  "EventType": "presence",
  "jid": "5511888@s.whatsapp.net",
  "status": "available" | "unavailable" | "composing" | "recording"
}
```
**Processado no webhook**: ❌ Ignorado
**Uso futuro**: M2 (Helpdesk) — indicador "digitando..." no chat

### Payload especial: status_ia
```json
{
  "status_ia": "ligada" | "desligada",
  "chatid": "5511888@s.whatsapp.net",
  "instanceName": "5511999999999",
  "inbox_id": "uuid"
}
```
**Processado no webhook**: ✅ Atualiza `conversations.status_ia`
**Nota**: Verificado ANTES do processamento de mensagem. Pode vir junto com mensagem (ex: resposta do agente IA).

### Payload via n8n
O n8n pode encapsular o payload em array e/ou em `body`/`Body`:
```json
[{ "body": { "EventType": "messages", "message": {...} } }]
```
O webhook faz unwrap automático.

---

## 4. NORMALIZAÇÃO DE DADOS — Quirks da API

### 4.1 PascalCase vs camelCase
A UAZAPI retorna campos com naming inconsistente. SEMPRE verificar ambos:
```
JID          ↔ jid
Name         ↔ name ↔ Subject ↔ subject
Size         ↔ size
Participants ↔ participants
PhoneNumber  ↔ phoneNumber
PushName     ↔ pushName ↔ DisplayName ↔ Name ↔ name
IsAdmin      ↔ isAdmin
IsSuperAdmin ↔ isSuperAdmin
Users        ↔ users ↔ data
link         ↔ url ↔ fileUrl ↔ fileURL
mimetype     ↔ mimeType
```

### 4.2 Formatos de JID
```
Individual:  5511999999999@s.whatsapp.net
Grupo:       120363012345678@g.us
LID (masked): contém "·" — telefone indisponível
Broadcast:   status@broadcast
```

### 4.3 Timestamp
```
Se valor > 9999999999 → milissegundos (dividir por 1000 para Date)
Se valor ≤ 9999999999 → segundos (multiplicar por 1000 para Date)
```

### 4.4 Carousel Retry Strategy
O endpoint `/send/carousel` aceita diferentes nomes de campo dependendo da versão/contexto. O proxy tenta 4 variantes sequencialmente:
1. `{ groupjid, message, carousel }` — para grupos
2. `{ chatId, message, carousel }` — alt grupo
3. `{ phone, message, carousel }` — individual
4. `{ number, text, carousel }` — alt individual

Para de tentar ao receber sucesso (200) ou erro que NÃO seja "missing required fields".

### 4.5 Media URLs Temporárias
URLs de mídia no webhook são TEMPORÁRIAS e expiram. Fluxo correto:
1. Receber messageId no webhook
2. Chamar `POST /message/download` com `return_link: true`
3. Obter URL persistente
4. Upload para Supabase Storage (exceto áudio)
5. Salvar URL pública no DB

### 4.6 Grupos Response Formats
A resposta de `/group/list` pode vir em 3 formatos:
- Array direto: `[{ JID: "...", Name: "..." }, ...]`
- Objeto com groups: `{ groups: [...] }`
- Objeto com data: `{ data: [...] }`

---

## 5. TASKS DE INTERESSE POR MÓDULO

### M1 — WhatsApp (Instâncias & Grupos) ✅ Implementado
| Endpoint | Action no Proxy | Status |
|----------|----------------|--------|
| `POST /instance/create` | `create-instance` | ✅ |
| `POST /instance/connect` | `connect` | ✅ |
| `GET /instance/status` | `status` | ✅ |
| `GET /instance/all` | `list` | ✅ |
| `POST /instance/disconnect` | `disconnect` | ✅ |
| `POST /instance/delete` | `delete-instance` | ✅ |
| `GET /group/list` | `groups` | ✅ |
| `POST /group/info` | `group-info` | ✅ |

### M2 — Helpdesk (Atendimento) ✅ Implementado
| Endpoint | Action no Proxy | Status |
|----------|----------------|--------|
| `POST /send/text` | `send-message`, `send-chat` | ✅ |
| `POST /send/media` | `send-media`, `send-audio` | ✅ |
| `POST /message/download` | `download-media` + webhook interno | ✅ |
| Webhook `messages` event | whatsapp-webhook | ✅ |
| `POST /send/reaction` | — | ❌ Planejado |
| `POST /message/delete` | — | ❌ Planejado |
| Webhook `presence` event | — | ❌ Planejado (R14: indicador digitando) |

### M3 — Broadcast (Disparador) ✅ Implementado
| Endpoint | Action no Proxy | Status |
|----------|----------------|--------|
| `POST /send/text` | `send-message` | ✅ |
| `POST /send/media` | `send-media` | ✅ |
| `POST /send/carousel` | `send-carousel` | ✅ |
| `POST /chat/check` | `check-numbers` | ✅ |

### M10 — Funis Conversacionais 📋 Planejado
| Endpoint | Uso no Funil | Prioridade |
|----------|-------------|-----------|
| `POST /send/text` | Enviar mensagens de step | ✅ Já existe |
| `POST /send/media` | Enviar mídia em step | ✅ Já existe |
| `POST /send/quickreply` | Perguntas com botões (2-3 opções) | 🔴 Crítico |
| `POST /send/list` | Perguntas com muitas opções (4+) | 🔴 Crítico |
| `POST /send/template` | Templates aprovados WhatsApp Business | 🟡 Médio |
| `POST /send/carousel` | Apresentar produtos/opções visuais | ✅ Já existe |
| `POST /send/location` | Enviar localização de loja/escritório | 🟢 Baixo |
| Webhook `presence` | Saber se contato está online/digitando | 🟢 Baixo |

### M11 — E-commerce WhatsApp 📋 Planejado
| Endpoint | Uso no E-commerce | Prioridade |
|----------|------------------|-----------|
| `POST /send/carousel` | Catálogo de produtos | ✅ Já existe |
| `POST /send/media` | Foto do produto individual | ✅ Já existe |
| `POST /send/text` | Confirmação de pedido, tracking | ✅ Já existe |
| `POST /send/list` | Lista de produtos por categoria | 🔴 Crítico |
| `POST /send/quickreply` | Confirmar pedido (Sim/Não) | 🔴 Crítico |
| `POST /send/location` | Localização de entrega | 🟡 Médio |

### M12 — Formulários WhatsApp 📋 Planejado
| Endpoint | Uso no Formulário | Prioridade |
|----------|------------------|-----------|
| `POST /send/text` | Perguntas abertas | ✅ Já existe |
| `POST /send/quickreply` | Perguntas sim/não, múltipla escolha (≤3) | 🔴 Crítico |
| `POST /send/list` | Perguntas com muitas opções | 🔴 Crítico |
| `POST /send/media` | Enviar instruções com imagem | ✅ Já existe |

### M13 — Cursos & Membership 📋 Planejado
| Endpoint | Uso no Curso | Prioridade |
|----------|-------------|-----------|
| `POST /send/text` | Conteúdo de texto, notificações | ✅ Já existe |
| `POST /send/media` | Vídeos, PDFs, imagens de aula | ✅ Já existe |
| `POST /send/quickreply` | Quiz (2-3 alternativas) | 🔴 Crítico |
| `POST /send/list` | Quiz (4+ alternativas) | 🟡 Médio |
| `POST /group/create` | Criar grupo de alunos | 🟡 Médio |
| `POST /group/add` | Adicionar aluno ao grupo | 🟡 Médio |
| `POST /group/remove` | Remover aluno do grupo | 🟡 Médio |

---

## 6. ORQUESTRADOR — Como o Proxy Funciona

### Fluxo de autenticação
```
1. Frontend envia: { action, instance_id, ...params } + Bearer token
2. Edge function extrai JWT do Authorization header
3. Verifica usuário via Supabase Auth (getUser)
4. Checa permissão: super_admin OU gerente OU user_instance_access record
5. Busca instance.token no banco de dados
6. Chama UAZAPI com o token da instância no header
7. Normaliza e retorna resposta
```

### Actions implementadas no proxy (17 total)
| Action | Endpoint UAZAPI | Descrição |
|--------|----------------|-----------|
| `connect` | `POST /instance/connect` | Gerar QR code |
| `status` | `GET /instance/status` | Check conexão |
| `list` | `GET /instance/all` | Listar instâncias (admin) |
| `groups` | `GET /group/list` | Listar grupos |
| `group-info` | `POST /group/info` | Detalhes do grupo |
| `send-message` | `POST /send/text` | Texto para grupo/individual |
| `send-media` | `POST /send/media` | Mídia (image/video/doc) |
| `send-carousel` | `POST /send/carousel` | Carrossel com retry |
| `send-audio` | `POST /send/media (type=ptt)` | Áudio gravado |
| `send-chat` | `POST /send/text` | Texto (alt action name) |
| `check-numbers` | `POST /chat/check` | Verificar números WhatsApp |
| `resolve-lids` | `POST /group/info (multi)` | Resolver participantes mascarados |
| `download-media` | Proxy fetch | Download de arquivo com token |
| `create-instance` | `POST /instance/create` | Criar instância |
| `delete-instance` | `POST /instance/delete` | Excluir instância |
| `disconnect` | `POST /instance/disconnect` | Desconectar |

### Actions planejadas (a implementar)
| Action Futura | Endpoint | Módulo | Prioridade |
|--------------|----------|--------|-----------|
| `send-quickreply` | `POST /send/quickreply` | M10, M12, M13 | 🔴 Crítico |
| `send-list` | `POST /send/list` | M10, M11, M12 | 🔴 Crítico |
| `send-reaction` | `POST /send/reaction` | M2 | 🟡 Médio |
| `send-location` | `POST /send/location` | M11 | 🟡 Médio |
| `send-contact` | `POST /send/contact` | M2 | 🟢 Baixo |
| `send-template` | `POST /send/template` | M10 | 🟡 Médio |
| `delete-message` | `POST /message/delete` | M2 | 🟡 Médio |
| `group-create` | `POST /group/create` | M13 | 🟡 Médio |
| `group-add` | `POST /group/add` | M13 | 🟡 Médio |
| `group-remove` | `POST /group/remove` | M13 | 🟡 Médio |
| `set-webhook` | `POST /webhook/set` | Admin | 🟢 Baixo |
| `profile-update` | `POST /profile/*` | Admin | 🟢 Baixo |
| `contact-info` | `GET /contact/info` | M2 | 🟢 Baixo |
| `chat-list` | `GET /chat/list` | M2 | 🟢 Baixo |
| `message-list` | `GET /message/list` | M2 | 🟢 Baixo |

---

## 7. TASKS PENDENTES — Endpoints Não Utilizados

### Prioridade 🔴 CRÍTICA (necessários para M10-M13)
1. **`send/quickreply`** — Fundamental para funis (M10), formulários (M12), quizzes (M13). Permite botões de resposta rápida com até 3 opções.
2. **`send/list`** — Fundamental para funis com muitas opções, catálogo de produtos (M11), formulários com select (M12).

### Prioridade 🟡 MÉDIA
3. **`send/reaction`** — UX no helpdesk (M2): agente reage a mensagem
4. **`send/template`** — Templates aprovados para envio proativo (24h+) via funis (M10)
5. **`send/location`** — E-commerce (M11): localização de loja/entrega
6. **`message/delete`** — Helpdesk (M2): apagar mensagem enviada por engano
7. **`group/create`**, **`group/add`**, **`group/remove`** — Cursos (M13): gestão de grupos de alunos

### Prioridade 🟢 BAIXA
8. **`send/contact`** — Compartilhar vCard de agente
9. **`webhook/set`** — Configurar webhook via API (hoje é manual)
10. **`profile/*`** — Gerenciar perfil da instância via admin
11. **`contact/info`**, **`contact/list`** — Enriquecer dados de contatos
12. **`chat/list`**, **`message/list`** — Sincronização avançada de histórico
13. **Webhook `presence`** — Indicador "digitando..." no helpdesk
14. **Webhook `status`** — Rastrear entrega/leitura de mensagens
15. **Webhook `group`** — Monitorar entrada/saída em grupos
16. **`instance/restart`**, **`instance/logout`** — Gestão avançada de instância

---

## 8. TROUBLESHOOTING — Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| "missing required fields" no carousel | Campo de destino errado | Proxy já faz retry com 4 variantes |
| Mídia com URL quebrada | URLs temporárias | Sempre usar `/message/download` + upload Storage |
| Campo não encontrado na resposta | PascalCase vs camelCase | Verificar AMBAS as variantes |
| Mensagem duplicada | Webhook chamado 2x | Dedup por `external_id` no webhook |
| Participante sem telefone | LID (masked) | Verificar se JID contém `·` |
| Timestamp errado | ms vs seconds | Se > 9999999999, é ms |
| QR code não aparece | Formato inconsistente | `uazapiUtils.ts` normaliza múltiplos formatos |
| Áudio não reproduz | Formato errado | Usar `generate_mp3: true` no download |
| Mensagem de grupo processada | isGroup não filtrado | Webhook filtra `isGroup === true` |
| Webhook payload encapsulado | n8n wrapping | Webhook faz unwrap de array e body/Body |

---

## 9. AUDITORIA v2.9.0 — Findings de Segurança e Qualidade

> Resultados da auditoria completa realizada em 2026-03-23 cobrindo todos os endpoints, proxy, webhook e edge functions.

### 9.1 Segurança do Proxy (uazapi-proxy/index.ts)

| Issue | Severidade | Detalhes | Roadmap |
|-------|-----------|----------|---------|
| Sem timeout nos fetch() | Média | Requests para UAZAPI podem travar indefinidamente | R42 |
| Input validation incompleta | Média | Phone numbers não validados com regex antes de envio | Pendente |
| Carousel button ID vazio | Baixa | `btn.url ?? btn.id ?? ''` pode enviar ID vazio | Pendente |
| Media URL sem whitelist de protocolo | Média | Poderia proxiar URLs internas se UAZAPI comprometida | Pendente |
| Audio size validado mas sem MIME type | Baixa | Extensão não verificada contra whitelist | Pendente |
| Normalização de resposta espalhada | Baixa | Checks PascalCase/camelCase não centralizados | Pendente |

### 9.2 Segurança do Webhook (whatsapp-webhook/index.ts)

| Issue | Severidade | Detalhes | Roadmap |
|-------|-----------|----------|---------|
| Sem validação de assinatura (HMAC) | Média | Apenas verifica WEBHOOK_SECRET header | R3 |
| Sem limite de payload size | Baixa | `req.json()` sem Content-Length check | Pendente |
| Logs podem expor dados sensíveis | Média | Primeiros 500 chars do response logados | Pendente |

### 9.3 Segurança das Edge Functions

| Issue | Severidade | Detalhes | Roadmap |
|-------|-----------|----------|---------|
| CORS default wildcard | Alta | `cors.ts` aceita `*` se ALLOWED_ORIGIN ausente | R39 |
| fire-outgoing-webhook sem timeout | Média | fetch() para webhook externo pode travar | R42 |
| activate-ia webhook hardcoded | Média | URL externa fixa em `activate-ia/index.ts:76-88` | Pendente |
| sync-conversations sem transaction | Média | Contact + conversation + messages sem rollback | Pendente |
| Error responses inconsistentes | Média | Formatos variam entre funções | R67 |
| Sem audit logging em admin functions | Média | Deletes/creates sem trail | Pendente |

### 9.4 Frontend (Clients)

| Issue | Severidade | Detalhes | Roadmap |
|-------|-----------|----------|---------|
| broadcastSender.ts tipo errado | Alta | `groupjid: number` deveria ser `string` | R55 |
| normalizePhone falsos positivos | Alta | Últimos 8 dígitos pode matchear números errados | R56 |
| saveToHelpdesk duplicação de contatos | Média | Alt JID lookup pode criar duplicatas | Pendente |
| uploadCarouselImage sem extensão whitelist | Baixa | Aceita qualquer extensão de arquivo | Pendente |

### 9.5 Recomendações Priorizadas

**Imediatas (Semana 1):**
1. Adicionar timeout 30s em todos os `fetch()` do proxy e webhook
2. Validar phone numbers com regex antes de enviar para UAZAPI
3. Whitelist de protocolos (https only) em URLs de mídia
4. Corrigir tipo `groupjid` em broadcastSender.ts

**Alta Prioridade (Semana 2-3):**
5. Implementar webhook signature validation (HMAC)
6. Centralizar normalização de response UAZAPI em util function
7. Padronizar error response format em todas as edge functions
8. Corrigir normalizePhone para usar 10-11 dígitos

**Média Prioridade (Semana 4):**
9. Adicionar audit logging em admin functions
10. Wrap sync-conversations em transaction
11. Substituir URL hardcoded em activate-ia por env var

---

## 10. NOVOS ENDPOINTS v2 (uazapiGO) — Descobertos 2026-03-28

> Pesquisa via n8n-nodes-uazapi v1.0.4, docs.uazapi.com URL structure, e uazapi.dev marketing.
> **Atenção**: Estes endpoints existem na API mas NÃO estão implementados no proxy ainda.
> Docs oficiais em https://docs.uazapi.com/ são um React SPA — não scrapável (retorna só JS polyfill).

### 10.1 Novos Endpoints de Mensagens

#### `POST /send/pix-button` — Enviar botão PIX (confirmado)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "pixKey": "chave-pix@email.com",
  "type": "CPF" | "CNPJ" | "PHONE" | "EMAIL" | "EVP",
  "merchantName": "Empresa XYZ"   // opcional
}
```
**Uso**: M11 (E-commerce) — pagamento via PIX no WhatsApp

#### `POST /send/poll` — Enquete interativa (provável)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "question": "Qual produto prefere?",
  "options": ["Opção A", "Opção B", "Opção C"],
  "selectableCount": 1   // 1 = única escolha, 0 = múltipla
}
```
**Uso**: M10 (Funis) — qualificação com enquetes, M12 (Formulários)

#### `POST /send/status` (ou `/send/story`) — Postar status/story (provável)
```
Headers: { token: "<instance_token>" }
Body: {
  "type": "text" | "image" | "video",
  "content": "Promoção hoje! 20% off",
  "backgroundColor": "#128C7E",  // para type=text
  "file": "https://..."          // para image/video
}
```

### 10.2 Novos Endpoints de Mensagens (Edição/Leitura)

#### `POST /message/edit` — Editar mensagem enviada (provável)
```
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999@s.whatsapp.net",
  "messageId": "3EB0ABC123...",
  "newText": "Texto corrigido"
}
```

#### `POST /chat/read` (ou `/message/read`) — Marcar como lido (provável)
```
Headers: { token: "<instance_token>" }
Body: {
  "jid": "5511999999999@s.whatsapp.net",
  "messageId": "3EB0ABC123..."   // opcional — marca todos se omitido
}
```
**Uso**: M2 (Helpdesk) — marcar conversa como lida ao abrir

### 10.3 Novos Endpoints de Chat

#### `POST /chat/archive` — Arquivar conversa (provável)
```
Headers: { token: "<instance_token>" }
Body: { "jid": "5511999999999@s.whatsapp.net", "archive": true }
```

#### `POST /chat/pin` — Fixar conversa (provável)
```
Headers: { token: "<instance_token>" }
Body: { "jid": "5511999999999@s.whatsapp.net", "pin": true }
```

#### `POST /chat/mute` — Silenciar conversa (provável)
```
Headers: { token: "<instance_token>" }
Body: {
  "jid": "5511999999999@s.whatsapp.net",
  "mute": true,
  "duration": 3600   // segundos (0 = permanente)
}
```

### 10.4 Gestão de Campanhas (provável — n8n node v1.0.4)

#### `POST /campaign/create` — Criar campanha de disparo em massa
```
Headers: { token: "<instance_token>" }
Body: {
  "name": "Black Friday 2026",
  "numbers": ["5511999999999", "5511888888888"],
  "message": "Promoção especial!",
  "delay": 5000,   // ms entre mensagens (anti-ban)
  "type": "text" | "media"
}
```

#### `POST /campaign/pause` / `/campaign/resume` / `/campaign/stop`
```
Headers: { token: "<instance_token>" }
Body: { "campaignId": "uuid" }
```

#### `GET /campaign/report` — Relatório de envio
```
Headers: { token: "<instance_token>" }
Query: ?campaignId=uuid
Response: { "sent": 150, "failed": 3, "pending": 47, "total": 200 }
```
**Uso**: M3 (Broadcast) — substituir lógica atual de bulk send manual

### 10.5 Gestão de Labels (provável — n8n node v1.0.4)

#### `POST /label/create` — Criar label
```
Headers: { token: "<instance_token>" }
Body: { "name": "Cliente VIP", "color": "#FF6B6B" }
```

#### `GET /label/list` — Listar labels da instância
```
Headers: { token: "<instance_token>" }
Response: [{ "id": "...", "name": "Cliente VIP", "color": "#FF6B6B" }]
```

#### `POST /label/add` — Adicionar label a chat
```
Headers: { token: "<instance_token>" }
Body: { "jid": "5511999999999@s.whatsapp.net", "labelId": "..." }
```

### 10.6 Arquitetura v1 → v2 (histórico)
| | v1 (Baileys) | v2 (uazapiGO) — ATUAL |
|---|---|---|
| **Linguagem** | Node.js | Go |
| **WA Client** | Baileys (não-oficial) | API comercial |
| **Anti-ban** | Não incluso | Residential proxies built-in |
| **Lançamento** | ~2022 | Setembro 2024 |
| **Status** | ❌ Deprecated | ✅ Ativo |
| **Endpoints** | ~30 | 90+ |

### 10.7 Pricing Atual (2026)
| Plano | Preço | Dispositivos |
|---|---|---|
| Basic | R$ 38/mês | 2 |
| Lite | R$ 138/mês | 100 |
| Pro | R$ 195/mês | 300 |

Todos incluem: mensagens ilimitadas, webhooks, proxies residenciais, 90+ endpoints.

### 10.8 Actions a Adicionar ao Proxy (priorizadas)
| Action | Endpoint | Módulo | Prioridade |
|---|---|---|---|
| `send-pix-button` | `POST /send/pix-button` | M11 | 🔴 Crítico |
| `send-poll` | `POST /send/poll` | M10, M12 | 🔴 Crítico |
| `chat-read` | `POST /chat/read` | M2 | 🟡 Médio |
| `message-edit` | `POST /message/edit` | M2 | 🟡 Médio |
| `campaign-create` | `POST /campaign/create` | M3 | 🟡 Médio |
| `label-list` | `GET /label/list` | M2 | 🟢 Baixo |
