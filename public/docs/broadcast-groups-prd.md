# PRD — Módulo Broadcast (Grupos)

## 1. Visão Geral

O módulo **Broadcast (Grupos)** permite o envio em massa de mensagens para **grupos WhatsApp** conectados a uma instância. Diferente do Broadcast de Leads (que envia para contatos individuais), este módulo envia diretamente ao JID do grupo ou, opcionalmente, aos membros regulares (não-admin) individualmente.

### Características Principais
- **Wizard de 3 etapas**: Instância → Grupos → Mensagem
- **Modos de envio**: direto ao grupo ou individual para membros não-admin
- **Tipos de mensagem**: texto, mídia (imagem/vídeo/áudio/documento) e carrossel interativo
- **Templates reutilizáveis** com categorias e busca
- **Agendamento** com recorrência (diária/semanal/mensal/custom)
- **Progresso em tempo real** com pause/resume/cancel
- **Delay anti-bloqueio** configurável entre envios
- **Reenvio** a partir do histórico de broadcast
- **Criação de base de leads** a partir dos membros dos grupos selecionados
- **Persistência no HelpDesk** de cada mensagem enviada

### Rota
\`/dashboard/broadcast\` → \`Broadcaster.tsx\`

---

## 2. Modelo de Dados

### 2.1 broadcast_logs

Registra cada execução de envio em massa.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador único |
| user_id | UUID FK → auth.users | Dono do envio |
| instance_id | TEXT | ID da instância utilizada |
| instance_name | TEXT | Nome da instância (snapshot) |
| message_type | TEXT | \`text\`, \`image\`, \`video\`, \`audio\`, \`file\`, \`carousel\` |
| content | TEXT | Conteúdo textual / caption |
| media_url | TEXT | URL da mídia enviada |
| carousel_data | JSONB | Dados do carrossel (cards, botões, imagens) |
| group_names | TEXT[] | Nomes dos grupos alvo |
| groups_targeted | INT | Quantidade de grupos/membros alvo |
| recipients_targeted | INT | Total de destinatários |
| recipients_success | INT | Envios com sucesso |
| recipients_failed | INT | Envios com falha |
| exclude_admins | BOOLEAN | Se excluiu admins do envio |
| random_delay | TEXT | Preset de delay utilizado |
| status | TEXT | \`sending\`, \`completed\`, \`failed\`, \`cancelled\` |
| error_message | TEXT | Mensagem de erro (se houver) |
| started_at | TIMESTAMPTZ | Início do envio |
| completed_at | TIMESTAMPTZ | Conclusão do envio |
| duration_seconds | INT | Duração total em segundos |

### 2.2 scheduled_messages

Mensagens agendadas para envio futuro ou recorrente.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador único |
| user_id | UUID FK → auth.users | Dono do agendamento |
| instance_id | TEXT FK → instances | Instância de envio |
| group_jid | TEXT | JID do grupo destino |
| group_name | TEXT | Nome do grupo (snapshot) |
| message_type | TEXT | \`text\`, \`image\`, \`video\`, \`audio\`, \`file\` |
| content | TEXT | Conteúdo textual / caption |
| media_url | TEXT | URL da mídia |
| filename | TEXT | Nome do arquivo (mídia) |
| recipients | JSONB | Lista de destinatários individuais (quando excluir admins) |
| scheduled_at | TIMESTAMPTZ | Data/hora do primeiro envio |
| next_run_at | TIMESTAMPTZ | Próxima execução prevista |
| is_recurring | BOOLEAN | Se é recorrente |
| recurrence_type | TEXT | \`daily\`, \`weekly\`, \`monthly\`, \`custom\` |
| recurrence_interval | INT | Intervalo de recorrência |
| recurrence_days | INT[] | Dias da semana (para weekly) |
| recurrence_end_at | TIMESTAMPTZ | Fim da recorrência por data |
| recurrence_count | INT | Fim da recorrência por contagem |
| executions_count | INT | Execuções realizadas |
| last_executed_at | TIMESTAMPTZ | Última execução |
| random_delay | TEXT | Delay anti-bloqueio |
| exclude_admins | BOOLEAN | Se exclui admins |
| status | TEXT | \`pending\`, \`active\`, \`paused\`, \`completed\`, \`cancelled\` |
| last_error | TEXT | Último erro de execução |

### 2.3 message_templates

Templates reutilizáveis para mensagens.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador único |
| user_id | UUID FK → auth.users | Dono do template |
| name | TEXT | Nome do template |
| category | TEXT | Categoria opcional |
| message_type | TEXT | \`text\`, \`image\`, \`video\`, \`audio\`, \`file\`, \`carousel\` |
| content | TEXT | Conteúdo textual |
| media_url | TEXT | URL da mídia |
| filename | TEXT | Nome do arquivo |
| carousel_data | JSONB | Dados do carrossel |
| created_at | TIMESTAMPTZ | Criação |
| updated_at | TIMESTAMPTZ | Última atualização |

---

## 3. Políticas RLS

### broadcast_logs
- **SELECT**: \`auth.uid() = user_id\` OU \`is_super_admin(auth.uid())\`
- **INSERT**: \`auth.uid() = user_id\`
- **DELETE**: \`auth.uid() = user_id\` OU \`is_super_admin(auth.uid())\`

### scheduled_messages
- **ALL**: \`auth.uid() = user_id\`
- **SELECT** (super_admin): \`is_super_admin(auth.uid())\`

### message_templates
- **ALL**: \`auth.uid() = user_id\`

---

## 4. Interface do Usuário — Componentes

### 4.1 Broadcaster.tsx (Página Principal)
- Wizard de 3 etapas com indicador de progresso visual
- **Step 1**: Seleção de instância via \`InstanceSelector\`
- **Step 2**: Seleção de grupos via \`GroupSelector\` + botão "Criar Base" de leads
- **Step 3**: Composição e envio via \`BroadcastMessageForm\`
- Gestão de estado: \`selectedInstance\`, \`selectedGroups\`, \`step\`
- Suporte a reenvio via \`sessionStorage('resendData')\` com banner visual

### 4.2 InstanceSelector.tsx
- Grid de instâncias carregadas do Supabase (\`instances\` table)
- Status online/offline com badge colorido
- Auto-seleção quando há apenas uma instância conectada
- Avatar da instância (\`profile_pic_url\`) ou ícone padrão

### 4.3 GroupSelector.tsx
- Busca grupos via \`uazapi-proxy\` com action \`groups\`
- Normalização de múltiplos formatos de resposta da API
- Lista com busca por nome, seleção múltipla
- Contagem de membros: total, admins, regulares
- Ações: selecionar todos, limpar seleção
- Cada card mostra avatar do grupo, nome, e contagens

### 4.4 BroadcastMessageForm.tsx (Compositor Principal)
- **3 abas**: Texto, Mídia, Carrossel
- **Texto**: Textarea com max 4096 caracteres, emoji picker, formatação WhatsApp
- **Mídia**: Upload de arquivo ou URL, tipos suportados, max 10MB, caption opcional
- **Carrossel**: Editor visual via \`CarouselEditor\`
- **Templates**: \`TemplateSelector\` para carregar/salvar templates
- **Excluir Admins**: Switch que ativa \`ParticipantSelector\` para envio individual
- **Delay**: Presets de delay anti-bloqueio (nenhum, 5-10s, 10-20s)
- **Agendamento**: Botão que abre \`ScheduleMessageDialog\`
- **Progresso**: Card modal com barra, nome do grupo/membro atual, tempo, pause/resume/cancel

### 4.5 ParticipantSelector.tsx
- Lista membros regulares (não-admin, não-superadmin) dos grupos selecionados
- Deduplicação por JID entre grupos
- Busca por nome/telefone
- Selecionar todos / limpar seleção
- Detecção e badge de participantes LID-only (sem número real)
- Formatação de telefone: DDI DDD NUMERO

### 4.6 BroadcasterHeader.tsx
- Header compacto exibindo instância selecionada
- Botão para trocar instância (voltar ao Step 1)

### 4.7 MessagePreview.tsx
- Preview estilo WhatsApp da mensagem composta
- Formatação inline: **bold**, *italic*, ~strike~
- Suporte a edição inline com textarea auto-resize
- Preview de mídia (imagem, vídeo, áudio, documento)
- Timestamp decorativo

### 4.8 CarouselEditor.tsx / CarouselPreview.tsx
- Editor visual de cards de carrossel
- Cada card: imagem (upload para \`carousel-images\` bucket), texto, até 3 botões
- Tipos de botão: URL (abre link), REPLY (resposta rápida), CALL (ligação)
- Upload via \`uploadCarouselImage\` (base64 → File → Storage → URL pública)
- Preview lateral do carrossel formatado

### 4.9 TemplateSelector.tsx
- Dropdown com lista de templates do usuário
- Busca por nome, filtro por categoria e tipo de mensagem
- Categorias colapsáveis
- Ações por template: carregar, editar (nome/categoria), excluir
- Salvar mensagem atual como novo template (nome + categoria opcional)
- Ícones por tipo de mídia

### 4.10 ScheduleMessageDialog.tsx
- Seleção de data e hora futura
- Recorrência configurável:
  - **Diária**: a cada N dias
  - **Semanal**: dias da semana selecionáveis (seg-dom)
  - **Mensal**: a cada N meses
  - **Custom**: intervalo personalizado em dias
- Condição de fim: nunca, por data, por contagem
- Delay anti-bloqueio: nenhum, 5-10s, 10-20s
- Preview resumido da configuração

### 4.11 CreateLeadDatabaseDialog.tsx
- Disponível no Step 2 (seleção de grupos)
- Extrai membros não-admin dos grupos selecionados
- Deduplicação por telefone
- Nome e descrição da base
- Preview da quantidade de leads a serem extraídos
- Salva \`lead_databases\` + \`lead_database_entries\` no Supabase
- Rollback automático em caso de erro na inserção

### 4.12 BroadcastHistoryPage.tsx / BroadcastHistory.tsx
- Lista histórico de \`broadcast_logs\` com filtros
- Filtros: status, tipo de mensagem, alvo (grupos/leads), instância, período, busca textual
- Detalhes expandíveis: grupos, destinatários, duração, erros
- Preview de carrossel no histórico (\`HistoryCarouselPreview\`)
- Ações: reenviar, excluir

### 4.13 ResendOptionsDialog.tsx
- Dialog para configurar reenvio
- Escolher destino: grupos ou leads
- Switch para excluir admins (quando destino = grupos)
- Confirma e redireciona para Broadcaster ou LeadsBroadcaster com dados via sessionStorage

---

## 5. Modos de Envio

### 5.1 Envio Direto ao Grupo
- Envia mensagem ao JID do grupo (\`{id}@g.us\`)
- Todos os membros do grupo recebem
- Loop pelos grupos selecionados com delay entre envios (500ms entre grupos)

### 5.2 Envio Individual (Excluir Admins)
- Ativa \`ParticipantSelector\` para seleção granular
- Envia para cada membro regular individualmente via JID pessoal
- Deduplicação: mesmo JID em múltiplos grupos conta uma vez
- Delay configurável entre envios para anti-bloqueio
- Delay padrão: 350ms entre envios individuais

### 5.3 Delay Anti-Bloqueio
- **Nenhum**: Sem delay adicional (apenas delay base de 350ms)
- **5-10s**: Delay aleatório entre 5 e 10 segundos entre cada envio
- **10-20s**: Delay aleatório entre 10 e 20 segundos entre cada envio
- Objetivo: evitar bloqueio do número pelo WhatsApp

---

## 6. Tipos de Mensagem

### 6.1 Texto
- Textarea com contador de caracteres (máximo 4096)
- Emoji picker integrado
- Formatação WhatsApp suportada: \`*bold*\`, \`_italic_\`, \`~strike~\`
- Preview em tempo real via \`MessagePreview\`

### 6.2 Mídia
- **Upload de arquivo** ou **URL direta**
- Tipos suportados:
  - Imagem: \`image/jpeg\`, \`image/png\`, \`image/gif\`, \`image/webp\`
  - Vídeo: \`video/mp4\`
  - Áudio: \`audio/mpeg\`, \`audio/ogg\`, \`audio/mp3\`, \`audio/wav\`
  - Documento: qualquer tipo não listado acima
- Tamanho máximo: 10MB
- Caption opcional (texto acompanhando a mídia)
- Modo PTT (Push-to-Talk) para áudio

### 6.3 Carrossel
- Editor visual com cards configuráveis
- Cada card contém:
  - **Imagem**: upload para bucket \`carousel-images\` (público)
  - **Texto**: corpo do card
  - **Botões** (até 3 por card):
    - \`URL\`: abre link externo
    - \`REPLY\`: resposta rápida (quick reply)
    - \`CALL\`: inicia ligação para número
- Upload de imagens: base64 → \`base64ToFile()\` → \`uploadCarouselImage()\` → URL pública
- Retry automático em erro "missing field" com campo \`title\` adicionado

---

## 7. Templates (TemplateSelector)

### Funcionalidades
- **Carregar**: seleciona template → auto-preenche campos (texto, mídia, carrossel)
- **Salvar**: mensagem atual → dialog com nome e categoria opcional → \`message_templates\` INSERT
- **Editar**: alterar nome e/ou categoria de template existente → UPDATE
- **Excluir**: confirmação → DELETE

### Interface
- Dropdown menu com busca textual
- Filtros por categoria e tipo de mídia
- Categorias colapsáveis com toggle
- Ícones representativos por tipo (texto, imagem, vídeo, áudio, documento, carrossel)
- Botão "Salvar como template" abre dialog com campos nome e categoria

---

## 8. Agendamento (ScheduleMessageDialog)

### Configuração
- **Data e hora**: seleção com calendar picker + input de hora
- **Recorrência** (opcional):
  - Diária: a cada N dias
  - Semanal: seleciona dias da semana (segunda a domingo)
  - Mensal: a cada N meses
  - Custom: intervalo personalizado em dias
- **Condição de fim**:
  - Nunca (executa indefinidamente)
  - Por data (calendar picker para data final)
  - Por contagem (input numérico)
- **Delay anti-bloqueio**: nenhum, 5-10s, 10-20s

### Persistência
- Insere em \`scheduled_messages\` com:
  - \`status: 'pending'\`
  - \`recipients\`: JSON com lista de destinatários (quando excluir admins)
  - \`next_run_at\`: calculado a partir de \`scheduled_at\`
  - Campos de recorrência preenchidos conforme configuração
- Edge Function \`process-scheduled-messages\` processa no horário agendado

---

## 9. Progresso de Envio

### Interface
- Card modal centralizado durante o envio
- Barra de progresso com porcentagem
- Informações exibidas:
  - Grupo ou membro atual sendo processado
  - Tempo decorrido
  - Tempo restante estimado
  - Contadores: sucesso / falha / total
- Resultados por grupo/membro com indicador de sucesso/erro

### Controles
- **Pausar**: aguarda conclusão do envio atual, suspende loop
- **Retomar**: continua o loop de envio
- **Cancelar**: interrompe imediatamente, salva log parcial
- Auto-fechamento após conclusão com resumo final

---

## 10. Persistência

### 10.1 saveBroadcastLog
Após conclusão (ou cancelamento) do envio:
- Upload de imagens de carrossel (base64 → Storage → URL pública)
- INSERT em \`broadcast_logs\` com:
  - Tipo, conteúdo, mídia, dados de carrossel
  - Nomes dos grupos, totais de destinatários (targeted/success/failed)
  - Duração em segundos, delay utilizado, status final
  - Referência à instância e ao usuário

### 10.2 saveToHelpdesk
Para cada mensagem enviada com sucesso:
- Persiste como mensagem de saída (\`direction: 'outgoing'\`) na conversa do contato
- Resolve contato por JID (com fallback por variação de 9° dígito brasileiro)
- Cria ou atualiza conversa aberta na inbox da instância
- Envia evento realtime \`conversation_updated\` via Supabase channel
- Dados persistidos: \`content\`, \`media_type\`, \`media_url\`

---

## 11. Reenvio

### Fluxo
1. Usuário acessa **Histórico de Envios** (\`/dashboard/broadcast/history\`)
2. Clica "Reenviar" em um broadcast_log
3. \`ResendOptionsDialog\` abre com opções:
   - **Destino**: grupos ou leads
   - **Excluir admins**: switch (apenas quando destino = grupos)
4. Confirma → dados salvos em \`sessionStorage('resendData')\`:
   \`\`\`json
   {
     "messageType": "text|image|video|carousel|...",
     "content": "texto da mensagem",
     "mediaUrl": "https://...",
     "instanceId": "uuid",
     "instanceName": "Nome da Instância",
     "carouselData": {...},
     "excludeAdmins": true
   }
   \`\`\`
5. Redireciona para \`/dashboard/broadcast\` ou \`/dashboard/broadcast/leads\`
6. Broadcaster detecta resendData → exibe banner de reenvio
7. Mensagem pré-preenchida com dados do envio original

---

## 12. Criação de Base de Leads

### Fluxo (CreateLeadDatabaseDialog)
1. No Step 2 do wizard, botão **"Criar Base"**
2. Dialog exibe:
   - Preview: quantidade de leads a serem extraídos
   - Campos: nome e descrição da base
   - Badges dos grupos selecionados
3. Extração:
   - Filtra participantes não-admin e não-superadmin
   - Deduplicação por telefone
   - Normalização: números curtos recebem prefixo \`55\`
   - JID gerado: \`{phone}@s.whatsapp.net\`
4. Persistência:
   - INSERT em \`lead_databases\` (nome, descrição, user_id, leads_count)
   - INSERT em \`lead_database_entries\` (phone, name, jid, source: 'group', group_name)
   - Rollback: deleta \`lead_databases\` se inserção de entries falhar
5. Base disponível para uso no módulo **Broadcast (Leads)**

---

## 13. Edge Functions

### uazapi-proxy
Proxy centralizado para comunicação com a API UAZAPI/WhatsApp.

| Action | Descrição | Parâmetros |
|--------|-----------|------------|
| \`groups\` | Listar grupos da instância | \`instance_id\` |
| \`send-message\` | Enviar mensagem de texto | \`token\`, \`number\`, \`text\` |
| \`send-media\` | Enviar mídia com caption | \`token\`, \`number\`, \`url\`, \`type\`, \`caption\`, \`filename\`, \`isPtt\` |
| \`send-carousel\` | Enviar carrossel interativo | \`token\`, \`number\`, \`cards\` (com retry em missing-field) |
| \`send-audio\` | Enviar áudio PTT | \`token\`, \`number\`, \`url\` |

### Autenticação
- JWT do Supabase Auth no header Authorization
- \`resolveInstanceToken\`: verifica \`user_roles\` + \`user_instance_access\` → retorna token da instância

### process-scheduled-messages
- Edge Function executada periodicamente (cron ou invocação)
- Busca \`scheduled_messages\` com \`next_run_at <= now()\` e \`status = 'pending' OR 'active'\`
- Executa envio conforme \`message_type\` e \`recipients\`
- Atualiza \`last_executed_at\`, \`executions_count\`, \`next_run_at\`
- Registra em \`scheduled_message_logs\`

---

## 14. Fluxos Operacionais

### 14.1 Envio Completo para Grupos
\`\`\`
Instância → Selecionar Grupos → Compor Mensagem → Enviar
→ Loop por grupo (delay 500ms) → send-message/send-media/send-carousel
→ saveBroadcastLog → saveToHelpdesk (por mensagem)
\`\`\`

### 14.2 Envio Individual (Excluir Admins)
\`\`\`
Instância → Selecionar Grupos → Ativar "Excluir Admins"
→ ParticipantSelector (deduplicação) → Compor Mensagem → Enviar
→ Loop por membro regular (delay configurável) → send-message/send-media
→ saveBroadcastLog → saveToHelpdesk (por mensagem)
\`\`\`

### 14.3 Agendamento
\`\`\`
Instância → Selecionar Grupos → Compor Mensagem → Agendar
→ ScheduleMessageDialog (data/hora + recorrência)
→ INSERT scheduled_messages (status: 'pending', recipients JSON)
→ Edge Function processa na hora agendada
\`\`\`

### 14.4 Reenvio
\`\`\`
Histórico → "Reenviar" → ResendOptionsDialog (destino + excluir admins)
→ sessionStorage('resendData') → Redirect
→ Broadcaster detecta resendData → Banner + mensagem pré-preenchida
→ Selecionar Instância → Selecionar Grupos → Enviar
\`\`\`

### 14.5 Criar Base de Leads
\`\`\`
Step 2 → "Criar Base" → CreateLeadDatabaseDialog
→ Extrair não-admins → Deduplicar por telefone → Normalizar
→ INSERT lead_databases + lead_database_entries
→ Base disponível em Broadcast (Leads)
\`\`\`

---

## 15. Regras de Negócio

### Delays
- Delay base entre envios individuais: **350ms**
- Delay entre grupos (envio direto): **500ms**
- Delay anti-bloqueio configurável: 0, 5-10s, 10-20s (aleatório)

### Carrossel
- Retry automático em erro "missing field": adiciona campo \`title\` e reenvia
- Imagens armazenadas no bucket \`carousel-images\` (público)
- Conversão: base64 → File → upload → URL pública

### Participantes
- Deduplicação por JID entre múltiplos grupos
- Participantes LID-only (sem número real) identificados com badge
- Números mascarados (\`00000000000\`) ignorados na normalização
- Normalização de telefone: remove +, espaços, hífens; prefixo 55 para números curtos

### Persistência
- Todo envio (completo, parcial ou cancelado) gera um \`broadcast_log\`
- Cada mensagem enviada com sucesso é persistida no HelpDesk como mensagem de saída
- Templates são por usuário (RLS por \`user_id\`)

### Limites
- Texto: máximo 4096 caracteres
- Mídia: máximo 10MB
- Carrossel: até 3 botões por card

---

## 16. Armazenamento (Storage)

### Bucket: carousel-images
- **Acesso**: público (leitura)
- **Estrutura**: \`{user_id}/{uuid}.{ext}\`
- **Upload**: via \`uploadCarouselImage(file: File)\`
- **Conversão**: \`base64ToFile(base64, filename)\` para preparar upload
- **Uso**: URLs públicas referenciadas nos cards do carrossel

---

## 17. Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| \`/dashboard/broadcast\` | \`Broadcaster.tsx\` | Wizard de broadcast para grupos |
| \`/dashboard/broadcast/history\` | \`BroadcastHistoryPage.tsx\` | Histórico de envios |
| \`/dashboard/broadcast/leads\` | \`LeadsBroadcaster.tsx\` | Broadcast para leads (módulo separado) |

---

## 18. Segurança

- **RLS**: Todas as tabelas possuem políticas por \`user_id\`
- **Autenticação**: JWT obrigatório em todas as operações
- **Autorização**: \`resolveInstanceToken\` verifica acesso à instância via \`user_roles\` + \`user_instance_access\`
- **Super Admin**: acesso de leitura a todos os logs (auditoria)
- **Storage**: upload autenticado, leitura pública (carousel-images)
- **sessionStorage**: dados de reenvio transitórios, não sensíveis