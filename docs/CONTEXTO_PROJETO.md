# WhatsPRO — Contexto Completo do Projeto (v2.8.0)

> **Cópia de consulta rápida** — Fonte de verdade: `PRD.md` (raiz)
> Atualizado automaticamente pelo Claude Code a cada nova versão.

---

## Visão Geral

WhatsPRO é uma plataforma multi-tenant de atendimento WhatsApp (helpdesk) e CRM.

**Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + UAZAPI + OpenAI gpt-4.1-mini (Agent) + Gemini 2.5 Flash (TTS/fallback) + Groq (transcription/summarization)

**Roles:** `super_admin` (tudo), `gerente` (gerencia equipe/inboxes), `user` (atende conversas)

## Projetos Supabase

| Projeto | Ref | Uso |
|---------|-----|-----|
| **wspro_v2** (ativo) | `euljumeflwtljegknawy` | Frontend .env, edge functions, DB principal |
| **Novo WsmartQR** (legacy) | `crzcpnczpuzwieyzbqev` | Storage de mídia antiga |

---

## M1 — WhatsApp (Instâncias & Grupos) — 9 tasks ✅

**Páginas:** `/dashboard/instances`, `/dashboard/instances/:id`

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T1.1 Criar instância via QR code | Usuário clica "Nova Instância" → scan QR no celular → instância conecta e salva token/ID automaticamente | Admin cria instância "Vendas" para o time comercial |
| T1.2 Listar instâncias com status | Cards com badge verde (online) ou vermelho (offline), atualiza a cada 30s via polling | Dashboard mostra 3 instâncias: 2 online, 1 offline |
| T1.3 Sincronizar instâncias UAZAPI | Dialog compara instâncias locais vs UAZAPI, mostra diff, permite importar novas | Admin detecta instância criada direto na UAZAPI e importa |
| T1.4 Desconectar/excluir | Soft delete (desabilita) ou hard delete (remove do UAZAPI + banco) com confirmação | Admin desativa instância de teste sem perder dados |
| T1.5 Listar grupos | Grid de grupos com nome, foto, participantes. Filtro por texto | Agente busca grupo "Vendas" para enviar mensagem |
| T1.6 Enviar mensagem a grupo | Texto, mídia ou carrossel para grupo selecionado | Marketing envia promoção para grupo de clientes VIP |
| T1.7 Enviar mídia a grupo | Imagem, vídeo, áudio, documento com caption | RH envia PDF de benefícios para grupo da empresa |
| T1.8 Histórico de conexão | Timeline de eventos: conectou, desconectou, erro | Admin investiga por que instância ficou offline às 3h |
| T1.9 Controle de acesso | Tabela `user_instance_access` define quem vê qual instância | Gerente vê só instâncias do seu departamento |

**Edge Functions:** `uazapi-proxy` (actions: connect, status, list, groups, send-message, send-media, send-carousel, disconnect, getProfilePic)
**Tabelas:** `instances`, `user_instance_access`, `instance_connection_logs`
**Endpoints UAZAPI:**
- `POST /instance/connect` — Gera QR code
- `GET /instance/status` — Status da conexão
- `GET /instance/all` — Lista todas (admin)
- `GET /group/list` — Lista grupos
- `POST /send/text` — Envia texto
- `POST /send/media` — Envia mídia
- `POST /send/carousel` — Envia carrossel

---

## M2 — Helpdesk (Atendimento) — 28 tasks ✅

**Página:** `/dashboard/helpdesk`

### Core (T2.1 - T2.10)

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T2.1 Receber mensagens | Webhook UAZAPI → n8n → edge function `whatsapp-webhook` → insere em `conversation_messages` + broadcast realtime | Cliente envia "Oi" → aparece no helpdesk em tempo real |
| T2.2 Filtros avançados | Filtrar por: status, label, departamento, agente atribuído, prioridade, busca por nome/telefone/conteúdo | Gerente filtra "pendentes" + "sem agente" para redistribuir |
| T2.3 Chat em tempo real | Supabase Realtime broadcast channel. Mensagens aparecem sem refresh | Dois agentes veem a mesma conversa atualizar simultaneamente |
| T2.4 Enviar mensagens | Texto (Enter), áudio gravado (botão mic), imagem (botão câmera), documento (botão clip) | Agente responde cliente com texto + envia PDF de orçamento |
| T2.5 Notas privadas | `direction='private_note'`, visíveis só para agentes, ícone 📝 | Agente anota "Cliente irritado, cuidado" para o próximo atendente |
| T2.6 Labels por inbox | CRUD labels com cores. Aplicar/remover em conversas. Filtrar lista por label | Label "Urgente" (vermelho) aplicada em conversa de reclamação |
| T2.7 Departamentos | CRUD por inbox. Atribuir agentes. Filtrar conversas por dept. Dept padrão | Conversa encaminhada de "Vendas" para "Suporte Técnico" |
| T2.8 Atribuir agentes | Select de agente no painel lateral. Auto-assign ao enviar primeira resposta. Broadcast para outros agentes | Gerente atribui conversa ao agente mais disponível |
| T2.9 Status | aberta (verde), pendente (amarela), resolvida (cinza). Tabs com contagem | Agente muda para "resolvida" após resolver problema |
| T2.10 Prioridade | alta/media/baixa. Indicador visual no avatar. Filtro e ordenação | Conversa de cliente VIP marcada como "alta" |

### IA (T2.11 - T2.14)

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T2.11 Resumo IA (auto) | Trigger no status='resolvida' chama Groq Llama → gera motivo + resumo + resolução. Cache 60 dias | Conversa resolvida → resumo "Cliente pediu 2ª via de boleto. Enviado link." |
| T2.12 Resumo IA (manual) | Botão "✨ Resumir" no ContactInfoPanel. Pode forçar refresh | Agente clica para entender contexto de conversa longa (200+ msgs) |
| T2.13 Transcrição de áudio | Groq Whisper automático. Broadcast atualiza em tempo real | Cliente envia áudio de 2min → transcrição aparece abaixo do player |
| T2.14 Status IA | Badge "IA Ativada" no header. Webhook externo (n8n) controla liga/desliga | Bot n8n responde automaticamente, agente vê badge verde |

### UX (T2.15 - T2.28)

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T2.15 Paginação | 200 conversas por página, botão "Carregar mais" | Inbox com 500 conversas carrega rápido, load more para ver antigas |
| T2.16 Busca em mensagens | Debounce 500ms, busca em `conversation_messages.content` | Agente busca "boleto" e encontra conversa de 3 dias atrás |
| T2.17 Painel de contato | Info: nome, telefone, WhatsApp link. Labels, dept, agente, histórico | Agente vê que cliente já teve 5 conversas anteriores |
| T2.18 Layout mobile | 3 views: list/chat/info com botões de navegação | Agente atende pelo celular com navegação fluida |
| T2.19 Webhooks de saída | URL configurável por inbox. Dispara ao enviar mensagem outgoing | n8n recebe notificação quando agente responde para trigger externo |
| T2.20 Foto de perfil UAZAPI | Auto-fetch via `POST /contact/getProfilePic`. Persiste no banco | Contato sem foto → busca na UAZAPI → salva e exibe avatar |
| T2.21 Avatar no header | Foto 32px ao lado do nome. Fallback: iniciais ou ícone User | Header: [foto] Carlos Bezerra 558788239328 |
| T2.22 Divider não lidos | Linha "Novas mensagens" entre mensagens lidas e não lidas | Agente abre conversa → vê exatamente onde parou de ler |
| T2.23 Som de notificação | Beep ao receber msg incoming com janela fora de foco | Agente em outra aba ouve beep → volta para atender |
| T2.24 Drag-and-drop | Arrastar arquivo sobre área de mensagens → overlay "Solte aqui" | Agente arrasta PDF do Explorer direto para o chat |
| T2.25 Info início conversa | "Conversa iniciada em 24/02/2026 às 12:06" acima das mensagens | Agente sabe há quanto tempo conversa existe |
| T2.26 Broadcast status | Mudança de status sincroniza em tempo real entre agentes/tabs | Agente A resolve → Agente B vê sumir da lista "Atendendo" |
| T2.27 Stale fetch guard | `fetchIdRef` impede mensagens de conversa A aparecerem em conversa B | Troca rápida de conversa não mostra dados misturados |
| T2.28 Confirm delete notas | AlertDialog "Excluir nota?" antes de apagar | Agente não apaga nota acidentalmente |

**Edge Functions:** `whatsapp-webhook`, `sync-conversations`, `auto-summarize`, `summarize-conversation`, `transcribe-audio`, `activate-ia`, `fire-outgoing-webhook`
**Tabelas:** `inboxes`, `inbox_users`, `conversations`, `conversation_messages`, `contacts`, `labels`, `conversation_labels`, `departments`, `department_members`
**Componentes:** `ChatPanel`, `ChatInput`, `ConversationList`, `ConversationItem`, `ContactInfoPanel`, `MessageBubble`, `AudioPlayer`, `NotesPanel`, `ConversationStatusSelect`, `ContactAvatar`
**Hooks:** `useHelpdeskInboxes`, `useHelpdeskConversations`, `useHelpdeskFilters`, `useSendFile`, `useAudioRecorder`, `useContactProfilePic`, `useToggleLabel`
**Utilities:** `helpdeskBroadcast.ts` (broadcastNewMessage, broadcastAssignedAgent, broadcastStatusChanged, assignAgent)

---

## M3 — Broadcast (Disparador) — 13 tasks ✅

**Páginas:** `/dashboard/broadcast`, `/dashboard/broadcast/history`, `/dashboard/broadcast/leads`

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T3.1 Broadcast para grupos | Selecionar instância → selecionar grupos (multi-select) → compor mensagem → enviar | Marketing envia promoção para 30 grupos de clientes |
| T3.2 Broadcast para leads | Selecionar database → selecionar contatos → enviar texto/mídia | Vendas envia oferta personalizada para 200 leads qualificados |
| T3.3 Progresso em tempo real | Modal com barra de progresso, contadores success/failed, botões pause/resume/cancel | Envio para 500 leads: 340/500 ✅ 12 ❌ — pausa para ajustar |
| T3.4 Delay aleatório | Opções: sem delay, 5-10s, 10-20s entre envios | Delay de 10-20s para parecer envio manual e evitar ban |
| T3.5 Excluir admins | Filtrar admins dos participantes do grupo | Enviar só para membros regulares, não admins |
| T3.6 Histórico | Lista de broadcasts com filtros por data/status/tipo/instância | Gerente verifica quantos broadcasts foram feitos este mês |
| T3.7 Reenviar | Botão "Reenviar" copia dados para novo broadcast | Reenviar promoção que falhou em 50 contatos |
| T3.8 Carrossel | Cards com imagem + texto + botões (REPLY/URL/CALL/COPY) | Catálogo de produtos com botão "Comprar" (URL para loja) |
| T3.9 Base de leads | CRUD databases. Import: CSV, paste, extrair de grupos, manual | Importar 10k contatos de planilha CRM via CSV |
| T3.10 Verificação | `POST /chat/check` verifica se números têm WhatsApp | Limpar base: 8k válidos, 2k inválidos removidos |
| T3.11 Templates | CRUD com categorias. Texto, mídia, carrossel reutilizáveis | Template "Boas-vindas" usado em todo broadcast de onboarding |
| T3.12 Sanitização CSV | Limite 10MB, max 50k linhas, strip injection (=, +, @, -) | Upload de CSV suspeito → caracteres perigosos removidos |
| T3.13 Limites | Max 500 phones, 50 groups, 10 cards carrossel, 12MB áudio | Tentativa de enviar para 600 → erro "máximo 500" |

**Endpoints UAZAPI:** `/send/text`, `/send/media`, `/send/carousel`, `/chat/check`
**Tabelas:** `broadcast_logs`, `lead_databases`, `lead_database_entries`, `message_templates`

---

## M4 — CRM Kanban — 11 tasks ✅

**Páginas:** `/dashboard/crm`, `/dashboard/crm/:boardId`

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T4.1 CRUD boards | Criar, editar nome/descrição, duplicar (copia colunas+campos+entidades), excluir com confirmação | Criar board "Pipeline Vendas" com 5 colunas |
| T4.2 Visibilidade | Shared (todos veem) ou private (só criador + membros) | Board "Leads Internos" privado para time de vendas |
| T4.3 Colunas drag-drop | Reordenar colunas arrastando. Cor customizável. Criar/excluir | Mover coluna "Negociação" para antes de "Fechado" |
| T4.4 Cards drag-drop | Mover cards entre colunas arrastando. Posição persistida. Rollback se DB falhar | Arrastar lead "João" de "Novo" para "Qualificado" |
| T4.5 Campos customizados | Tipos: text, currency, date, select, entity_select. Sheet lateral de detalhes | Campo "Valor do Deal" (currency) = R$ 15.000 |
| T4.6 Entidades customizadas | Enums: "Produto" (A, B, C), "Origem" (Site, WhatsApp, Indicação) | Select "Produto" mostra opções cadastradas pelo admin |
| T4.7 Automação coluna | Ao mover card para coluna X, envia mensagem WhatsApp automática | Card move para "Aprovado" → cliente recebe "Parabéns!" |
| T4.8 Membros do board | Roles: editor (CRUD cards), viewer (só visualiza) | Estagiário adicionado como viewer no pipeline |
| T4.9 Filtro por responsável | Chips com avatar. Múltipla seleção. `aria-pressed` | Gerente filtra cards do agente "Maria" |
| T4.10 Busca de cards | Por título, tags, responsável. Debounce | Buscar "João" encontra card com tag "Cliente Premium" |
| T4.11 Contagem otimizada | RPC `get_kanban_board_counts` (1 query em vez de N+1) | Lista de boards mostra "32 cards" sem query extra por board |

**Tabelas:** `kanban_boards`, `kanban_columns`, `kanban_cards`, `kanban_card_data`, `kanban_fields`, `kanban_entities`, `kanban_entity_values`, `kanban_board_members`

---

## M5 — Admin & Usuários — 13 tasks ✅

**Páginas:** `/dashboard/admin/*` (sub-rotas individuais), `/dashboard/settings`
**Sub-rotas admin:** `/admin/inboxes`, `/admin/users`, `/admin/departments`, `/admin/secrets`
**Sub-rotas docs:** `/docs`, `/roadmap`, `/backup`

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T5.1 CRUD usuários | Criar via edge function (Supabase Auth), editar perfil, desativar | Admin cria conta para novo atendente |
| T5.2 Roles | super_admin, gerente, user. Confirmação ao mudar role | Promover atendente a gerente com AlertDialog |
| T5.3 CRUD inboxes | Criar inbox vinculada a instância. Webhook auto-gerado | Criar inbox "Suporte" vinculada à instância "Principal" |
| T5.4 Membros de inbox | Checkboxes inline nos cards de equipe. Roles: admin/gestor/agente | Atribuir 3 agentes à inbox "Vendas" |
| T5.5 Departamentos | CRUD por inbox. Marcar departamento padrão | Criar dept "Financeiro" na inbox "Suporte" |
| T5.6 Acesso a instâncias | Atribuir instâncias específicas por usuário | Gerente regional vê só instâncias da sua região |
| T5.7 Webhooks por inbox | URL de entrada (n8n) + URL de saída (outgoing) copiáveis | Configurar webhook n8n para agente IA |
| T5.8 Secrets | Gerenciar GROQ_API_KEY, UAZAPI_ADMIN_TOKEN, ALLOWED_ORIGIN | Rotacionar API key do Groq |
| T5.9 Docs in-app | 11 módulos documentados na aba "Docs" | Novo dev consulta como funciona o broadcast |
| T5.10 Equipe unificada | Cards expandíveis: info + inboxes + instâncias + departamentos | Ver de uma vez tudo que o agente "Maria" tem acesso |
| T5.11 Endpoint copiável | URL do whatsapp-webhook auto-gerada com botão copy | Admin copia URL para configurar no n8n |
| T5.12 Docs completos | 11/11 módulos com PRDs embutidos | Cobertura 100% da documentação |
| T5.13 Backup env vars | Exporta system_settings + template .env | Backup das variáveis antes de migração |

**Edge Functions:** `admin-create-user`, `admin-update-user`, `admin-delete-user`
**Tabelas:** `user_profiles`, `user_roles`, `user_instance_access`, `system_settings`

---

## M6 — Inteligência & Analytics — 6 tasks ✅

**Páginas:** `/dashboard/intelligence`, `/dashboard` (home)

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T6.1 KPIs | Cards: principal motivo, produto mais citado, principal objeção, sentimento (3 porcentagens) | "40% positivo, 35% neutro, 25% negativo" |
| T6.2 Gráficos | BarChart motivos (horizontal), PieChart sentimento (donut), BarChart produtos/objeções | Gerente vê que "prazo de entrega" é top motivo (23x) |
| T6.3 Top motivos IA | Groq agrupa motivos similares. Badge "Agrupado por IA" | 50 motivos diferentes → 8 categorias agrupadas |
| T6.4 Filtros + cache | Período (1-90 dias), inbox. Cache React Query 5min. Botão "Regenerar". "Copiar Análise" para clipboard | Gerente gera análise → copia → cola no email para diretoria |
| T6.5 Dashboard home | KPIs consolidados, leads hoje/ontem, gráficos de instâncias, heatmap horários | Admin vê visão geral: 5 instâncias, 23 leads hoje (+15%) |
| T6.6 Heatmap horários | Distribuição por hora (Brasília). Comercial/noite/fds com cores | 70% das mensagens entre 8h-18h (comercial) |

**Edge Functions:** `analyze-summaries` (max 200 convs, Groq Llama, retry + fallback), `group-reasons`
**Endpoints:** Limite de 200 conversas com `total_available` na resposta para transparência

---

## M7 — Relatórios de Turno — 4 tasks ✅

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T7.1 Config por inbox | Destinatário (WhatsApp), horário de envio, habilitar/desabilitar | Configurar envio diário às 18h para o gerente |
| T7.2 Envio automático | pg_cron verifica hora. Edge function gera e envia | 18h → relatório enviado automaticamente para o gestor |
| T7.3 Conteúdo IA | Groq formata KPIs (total, resolvidas, top agente, motivos) em estilo WhatsApp com emojis | "📊 Relatório: 45 conversas, 38 resolvidas (84%), Top: Maria (15)" |
| T7.4 Logs de envio | Histórico: status, data, contadores, conteúdo | Admin verifica que relatório de ontem falhou → investiga |

**Edge Functions:** `send-shift-report` (cron hourly + manual trigger)
**Tabelas:** `shift_report_configs`, `shift_report_logs`

---

## M8 — Agendamentos & Templates — 6 tasks ✅

**Página:** `/dashboard/scheduled`

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T8.1 Agendar única | Data/hora específica para enviar mensagem para grupo/contato | Enviar lembrete de reunião amanhã às 9h |
| T8.2 Recorrência | Diário, semanal (escolher dias), mensal, intervalo customizado | Todo dia útil às 8h enviar "Bom dia" para grupo |
| T8.3 Delay aleatório | 5-10s ou 10-20s entre envios (anti-spam) | Mensagem recorrente com delay para parecer manual |
| T8.4 Excluir admins | Enviar apenas para membros regulares do grupo | Aviso enviado para membros, não para admins |
| T8.5 CRUD templates | Texto, mídia, carrossel com categorias. Reutilizáveis em broadcast | Template "Promoção Semanal" usado toda segunda-feira |
| T8.6 Logs de execução | Success/failed por execução. Histórico expansível | Ver que agendamento de ontem enviou 45/50 com sucesso |

**Edge Functions:** `process-scheduled-messages` (cron every minute)
**Tabelas:** `scheduled_messages`, `scheduled_message_logs`, `message_templates`

---

## M9 — Backup & Manutenção — 4 tasks ✅

| Task | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| T9.1 Backup tabelas | Export JSON de todas as tabelas principais (schema + data) | Admin faz backup antes de atualização grande |
| T9.2 Restaurar | Import JSON com merge (não sobrescreve existentes) | Restaurar dados de teste em ambiente staging |
| T9.3 Cleanup mídia | Auto-delete arquivos > 30 dias no storage. Cron diário 3h UTC | Storage não cresce indefinidamente |
| T9.4 Exportar env vars | Download de system_settings + template .env | Salvar configuração antes de migrar para novo servidor |

**Edge Functions:** `database-backup`, `cleanup-old-media`
**Componentes:** `BackupModule`

---

## M10 — Agente de IA WhatsApp — 22 tasks (22 ✅ / 0 📋) — S1-S3 COMPLETAS

> Consulte `/ai-agent` para roadmap detalhado por sprint com exemplos de fluxo.

**Arquitetura:** Orquestrador com 8 tools via OpenAI gpt-4.1-mini function calling
**Cérebro:** OpenAI gpt-4.1-mini (LLM primário). Fallback: Gemini 2.5 Flash → Mistral Small → templates estáticos
**Edge Functions:** `ai-agent` (cérebro), `ai-agent-debounce` (agrupamento 10s), `ai-agent-playground` (simulado, super_admin)
**Tabelas:** `ai_agents` (+ extraction_fields JSONB), `ai_agent_products`, `ai_agent_knowledge`, `ai_agent_media`, `ai_agent_logs`, `lead_profiles`, `ai_debounce_queue`, `conversations` (+ tags TEXT[])
**Admin:** 10 tabs (Geral, Cérebro, Catálogo, Conhecimento, Regras, Guardrails, Voz, Extração, Sub-Agentes, Métricas) + Playground
**TTS:** Gemini 2.5 Flash Preview TTS (chain: Gemini → Cartesia → Murf → Speechify → texto). 6 vozes configuráveis.
**Sub-agentes:** 5 modos (SDR, Sales, Support, Scheduling, Handoff) com prompts individuais em ai_agents.sub_agents JSONB
**Páginas dedicadas:** `/dashboard/ai-agent`, `/ai-agent/catalog`, `/ai-agent/knowledge`, `/ai-agent/playground`

| Sprint | Tasks | Status |
|--------|-------|--------|
| S1 — MVP | 7/7 | ✅ Agente, debounce, webhook, admin tabs |
| S2 — Catálogo | 7/7 | ✅ Produtos, search, carousel, media, qualificação |
| S3 — Handoff | 7/7 | ✅ Labels, tags, kanban, shadow, extração, handoff melhorado |
| S4 — Voz/Playground | 5/5 | ✅ TTS Gemini, Playground, Métricas, Sub-agentes |
| S5 — Contexto/Leads | 4/5 | 🔄 S5.1-S5.4 completas, falta S5.5 duplicar agente |

**Tools implementados (8):** search_products, send_carousel, send_media, assign_label, set_tags, move_kanban, update_lead_profile, handoff_to_human
**Qualificação:** 1 pergunta por msg → QUALIFICAR → BUSCAR → APRESENTAR → HANDOFF automático
**Labels:** Pipeline stages (Novo → Qualificando → Interessado → Atendimento Humano)
**Tags:** "chave:valor" cumulativas em conversations.tags TEXT[]
**Shadow mode:** status_ia='shadow' — IA extrai dados sem responder
**Tools planejados:** send_location, send_contact, assign_agent, assign_department

---

## Infraestrutura

### Banco de Dados — 44+ tabelas com RLS
- **Indexes:** conversations (inbox_id, status, priority, assigned_to, department_id, last_message_at), contacts (jid UNIQUE, phone), kanban_cards (board_id, column_id)
- **Vault:** API keys em `supabase_vault`
- **RPCs:** `delete_inbox`, `get_kanban_board_counts`, `is_super_admin`, `has_inbox_access`, `can_access_kanban_board`

### Edge Functions — 30 total
| Function | Auth | Descrição |
|----------|------|-----------|
| uazapi-proxy | JWT + instance | Proxy UAZAPI (17 actions) |
| whatsapp-webhook | Public | Recebe msgs do WhatsApp via n8n |
| sync-conversations | JWT | Sincroniza conversas UAZAPI → DB |
| auto-summarize | Cron/JWT | Gera resumo IA automático |
| summarize-conversation | JWT | Resumo individual de conversa |
| analyze-summaries | Super admin | Inteligência de negócios |
| group-reasons | JWT | Agrupa motivos de contato via IA |
| transcribe-audio | JWT/Anon | Transcrição Whisper |
| send-shift-report | Cron/Admin | Relatórios de turno |
| process-scheduled-messages | Cron | Executa agendamentos |
| admin-create-user | Super admin | Criar usuário |
| admin-update-user | Super admin | Atualizar usuário |
| admin-delete-user | Super admin | Deletar usuário |
| activate-ia | JWT | Ativar/desativar IA na conversa |
| cleanup-old-media | Cron | Limpar mídia antiga |
| database-backup | Super admin | Backup do banco |
| fire-outgoing-webhook | Internal | Dispara webhook de saída |
| ai-agent | Webhook | Cérebro IA (OpenAI gpt-4.1-mini + function calling) |
| ai-agent-debounce | Webhook | Agrupa msgs 10s + typing indicator |
| ai-agent-playground | Super admin | Chat simulado para testar agente IA |

### Hooks Reutilizáveis
| Hook | Descrição |
|------|-----------|
| `useContactProfilePic` | Auto-fetch foto de perfil via UAZAPI + persist DB |
| `useToggleLabel` | Toggle de labels com DB + error handling |
| `useSupabaseQuery` | Fetch genérico (loading/error/refetch) |
| `useHelpdeskInboxes` | Inboxes, labels, department filter |
| `useHelpdeskConversations` | Conversas, paginação, realtime broadcast |
| `useHelpdeskFilters` | Filtros busca/label/assignment/priority |
| `useAudioRecorder` | Gravação OGG/Opus com timer |
| `useSendFile` | Upload Storage + envio UAZAPI + broadcast |
| `useInstances` | Lista instâncias com status |

### Utilities
| Utility | Descrição |
|---------|-----------|
| `helpdeskBroadcast.ts` | broadcastNewMessage, assignAgent, broadcastStatusChanged |
| `handleError()` | Error handling padronizado com toast |
| `edgeFunctionFetch()` | Fetch autenticado para edge functions |
| `formatBR()` / `smartDateBR()` | Formatação de datas pt-BR |
| `STATUS_OPTIONS` / `PRIORITY_OPTIONS` | Constantes compartilhadas |

### Componentes Reutilizáveis
| Componente | Descrição |
|------------|-----------|
| `ConversationStatusSelect` | Dropdown status (aberta/pendente/resolvida) |
| `ContactAvatar` | Avatar com fallback (image → initials → icon) |
| `ErrorBoundary` | Error boundary com retry + guard anti-loop |

---

## Regra Crítica

> **Após implementar e testar qualquer funcionalidade, SEMPRE atualizar:**
> 1. `PRD.md` — Incrementar versão, changelog, marcar tasks
> 2. `RoadmapTab.tsx` — Arrays MODULES, CHANGELOG
> 3. `docs/CONTEXTO_PROJETO.md` — Este arquivo
> 4. Memory do Claude — `~/.claude/.../memory/project_whatspro.md`
