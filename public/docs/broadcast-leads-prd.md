# PRD — Módulo Broadcast (Leads)

**Produto:** WsmartQR  
**Módulo:** Broadcast de Leads  
**Versão:** 1.0  
**Data:** 2026-03-03  
**Status:** Completo

---

## 1. Visão Geral

O módulo **Broadcast de Leads** permite o envio em massa de mensagens via WhatsApp para **contatos individuais** (diferente do Broadcast de Grupos que envia para grupos). O fluxo segue um wizard de 3 etapas:

1. **Seleção de Instância** — escolher a instância WhatsApp conectada
2. **Gestão de Contatos** — importar, verificar e selecionar leads
3. **Composição e Envio** — redigir e enviar mensagem (texto, mídia ou carrossel)

O módulo integra-se com o **HelpDesk** (persistindo mensagens enviadas como histórico de conversa) e suporta **reenvio** a partir do histórico de broadcasts.

---

## 2. Modelo de Dados

### 2.1 Tabela: \`lead_databases\`

Armazena as bases de leads criadas pelos usuários.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NÃO | gen_random_uuid() | Identificador único |
| name | text | NÃO | — | Nome da base |
| description | text | SIM | NULL | Descrição opcional |
| user_id | uuid | NÃO | — | Proprietário (auth.users) |
| instance_id | text | SIM | NULL | Instância vinculada (opcional) |
| leads_count | integer | SIM | 0 | Contagem de leads na base |
| created_at | timestamptz | SIM | now() | Data de criação |
| updated_at | timestamptz | SIM | now() | Data de última atualização |

### 2.2 Tabela: \`lead_database_entries\`

Armazena os contatos individuais dentro de cada base.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NÃO | gen_random_uuid() | Identificador único |
| database_id | uuid | NÃO | — | FK → lead_databases.id |
| phone | text | NÃO | — | Telefone normalizado |
| name | text | SIM | NULL | Nome do contato |
| jid | text | NÃO | — | JID WhatsApp (phone@s.whatsapp.net) |
| source | text | SIM | 'paste' | Origem: paste, csv, group, manual |
| group_name | text | SIM | NULL | Nome do grupo de origem |
| is_verified | boolean | SIM | false | Se o número foi verificado |
| verified_name | text | SIM | NULL | Nome retornado pela verificação |
| verification_status | text | SIM | NULL | Status: pending, valid, invalid, error |
| created_at | timestamptz | SIM | now() | Data de criação |

### 2.3 Tabela: \`broadcast_logs\`

Registra cada operação de envio em massa (compartilhada com Broadcast de Grupos).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NÃO | gen_random_uuid() | Identificador único |
| user_id | uuid | NÃO | — | Usuário que realizou o envio |
| instance_id | text | NÃO | — | Instância utilizada |
| instance_name | text | SIM | NULL | Nome da instância |
| message_type | text | NÃO | 'text' | Tipo: text, image, video, audio, file, carousel |
| content | text | SIM | NULL | Conteúdo textual da mensagem |
| media_url | text | SIM | NULL | URL da mídia enviada |
| carousel_data | jsonb | SIM | NULL | Dados do carrossel (cards, botões) |
| groups_targeted | integer | NÃO | 0 | Quantidade de grupos (0 para leads) |
| recipients_targeted | integer | NÃO | 0 | Total de destinatários |
| recipients_success | integer | NÃO | 0 | Envios bem-sucedidos |
| recipients_failed | integer | NÃO | 0 | Envios com falha |
| exclude_admins | boolean | NÃO | false | Se excluiu admins |
| random_delay | text | SIM | 'none' | Preset de delay utilizado |
| status | text | NÃO | 'completed' | Status: completed, error, cancelled |
| error_message | text | SIM | NULL | Mensagem de erro (se houver) |
| started_at | timestamptz | NÃO | now() | Início do envio |
| completed_at | timestamptz | SIM | NULL | Fim do envio |
| duration_seconds | integer | SIM | NULL | Duração total em segundos |
| group_names | text[] | SIM | '{}' | Nomes dos grupos (vazio para leads) |

### 2.4 Tabela: \`message_templates\`

Templates reutilizáveis de mensagens (compartilhada entre módulos).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NÃO | gen_random_uuid() | Identificador único |
| user_id | uuid | NÃO | — | Proprietário do template |
| name | text | NÃO | — | Nome do template |
| content | text | SIM | NULL | Conteúdo textual |
| message_type | text | NÃO | 'text' | Tipo da mensagem |
| media_url | text | SIM | NULL | URL da mídia |
| filename | text | SIM | NULL | Nome do arquivo |
| category | text | SIM | NULL | Categoria para organização |
| carousel_data | jsonb | SIM | NULL | Dados do carrossel |
| created_at | timestamptz | NÃO | now() | Data de criação |
| updated_at | timestamptz | NÃO | now() | Data de atualização |

---

## 3. Políticas RLS (Row-Level Security)

### 3.1 lead_databases

| Política | Comando | Expressão |
|----------|---------|-----------|
| Users can manage own lead databases | ALL | \`auth.uid() = user_id\` |
| Super admins can view all lead databases | SELECT | \`is_super_admin(auth.uid())\` |

### 3.2 lead_database_entries

| Política | Comando | Expressão |
|----------|---------|-----------|
| Users can manage entries via database ownership | ALL | \`EXISTS (SELECT 1 FROM lead_databases WHERE id = database_id AND user_id = auth.uid())\` |
| Super admins can view all lead entries | SELECT | \`EXISTS (SELECT 1 FROM lead_databases WHERE id = database_id AND is_super_admin(auth.uid()))\` |

### 3.3 broadcast_logs

| Política | Comando | Expressão |
|----------|---------|-----------|
| Users can insert own broadcast logs | INSERT | \`auth.uid() = user_id\` |
| Users can view own broadcast logs | SELECT | \`auth.uid() = user_id\` |
| Users can delete own broadcast logs | DELETE | \`auth.uid() = user_id\` |
| Super admins can view all broadcast logs | SELECT | \`is_super_admin(auth.uid())\` |
| Super admins can delete broadcast logs | DELETE | \`is_super_admin(auth.uid())\` |

### 3.4 message_templates

| Política | Comando | Expressão |
|----------|---------|-----------|
| Users can create their own templates | INSERT | \`auth.uid() = user_id\` |
| Users can view their own templates | SELECT | \`auth.uid() = user_id\` |
| Users can update their own templates | UPDATE | \`auth.uid() = user_id\` |
| Users can delete their own templates | DELETE | \`auth.uid() = user_id\` |

---

## 4. Interface do Usuário — Componentes

### 4.1 LeadsBroadcaster.tsx (Página Principal)

Wizard de 3 etapas que orquestra todo o fluxo:

- **Step 1**: \`InstanceSelector\` — seleção da instância WhatsApp conectada
- **Step 2**: Gestão de leads — importação, bases salvas, verificação, seleção
- **Step 3**: \`LeadMessageForm\` — composição e envio da mensagem

**Estado gerenciado:**
- \`selectedInstance\`: instância selecionada
- \`leads\`: array de leads importados
- \`selectedLeads\`: Set de IDs selecionados para envio
- \`selectedDatabases\`: bases carregadas
- \`resendData\`: dados de reenvio restaurados do sessionStorage

### 4.2 InstanceSelector.tsx

- Busca instâncias do Supabase (\`instances\` table)
- Exibe grid de cards com avatar, nome e status (Online/Offline)
- Auto-seleciona quando há apenas uma instância conectada
- Só permite seleção de instâncias com status \`connected\` ou \`online\`

### 4.3 LeadImporter.tsx

Componente com 4 abas de importação:

| Aba | Descrição | Funcionalidade |
|-----|-----------|----------------|
| Colar | Textarea para colar números | Quebra por linha, normaliza, deduplica |
| CSV/Excel | Upload de arquivo | Detecta delimitador, mapeia colunas (telefone obrigatório, nome opcional), preview tabular |
| Grupos | Extrair de grupos da instância | Busca grupos via uazapi-proxy, seleciona, extrai não-admins |
| Manual | Formulário individual | Telefone + nome opcional |

**Normalização de telefone (\`parsePhoneToJid\`):**
1. Remove caracteres não-numéricos (+, espaços, hífens, parênteses)
2. Aplica prefixo \`55\` para números com menos de 11 dígitos
3. Gera JID: \`{digits}@s.whatsapp.net\`

### 4.4 LeadList.tsx

Lista paginada (50 itens/página) com:
- **Busca**: filtra por nome, telefone ou grupo de origem
- **Filtro por status**: todos, verificados, inválidos, pendentes
- **Seleção**: individual (checkbox) ou em massa (selecionar todos / limpar)
- **Badges**: status de verificação (válido/inválido/pendente) e origem (colar/CSV/grupo/manual)
- **Paginação**: navegação por páginas com botões numéricos

### 4.5 LeadDatabaseSelector.tsx

Lista de bases de leads salvas:
- Carrega \`lead_databases\` do Supabase ordenadas por \`updated_at\`
- Ações por base: Selecionar, Editar (EditDatabaseDialog), Gerenciar (ManageLeadDatabaseDialog), Excluir
- Botão "Criar Nova Base"
- Suporte a multi-seleção de bases (combina entries)

### 4.6 LeadMessageForm.tsx

Compositor de mensagem com 3 abas:

| Aba | Componentes | Limites |
|-----|-------------|---------|
| Texto | Textarea + emoji picker | Max 4096 caracteres |
| Mídia | Upload/URL + caption | Max 10MB; image/jpeg/png/gif/webp, video/mp4, audio/mpeg/ogg/mp3/wav |
| Carrossel | CarouselEditor + CarouselPreview | Cards com imagem + texto + botões (URL/REPLY/CALL) |

**Funcionalidades:**
- **Templates**: carregar template salvo ou salvar novo com nome/categoria
- **Delay configurável**: presets de intervalo entre envios (anti-bloqueio)
- **Progresso**: card modal com barra, contato atual, tempo decorrido/restante
- **Controles**: pause/resume/cancel durante envio
- **Persistência**: salva \`broadcast_log\` após conclusão + cada mensagem no HelpDesk

### 4.7 Dialogs de Gestão

| Dialog | Função |
|--------|--------|
| EditDatabaseDialog | Editar nome e descrição da base |
| ManageLeadDatabaseDialog | Listar entries (30/página), buscar, adicionar contato, excluir contato |
| CreateLeadDatabaseDialog | Criar base a partir de grupos selecionados (extrai não-admins, deduplica) |

### 4.8 Preview e Carrossel

| Componente | Função |
|------------|--------|
| MessagePreview | Preview WhatsApp-style com formatação (negrito/itálico/tachado), edição inline |
| CarouselEditor | Editor visual de cards do carrossel |
| CarouselPreview | Preview do carrossel com cards horizontais |
| TemplateSelector | Dropdown com busca, filtro por categoria/tipo, CRUD de templates |

---

## 5. Importação de Leads

### 5.1 Fluxo de Importação por Colagem

1. Usuário cola números no textarea (um por linha)
2. Sistema chama \`parsePhoneToJid()\` para cada linha
3. Remove duplicatas por telefone
4. Adiciona ao array de leads com \`source: 'paste'\`

### 5.2 Fluxo de Importação CSV/Excel

1. Upload de arquivo (.csv, .tsv, .xlsx, .xls)
2. Para CSV: detecta delimitador (vírgula, ponto-e-vírgula, tab)
3. Exibe preview tabular com headers
4. Usuário mapeia colunas: **Telefone** (obrigatório) e **Nome** (opcional)
5. Sistema processa linhas, normaliza telefones, gera JIDs
6. Suporte a drag-and-drop de arquivos

### 5.3 Fluxo de Extração de Grupos

1. Busca grupos da instância via \`uazapi-proxy\` (action: \`groups\`)
2. Exibe lista de grupos com nome e tamanho
3. Usuário seleciona grupos desejados
4. Sistema extrai participantes **não-admin** (filtra \`isAdmin\` e \`isSuperAdmin\`)
5. Normaliza telefones a partir de \`phoneNumber\` ou \`jid\`
6. Deduplica por telefone, registra \`group_name\` como origem

### 5.4 Fluxo Manual

1. Formulário com campo de telefone e nome (opcional)
2. Normaliza e valida o número
3. Adiciona ao array com \`source: 'manual'\`

---

## 6. Verificação de Números

### 6.1 Processo

1. Chamada: \`supabase.functions.invoke('uazapi-proxy', { body: { action: 'check-numbers', instance_id, phones } })\`
2. Processamento em **batches de 50** números por chamada
3. Progresso visual durante verificação

### 6.2 Status Retornados

| Status | Descrição |
|--------|-----------|
| valid | Número possui WhatsApp ativo |
| invalid | Número não possui WhatsApp |
| error | Erro na verificação |

### 6.3 Ações Pós-Verificação

- **Remover inválidos**: filtra leads com \`verification_status !== 'valid'\`
- **Selecionar apenas válidos**: atualiza seleção para incluir apenas números válidos

---

## 7. Gestão de Bases de Leads

### 7.1 Criar Nova Base

1. Importar leads (qualquer método)
2. Clicar em "Salvar Base"
3. Informar nome e descrição
4. Sistema insere \`lead_databases\` + \`lead_database_entries\`
5. Atualiza \`leads_count\`

### 7.2 Selecionar Base Existente

1. \`LeadDatabaseSelector\` lista bases do usuário
2. Ao selecionar, carrega \`lead_database_entries\` da base
3. Deduplica por telefone ao combinar múltiplas bases

### 7.3 Atualizar Base

1. Substitui todas as entries existentes
2. Insere novas entries
3. Atualiza \`leads_count\` e \`updated_at\`

### 7.4 Gerenciar Entradas (ManageLeadDatabaseDialog)

- Visualizar metadados (nome, descrição, contagem)
- Buscar entries por nome/telefone
- Adicionar contato manualmente (com verificação de duplicata)
- Excluir contato individual (com confirmação)
- Paginação: 30 itens por página
- Atualização automática de \`leads_count\`

### 7.5 Criar Base a partir de Grupos (CreateLeadDatabaseDialog)

1. Disponível no Broadcaster de Grupos (Step 2)
2. Extrai participantes não-admin dos grupos selecionados
3. Normaliza telefones (\`phoneNumber\` ou \`jid\`)
4. Aplica prefixo \`55\` para números curtos
5. Deduplica por telefone
6. Salva com \`source: 'group'\` e \`group_name\`
7. Rollback automático se inserção de entries falhar

---

## 8. Composição e Envio de Mensagens

### 8.1 Envio de Texto

1. Valida conteúdo (não vazio, max 4096 caracteres)
2. Loop por cada lead selecionado
3. Chamada: \`uazapi-proxy\` com \`action: 'send-message'\`, \`jid\`, \`text\`
4. Delay configurável entre envios
5. Registra resultado (sucesso/falha) por contato
6. Persiste no HelpDesk via \`saveToHelpdesk()\`

### 8.2 Envio de Mídia

1. Valida arquivo (tipo e tamanho ≤ 10MB)
2. Determina tipo de mídia: image, video, audio, file
3. Loop por cada lead selecionado
4. Chamada: \`uazapi-proxy\` com \`action: 'send-media'\`, \`jid\`, \`mediaUrl\`, \`type\`, \`caption\`
5. Para áudio: envia como PTT (push-to-talk) via \`send-audio\`

### 8.3 Envio de Carrossel

1. Valida cards (pelo menos 1 card com imagem)
2. Loop por cada lead selecionado
3. Chamada: \`uazapi-proxy\` com \`action: 'send-carousel'\`, \`jid\`, \`carouselData\`
4. Retry automático em caso de campos faltantes

### 8.4 Progresso e Controles

| Controle | Ação |
|----------|------|
| Pause | Pausa o loop de envio (\`waitWhilePaused\`) |
| Resume | Retoma o envio |
| Cancel | Cancela o envio, salva log parcial |

**Informações exibidas:**
- Barra de progresso (current/total)
- Nome do contato atual
- Tempo decorrido
- Tempo restante estimado

### 8.5 Persistência

Após conclusão (ou cancelamento):
1. Insere registro em \`broadcast_logs\` com métricas completas
2. Se carrossel: faz upload das imagens para bucket \`carousel-images\` (público)
3. Cada mensagem individual é salva no HelpDesk via \`saveToHelpdesk()\`

---

## 9. Reenvio de Mensagens

### 9.1 Fluxo de Reenvio

1. **BroadcastHistoryPage**: lista histórico de envios via \`BroadcastHistory\`
2. Usuário clica "Reenviar" em um log
3. **ResendOptionsDialog**: escolhe destino (grupos ou leads) e se exclui admins
4. Dados salvos em \`sessionStorage('resendData')\`:
   - \`messageType\`, \`content\`, \`mediaUrl\`, \`instanceId\`, \`instanceName\`, \`carouselData\`, \`excludeAdmins\`
5. Navega para \`/dashboard/broadcast/leads\`
6. **LeadsBroadcaster** restaura dados do sessionStorage
7. Banner visual indica reenvio ativo
8. Mensagem pré-preenchida no Step 3

### 9.2 Dados do ResendData

\`\`\`typescript
interface ResendData {
  messageType: string;
  content: string | null;
  mediaUrl: string | null;
  instanceId: string;
  instanceName: string | null;
  carouselData?: {
    message?: string;
    cards?: Array<{
      id?: string;
      text?: string;
      image?: string;
      buttons?: Array<{
        id?: string;
        type: 'URL' | 'REPLY' | 'CALL';
        label: string;
        value?: string;
      }>;
    }>;
  };
  excludeAdmins: boolean;
}
\`\`\`

---

## 10. Edge Functions Utilizadas

### 10.1 uazapi-proxy

Função proxy que roteia chamadas para a API UAZAPI com autenticação e resolução de token.

| Action | Método | Descrição |
|--------|--------|-----------|
| check-numbers | POST | Verifica se números possuem WhatsApp |
| send-message | POST | Envia mensagem de texto |
| send-media | POST | Envia mídia (imagem, vídeo, documento) |
| send-audio | POST | Envia áudio como PTT |
| send-carousel | POST | Envia carrossel interativo |
| groups | POST | Lista grupos da instância (para importação) |

**Autenticação:**
- Header \`Authorization: Bearer <jwt_token>\` (token do usuário logado)
- Função resolve o token da instância via \`resolveInstanceToken(userId, instanceId)\`
- Valida acesso via \`user_instance_access\` ou role \`super_admin\`

### 10.2 Integração com HelpDesk (saveToHelpdesk)

Cada mensagem enviada é persistida no HelpDesk:

1. Busca inbox vinculada à instância
2. Resolve contato por JID (com fallback de 9º dígito brasileiro)
3. Cria ou atualiza conversa com status \`aberta\`
4. Insere \`conversation_message\` com \`direction: 'outgoing'\`
5. Broadcast realtime: \`conversation_updated\`

---

## 11. Fluxos Operacionais

### 11.1 Envio Completo

\`\`\`
Selecionar Instância → Importar/Selecionar Leads → Verificar Números (opcional)
→ Selecionar Leads → Compor Mensagem → Configurar Delay → Enviar
→ Progresso em Tempo Real → Log Salvo → HelpDesk Atualizado
\`\`\`

### 11.2 Reenvio a partir do Histórico

\`\`\`
Histórico de Envios → Clicar "Reenviar" → Escolher Destino (Leads)
→ Navega para LeadsBroadcaster → Selecionar Instância → Selecionar Leads
→ Mensagem Pré-preenchida → Enviar
\`\`\`

### 11.3 Criar Base de Leads a partir de Grupos

\`\`\`
Broadcaster de Grupos → Step 2 (Seleção de Grupos) → Botão "Criar Base"
→ CreateLeadDatabaseDialog → Extrair Não-Admins → Nomear Base → Salvar
→ Base disponível no LeadsBroadcaster
\`\`\`

### 11.4 Gestão de Bases

\`\`\`
LeadsBroadcaster Step 2 → LeadDatabaseSelector → Selecionar/Criar/Editar/Gerenciar/Excluir
→ Carregar Leads → Verificar → Enviar
\`\`\`

---

## 12. Regras de Negócio

1. **Propriedade**: Bases de leads são por usuário (RLS por \`user_id\`)
2. **Deduplicação**: Por telefone normalizado ao importar e ao combinar bases
3. **Normalização de telefone**:
   - Remove \`+\`, espaços, hífens, parênteses
   - Aplica prefixo \`55\` para números com menos de 11 dígitos
   - Formato JID: \`{digits}@s.whatsapp.net\`
4. **Verificação**: Em batches de 50 números por chamada à API
5. **Anti-bloqueio**: Delay configurável entre envios (presets pré-definidos)
6. **Carrossel**: Imagens armazenadas no bucket \`carousel-images\` (público)
7. **HelpDesk**: Cada mensagem enviada é persistida como mensagem de saída na conversa do contato
8. **groups_targeted = 0**: No broadcast_log, diferencia envio para leads (0) vs grupos (> 0)
9. **Reenvio**: Dados transportados via sessionStorage entre páginas
10. **Rollback**: Criação de base com rollback automático se inserção de entries falhar

---

## 13. Storage

### Bucket: carousel-images

| Propriedade | Valor |
|-------------|-------|
| Nome | carousel-images |
| Público | Sim |
| Uso | Upload de imagens dos cards do carrossel |

Imagens são enviadas durante o \`saveBroadcastLog\` para persistência do carousel_data com URLs públicas.

---

## 14. Tipos TypeScript Principais

### 14.1 Lead

\`\`\`typescript
interface Lead {
  id: string;
  phone: string;
  name?: string;
  jid: string;
  source: 'manual' | 'paste' | 'group' | 'csv';
  groupName?: string;
  isVerified?: boolean;
  verifiedName?: string;
  verificationStatus?: 'pending' | 'valid' | 'invalid' | 'error';
}
\`\`\`

### 14.2 LeadDatabase

\`\`\`typescript
interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
  instance_id?: string | null;
}
\`\`\`

### 14.3 SendProgress

\`\`\`typescript
interface SendProgress {
  current: number;
  total: number;
  currentName: string;
  status: 'idle' | 'sending' | 'paused' | 'success' | 'error' | 'cancelled';
  results: Array<{ name: string; success: boolean; error?: string }>;
  startedAt: number | null;
}
\`\`\`

---

## 15. Rotas e Navegação

| Rota | Componente | Descrição |
|------|-----------|-----------|
| /dashboard/broadcast/leads | LeadsBroadcaster | Wizard de envio para leads |
| /dashboard/broadcast/history | BroadcastHistoryPage | Histórico de envios (grupos + leads) |
| /dashboard/broadcast | Broadcaster | Wizard de envio para grupos |

---

## 16. Considerações de Segurança

1. **Tokens de instância** nunca são expostos no frontend — resolvidos server-side via \`resolveInstanceToken\`
2. **RLS por user_id** em todas as tabelas de dados do usuário
3. **Super admin** tem acesso de leitura global para auditoria
4. **JWT obrigatório** em todas as chamadas à Edge Function
5. **Validação de acesso** à instância via \`user_instance_access\` antes de resolver token