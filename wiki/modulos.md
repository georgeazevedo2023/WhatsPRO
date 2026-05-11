---
title: Módulos e Funcionalidades
type: modulos
updated: 2026-05-11
audited_at: 2026-05-11
---

# Módulos e Funcionalidades

> Tabela de tasks shipadas (T-codes) por módulo. Atualizar quando feature nova de um módulo for shipada. Para changelog cronológico veja [[CHANGELOG]].


### M1 - WhatsApp (Instâncias & Grupos) ✅

**Páginas**: `/dashboard/instances`, `/dashboard/instances/:id`, `/dashboard/instances/:id/groups/:gid`

| Task | Status | Descrição |
|------|--------|-----------|
| T1.1 Criar instância via QR code | ✅ | Scan QR, auto-salva token e ID |
| T1.2 Listar instâncias com status | ✅ | Status real-time (connected/disconnected), polling 30s |
| T1.3 Sincronizar instâncias UAZAPI | ✅ | Dialog de sync manual com diff |
| T1.4 Desconectar/excluir instância | ✅ | Soft delete (disable) ou hard delete (UAZAPI + DB) |
| T1.5 Listar grupos da instância | ✅ | Cache local, busca com filtro |
| T1.6 Enviar mensagem a grupo | ✅ | Texto, mídia, carrossel |
| T1.7 Enviar mídia a grupo | ✅ | Imagem, vídeo, áudio, documento com caption |
| T1.8 Histórico de conexão | ✅ | Logs de eventos (connect, disconnect, status change) |
| T1.9 Controle de acesso por instância | ✅ | `user_instance_access` com FK para auth.users |

**Edge Functions**: `uazapi-proxy`
**Tabelas**: `instances`, `user_instance_access`, `instance_connection_logs`
**Componentes**: `Instances.tsx`, `InstanceDetails.tsx`, `InstanceOverview`, `InstanceGroups`, `InstanceHistory`, `InstanceStats`
**Hooks**: `useInstances`, `useInstanceGroups`, `useQrConnect`

---

### M2 - Helpdesk (Atendimento) ✅

**Páginas**: `/dashboard/helpdesk`

| Task | Status | Descrição |
|------|--------|-----------|
| T2.1 Receber mensagens via webhook | ✅ | UAZAPI → webhook → conversations/messages |
| T2.2 Listar conversas com filtros | ✅ | Status, label, departamento, atribuição, prioridade, busca |
| T2.3 Chat em tempo real | ✅ | Broadcast channel para new-message e assigned-agent |
| T2.4 Enviar mensagens outgoing | ✅ | Texto, mídia, áudio gravado |
| T2.5 Notas privadas | ✅ | direction='private_note', visíveis só para agentes |
| T2.6 Labels por inbox | ✅ | CRUD labels, aplicar/remover em conversas, filtrar |
| T2.7 Departamentos | ✅ | CRUD departamentos, atribuir agentes, filtrar conversas |
| T2.8 Atribuir agentes | ✅ | Assign/reassign com broadcast realtime |
| T2.9 Status da conversa | ✅ | aberta/pendente/resolvida com tabs visuais |
| T2.10 Prioridade | ✅ | alta/media/baixa com filtro e ordenação |
| T2.11 Resumo IA (auto) | ✅ | Groq Llama, trigger ao resolver, cache 60 dias |
| T2.12 Resumo IA (manual) | ✅ | Botão para resumir conversa a qualquer momento |
| T2.13 Transcrição de áudio | ✅ | Groq Whisper, automático via broadcast |
| T2.14 Status IA (ligada/desligada) | ✅ | Controle por conversa, sync via webhook externo |
| T2.15 Paginação/scroll infinito | ✅ | 200 conversas por página, load more |
| T2.16 Busca em mensagens | ✅ | Debounce 500ms, busca em conversation_messages |
| T2.17 Painel de contato | ✅ | Info do contato, labels, departamento, agente |
| T2.18 Layout responsivo mobile | ✅ | 3 views: list/chat/info com navegação mobile |
| T2.19 Webhooks de saída | ✅ | Outgoing webhook configurável por inbox |
| T2.20 Foto de perfil via UAZAPI | ✅ | Busca automática via /contact/getProfilePic no webhook + painel |
| T2.21 Avatar no header do chat | ✅ | Foto do contato 32px ao lado do nome, fallback para ícone |
| T2.22 Divider de não lidos | ✅ | "Novas mensagens" divider entre lidas e não lidas |
| T2.23 Som de notificação | ✅ | Beep ao receber mensagem com janela fora de foco |
| T2.24 Drag-and-drop de arquivos | ✅ | Arrastar arquivo sobre chat para enviar imagem/documento |
| T2.25 Info de início da conversa | ✅ | "Conversa iniciada em DD/MM/YYYY às HH:mm" acima das mensagens |
| T2.26 Broadcast de status change | ✅ | Mudança de status sincronizada em tempo real entre agentes |
| T2.27 Stale fetch guard | ✅ | Troca rápida de conversa não mostra mensagens da conversa anterior |
| T2.28 Confirmação delete notas | ✅ | AlertDialog antes de excluir nota privada |

**Edge Functions**: `whatsapp-webhook`, `sync-conversations`, `auto-summarize`, `summarize-conversation`, `transcribe-audio`, `activate-ia`, `fire-outgoing-webhook`
**Tabelas**: `inboxes`, `inbox_users`, `conversations`, `conversation_messages`, `contacts`, `labels`, `conversation_labels`, `departments`, `department_members`
**Componentes**: `ChatPanel`, `ChatInput`, `ConversationList`, `ConversationItem`, `ContactInfoPanel`, `MessageBubble`, `AudioPlayer`, `LabelPicker`, `ManageLabelsDialog`, `NotesPanel`, `ConversationStatusSelect`, `ContactAvatar`
**Hooks**: `useHelpdeskInboxes`, `useHelpdeskConversations`, `useHelpdeskFilters`, `useInboxes`, `useDepartments`, `useSendFile`, `useAudioRecorder`, `useSignedUrl`, `useContactProfilePic`, `useToggleLabel`
**Utilities**: `helpdeskBroadcast.ts` (broadcastNewMessage, broadcastAssignedAgent, broadcastStatusChanged, assignAgent)

---

### M3 - Broadcast (Disparador) ✅

**Páginas**: `/dashboard/broadcast`, `/dashboard/broadcast/history`, `/dashboard/broadcast/leads`

| Task | Status | Descrição |
|------|--------|-----------|
| T3.1 Broadcast para grupos | ✅ | Multi-select grupos, texto/mídia/carrossel |
| T3.2 Broadcast para leads | ✅ | Selecionar database, verificar números, enviar |
| T3.3 Progresso em tempo real | ✅ | Modal com contadores success/failed, pause/resume/cancel |
| T3.4 Delay aleatório | ✅ | none/5-10s/10-20s entre envios |
| T3.5 Excluir admins | ✅ | Filtrar admins dos participantes |
| T3.6 Histórico de broadcasts | ✅ | Filtros por data, status, tipo, instância |
| T3.7 Reenviar broadcast | ✅ | Resend com reconfiguração |
| T3.8 Carrossel interativo | ✅ | Cards com imagem, texto, botões (REPLY/URL/CALL/COPY) |
| T3.9 Base de leads | ✅ | CRUD databases, import CSV/paste/grupos/manual |
| T3.10 Verificação de números | ✅ | WhatsApp check via UAZAPI, status verified/invalid |
| T3.11 Templates de mensagem | ✅ | CRUD templates texto/mídia/carrossel |
| T3.12 Sanitização CSV | ✅ | Limite 10MB, max 50k linhas, proteção contra injection |
| T3.13 Limites de segurança | ✅ | Max 500 phones, 50 groups, 10 carousel cards, 12MB áudio |

**Edge Functions**: `uazapi-proxy` (send-message, send-media, send-carousel, check-numbers)
**Tabelas**: `broadcast_logs`, `lead_databases`, `lead_database_entries`, `message_templates`
**Componentes**: `BroadcastHistory`, `BroadcastLogCard`, `BroadcastHistoryFilters`, `BroadcastDeleteDialogs`, `HistoryMessagePreview`, `BroadcastMessageForm`, `BroadcastProgressModal`, `CarouselEditor`, `GroupSelector`, `LeadList`, `LeadMessageForm`, `ContactsStep`, `MessageStep`, `TemplateSelector`
**Hooks**: `useBroadcastSend`, `useLeadsBroadcaster`, `useMessageTemplates`

---

### M4 - CRM Kanban ✅

**Páginas**: `/dashboard/crm`, `/dashboard/crm/:boardId`

| Task | Status | Descrição |
|------|--------|-----------|
| T4.1 CRUD boards | ✅ | Criar, editar, duplicar, excluir quadros |
| T4.2 Visibilidade (shared/private) | ✅ | Boards compartilhados ou privados |
| T4.3 Colunas com drag-drop | ✅ | Reordenar, colorir, criar/excluir |
| T4.4 Cards com drag-drop | ✅ | Mover entre colunas, reordenar |
| T4.5 Campos customizados | ✅ | text, currency, date, select, entity_select |
| T4.6 Entidades customizadas | ✅ | Enums personalizados com valores |
| T4.7 Automação por coluna | ✅ | Mensagem automática ao mover card |
| T4.8 Membros do board | ✅ | Roles editor/viewer |
| T4.9 Filtro por responsável | ✅ | Chips com avatar, aria-pressed |
| T4.10 Busca de cards | ✅ | Por título, tags, responsável |
| T4.11 Contagem otimizada | ✅ | RPC `get_kanban_board_counts` (1 query vs N+1) |

**Tabelas**: `kanban_boards`, `kanban_columns`, `kanban_cards`, `kanban_card_data`, `kanban_fields`, `kanban_entities`, `kanban_entity_values`, `kanban_board_members`
**Componentes**: `KanbanCRM`, `KanbanBoard`, `KanbanColumn`, `KanbanCardItem`, `CardDetailSheet`, `EditBoardDialog`, `CreateBoardDialog`, `BoardCard`, `DynamicFormField`, `ColumnsTab`, `FieldsTab`, `EntitiesTab`, `AccessTab`

---

### M5 - Admin & Usuários ✅

**Páginas**: `/dashboard/admin`, `/dashboard/users`, `/dashboard/settings`

| Task | Status | Descrição |
|------|--------|-----------|
| T5.1 CRUD usuários | ✅ | Criar, editar, excluir via edge functions |
| T5.2 Roles (super_admin/gerente/user) | ✅ | Atribuição de papel por usuário |
| T5.3 CRUD inboxes | ✅ | Criar, editar, excluir (RPC `delete_inbox`) |
| T5.4 Membros de inbox | ✅ | Atribuir users com roles (admin/gestor/agente) |
| T5.5 Departamentos por inbox | ✅ | CRUD com default department |
| T5.6 Acesso a instâncias | ✅ | Atribuir instâncias por usuário |
| T5.7 Webhooks por inbox | ✅ | Configurar webhook entrada (n8n) e saída |
| T5.8 Secrets/configurações | ✅ | Gerenciar API keys e secrets do sistema |
| T5.9 Documentação in-app | ✅ | PRDs embutidos na aba Docs |
| T5.10 Equipe unificada | ✅ | Cards expandíveis com inbox memberships inline (merge UsersTab+TeamTab) |
| T5.11 Endpoint do sistema copiável | ✅ | URL do whatsapp-webhook auto-gerada na config de inbox |
| T5.12 Docs completos (11/11 módulos) | ✅ | Agendamentos e Dashboard/Analytics documentados |
| T5.13 Backup de variáveis de ambiente | ✅ | Exporta system_settings + template .env |

**Edge Functions**: `admin-create-user`, `admin-update-user`, `admin-delete-user`
**Tabelas**: `user_profiles`, `user_roles`, `user_instance_access`, `system_settings`
**Componentes**: `AdminPanel`, `InboxesTab`, `UsersTab` (unificado), `SecretsTab`, `DocumentationTab`, `BackupModule`

---

### M6 - Inteligência & Analytics ✅

**Páginas**: `/dashboard/intelligence`, `/dashboard` (home)

| Task | Status | Descrição |
|------|--------|-----------|
| T6.1 KPIs (conversas, resolução, tempo) | ✅ | Cards com contadores animados |
| T6.2 Gráficos de tendência | ✅ | Conversas ao longo do tempo, taxa de resolução |
| T6.3 Top motivos de contato | ✅ | Agrupamento IA dos motivos, gráfico barras |
| T6.4 Filtros (inbox, período, dept) | ✅ | Filtros com estado vazio/loading |
| T6.5 Dashboard home | ✅ | Métricas consolidadas, cards de instância |
| T6.6 Heatmap de horários | ✅ | Atividade por dia da semana e hora |

**Edge Functions**: `analyze-summaries`, `group-reasons`
**Componentes**: `Intelligence`, `IntelligenceKPICards`, `IntelligenceCharts`, `IntelligenceFilters`, `DashboardHome`, `DashboardCharts`, `HelpdeskMetricsCharts`, `BusinessHoursChart`, `TopContactReasons`

---

### M7 - Relatórios de Turno ✅

| Task | Status | Descrição |
|------|--------|-----------|
| T7.1 Configurar relatório por inbox | ✅ | Destinatário, horário, habilitar/desabilitar |
| T7.2 Envio automático diário | ✅ | Cron via edge function |
| T7.3 Conteúdo IA formatado | ✅ | Groq Llama formata KPIs em WhatsApp style |
| T7.4 Logs de envio | ✅ | Histórico com status e conteúdo |

**Edge Functions**: `send-shift-report`
**Tabelas**: `shift_report_configs`, `shift_report_logs`

---

### M8 - Agendamentos & Templates ✅

**Páginas**: `/dashboard/scheduled`

| Task | Status | Descrição |
|------|--------|-----------|
| T8.1 Agendar mensagem única | ✅ | Data/hora específica |
| T8.2 Mensagens recorrentes | ✅ | Diário, semanal (dias), mensal, customizado |
| T8.3 Delay aleatório | ✅ | 5-10s ou 10-20s |
| T8.4 Excluir admins | ✅ | Enviar apenas para membros regulares |
| T8.5 CRUD templates | ✅ | Texto, mídia, carrossel com categorias |
| T8.6 Logs de execução | ✅ | Success/failed por execução |

**Edge Functions**: `process-scheduled-messages`
**Tabelas**: `scheduled_messages`, `scheduled_message_logs`, `message_templates`

---

### M9 - Backup & Manutenção ✅

| Task | Status | Descrição |
|------|--------|-----------|
| T9.1 Backup de tabelas | ✅ | Export JSON de todas as tabelas principais |
| T9.2 Restaurar dados | ✅ | Import JSON com merge |
| T9.3 Cleanup de mídia antiga | ✅ | Auto-delete arquivos > 30 dias |
| T9.4 Listar usuários auth | ✅ | Via admin API |

**Edge Functions**: `database-backup`, `cleanup-old-media`
**Componentes**: `BackupModule`

---


