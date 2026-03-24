# PRD — Módulo Helpdesk / Atendimento

> **Módulo:** Helpdesk  
> **Versão:** 1.0  
> **Última atualização:** 2026-03-03  
> **Responsável:** Equipe WsmartQR  

---

## 1. Visão Geral

O módulo Helpdesk é o centro de atendimento ao cliente via WhatsApp do WsmartQR. Permite que equipes de suporte gerenciem conversas em tempo real, organizadas por **caixas de entrada (inboxes)**, **departamentos** e **labels**, com suporte a múltiplos tipos de mídia, integração com IA e webhooks.

### Objetivos
- Centralizar atendimentos WhatsApp em uma interface web profissional
- Suportar múltiplas caixas de entrada (multi-inbox) e departamentos
- Integrar IA para resumos automáticos e transcrição de áudio
- Permitir atribuição de agentes, priorização e categorização via labels
- Fornecer webhooks de entrada/saída para integração com n8n e sistemas externos

### Rota principal
\`/dashboard/helpdesk\`

### Acesso
- Todos os usuários com vínculo a pelo menos uma inbox (\`inbox_users\`)
- \`super_admin\` vê todas as inboxes e conversas
- Visibilidade filtrada por departamento para \`agente\`

---

## 2. Modelo de Dados

### 2.1 conversations
Registro central de cada atendimento.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| inbox_id | UUID | — | FK → inboxes.id |
| contact_id | UUID | — | FK → contacts.id |
| status | TEXT | 'aberta' | aberta, pendente, resolvida |
| priority | TEXT | 'media' | alta, media, baixa |
| assigned_to | UUID | NULL | ID do agente atribuído |
| department_id | UUID | NULL | FK → departments.id |
| is_read | BOOLEAN | false | Lida pelo agente |
| last_message | TEXT | NULL | Preview da última mensagem |
| last_message_at | TIMESTAMPTZ | now() | Timestamp da última mensagem |
| ai_summary | JSONB | NULL | Resumo gerado por IA |
| ai_summary_expires_at | TIMESTAMPTZ | NULL | Expiração do resumo (60 dias) |
| status_ia | TEXT | NULL | Estado da IA: 'ligada', 'desligada', NULL |
| created_at | TIMESTAMPTZ | now() | — |
| updated_at | TIMESTAMPTZ | now() | — |

### 2.2 conversation_messages
Histórico de mensagens de cada conversa.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| conversation_id | UUID | — | FK → conversations.id |
| direction | TEXT | 'incoming' | incoming, outgoing, private_note |
| content | TEXT | NULL | Texto da mensagem |
| media_type | TEXT | 'text' | text, image, video, audio, document, sticker, contact, carousel |
| media_url | TEXT | NULL | URL da mídia (Storage ou UAZAPI) |
| sender_id | UUID | NULL | ID do agente (se outgoing) |
| external_id | TEXT | NULL | ID externo UAZAPI (dedupe) |
| transcription | TEXT | NULL | Transcrição de áudio (Whisper) |
| created_at | TIMESTAMPTZ | now() | — |

### 2.3 contacts
Contatos WhatsApp.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| jid | TEXT | — | JID WhatsApp (ex: 5511999999999@s.whatsapp.net) |
| phone | TEXT | — | Número limpo |
| name | TEXT | NULL | Nome do contato |
| profile_pic_url | TEXT | NULL | Foto de perfil |
| created_at | TIMESTAMPTZ | now() | — |

### 2.4 labels
Etiquetas por inbox para categorizar conversas.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| name | TEXT | — | Nome da label |
| color | TEXT | '#6366f1' | Cor hex |
| inbox_id | UUID | — | FK → inboxes.id |
| created_at | TIMESTAMPTZ | now() | — |

### 2.5 conversation_labels
Associação N:N entre conversas e labels.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| conversation_id | UUID | — | FK → conversations.id |
| label_id | UUID | — | FK → labels.id |

### 2.6 departments
Departamentos por inbox.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| name | TEXT | — | Nome |
| description | TEXT | NULL | Descrição |
| inbox_id | UUID | — | FK → inboxes.id |
| is_default | BOOLEAN | false | Departamento padrão da inbox |
| created_at | TIMESTAMPTZ | now() | — |
| updated_at | TIMESTAMPTZ | now() | — |

> **Trigger:** \`ensure_single_default_department\` garante apenas um departamento padrão por inbox.

### 2.7 department_members
Associação de agentes a departamentos.

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| department_id | UUID | — | FK → departments.id |
| user_id | UUID | — | ID do agente |
| created_at | TIMESTAMPTZ | now() | — |

---

## 3. Políticas RLS

### 3.1 conversations
- **SELECT/UPDATE:** \`has_inbox_access(auth.uid(), inbox_id)\` + filtro por departamento:
  - Se \`department_id IS NULL\`: visível a todos da inbox
  - Se \`department_id\` preenchido: \`super_admin\`, \`admin\` e \`gestor\` veem tudo; \`agente\` só vê se for membro do departamento
- **INSERT:** \`has_inbox_access(auth.uid(), inbox_id)\`
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.2 conversation_messages
- **SELECT/INSERT:** Via conversa → \`has_inbox_access(auth.uid(), c.inbox_id)\`
- **DELETE:** Apenas \`private_note\` + acesso à inbox
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.3 contacts
- **SELECT:** Via conversas acessíveis → \`has_inbox_access\`
- **INSERT:** Qualquer usuário autenticado
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.4 labels
- **SELECT:** \`has_inbox_access(auth.uid(), inbox_id)\`
- **ALL (CRUD):** \`get_inbox_role\` = admin ou gestor
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.5 conversation_labels
- **SELECT/ALL:** Via conversa → \`has_inbox_access\`
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.6 departments
- **SELECT:** \`has_inbox_access(auth.uid(), inbox_id)\`
- **ALL:** \`is_super_admin(auth.uid())\`

### 3.7 department_members
- **SELECT:** Via departamento → \`has_inbox_access\`
- **ALL:** \`is_super_admin(auth.uid())\`

---

## 4. Funções de Segurança (SECURITY DEFINER)

| Função | Parâmetros | Retorno | Uso no Helpdesk |
|--------|-----------|---------|-----------------|
| \`has_inbox_access\` | (_user_id, _inbox_id) | BOOLEAN | Verifica se usuário tem acesso à inbox |
| \`get_inbox_role\` | (_user_id, _inbox_id) | inbox_role | Retorna papel do usuário na inbox |
| \`is_inbox_member\` | (_user_id, _inbox_id) | BOOLEAN | Verifica se é membro da inbox |
| \`is_super_admin\` | (_user_id) | BOOLEAN | Bypass total de RLS |

---

## 5. Status e Fluxo de Conversas

### Status possíveis
- **aberta**: Conversa ativa, aguardando resposta
- **pendente**: Em espera por ação do agente
- **resolvida**: Atendimento concluído

### Prioridades
- **alta**: Atendimento urgente (badge vermelho)
- **media**: Padrão (badge amarelo)
- **baixa**: Baixa prioridade (badge azul)

### Fluxo de vida
\`\`\`
Webhook recebe mensagem → Cria/atualiza conversa (status: aberta)
  → Agente atende → Pode mudar status para pendente
  → Agente resolve → Muda para resolvida
  → Trigger: auto-summarize gera resumo por IA
\`\`\`

---

## 6. Edge Functions

### 6.1 whatsapp-webhook
**Endpoint:** \`/functions/v1/whatsapp-webhook\`  
**Método:** POST  
**Autenticação:** Nenhuma (webhook público)

**Fluxo completo:**
1. Recebe payload UAZAPI (suporta múltiplos formatos)
2. Detecta payload de \`status_ia\` → atualiza \`conversations.status_ia\` e broadcast
3. Valida \`EventType/eventType\` = messages, ignora grupos
4. Resolve instância → inbox via \`inboxes.instance_id\`
5. Extrai conteúdo e tipo de mídia (\`normalizeMediaType\`)
6. Busca URL de mídia persistente via \`getMediaLink\` (UAZAPI)
7. Upload de mídia não-áudio para \`helpdesk-media\` (Storage)
8. Deduplica por \`external_id\`
9. Upsert contato em \`contacts\`
10. Find/create conversa em \`conversations\`
11. Insere mensagem em \`conversation_messages\`
12. Atualiza \`last_message\`, \`last_message_at\`, \`is_read\`
13. Auto-adiciona contato a \`lead_databases\` (se existir base da instância)
14. Broadcast realtime: \`helpdesk-realtime\` (new-message) e \`helpdesk-conversations\` (new-message)
15. Dispara \`transcribe-audio\` para mensagens de áudio incoming

### 6.2 sync-conversations
**Endpoint:** \`/functions/v1/sync-conversations\`  
**Método:** POST  
**Autenticação:** Bearer JWT

**Payload:** \`{ inbox_id: string }\`

**Fluxo:**
1. Valida JWT e resolve inbox → instância → token
2. Busca chats via \`POST /chat/find\` (UAZAPI)
3. Busca mensagens via \`POST /message/find\`
4. Filtra chats individuais (não-grupo)
5. Para cada chat: upsert contato, upsert conversa, insert mensagens (dedupe por external_id)
6. Retorna \`{ synced, errors, messagesImported, total }\`

### 6.3 fire-outgoing-webhook
**Endpoint:** \`/functions/v1/fire-outgoing-webhook\`  
**Método:** POST  
**Autenticação:** Bearer JWT

**Payload:** \`{ webhook_url: string, payload: object }\`

**Segurança SSRF:**
- Apenas HTTPS permitido
- Bloqueia localhost, loopback, IPs privados (10.x, 172.16-31.x, 192.168.x)
- Bloqueia endpoints de metadados cloud (169.254.169.254, metadata.google.internal)

**Uso:** Envia dados do atendimento para n8n/IA externa via \`webhook_outgoing_url\` da inbox.

### 6.4 transcribe-audio
**Endpoint:** \`/functions/v1/transcribe-audio\`  
**Método:** POST  
**Autenticação:** Nenhuma (chamada interna)

**Payload:** \`{ messageId: string, audioUrl: string, conversationId?: string }\`

**Fluxo:**
1. Baixa áudio da URL
2. Envia para Groq Whisper API (\`whisper-large-v3\`, idioma: pt)
3. Salva transcrição em \`conversation_messages.transcription\`
4. Broadcast realtime: \`helpdesk-realtime\` (transcription-updated)

**Secrets:** \`GROQ_API_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`

### 6.5 summarize-conversation
**Endpoint:** \`/functions/v1/summarize-conversation\`  
**Método:** POST  
**Autenticação:** Bearer JWT

**Payload:** \`{ conversation_id: string, force_refresh?: boolean }\`

**Fluxo:**
1. Valida JWT e verifica acesso à inbox (\`has_inbox_access\` ou \`is_super_admin\`)
2. Retorna cache se existir e \`!force_refresh\`
3. Busca mensagens (exclui \`private_note\`)
4. Chama Groq (\`llama-3.3-70b-versatile\`) com prompt estruturado
5. Parseia JSON: \`{ reason, summary, resolution }\`
6. Persiste em \`conversations.ai_summary\` com expiração de 60 dias

### 6.6 auto-summarize
**Endpoint:** \`/functions/v1/auto-summarize\`  
**Método:** POST  
**Autenticação:** Bearer (anon key)

**Modos:**
- **conversation_id:** Resumo individual (trigger ao resolver)
- **mode=backfill:** Processa conversas sem resumo (até \`limit\`)
- **mode=inactive:** Processa conversas inativas (até \`limit\`)

**Trigger:** \`trigger_auto_summarize\` — dispara automaticamente quando \`status\` muda para \`resolvida\`.

---

## 7. Tipos de Mídia Suportados

| Tipo | Renderização | Storage Bucket |
|------|-------------|---------------|
| text | Texto simples | — |
| image | \`<img>\` com lightbox | helpdesk-media |
| video | \`<video>\` player | helpdesk-media |
| audio | AudioPlayer customizado | audio-messages |
| document | Download button | helpdesk-media |
| sticker | \`<img>\` transparente | — (URL direta) |
| contact | Card vCard com botão "Conversar" | — |
| carousel | ScrollArea horizontal com cards | carousel-images |

### Resolução de URLs
- **Storage privado:** URLs temporárias via \`useSignedUrl\` hook (expiração configurável)
- **UAZAPI:** Download persistente via \`getMediaLink\` no webhook
- **Fallback:** Download via \`uazapi-proxy\` action \`download-media\`

---

## 8. Canais Realtime (Supabase Broadcast)

### 8.1 helpdesk-realtime
Usado pelo **ChatPanel** para atualizações em tempo real dentro de uma conversa.

| Evento | Payload | Uso |
|--------|---------|-----|
| new-message | \`{ conversation_id, inbox_id }\` | Recarrega mensagens da conversa ativa |
| transcription-updated | \`{ message_id, transcription, conversation_id }\` | Atualiza transcrição inline |

### 8.2 helpdesk-conversations
Usado pela **ConversationList** para atualizações na lista.

| Evento | Payload | Uso |
|--------|---------|-----|
| new-message | \`{ conversation_id, inbox_id }\` | Reordena lista, marca como não-lida |
| assigned-agent | \`{ conversation_id, agent_id }\` | Atualiza badge de agente |
| conversation_updated | \`{ conversation_id }\` | Recarrega dados da conversa |

---

## 9. Interface do Usuário

### 9.1 HelpDesk.tsx (Página principal)
- Layout responsivo: lista à esquerda, chat ao centro, info à direita
- Mobile: navegação por abas (lista → chat → info)
- **Filtros:** status (aberta/pendente/resolvida), inbox, departamento, label, atribuição (todas/minhas/não-atribuídas), prioridade, busca por texto
- Botão de sincronização (chama \`sync-conversations\`)
- Realtime subscription para \`new-message\` e \`assigned-agent\`

### 9.2 ConversationList.tsx
- Lista scrollável de conversas com busca
- Filtros compactos: label, departamento, atribuição, prioridade
- Badge de "filtros ativos" com botão limpar
- Botão para gerenciar labels da inbox

### 9.3 ConversationItem.tsx
- Avatar com iniciais fallback
- Pill de prioridade colorido
- Preview da última mensagem (com \`mediaPreview\` para mídias)
- Indicador de não-lido
- Badges: departamento, agente atribuído, notas privadas, labels

### 9.4 ChatPanel.tsx
- **Header:** Nome do contato, Select de status, badge/botão de IA, botão de notas, botão info
- **Lista de mensagens:** \`MessageBubble\` com scroll automático ao fundo
- **Input:** \`ChatInput\` compositor completo
- **Notas:** \`NotesPanel\` drawer lateral
- Realtime: escuta \`new-message\` e \`transcription-updated\`

### 9.5 ChatInput.tsx
- **Modos:** texto normal, nota privada (fundo amarelo)
- **Envio de texto:** via \`uazapi-proxy\` action \`send-chat\`
- **Envio de áudio:** gravação OGG/Opus → upload \`audio-messages\` → \`send-audio\`
- **Envio de arquivo:** upload \`helpdesk-media\` → \`send-media\`
- **Ações extras:** popover com labels, status, emoji picker
- **Auto-assign:** primeiro agente a enviar mensagem é atribuído automaticamente
- **Webhook saída:** dispara \`fire-outgoing-webhook\` após cada envio

### 9.6 MessageBubble.tsx
- Renderização condicional por \`media_type\`
- Suporte completo: text, image, audio, video, document, sticker, contact (vCard), carousel
- Transcrição inline para áudio (\`transcription\` field)
- Signed URLs via \`useSignedUrl\` para mídias privadas
- Download de documentos com fallback via proxy
- Notas privadas: fundo amarelo, ícone de cadeado

### 9.7 ContactInfoPanel.tsx
- Dados do contato: avatar, telefone
- Label picker + labels atribuídas
- Selects: status, prioridade, agente, departamento
- **Resumo IA:** card com reason/summary/resolution + botão "Gerar/Atualizar"
- **Histórico:** timeline de conversas anteriores do mesmo contato com resumos expandíveis

### 9.8 Componentes auxiliares
- **NotesPanel.tsx:** Drawer com notas privadas (direction: private_note), CRUD
- **ManageLabelsDialog.tsx:** Dialog para criar/editar/excluir labels por inbox
- **LabelPicker.tsx:** Popover checkbox para atribuir labels a conversas
- **AudioPlayer.tsx:** Player customizado com play/pause, seek bar, velocidade (1x/1.5x/2x)
- **ConversationLabels.tsx:** Renderização de pills de labels

---

## 10. Integração com IA

### 10.1 Status IA (\`status_ia\`)
Campo na tabela \`conversations\` que controla o estado da IA:
- \`NULL\`: IA nunca ativada
- \`'ligada'\`: IA ativa, respondendo via n8n
- \`'desligada'\`: IA pausada, agente humano atendendo

### 10.2 Ativação
1. Agente clica "Ativar IA" no ChatPanel
2. ChatPanel chama \`fire-outgoing-webhook\` com payload:
   \`\`\`json
   {
     "event": "ia_activated",
     "pausar_agente": "nao",
     "conversation_id": "...",
     "contact_phone": "...",
     "instance_name": "..."
   }
   \`\`\`
3. n8n processa e configura bot para responder

### 10.3 Desativação
- Automática ao enviar mensagem manual: \`status_ia\` → \`'desligada'\`
- Webhook \`whatsapp-webhook\` detecta payload \`status_ia\` e atualiza

### 10.4 Resumos Automáticos
- **Trigger:** \`trigger_auto_summarize\` ao marcar conversa como \`resolvida\`
- **Formato JSON:** \`{ reason: string, summary: string, resolution: string, generated_at: string, message_count: number }\`
- **Modelo:** Groq LLaMA 3.3 70B Versatile
- **Expiração:** 60 dias
- **Cache:** Retorna resumo existente se < 5 min (auto-summarize) ou se existe (summarize-conversation)

---

## 11. Fluxos Operacionais

### 11.1 Mensagem de Entrada (Incoming)
\`\`\`
UAZAPI → POST /functions/v1/whatsapp-webhook
  → Normaliza payload
  → Resolve instância → inbox
  → Extrai conteúdo + tipo de mídia
  → Busca URL de mídia (getMediaLink)
  → Upload para Storage (se não-áudio)
  → Deduplica por external_id
  → Upsert contato
  → Find/create conversa
  → Insert mensagem
  → Atualiza conversa (last_message, is_read=false)
  → Auto-add lead database
  → Broadcast realtime (new-message)
  → Dispara transcribe-audio (se áudio incoming)
\`\`\`

### 11.2 Mensagem de Saída (Outgoing)
\`\`\`
Agente digita no ChatInput
  → uazapi-proxy (send-chat / send-media / send-audio)
  → Insert conversation_messages (direction: outgoing)
  → Update conversations (last_message, is_read=true, status_ia='desligada')
  → Broadcast realtime (new-message)
  → fire-outgoing-webhook (webhook_outgoing_url da inbox)
  → Auto-assign agente (se primeiro envio)
\`\`\`

### 11.3 Auto-assign de Agente
- Primeiro agente a enviar mensagem numa conversa sem \`assigned_to\`
- Atualiza \`conversations.assigned_to\`
- Broadcast \`assigned-agent\` no canal \`helpdesk-conversations\`

### 11.4 Sincronização
\`\`\`
Botão "Sincronizar" no HelpDesk
  → POST /functions/v1/sync-conversations { inbox_id }
  → Busca chats + mensagens no UAZAPI
  → Para cada chat individual:
    → Upsert contato
    → Upsert conversa
    → Insert mensagens (dedupe external_id)
  → Retorna { synced, errors, messagesImported }
\`\`\`

---

## 12. Secrets e Variáveis

| Secret | Uso |
|--------|-----|
| \`GROQ_API_KEY\` | Transcrição de áudio (Whisper) e resumos (LLaMA 3.3) |
| \`UAZAPI_SERVER_URL\` | Base URL do servidor UAZAPI (ex: https://wsmart.uazapi.com) |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Operações privilegiadas (bypass RLS) |
| \`SUPABASE_ANON_KEY\` | Broadcast realtime |
| \`SUPABASE_URL\` | URL do projeto Supabase |

---

## 13. Storage Buckets

| Bucket | Público | Conteúdo |
|--------|---------|----------|
| \`helpdesk-media\` | ❌ | Imagens, vídeos, documentos recebidos/enviados |
| \`audio-messages\` | ❌ | Áudios gravados pelos atendentes |
| \`carousel-images\` | ✅ | Imagens de carrossel para broadcast |

### Políticas de acesso
- **helpdesk-media / audio-messages:** Acesso via signed URLs (hook \`useSignedUrl\`)
- **carousel-images:** Acesso público (imagens de carrossel)

---

## 14. Regras de Negócio

1. **Conversa por contato por inbox:** Cada contato tem no máximo uma conversa ativa por inbox
2. **Deduplicação:** Mensagens com mesmo \`external_id\` são ignoradas
3. **Notas privadas:** direction = \`private_note\`, visíveis apenas para agentes, não enviadas ao WhatsApp
4. **Leitura automática:** Conversa marcada como lida ao ser selecionada pelo agente
5. **Status IA:** Desativado automaticamente ao enviar mensagem manual
6. **Auto-assign:** Primeiro agente a responder é atribuído
7. **Resumo ao resolver:** Trigger automático gera resumo IA ao marcar como resolvida
8. **Departamento padrão:** Novas conversas sem departamento são visíveis a todos da inbox
9. **Agentes restritos:** Com \`department_id\` preenchido, agentes só veem conversas de seus departamentos
10. **Webhook de saída:** Configurável por inbox via \`webhook_outgoing_url\`