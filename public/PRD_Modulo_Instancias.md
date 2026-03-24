# PRD — Módulo de Instâncias WhatsApp (WhatsPRO)

**Versão:** 2.0
**Data:** 2026-03-21
**Status:** Implementado
**API WhatsApp:** UAZAPI v2 (wsmart.uazapi.com) — API definitiva do projeto

---

## 1. Visão Geral

O módulo de Instâncias é o núcleo de conexão do WhatsPRO com o WhatsApp. Cada instância representa uma sessão ativa de WhatsApp conectada via API UAZAPI, permitindo envio/recebimento de mensagens, gerenciamento de grupos e operações de broadcast.

### 1.1 Objetivos
- Conectar e gerenciar múltiplas sessões de WhatsApp simultaneamente
- Permitir atribuição granular de instâncias a usuários (multi-tenancy)
- Sincronizar instâncias existentes da UAZAPI com o sistema local
- Monitorar status de conexão em tempo real
- Detectar e limpar instâncias órfãs

---

## 2. Arquitetura

### 2.1 Stack Tecnológico
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **API Externa:** UAZAPI (servidor WhatsApp)
- **Proxy:** Edge Function `uazapi-proxy` (centraliza chamadas à UAZAPI)

### 2.2 Diagrama de Fluxo

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│  uazapi-proxy    │────▶│   UAZAPI     │
│  (React)     │◀────│  (Edge Function) │◀────│  (WhatsApp)  │
└──────┬───────┘     └──────────────────┘     └──────────────┘
       │
       │ Supabase SDK
       ▼
┌──────────────┐
│  PostgreSQL  │
│  (instances, │
│  user_access)│
└──────────────┘
```

---

## 3. Modelo de Dados

### 3.1 Tabela: `instances`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `text` | Não | — | ID da instância na UAZAPI (PK) |
| `name` | `text` | Não | — | Nome da instância |
| `token` | `text` | Não | — | Token de autenticação da UAZAPI |
| `status` | `text` | Não | `'disconnected'` | `connected` \| `disconnected` |
| `owner_jid` | `text` | Sim | `null` | JID do proprietário (ex: `558199669495` ou `558199669495@s.whatsapp.net`) |
| `profile_pic_url` | `text` | Sim | `null` | URL da foto de perfil do WhatsApp |
| `user_id` | `uuid` | Não | — | ID do usuário proprietário (referência lógica a `auth.users`) |
| `created_at` | `timestamptz` | Não | `now()` | Data de criação |
| `updated_at` | `timestamptz` | Não | `now()` | Última atualização |

**Índices:** PK em `id`

### 3.2 Tabela: `user_instance_access`

Controle de acesso many-to-many (uma instância pode ser acessada por múltiplos usuários).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | Não | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | Não | — | ID do usuário |
| `instance_id` | `text` | Não | — | ID da instância |
| `created_at` | `timestamptz` | Não | `now()` | Data de atribuição |

### 3.3 Tabela: `instance_connection_logs`

Histórico de eventos de conexão/desconexão.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | Não | `gen_random_uuid()` | PK |
| `instance_id` | `text` | Não | — | ID da instância |
| `event_type` | `text` | Não | — | `connected` \| `disconnected` \| `created` |
| `description` | `text` | Sim | — | Descrição do evento |
| `metadata` | `jsonb` | Sim | `'{}'` | Dados adicionais (`old_status`, `new_status`, `owner_jid`) |
| `user_id` | `uuid` | Sim | — | Usuário que disparou o evento |
| `created_at` | `timestamptz` | Não | `now()` | Data do evento |

### 3.4 Trigger: `log_instance_status_change`

Trigger `BEFORE UPDATE` na tabela `instances` que registra automaticamente mudanças de status em `instance_connection_logs`.

```sql
CREATE OR REPLACE FUNCTION public.log_instance_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.instance_connection_logs (instance_id, event_type, description, metadata, user_id)
    VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'connected' THEN 'connected' ELSE 'disconnected' END,
      CASE WHEN NEW.status = 'connected' THEN 'Conectado ao WhatsApp' ELSE 'Desconectado do WhatsApp' END,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'owner_jid', NEW.owner_jid),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Políticas de Segurança (RLS)

### 4.1 `instances`

| Operação | Política | Condição |
|----------|----------|----------|
| SELECT | Users can view assigned instances | `is_super_admin(uid) OR EXISTS(user_instance_access)` |
| INSERT | Super admin can insert instances | `is_super_admin(uid)` |
| UPDATE | Users can update assigned instances | `is_super_admin(uid) OR EXISTS(user_instance_access)` |
| DELETE | Super admin can delete instances | `is_super_admin(uid)` |

### 4.2 `user_instance_access`

| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admin can manage all access | `is_super_admin(uid)` |
| SELECT | Users can view own access | `auth.uid() = user_id` |

### 4.3 `instance_connection_logs`

| Operação | Política | Condição |
|----------|----------|----------|
| SELECT | Users can view logs of assigned instances | `is_super_admin(uid) OR EXISTS(user_instance_access)` |
| INSERT | Users can insert logs for assigned instances | `is_super_admin(uid) OR EXISTS(user_instance_access)` |
| UPDATE | ❌ Bloqueado | — |
| DELETE | ❌ Bloqueado | — |

---

## 5. Edge Function: `uazapi-proxy`

Proxy autenticado que centraliza todas as chamadas à API UAZAPI. Requer autenticação JWT.

**URL:** `POST /functions/v1/uazapi-proxy`

**Headers obrigatórios:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 5.1 Endpoints (Actions)

---

#### `action: "list"` — Listar Todas as Instâncias

Lista todas as instâncias registradas no servidor UAZAPI.

**Request Body:**
```json
{ "action": "list" }
```

**UAZAPI Endpoint:** `GET /instance/all`  
**Headers UAZAPI:** `admintoken: <UAZAPI_ADMIN_TOKEN>`, `token: <UAZAPI_ADMIN_TOKEN>`

**Response (200):**
```json
[
  {
    "id": "inst_abc123",
    "instanceName": "Suporte - João",
    "token": "abc123xyz...",
    "connectionStatus": "connected",
    "ownerJid": "558199669495@s.whatsapp.net",
    "profilePicUrl": "https://...",
    "profileName": "João Silva"
  }
]
```

**Uso:** Sincronização de status, importação de instâncias, detecção de órfãs.

---

#### `action: "connect"` — Conectar / Gerar QR Code

Conecta uma instância existente ou gera QR Code para pareamento.

**Request Body:**
```json
{
  "action": "connect",
  "instanceName": "Suporte - João",
  "token": "<instance_token>"
}
```

**UAZAPI Endpoint:** `POST /instance/connect`  
**Headers UAZAPI:** `token: <instance_token>`  
**Body UAZAPI:** `{}`

**Response (200) — QR Code gerado:**
```json
{
  "instance": {
    "qrcode": "data:image/png;base64,iVBOR...",
    "status": "pending"
  }
}
```

**Response (200) — Já conectado:**
```json
{
  "instance": {
    "status": "connected"
  }
}
```

**Lógica de extração de QR Code no frontend:**
1. `data.instance.qrcode`
2. `data.qrcode`
3. `data.base64`

**Lógica de detecção de conexão:**
1. `data.instance.status === 'connected'`
2. `data.status === 'connected'`
3. `data.status.connected === true`
4. `data.loggedIn === true`

---

#### `action: "status"` — Verificar Status

Consulta o status atual de uma instância.

**Request Body:**
```json
{
  "action": "status",
  "token": "<instance_token>"
}
```

**UAZAPI Endpoint:** `GET /instance/status`  
**Headers UAZAPI:** `token: <instance_token>`

**Response (200):**
```json
{
  "status": "connected",
  "loggedIn": true
}
```

**Uso:** Polling de 5s durante pareamento QR Code, polling de 30s para atualização geral.

---

#### `action: "groups"` — Listar Grupos

Lista todos os grupos dos quais a instância participa.

**Request Body:**
```json
{
  "action": "groups",
  "token": "<instance_token>"
}
```

**UAZAPI Endpoint:** `GET /group/list?noparticipants=false`  
**Headers UAZAPI:** `token: <instance_token>`

**Response (200):**
```json
[
  {
    "JID": "120363123456789@g.us",
    "Name": "Grupo de Vendas",
    "Subject": "Vendas 2026",
    "PictureUrl": "https://...",
    "ParticipantCount": 45,
    "Participants": [
      {
        "JID": "558199669495@s.whatsapp.net",
        "PhoneNumber": "558199669495@s.whatsapp.net",
        "PushName": "João",
        "IsAdmin": true,
        "IsSuperAdmin": false
      }
    ]
  }
]
```

**Normalização no proxy:** Sempre retorna array (desencapsula `{ groups: [...] }` ou `{ data: [...] }`).

---

#### `action: "group-info"` — Informações do Grupo

Obtém informações detalhadas de um grupo específico com lista completa de participantes.

**Request Body:**
```json
{
  "action": "group-info",
  "token": "<instance_token>",
  "groupjid": "120363123456789@g.us"
}
```

**UAZAPI Endpoint:** `POST /group/info`  
**Headers UAZAPI:** `token: <instance_token>`

**Response (200):**
```json
{
  "JID": "120363123456789@g.us",
  "Name": "Grupo de Vendas",
  "Participants": [
    {
      "JID": "558199669495@s.whatsapp.net",
      "PhoneNumber": "558199669495@s.whatsapp.net",
      "PushName": "João",
      "IsAdmin": true,
      "IsSuperAdmin": false
    }
  ]
}
```

---

#### `action: "send-message"` — Enviar Mensagem de Texto

Envia mensagem de texto para um grupo.

**Request Body:**
```json
{
  "action": "send-message",
  "token": "<instance_token>",
  "groupjid": "120363123456789@g.us",
  "message": "Olá grupo!"
}
```

**UAZAPI Endpoint:** `POST /send/text`  
**Body UAZAPI:** `{ "number": "<groupjid>", "text": "<message>" }`

**Validações:**
- Mensagem não pode ser vazia
- Máximo 4096 caracteres

---

#### `action: "send-media"` — Enviar Mídia

Envia imagem ou documento para grupo/contato.

**Request Body:**
```json
{
  "action": "send-media",
  "token": "<instance_token>",
  "groupjid": "120363123456789@g.us",
  "mediaUrl": "https://... ou data:image/png;base64,...",
  "mediaType": "image",
  "caption": "Legenda da imagem",
  "filename": "documento.pdf"
}
```

**UAZAPI Endpoint:** `POST /send/media`  
**Body UAZAPI:**
```json
{
  "number": "<groupjid>",
  "type": "image|document",
  "file": "<url_ou_base64>",
  "text": "<caption>",
  "docName": "<filename>"
}
```

**Nota:** Base64 é automaticamente limpo (remove prefixo `data:...;base64,`).

---

#### `action: "send-carousel"` — Enviar Carrossel

Envia mensagem de carrossel com cards interativos.

**Request Body:**
```json
{
  "action": "send-carousel",
  "token": "<instance_token>",
  "groupjid": "120363123456789@g.us",
  "message": "Confira nossas opções:",
  "carousel": [
    {
      "text": "Card 1",
      "image": "https://... ou base64",
      "buttons": [
        { "text": "Saiba mais", "type": "URL", "url": "https://..." },
        { "text": "Ligar", "type": "CALL", "phone": "5581999999999" },
        { "text": "Responder", "type": "REPLY", "id": "reply_1" },
        { "text": "Copiar código", "type": "COPY", "id": "ABC123" }
      ]
    }
  ]
}
```

**UAZAPI Endpoint:** `POST /send/carousel`

**Tipos de botão suportados:**
| Tipo | Campo `id` | Descrição |
|------|-----------|-----------|
| `URL` | URL completa | Abre link |
| `CALL` | Número de telefone | Inicia chamada |
| `REPLY` | Texto de resposta | Resposta rápida |
| `COPY` | Texto a copiar | Copia para clipboard |

**Lógica de retry:** Tenta até 4 variações de payload (`groupjid`, `chatId`, `phone`, `number`) em caso de erro "Missing required fields".

---

#### `action: "send-chat"` — Enviar Texto para Contato Individual

Usado pelo módulo Helpdesk para enviar mensagens a contatos individuais.

**Request Body:**
```json
{
  "action": "send-chat",
  "token": "<instance_token>",
  "jid": "558199669495@s.whatsapp.net",
  "message": "Olá, como posso ajudar?"
}
```

**UAZAPI Endpoint:** `POST /send/text`  
**Body UAZAPI:** `{ "number": "<jid>", "text": "<message>" }`

---

#### `action: "send-audio"` — Enviar Áudio/PTT

Envia mensagem de voz (Push-to-Talk).

**Request Body:**
```json
{
  "action": "send-audio",
  "token": "<instance_token>",
  "jid": "558199669495@s.whatsapp.net",
  "audio": "data:audio/ogg;base64,..."
}
```

**UAZAPI Endpoint:** `POST /send/media`  
**Body UAZAPI:** `{ "number": "<jid>", "type": "ptt", "file": "<base64>" }`

---

#### `action: "check-numbers"` — Verificar Números no WhatsApp

Verifica se uma lista de telefones está registrada no WhatsApp.

**Request Body:**
```json
{
  "action": "check-numbers",
  "token": "<instance_token>",
  "phones": ["5581999991111", "5581999992222"]
}
```

**UAZAPI Endpoint:** `POST /chat/check`  
**Body UAZAPI:** `{ "numbers": [...] }`

**Response (200):**
```json
{
  "users": [
    { "query": "5581999991111", "isInWhatsapp": true, "jid": "5581999991111@s.whatsapp.net" },
    { "query": "5581999992222", "isInWhatsapp": false }
  ]
}
```

---

#### `action: "resolve-lids"` — Enriquecer Participantes de Grupos

Busca informações completas de participantes (substituindo LIDs por números reais via `/group/info`).

**Request Body:**
```json
{
  "action": "resolve-lids",
  "token": "<instance_token>",
  "groupJids": ["120363123456789@g.us"]
}
```

**Response (200):**
```json
{
  "groupParticipants": {
    "120363123456789@g.us": [
      {
        "jid": "558199669495@s.whatsapp.net",
        "phone": "558199669495",
        "name": "João",
        "isAdmin": true,
        "isSuperAdmin": false,
        "isLid": false
      }
    ]
  }
}
```

---

#### `action: "download-media"` — Proxy de Download de Mídia

Faz proxy autenticado para download de arquivos de mídia do UAZAPI.

**Request Body:**
```json
{
  "action": "download-media",
  "fileUrl": "https://uazapi.server/files/...",
  "instanceId": "inst_abc123"
}
```

**Response:** Stream binário do arquivo com `Content-Type` original.

**Nota:** Busca o token da instância via `service_role` no banco.

---

## 6. Interface do Usuário

### 6.1 Página: Listagem de Instâncias (`/dashboard/instances`)

**Componente:** `src/pages/dashboard/Instances.tsx`

| Feature | Descrição |
|---------|-----------|
| Grid de Cards | Cards com avatar, nome, telefone, status, badge de proprietário |
| Busca | Filtro por nome ou email do proprietário |
| Criar Instância | Dialog com nome + seleção de usuário (Super Admin) |
| Sincronizar | Importa instâncias da UAZAPI com atribuição de usuário |
| QR Code Modal | Exibe QR Code com polling de 5s para detecção de conexão |
| Polling de Status | Atualiza status de todas as instâncias a cada 30s |
| Gerenciar Acesso | Atribui/revoga acesso de usuários (Super Admin) |
| Excluir | Remove instância do banco (Super Admin) |

### 6.2 Página: Detalhes da Instância (`/dashboard/instances/:id`)

**Componente:** `src/pages/dashboard/InstanceDetails.tsx`

**Abas disponíveis:**

| Aba | Componente | Descrição |
|-----|-----------|-----------|
| Visão Geral | `InstanceOverview` | Nome, status, telefone, ID, token (oculto), proprietário, datas, botão conectar QR |
| Grupos | `InstanceGroups` | Lista de grupos com busca, contagem de participantes, navegação para detalhes |
| Estatísticas | `InstanceStats` | Total de grupos, participantes, tempo de vida, última atividade |
| Histórico | `InstanceHistory` | Timeline de eventos de conexão/desconexão com metadados |

### 6.3 Componentes Auxiliares

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `InstanceCard` | `src/components/dashboard/InstanceCard.tsx` | Card individual com avatar, status badge, ações |
| `SyncInstancesDialog` | `src/components/dashboard/SyncInstancesDialog.tsx` | Dialog de sincronização com UAZAPI + detecção de órfãs |
| `ManageInstanceAccessDialog` | `src/components/dashboard/ManageInstanceAccessDialog.tsx` | Dialog de gerenciamento de acesso multi-usuário |
| `InstanceFilterSelect` | `src/components/dashboard/InstanceFilterSelect.tsx` | Dropdown de filtro por instância (usado em outros módulos) |

---

## 7. Fluxos de Operação

### 7.1 Criar Nova Instância

```
1. Super Admin clica "Nova Instância"
2. Preenche nome e seleciona usuário
3. Frontend gera token aleatório (32 chars)
4. Chama uazapi-proxy (action: "connect") com instanceName + token
5. Salva no banco: instances + user_instance_access
6. Se QR Code retornado → abre modal com polling de 5s
7. Quando conectado → atualiza status no banco
```

### 7.2 Sincronizar Instâncias da UAZAPI

```
1. Super Admin abre dialog de sincronização
2. Sistema busca: instâncias da UAZAPI + instâncias locais + usuários
3. Compara IDs → identifica: novas, já sincronizadas, órfãs
4. Super Admin seleciona novas instâncias e atribui usuários
5. Insere em instances + user_instance_access
6. (Opcional) Remove instâncias órfãs + dados relacionados
```

### 7.3 Conectar via QR Code

```
1. Usuário clica "Conectar" no card da instância
2. Chama uazapi-proxy (action: "connect")
3. Extrai QR Code da resposta → exibe no modal
4. Inicia polling de 5s (action: "status")
5. Quando status === "connected" → fecha modal + atualiza instância
6. Trigger log_instance_status_change grava evento no histórico
```

### 7.4 Exclusão com Limpeza de Instâncias Órfãs

```
1. Dialog de sync detecta instâncias locais sem correspondência na UAZAPI
2. Super Admin seleciona órfãs para remoção
3. Sistema remove: user_instance_access → scheduled_messages → instances
4. Dispara evento 'instances-updated' para atualizar sidebar
```

### 7.5 Gerenciar Acesso Multi-Usuário

```
1. Super Admin clica "Gerenciar Acesso" no card
2. Dialog lista todos os usuários com checkboxes
3. Super Admins aparecem marcados e desabilitados (acesso automático via RLS)
4. Ao salvar: diff entre estado atual e desejado → insert/delete em user_instance_access
```

---

## 8. Secrets / Variáveis de Ambiente

| Secret | Descrição | Uso |
|--------|-----------|-----|
| `UAZAPI_SERVER_URL` | URL do servidor UAZAPI (ex: `https://wsmart.uazapi.com`) | Edge Function uazapi-proxy |
| `UAZAPI_ADMIN_TOKEN` | Token administrativo da UAZAPI | Listar todas as instâncias |
| `SUPABASE_URL` | URL do projeto Supabase | Edge Functions |
| `SUPABASE_ANON_KEY` | Chave anon do Supabase | Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role | Download de mídia (bypass RLS) |

---

## 9. Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/dashboard/instances` | `Instances` | Listagem de instâncias |
| `/dashboard/instances/:id` | `InstanceDetails` | Detalhes com abas |
| `/dashboard/instances/:id/groups/:groupId` | `GroupDetails` | Detalhes de um grupo específico |

---

## 10. Permissões por Role

| Ação | Super Admin | User (com acesso) | User (sem acesso) |
|------|-------------|--------------------|--------------------|
| Ver instâncias | ✅ Todas | ✅ Atribuídas | ❌ |
| Criar instância | ✅ | ❌ | ❌ |
| Excluir instância | ✅ | ❌ | ❌ |
| Conectar QR Code | ✅ | ✅ | ❌ |
| Atualizar status | ✅ | ✅ | ❌ |
| Ver grupos | ✅ | ✅ | ❌ |
| Enviar mensagens | ✅ | ✅ | ❌ |
| Sincronizar UAZAPI | ✅ | ❌ | ❌ |
| Gerenciar acesso | ✅ | ❌ | ❌ |
| Ver histórico | ✅ | ✅ | ❌ |

---

## 11. Polling e Tempo Real

| Tipo | Intervalo | Descrição |
|------|-----------|-----------|
| Status geral | 30s | Atualiza status de todas as instâncias via `action: "list"` |
| QR Code polling | 5s | Verifica se instância conectou durante pareamento via `action: "status"` |

---

## 12. Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Token UAZAPI inválido | Toast de erro "UAZAPI admin token not configured" |
| Instância não encontrada | 404 + mensagem |
| Sessão expirada | 401 + redireção para login |
| UAZAPI offline | Toast de erro + retry manual disponível |
| QR Code expirado | Botão "Gerar novo QR" no modal |
| Resposta não-JSON da UAZAPI | Encapsulado como `{ raw: "..." }` |

---

## 13. Edge Function: `activate-ia`

Função auxiliar para ativar/desativar IA em conversas do helpdesk.

**URL:** `POST /functions/v1/activate-ia`

**Request Body:**
```json
{
  "chatid": "558199669495@s.whatsapp.net",
  "phone": "558199669495",
  "instanceId": "inst_abc123"
}
```

**Comportamento:** Envia webhook para `https://fluxwebhook.wsmart.com.br/webhook/receb_out_neo` com `status_ia: "ligada"`.

---

## 14. Considerações Técnicas

### 14.1 Owner JID
O `owner_jid` pode ser armazenado com ou sem o sufixo `@s.whatsapp.net`. Todas as buscas normalizam ambas as formas para garantir compatibilidade.

### 14.2 Formato de Resposta da UAZAPI
A UAZAPI pode retornar dados em formatos variados (PascalCase/camelCase, arrays diretos/encapsulados). O proxy normaliza automaticamente.

### 14.3 Instâncias Órfãs
Instâncias locais sem correspondência na UAZAPI são detectadas durante sincronização e podem ser removidas em cascata (access + scheduled_messages + instance).

### 14.4 Segurança do Token
- Tokens de instância são gerados no frontend (32 chars alfanuméricos)
- Exibidos mascarados por padrão (input type=password)
- Nunca expostos em logs (apenas primeiros 10 chars)
- Armazenados em texto plano no banco (protegidos por RLS)
