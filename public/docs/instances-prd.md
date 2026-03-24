# PRD — Módulo de Instâncias WhatsApp (WsmartQR)

**Versão:** 1.1  
**Data:** 2026-03-02  
**Status:** Implementado

---

## 1. Visão Geral

O módulo de Instâncias é o núcleo de conexão do WsmartQR com o WhatsApp. Cada instância representa uma sessão ativa de WhatsApp conectada via API UAZAPI, permitindo envio/recebimento de mensagens, gerenciamento de grupos e operações de broadcast.

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
- **Proxy:** Edge Function \`uazapi-proxy\` (centraliza chamadas à UAZAPI)

### 2.2 Diagrama de Fluxo

\`\`\`
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
\`\`\`

### 2.3 Segurança — Resolução de Tokens

> **IMPORTANTE (v1.1):** O frontend **nunca** envia tokens diretamente. Todas as chamadas ao \`uazapi-proxy\` utilizam \`instance_id\` como referência. O proxy resolve o token server-side via \`supabase.service_role\`, garantindo que tokens sensíveis não trafeguem pelo cliente.

---

## 3. Modelo de Dados

### 3.1 Tabela: \`instances\`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| \`id\` | \`text\` | Não | — | ID da instância na UAZAPI (PK) |
| \`name\` | \`text\` | Não | — | Nome da instância |
| \`token\` | \`text\` | Não | — | Token de autenticação da UAZAPI (resolvido server-side) |
| \`status\` | \`text\` | Não | \`'disconnected'\` | \`connected\` \\| \`disconnected\` |
| \`disabled\` | \`boolean\` | Não | \`false\` | Soft-delete flag |
| \`owner_jid\` | \`text\` | Sim | \`null\` | JID do proprietário (ex: \`558199669495@s.whatsapp.net\`) |
| \`profile_pic_url\` | \`text\` | Sim | \`null\` | URL da foto de perfil do WhatsApp |
| \`user_id\` | \`uuid\` | Não | — | ID do usuário proprietário |
| \`created_at\` | \`timestamptz\` | Não | \`now()\` | Data de criação |
| \`updated_at\` | \`timestamptz\` | Não | \`now()\` | Última atualização |

### 3.2 Tabela: \`user_instance_access\`

Controle de acesso many-to-many.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| \`id\` | \`uuid\` | Não | \`gen_random_uuid()\` | PK |
| \`user_id\` | \`uuid\` | Não | — | ID do usuário |
| \`instance_id\` | \`text\` | Não | — | ID da instância |
| \`created_at\` | \`timestamptz\` | Não | \`now()\` | Data de atribuição |

### 3.3 Tabela: \`instance_connection_logs\`

Histórico de eventos de conexão/desconexão.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| \`id\` | \`uuid\` | Não | \`gen_random_uuid()\` | PK |
| \`instance_id\` | \`text\` | Não | — | ID da instância |
| \`event_type\` | \`text\` | Não | — | \`connected\` \\| \`disconnected\` \\| \`created\` |
| \`description\` | \`text\` | Sim | — | Descrição do evento |
| \`metadata\` | \`jsonb\` | Sim | \`'{}'\` | Dados adicionais |
| \`user_id\` | \`uuid\` | Sim | — | Usuário que disparou o evento |
| \`created_at\` | \`timestamptz\` | Não | \`now()\` | Data do evento |

### 3.4 Trigger: \`log_instance_status_change\`

Trigger \`BEFORE UPDATE\` na tabela \`instances\` que registra automaticamente mudanças de status.

\`\`\`sql
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
\`\`\`

---

## 4. Políticas de Segurança (RLS)

### 4.1 \`instances\`

| Operação | Política | Condição |
|----------|----------|----------|
| SELECT | Users can view assigned instances | \`is_super_admin(uid) OR EXISTS(user_instance_access)\` |
| INSERT | Super admin can insert instances | \`is_super_admin(uid)\` |
| UPDATE | Users can update assigned instances | \`is_super_admin(uid) OR EXISTS(user_instance_access)\` |
| DELETE | Super admin can delete instances | \`is_super_admin(uid)\` |

### 4.2 \`user_instance_access\`

| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admin can manage all access | \`is_super_admin(uid)\` |
| SELECT | Users can view own access | \`auth.uid() = user_id\` |

### 4.3 \`instance_connection_logs\`

| Operação | Política | Condição |
|----------|----------|----------|
| SELECT | View logs of assigned instances | \`is_super_admin(uid) OR EXISTS(user_instance_access)\` |
| INSERT | Insert logs for assigned instances | \`is_super_admin(uid) OR EXISTS(user_instance_access)\` |
| UPDATE | ❌ Bloqueado | — |
| DELETE | ❌ Bloqueado | — |

---

## 5. Edge Function: \`uazapi-proxy\`

Proxy autenticado que centraliza todas as chamadas à API UAZAPI.

**URL:** \`POST /functions/v1/uazapi-proxy\`

**Headers obrigatórios:**
\`\`\`
Authorization: Bearer <jwt_token>
Content-Type: application/json
\`\`\`

**Resolução de token (v1.1):**
O frontend envia \`instance_id\` no body. O proxy usa \`supabase.service_role\` para buscar o token da instância no banco de dados, eliminando a necessidade de enviar tokens pelo cliente.

### 5.1 Endpoints (Actions)

#### \`action: "list"\` — Listar Todas as Instâncias

\`\`\`json
{ "action": "list" }
\`\`\`

UAZAPI: \`GET /instance/all\` com \`admintoken\`

#### \`action: "connect"\` — Conectar / Gerar QR Code

\`\`\`json
{
  "action": "connect",
  "instanceName": "Suporte - João",
  "instance_id": "inst_abc123"
}
\`\`\`

UAZAPI: \`POST /instance/connect\`

#### \`action: "status"\` — Verificar Status

\`\`\`json
{
  "action": "status",
  "instance_id": "inst_abc123"
}
\`\`\`

UAZAPI: \`GET /instance/status\`

#### \`action: "groups"\` — Listar Grupos

\`\`\`json
{
  "action": "groups",
  "instance_id": "inst_abc123"
}
\`\`\`

UAZAPI: \`GET /group/list?noparticipants=false\`

#### \`action: "group-info"\` — Informações do Grupo

\`\`\`json
{
  "action": "group-info",
  "instance_id": "inst_abc123",
  "groupjid": "120363123456789@g.us"
}
\`\`\`

UAZAPI: \`POST /group/info\`

#### \`action: "send-message"\` — Enviar Mensagem de Texto

\`\`\`json
{
  "action": "send-message",
  "instance_id": "inst_abc123",
  "groupjid": "120363123456789@g.us",
  "message": "Olá grupo!"
}
\`\`\`

UAZAPI: \`POST /send/text\`

#### \`action: "send-media"\` — Enviar Mídia

\`\`\`json
{
  "action": "send-media",
  "instance_id": "inst_abc123",
  "groupjid": "120363123456789@g.us",
  "mediaUrl": "https://...",
  "mediaType": "image",
  "caption": "Legenda",
  "filename": "doc.pdf"
}
\`\`\`

UAZAPI: \`POST /send/media\`

#### \`action: "send-carousel"\` — Enviar Carrossel

\`\`\`json
{
  "action": "send-carousel",
  "instance_id": "inst_abc123",
  "groupjid": "120363123456789@g.us",
  "message": "Confira:",
  "carousel": [
    {
      "text": "Card 1",
      "image": "https://...",
      "buttons": [
        { "text": "Saiba mais", "type": "URL", "url": "https://..." },
        { "text": "Ligar", "type": "CALL", "phone": "5581999999999" },
        { "text": "Responder", "type": "REPLY", "id": "reply_1" },
        { "text": "Copiar", "type": "COPY", "id": "ABC123" }
      ]
    }
  ]
}
\`\`\`

Retry: até 4 variações de payload em caso de erro.

#### \`action: "send-chat"\` — Enviar Texto para Contato

\`\`\`json
{
  "action": "send-chat",
  "instance_id": "inst_abc123",
  "jid": "558199669495@s.whatsapp.net",
  "message": "Olá!"
}
\`\`\`

#### \`action: "send-audio"\` — Enviar Áudio/PTT

\`\`\`json
{
  "action": "send-audio",
  "instance_id": "inst_abc123",
  "jid": "558199669495@s.whatsapp.net",
  "audio": "data:audio/ogg;base64,..."
}
\`\`\`

#### \`action: "check-numbers"\` — Verificar Números no WhatsApp

\`\`\`json
{
  "action": "check-numbers",
  "instance_id": "inst_abc123",
  "phones": ["5581999991111", "5581999992222"]
}
\`\`\`

#### \`action: "resolve-lids"\` — Enriquecer Participantes

\`\`\`json
{
  "action": "resolve-lids",
  "instance_id": "inst_abc123",
  "groupJids": ["120363123456789@g.us"]
}
\`\`\`

#### \`action: "download-media"\` — Proxy de Download de Mídia

\`\`\`json
{
  "action": "download-media",
  "fileUrl": "https://uazapi.server/files/...",
  "instanceId": "inst_abc123"
}
\`\`\`

---

## 6. Interface do Usuário

### 6.1 Página: Listagem de Instâncias (\`/dashboard/instances\`)

| Feature | Descrição |
|---------|-----------|
| Grid de Cards | Avatar, nome, telefone, status, badge de proprietário |
| Busca | Filtro por nome ou email do proprietário |
| Criar Instância | Dialog com nome + seleção de usuário (Super Admin) |
| Sincronizar | Importa instâncias da UAZAPI com atribuição de usuário |
| QR Code Modal | QR Code com polling de 5s para detecção de conexão |
| Polling de Status | Atualiza status de todas as instâncias a cada 30s |
| Gerenciar Acesso | Atribui/revoga acesso de usuários (Super Admin) |
| Excluir | Soft-delete (disabled=true) da instância (Super Admin) |

### 6.2 Página: Detalhes (\`/dashboard/instances/:id\`)

| Aba | Componente | Descrição |
|-----|-----------|-----------|
| Visão Geral | \`InstanceOverview\` | Nome, status, telefone, ID, proprietário |
| Grupos | \`InstanceGroups\` | Lista de grupos com busca e participantes |
| Estatísticas | \`InstanceStats\` | Totais, tempo de vida, última atividade |
| Histórico | \`InstanceHistory\` | Timeline de eventos de conexão |

### 6.3 Componentes Auxiliares

| Componente | Arquivo |
|-----------|---------|
| \`InstanceCard\` | \`src/components/dashboard/InstanceCard.tsx\` |
| \`SyncInstancesDialog\` | \`src/components/dashboard/SyncInstancesDialog.tsx\` |
| \`ManageInstanceAccessDialog\` | \`src/components/dashboard/ManageInstanceAccessDialog.tsx\` |
| \`InstanceFilterSelect\` | \`src/components/dashboard/InstanceFilterSelect.tsx\` |

---

## 7. Fluxos de Operação

### 7.1 Criar Nova Instância
1. Super Admin clica "Nova Instância"
2. Preenche nome e seleciona usuário
3. Frontend gera token aleatório (32 chars)
4. Chama uazapi-proxy (action: "connect") com instanceName + instance_id
5. Salva no banco: instances + user_instance_access
6. Se QR Code retornado → abre modal com polling de 5s
7. Quando conectado → atualiza status no banco

### 7.2 Sincronizar Instâncias da UAZAPI
1. Super Admin abre dialog de sincronização
2. Sistema busca: instâncias da UAZAPI + instâncias locais + usuários
3. Compara IDs → identifica: novas, já sincronizadas, órfãs
4. Super Admin seleciona novas instâncias e atribui usuários
5. Insere em instances + user_instance_access
6. (Opcional) Remove instâncias órfãs + dados relacionados

### 7.3 Conectar via QR Code
1. Usuário clica "Conectar" no card
2. Chama uazapi-proxy (action: "connect")
3. Extrai QR Code da resposta → exibe no modal
4. Inicia polling de 5s (action: "status")
5. Quando status === "connected" → fecha modal + atualiza
6. Trigger grava evento no histórico

### 7.4 Exclusão com Limpeza de Órfãs
1. Dialog de sync detecta instâncias locais sem correspondência na UAZAPI
2. Super Admin seleciona órfãs para remoção
3. Sistema remove: user_instance_access → scheduled_messages → instances
4. Dispara evento 'instances-updated'

---

## 8. Secrets / Variáveis de Ambiente

| Secret | Descrição | Uso |
|--------|-----------|-----|
| \`UAZAPI_SERVER_URL\` | URL do servidor UAZAPI | Edge Function uazapi-proxy |
| \`UAZAPI_ADMIN_TOKEN\` | Token administrativo da UAZAPI | Listar todas as instâncias |
| \`SUPABASE_URL\` | URL do projeto Supabase | Edge Functions |
| \`SUPABASE_ANON_KEY\` | Chave anon do Supabase | Edge Functions |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Chave service role | Resolução de tokens (bypass RLS) |

---

## 9. Rotas

| Rota | Componente |
|------|-----------|
| \`/dashboard/instances\` | \`Instances\` |
| \`/dashboard/instances/:id\` | \`InstanceDetails\` |
| \`/dashboard/instances/:id/groups/:groupId\` | \`GroupDetails\` |

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
| Status geral | 30s | Atualiza via \`action: "list"\` |
| QR Code polling | 5s | Verifica conexão via \`action: "status"\` |

---

## 12. Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Token UAZAPI inválido | Toast de erro |
| Instância não encontrada | 404 + mensagem |
| Sessão expirada | 401 + redireção para login |
| UAZAPI offline | Toast de erro + retry manual |
| QR Code expirado | Botão "Gerar novo QR" |
| Resposta não-JSON | Encapsulado como \`{ raw: "..." }\` |

---

## 13. Considerações Técnicas

### 13.1 Owner JID
O \`owner_jid\` pode ser armazenado com ou sem o sufixo \`@s.whatsapp.net\`. Buscas normalizam ambas as formas.

### 13.2 Formato de Resposta da UAZAPI
A UAZAPI retorna dados em formatos variados (PascalCase/camelCase, arrays diretos/encapsulados). O proxy normaliza automaticamente.

### 13.3 Instâncias Órfãs
Detectadas durante sincronização — podem ser removidas em cascata.

### 13.4 Segurança do Token (v1.1)
- Tokens resolvidos exclusivamente server-side via \`instance_id\`
- Frontend nunca recebe nem envia tokens de instância
- Proxy usa \`supabase.service_role\` para buscar token no banco
- Protegidos por RLS no banco de dados