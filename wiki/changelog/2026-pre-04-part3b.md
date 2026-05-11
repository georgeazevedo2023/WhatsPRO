---
title: Changelog — Pré 2026-04 — parte 3b
type: changelog-archive
updated: 2026-05-11
---

# Changelog — Releases v1-v2.9 (até 2026-03-23)

> Continuação de [[wiki/changelog/2026-pre-04-part3a]]. Read-only.

---

### v2.9.0 (2026-03-23) — Auditoria Completa do Sistema (30 Sugestões)

**Escopo**: Auditoria em 5 dimensões — Frontend (268 arquivos), Edge Functions (21), Banco de Dados (54 migrations), UX/UI, Hooks/Services/Utils.

**Segurança (Críticas):**
- **CORS wildcard em produção**: `_shared/cors.ts` default `*` se ALLOWED_ORIGIN não setada — deve falhar hard
- **JWT tokens expostos**: Migrations de cron jobs contêm tokens hardcoded no git history — necessário rotacionar
- **npm vulnerabilities**: react-router-dom XSS (Open Redirects), flatted DoS/Prototype Pollution — `npm audit fix`
- **ai-agent aceita service role key**: Deve aceitar apenas anon key + validar via RLS
- **Rate limiting ausente**: Endpoints caros (transcribe, summarize, analyze) sem throttle per-user
- **Fetch sem timeout**: Nenhum fetch() nas Edge Functions tem timeout configurado

**Banco de Dados:**
- **10 indexes faltando**: contacts(phone), conversations(assigned_to, status), conversation_messages(sender_id), inbox_users(user_id), departments(inbox_id), lead_database_entries(phone), kanban_cards(board_id, column_id) composite
- **7 FKs faltando**: conversations.assigned_to, conversation_messages.sender_id, department_members.user_id, kanban_board_members.user_id, kanban_cards.assigned_to → user_profiles
- **UNIQUE faltando**: lead_database_entries(database_id, phone), message_templates(user_id, name)
- **Race condition**: ai-agent-debounce check-then-act → deve usar upsert com onConflict
- **Trigger hardcoded**: auto_summarize_on_resolve com URL + JWT fixos — mover para env vars

**Código & Tipagem:**
- **TypeScript strict mode desabilitado**: noImplicitAny, strictNullChecks, strict = false
- **ESLint no-unused-vars desabilitado**: Permite dead code
- **11 tipos TS faltando**: Department, KanbanBoard, KanbanCard, KanbanField, LeadDatabase, LeadDatabaseEntry, UserRole, InboxUser, etc.
- **Bug broadcastSender.ts**: `groupjid: number` deveria ser `string`
- **Bug normalizePhone**: Últimos 8 dígitos cria falsos positivos — usar 10-11 dígitos

**UX/UI:**
- **Navegação "Leads" duplicada**: Broadcast/Leads E CRM/Leads — consolidar
- **Mobile Helpdesk**: Layout 3-painéis não adapta — implementar tab switching
- **Empty states sem CTAs**: Sem botões de ação ("Criar primeiro quadro", etc.)
- **Form validation apenas toast**: Sem validação inline nos campos
- **Breadcrumbs ausentes**: Sem indicação de localização atual
- **Password reset inexistente**: Sem link "Esqueci minha senha" no Login
- **God Components**: 8 componentes com 600-810 linhas (BackupModule, Sidebar, KanbanBoard, Leads)

**Performance & Qualidade:**
- **staleTime global ausente**: React Query refetch em cada re-mount — configurar 5min default
- **AuthContext re-renders**: 6 setState separados — consolidar em objeto único
- **Error responses inconsistentes**: Edge Functions retornam formatos diferentes
- **Zero testes**: vitest instalado mas nenhum test file no projeto

**Pontos Fortes Confirmados:**
- RLS abrangente (70+ policies cobrindo todas as tabelas)
- Lazy loading em 47 rotas com Error Boundaries
- Organização feature-based excelente (268 arquivos)
- Nenhum secret hardcoded no frontend
- Cleanup de subscriptions realtime correto
- shadcn/ui consistente (52 componentes)

**Skills atualizadas**: `/prd`, `/ai-agent`, `/uazapi` com findings da auditoria
**Roadmap**: Adicionados R38-R52 com as 30 sugestões de melhoria priorizadas

### v1.8.0 (2026-03-21) — Estudo Expert UAZAPI + Roadmap API
- **Skill**: Criada skill `/uazapi` expert com 1042 linhas — documentação completa da API UAZAPI v2
- **API**: 50+ endpoints documentados com payloads de request/response (instância, mensagens, grupos, contatos, perfil, webhook, sessão)
- **Proxy**: Mapeamento completo de 17 actions implementadas + 15 actions planejadas no uazapi-proxy
- **Webhook**: 6 tipos de eventos documentados (messages, status, connection, group, call, presence)
- **Roadmap**: Adicionados R31-R36 — endpoints críticos da UAZAPI necessários para M10-M13 (send/quickreply, send/list, send/reaction, send/template, group/create+add+remove, webhook events)
- **Infra**: Documentação de normalização de dados (PascalCase/camelCase, JID, timestamps, carousel retry)
- **Troubleshooting**: 10 problemas comuns catalogados com soluções

### v2.8.0 (2026-03-22) — S5.4: Integração Lead ↔ CRM Kanban
- **Migration**: kanban_cards.contact_id UUID FK + index
- **move_kanban melhorado**: busca por contact_id (FK direto), auto-cria card se não existe
- **Leads.tsx**: coluna "Estágio" com badge colorido da coluna Kanban
- **LeadDetailPanel**: seção CRM com estágio atual + link "Ver no CRM"
- **KanbanCardItem**: badge "Lead" + avatar + telefone em cards vinculados
- **CardDetailSheet**: mini-card do lead vinculado com avatar, nome, telefone

### v2.7.0 (2026-03-22) — S5.3: Cartão do Lead Completo
- **LeadDetailPanel refatorado**: 6 seções em Accordion (Perfil, Endereço, Campos Adicionais, Histórico, Ações, Arquivos)
- **ExtractionConfig expandida**: 3 seções (Perfil, Endereço com toggle, Campos Adicionais dinâmicos)
- **Perfil**: origem (select), aniversário, tags, labels, block IA
- **Endereço**: rua, número, bairro, cidade, CEP (editável)
- **Campos Adicionais**: email, documento, profissão, site + custom (editável)
- **Histórico**: resumo IA + resumo longo + contexto + timeline conversas + botão "Ver conversa"
- **Ações**: timeline cronológica de eventos (ai_agent_logs + tool calls)
- **Arquivos**: todas mídias agrupadas (imagens grid, docs lista, áudios, vídeos)
- **Edição inline**: atendente pode editar campos e salvar
- **Migration**: lead_profiles + origin, address JSONB, email, document, birth_date, custom_fields JSONB
- **Roadmap**: R37 Link Tracker adicionado como item futuro

### v2.6.0 (2026-03-22) — M11: Módulo Leads (Página Dedicada)
- **Leads.tsx**: Página /dashboard/leads com tabela de contatos, filtro por instância, busca por nome/telefone/tag
- **LeadDetailPanel**: Sheet lateral com perfil completo, campos extraídos, tags, labels, timeline de conversas, resumo IA, histórico longo
- **ConversationModal**: Dialog com chat read-only (todas as mensagens: lead + IA + vendedor)
- **Block IA**: Toggle global contacts.ia_blocked — agente ignora número em todas instâncias (equipe interna/fornecedores)
- **Clear context**: Limpa conversation_summaries, interests, notes sem apagar mensagens do helpdesk
- **Sidebar**: Link direto "Leads" entre CRM e Agente IA (super_admin + gerente)
- **ai-agent**: Check ia_blocked antes de processar (early return)
- **Migration**: contacts.ia_blocked BOOLEAN + index

### v2.5.0 (2026-03-22) — M10: S5.1 Contexto Longo Persistente
- **conversation_summaries**: JSONB array em lead_profiles — armazena resumo de cada interação (data, summary, products, sentiment, outcome, tools_used)
- **Auto-append**: após cada resposta do agente, gera mini-resumo e appenda (max 10 entradas)
- **Injeção no prompt**: últimas 5 interações carregadas e injetadas como "Histórico de interações anteriores"
- **Personalização**: prompt instrui IA a fazer referência a interações passadas quando relevante
- **Migration**: lead_profiles.conversation_summaries JSONB DEFAULT '[]'

### v2.4.0 (2026-03-22) — M10: Sprint 4 Completa (Áudio, Métricas, Sub-agentes)
- **S4.2 Áudio bidirecional**: TTS via Gemini (response_modalities: AUDIO, voz Kore) → envio como PTT via UAZAPI quando voice_enabled e response ≤ max_text_length
- **S4.3 Métricas**: MetricsConfig.tsx — KPIs (respostas, handoff rate, latência, tokens), tool usage bars, heatmap horário, custo estimado, filtro por período
- **S4.5 Sub-agentes**: SubAgentsConfig.tsx — 5 modos (SDR, Sales, Support, Scheduling, Handoff) com toggle + prompt individual, injetados no system prompt como "Modos de atendimento"
- **Admin**: 10 tabs (Geral, Cérebro, Catálogo, Conhecimento, Regras, Guardrails, Voz, Extração, Sub-Agentes, Métricas)

### v2.3.0 (2026-03-22) — M10: Sprint 3 Completa (Labels, Tags, Shadow, Extração)
- **S2.7 Aprimorado**: Qualificação com 1 pergunta por mensagem, auto-handoff quando lead qualificado (produto + nome)
- **S3.3 assign_label / set_tags**: Labels = pipeline (Novo → Qualificando → Interessado → Atendimento), tags = "chave:valor" cumulativas
- **S3.4 move_kanban**: Busca board por instance_id, coluna por nome, card por contact name, move automaticamente
- **S3.5 Shadow mode**: status_ia='shadow' — IA ouve sem responder, extrai dados via Gemini (set_tags + update_lead_profile)
- **S3.6 ExtractionConfig**: Admin tab "Extração" com campos configuráveis (nome, cidade, bairro, interesses, orçamento + custom)
- **update_lead_profile tool**: Upsert em lead_profiles com nome, cidade, interesses, notas
- **Handoff melhorado**: Auto-label "Atendimento Humano", auto-tag "ia:desativada", transição para shadow mode
- **Migration**: conversations.tags TEXT[] + ai_agents.extraction_fields JSONB + GIN index
- **8 tools totais**: search_products, send_carousel, send_media, assign_label, set_tags, move_kanban, update_lead_profile, handoff_to_human
- **maxAttempts**: 3 → 5 rounds de function calling

### v2.2.0 (2026-03-22) — M10: Sprint 2 Completa (Catálogo + Qualificação)
- **Tool send_carousel**: Envia carrossel de produtos via UAZAPI /send/carousel com imagens e botão "Quero este!" (REPLY)
- **Tool send_media**: Envia imagem/documento via UAZAPI /send/media (image, video, document) com legenda
- **Lógica de qualificação**: System prompt com fluxo QUALIFICAR → BUSCAR → APRESENTAR → ACOMPANHAR
- **Instance token early-load**: Token resolvido antes do loop Gemini para uso nos tools de envio
- **Playground sync**: send_carousel e send_media simulados no playground (sem envio real)
- **Tools implementados**: search_products, send_carousel, send_media, handoff_to_human (4 tools)

### v2.1.0 (2026-03-22) — M10: Agente de IA WhatsApp (Sprint 1-4 Implementadas)
- **Sprint 1 (MVP)**: Agente responde via Gemini 2.5 Flash com debounce 10s, saudação obrigatória, contexto curto
- **Tabelas**: ai_agents, ai_agent_logs, ai_debounce_queue, lead_profiles, ai_agent_products, ai_agent_knowledge, ai_agent_media (7 tabelas com RLS)
- **Edge Functions**: ai-agent (cérebro com function calling), ai-agent-debounce (agrupamento 10s + typing indicator), ai-agent-playground (chat simulado)
- **Webhook**: whatsapp-webhook integrado — detecta agente ativo → chama debounce automaticamente
- **Sprint 2 (Catálogo)**: CRUD produtos com upload de fotos (webp/png/jpg), geração de descrição por IA (Gemini), foto destaque, filtros por categoria/estoque/preço, tool search_products com SQL
- **Sprint 3 (Handoff)**: Regras de transbordo (gatilhos texto, sentimento negativo, limite tempo, cooldown), guardrails (tópicos bloqueados, frases proibidas, limite desconto), tool handoff_to_human
- **Sprint 4 (Voz/Playground)**: Config TTS + Playground com chat simulado (edge function com auth super_admin)
- **Admin**: 7 tabs (Geral, Cérebro, Catálogo, Conhecimento, Regras, Guardrails, Voz) + Playground dedicado
- **Knowledge Base**: FAQ (pergunta+resposta) + upload de documentos (PDF, TXT, DOC, DOCX até 20MB)
- **Admin reorganizado**: Sub-rotas individuais (/admin/inboxes, /admin/users, etc.), sidebar collapsibles
- **20 edge functions deployadas** (3 novas M10: ai-agent, ai-agent-debounce, ai-agent-playground)
- **Skill**: `/ai-agent` criada com roadmap detalhado por sprint

### v2.0.0 (2026-03-21) — M10: Agente de IA WhatsApp (Planejamento)
- **Novo módulo M10**: Agente de IA autônomo por instância WhatsApp
- **Arquitetura**: Orquestrador + 5 sub-agentes (SDR, Sales, Support, Scheduling, Handoff)
- **Cérebro**: Gemini 2.5 Flash (multimodal: texto, áudio, imagem)
- **Infra**: Edge functions ai-agent + ai-agent-debounce
- **Admin**: 10 tabs de configuração (Geral, Cérebro, Conhecimento, Catálogo, Regras, Extração, Voz, Guardrails, Métricas, Playground)
- **Banco**: 7 novas tabelas (ai_agents, ai_agent_products, ai_agent_knowledge, ai_agent_media, ai_agent_logs, lead_profiles, ai_debounce_queue)
- **Tools**: 13 tools (search_products, send_carousel, send_media, send_location, send_contact, assign_agent, assign_department, assign_label, set_tags, move_kanban, schedule_followup, handoff, extract_lead_data)
- **Features**: Debounce 10s, handoff com shadow mode, qualificação de produtos, TTS bidirecional, contexto curto/longo
- **Skill**: Criada skill `/ai-agent` com roadmap detalhado por sprint (S1-S5)
- **Novo módulo M11**: Leads (gerenciamento dedicado fora do disparador) — planejado para Sprint 5
- **Performance**: Bundle principal 611KB → 146KB (-76%) via code splitting (manualChunks)
- **Fix**: KanbanCRM/KanbanBoard try/catch + error state (spinner infinito)

### v1.9.0 (2026-03-21) — Auditoria Profunda + UX Helpdesk + Refatoração

**Inteligência de Negócios (M6):**
- Cores tema-aware nos gráficos (10+ HSL hardcoded → CSS vars)
- Cache React Query 5min + timestamp "Análise gerada em..."
- Botão "Copiar Análise" (formato texto legível)
- Limite 100→200 conversas + aviso "Analisadas X de Y"
- Sentiment card mostra 3 porcentagens (positivo/neutro/negativo)
- Key Insights como lista numerada
- Botão duplicado "Gerar Análise" removido

**Helpdesk (M2) — 10 novas tasks:**
- T2.20-T2.28: Foto de perfil UAZAPI, avatar header, divider não lidos, som notificação, drag-drop arquivos, info início conversa, broadcast status, stale fetch guard, confirm delete notas
- Fix stale closure no fetchMessages (bug que impedia mensagens de aparecer)
- Migração de 2489 mensagens entre projetos Supabase

**Auditoria Multi-Módulo — 30+ fixes:**
- Segurança: Token leak removido do useInstances, signOut error handling, ErrorBoundary anti-loop
- Tema: Login.tsx, Sidebar.tsx, KPICards.tsx, MessageBubble.tsx, AudioPlayer.tsx, ChatInput.tsx, ConversationItem.tsx
- Performance: BusinessHoursChart N+1 eliminado, HelpdeskMetrics com filtro de período, useSendFile base64 O(n²)→FileReader, CardDetailSheet upsert batch
- Kanban: BoardCard duplicate com try/catch, drag-drop rollback, unique constraint card_field
- Error handling: DynamicFormField .catch(), ScheduledMessages mutation typing, AudioPlayer play() try/catch
- UX: Settings phone validation, versão v1.6.0, provider Supabase Cloud

**Refatoração — 5 novos reutilizáveis:**
- `useContactProfilePic` hook (eliminou duplicação ChatPanel + ContactInfoPanel)
- `helpdeskBroadcast.ts` utilities (eliminou 5+ broadcast duplicados)
- `ConversationStatusSelect` component (eliminou 3 Select duplicados)
- `ContactAvatar` component (avatar com fallback reutilizável)
- `useToggleLabel` hook (toggle de labels reutilizável)

### v1.8.0 (2026-03-21) — UAZAPI Expert Skill + Módulos Futuros
- **UAZAPI Skill**: Documentação completa de todos os endpoints da API WhatsApp
- **Webhook**: 6 tipos de eventos documentados (messages, status, connection, group, call, presence)
- **Roadmap**: Adicionados R31-R36 — endpoints críticos da UAZAPI necessários para M10-M13 (send/quickreply, send/list, send/reaction, send/template, group/create+add+remove, webhook events)
- **Infra**: Documentação de normalização de dados (PascalCase/camelCase, JID, timestamps, carousel retry)
- **Troubleshooting**: 10 problemas comuns catalogados com soluções

### v1.7.0 (2026-03-21) — Detalhamento Completo dos Novos Módulos
- **M10**: 12 tasks detalhadas com exemplos de fluxo, tipos de nodes, templates de funil, condições, triggers, variáveis, A/B testing, métricas, integrações CRM, pause/resume, fallback humano, delays inteligentes, ações por step
- **M11**: 12 tasks detalhadas com schemas SQL, fluxos de checkout, provedores de pagamento, fulfillment tracking, invoices, estoque, relatórios de vendas, cupons de desconto, carrinho persistente, catálogo web
- **M12**: 10 tasks detalhadas com tipos de campo, bot sequencial, field sets, banco de submissions, landing pages, lógica condicional, validações, auto-preenchimento
- **M13**: 10 tasks detalhadas com hierarquia de cursos, enrollment, drip content, notificações, certificados, área de membros, quizzes, comunidade, gamificação com pontos/badges/ranking
- **R18-R30**: Detalhamento completo de todas as melhorias planejadas para módulos existentes

### v1.6.0 (2026-03-21) — Roadmap Estratégico (Estudo ClickFunnels)
- **Roadmap**: 15 novos itens (R16–R30) baseados em análise competitiva do ClickFunnels
- **Novos Módulos Planejados**: M10 (Funis Conversacionais), M11 (E-commerce WhatsApp), M12 (Formulários WhatsApp), M13 (Cursos & Membership)
- **Melhorias Planejadas**: Custom attributes em contatos, tags em contatos, pipeline analytics, API pública REST, lead scoring, agendamento de reuniões, GDPR compliance, webhooks tipados
- **Visão**: Evolução de "helpdesk WhatsApp" para "plataforma all-in-one de vendas conversacionais"

### v1.5.0 (2026-03-21) — Melhorias Helpdesk
- **UX**: Indicador de conexão realtime no ChatPanel (verde/vermelho/amarelo)
- **UX**: Error state com retry quando fetch de mensagens falha
- **UX**: Reply preview mostra 2 linhas em vez de 1 (line-clamp-2)
- **UX**: Toast de erro ao falhar download de arquivo no MessageBubble
- **UX**: Clear filters como Badge vermelha destacada no ConversationList
- **UX**: Load more com ícone ChevronDown e texto melhorado
- **UX**: Histórico de contato expandido (20→200 com "Ver todas")
- **UX**: Contador de conversas anteriores no ContactInfoPanel
- **UX**: Timestamp de atribuição de agente visível
- **Qualidade**: Constantes compartilhadas (STATUS_OPTIONS, PRIORITY_OPTIONS) em lib/constants.ts
- **Qualidade**: ContactInfoPanel migrado para handleError()

### v1.4.0 (2026-03-21) — Rewrite Admin Panel
- **Merge**: UsersTab + TeamTab unificados em "Equipe" com cards expandíveis (7 tabs → 6 tabs)
- **UX**: Criar+atribuir usuário reduzido de 15 para 4 passos
- **UX**: Membership de inbox inline com checkboxes + role selector automático
- **Docs**: 11/11 módulos documentados (Agendamentos e Dashboard/Analytics agora completos)
- **Backup**: Exportação de variáveis de ambiente (.env + system_settings) adicionada
- **Backup**: Lista de edge functions atualizada (17 funções, incluindo admin-update-user e group-reasons)
- **Secrets**: ALLOWED_ORIGIN adicionado, timestamp de última atualização visível
- **Secrets**: Lista de secrets de migração atualizada no BackupModule

### v1.3.0 (2026-03-21) — Bugs Críticos + UX + Consistência
- **Bug fix**: BackupModule nome corrigido (WsmartQR → WhatsPRO)
- **Bug fix**: ScheduledMessages toast migrado para sonner
- **Bug fix**: UsersTab role change com confirmação + upsert atômico
- **Bug fix**: DepartmentsTab set default agora reseta outros da inbox
- **UX**: Status tabs com labels visíveis no mobile
- **UX**: Empty state diferenciado (sem conversas vs filtros ativos)
- **UX**: Contador de conversas mostra "+" quando há mais páginas
- **UX**: Busca de cards visível no mobile (KanbanBoard)
- **UX**: Toast de sucesso ao completar broadcast (grupos e leads)
- **UX**: Aviso de leads não verificados antes de enviar
- **UX**: Endpoint do sistema copiável na config de inbox
- **Consistência**: DepartmentsTab usa EmptyState compartilhado
- **Consistência**: Placeholder "Arraste cards para cá" em colunas vazias

### v1.2.0 (2026-03-21) — Tema Claro/Escuro
- **Feature**: Toggle de tema claro/escuro no Sidebar (Sun/Moon icon)
- **Integração**: next-themes com ThemeProvider, persistência em localStorage
- **CSS**: Variáveis HSL reorganizadas (:root = light, .dark = dark) compatível com Tailwind `dark:` utilities
- **PRD**: Criado documento PRD.md completo + skill `/prd` para consulta e auto-atualização

### v1.1.0 (2026-03-21) — Auditoria Completa
- **Segurança**: Auth em 8 edge functions, vault para API keys, limites de array no proxy, CSV sanitization, storage DELETE policies, legacy token removido
- **Performance**: N+1 fix no KanbanCRM (RPC), useMemo/useCallback no HelpDesk, indexes no banco, FKs para auth.users
- **Qualidade**: Error handling padronizado (handleError), fetch patterns unificados (useSupabaseQuery), console.log removidos
- **UX**: Error Boundaries em 18 rotas, aria-labels em 6 componentes, split de 3 arquivos grandes
- **DB**: FK cascades corrigidos em todas as tabelas, 6 FKs adicionadas, 5 indexes criados
- **Refatoração**: HelpDesk.tsx → 3 hooks extraídos, BroadcastHistory → 5 sub-componentes, LeadsBroadcaster → 3 arquivos, Intelligence → 4 arquivos

### v1.0.0 (2026-03-20) — Release Inicial
- Plataforma completa com todos os 9 módulos funcionais
- 20 edge functions deployadas
- 38 tabelas com RLS completo
- Multi-tenant com 3 níveis de acesso

---

