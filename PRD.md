# WhatsPRO - Product Requirements Document

> **Versão**: 4.6.0 | **Última atualização**: 2026-03-27 | **Status**: Produção + OpenAI gpt-4.1-mini + Sprint A-E Completo + 26 Edge Functions + 44 Tabelas

## Visão Geral

WhatsPRO é uma plataforma multi-tenant de atendimento WhatsApp (helpdesk) e CRM, construída com React + Supabase + UAZAPI.

### Tech Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL 17, Auth, Storage, Realtime, Edge Functions) |
| WhatsApp API | UAZAPI (via Edge Function proxy) |
| AI | Groq API (Whisper transcription, Llama summarization) |
| Data Fetching | TanStack React Query 5 |

### Arquitetura
```
React Frontend ──> Supabase Edge Functions ──> UAZAPI (WhatsApp)
                                            ──> Groq AI (Summaries/Transcription)
React Frontend ──> Supabase Client (DB, Auth, Realtime, Storage)
```

### Roles de Usuário
| Role | Acesso |
|------|--------|
| `super_admin` | Acesso total: instâncias, inboxes, usuários, broadcast, CRM, analytics |
| `gerente` | CRM, helpdesk, gerenciar equipe dentro de inboxes atribuídas |
| `user` | Helpdesk: atender conversas nas inboxes atribuídas |

---

## Changelog

### v5.0.0 (2026-04-01) — AI Agent v2: Validator Agent + Prompt Studio + 30 melhorias

**Sprint completo com 30 perguntas de validação. 5 fases implementadas.**

**Validator Agent (auditor de qualidade):**
- Segundo agente IA audita cada resposta antes de enviar ao lead (score 0-10)
- PASS (envia), REWRITE (corrige), BLOCK (handoff)
- Detecta: frases proibidas, tópicos bloqueados, desconto acima do limite, múltiplas perguntas, nome repetido, info inventada
- Dashboard de métricas: score médio, distribuição, top violações, sugestões de melhoria
- Configurável no admin: toggle, modelo (nano/mini/flash), rigor (moderado/rigoroso/máximo)

**Prompt Studio (10 seções editáveis):**
- System prompt modular: Identidade, SDR, Produtos, Transbordo, Tags, Regras Absolutas, Objeções, Adicional
- Contexto da Empresa auto-gerado dos campos Business Info
- Preview do prompt final com contagem de tokens
- Defaults globais em system_settings (editáveis sem deploy)
- Botão "Restaurar padrão" por seção

**Melhorias de fluxo (backend):**
- Handoff → SHADOW padronizado (#11): IA continua extraindo dados pós-handoff
- Descartar texto LLM após handoff (#12): lead recebe só handoff_message
- Handoff message por horário comercial (#22): mensagem diferente dentro/fora
- Grade semanal business_hours (#23): horário por dia da semana
- Busca fuzzy pg_trgm word-level (#6): captura erros como "cooral"→"coral"
- Carousel fallback (#10): quando 4 variantes falham → fotos individuais
- Carousel botões configuráveis (#8, #27): 2 botões + texto personalizável
- TTS fallback chain (#21): Gemini → Cartesia → Murf → Speechify → texto
- Áudio resumido + texto (#20): resposta longa → 1ª sentença em áudio + texto completo
- Roteamento sub-agentes por tags (#18): motivo:compra → modo Vendas
- Taxonomia 3 tags (#25): motivo + interesse + produto com enforcement rígido
- Auto-extração de categoria dos produtos encontrados

**Admin (frontend):**
- Nova aba "Prompt Studio" com 9 seções editáveis
- Validator Agent UI: toggle, modelo, nível de rigor
- Carousel config: texto + 2 botões configuráveis
- Handoff: mensagem separada para fora do horário
- Renomeado: "Memória do Lead" + "Histórico da Conversa Atual" (#28)
- Removidos stubs de nicho vazios (#29)
- Dashboard Validator: score médio, PASS/REWRITE/BLOCK %, top violações, sugestões

**Banco de dados:**
- Tabela `ai_agent_validations` (scoring por mensagem)
- 10 colunas novas em `ai_agents`
- Função `search_products_fuzzy()` com índices trgm
- Defaults em `system_settings` (prompt_sections + sub_agent_prompts)
- Migração `business_hours` para grade semanal

### v4.11.0 (2026-03-31) — Fix: Busca Global (Ctrl+K) travada em "Buscando..."

**Causa raiz:** A RPC `global_search_conversations` tinha colunas sem alias (`cv.id`, `ct.id`) nos CTEs, gerando erro PostgreSQL `column combined.conversation_id does not exist`. O hook ficava preso em loading infinito.

**Fix:**
- RPC: aliases explícitos em todas as colunas dos CTEs (`cv.id AS conversation_id`, `ct.id AS contact_id`, etc.)
- Hook: `.catch()` adicionado para nunca travar em loading se a RPC falhar por qualquer motivo

**Arquivos:**
- `supabase/migrations/20260323000004_global_search_rpc.sql` — aliases corrigidos
- `src/hooks/useGlobalSearch.ts` — `.catch()` no Promise da RPC

### v4.10.0 (2026-03-30) — Módulo Disparador: Leads no sidebar + Página de Templates

**Navegação completa do módulo Disparador:**
- Sidebar "Disparador" agora tem 4 sub-itens: Grupos, Leads, Templates, Historico
- Nova página dedicada `/dashboard/broadcast/templates` para gerenciamento CRUD de templates
- Templates: grid de cards com busca, filtro por categoria/tipo, criar, editar, excluir com confirmação
- Rota lazy-loaded com ErrorBoundary + AdminRoute

**Arquivos:**
- `src/components/dashboard/Sidebar.tsx` — sub-itens Leads + Templates no menu Disparador
- `src/pages/dashboard/MessageTemplatesPage.tsx` — nova página de templates
- `src/App.tsx` — lazy import + rota `/dashboard/broadcast/templates`

### v4.9.0 (2026-03-30) — Fix: Botão "Enviar" do Disparador de Leads não funcionava (carrossel)

**Causa raiz (3 bugs combinados):**
1. `handleSend` sem try/catch — erros antes do loop de envio eram engolidos silenciosamente
2. Cards vazios do carrossel enviados para UAZAPI — cards sem imagem/texto causavam rejeição da API
3. `canSend` aceitava 1 card válido — WhatsApp exige mínimo 2 cards no carrossel

**Fix:**
- try/catch em `handleSend` com toast.error para surfacear erros
- Filtro `validCards` remove cards sem imagem ou texto antes do envio
- `canSend` agora exige `>= 2` cards válidos (alinhado com Broadcaster de grupos)
- Validação `handleSendCarousel` exige mínimo 2 cards preenchidos

**Arquivos:**
- `src/components/broadcast/LeadMessageForm.tsx` — try/catch + filtro cards + validação min 2

### v4.8.0 (2026-03-31) — Qualificação antes do Handoff (produto não encontrado)

**Feature: Perguntas de qualificação quando search_products retorna 0 resultados**

Antes do handoff automático, a IA agora tenta qualificar a busca com o lead (marca, especificação técnica, finalidade, tamanho, potência etc.). O número de tentativas é configurável no painel admin.

**Fluxo (exemplo com max_qualification_retries = 2):**
1. Lead: "tem lâmpada led?" → search = 0 → IA: "Tem preferência de marca ou quer luz quente/fria?"
2. Lead: "quero fria" → search = 0 → handoff_to_human (2ª tentativa = limite)

**Implementação:**
- `ai_agents.max_qualification_retries INT DEFAULT 2` — novo campo no banco
- Tag `search_fail:N` na conversa rastreia tentativas (reset automático quando produto encontrado)
- Quando `N < max`: retorno guia LLM a perguntar qualificação (não chamar handoff)
- Quando `N >= max`: retorno instrui LLM a chamar `handoff_to_human`
- Configurável em: **Admin → Agente IA → aba Segurança → "Qualificação quando Produto não Encontrado"** (campo 0-5, default 2)

**Arquivos:**
- `supabase/migrations/20260331000000_add_qualification_retries_to_agents.sql`
- `supabase/functions/ai-agent/index.ts` — lógica na tool `search_products`
- `src/components/admin/ai-agent/RulesConfig.tsx` — novo card de configuração
- `src/components/admin/AIAgentTab.tsx` — `max_qualification_retries` no ALLOWED_FIELDS
- `src/components/admin/ai-agent/validationSchemas.ts` — validação 0-5
- `src/integrations/supabase/types.ts` — tipos atualizados

### v4.7.0 (2026-03-31) — Fix: Carousel entregue mas invisível no Helpdesk

**Causa raiz (2 bugs combinados):**
1. `ai-agent` enviava o carousel para o WhatsApp e salvava em `conversation_messages`, mas **não chamava `broadcastEvent()`** para notificar o helpdesk via Realtime — o ChatPanel nunca soubesse que havia uma nova mensagem de carousel.
2. `ChatPanel` buscava apenas `limit(1)` (última mensagem) ao receber qualquer broadcast — quando carousel + resposta de texto eram inseridos em rápida sucessão, o carousel era pulado (a resposta de texto já era a "última" quando o fetch rodava).

**Fixes aplicados:**

`supabase/functions/ai-agent/index.ts`:
- Adicionado `broadcastEvent({ ..., media_type: 'carousel', media_url: ... })` após cada INSERT de carousel (3 pontos: auto-carousel multi-foto, auto-carousel multi-produto, `send_carousel` tool)
- Adicionado `broadcastEvent({ ..., media_type: 'image', media_url: ... })` após INSERT de `send/media` (produto único com 1 foto)
- Variante de payload corrigida: `{ phone, message }` como primária (não `{ number, message }`) — UAZAPI aceita ambas com HTTP 200 mas só entrega com `phone`
- Break condition alargada: `!resBody.toLowerCase().includes('missing')` (era `!includes('missing required')`)

`src/components/helpdesk/ChatPanel.tsx`:
- Alterado de `limit(1).maybeSingle()` para `limit(3)` + adição incremental de todas as mensagens novas não presentes — elimina race condition quando carousel + texto chegam em sequência rápida

**Padrão documentado:** Todo INSERT de mensagem de mídia no ai-agent **deve** ser seguido de `broadcastEvent()` para que o helpdesk exiba em tempo real.

### v4.6.0 (2026-03-27) — Sprint E Completo: Agent Performance + Bulk Actions

**E5: Agent Performance Dashboard**
- AgentPerformanceCard: ranking por conversas, taxa de resolução, tempo médio, msgs enviadas
- Adicionado ao DashboardHome com LazySection
- Métricas: weighted resolution rate, per-agent response time, ranked agent list
- Resolução de nomes via useUserProfiles hook

**E6: Ações em Massa no Helpdesk**
- Seleção múltipla de conversas via checkboxes
- Bulk action bar: Marcar lidas, Resolver, Arquivar
- Toggle select all com verificação de IDs (não apenas count)
- Selection cleared automaticamente ao trocar inbox ou status filter
- Guard contra double-click (bulkProcessing state)
- ConversationRow mostra checkbox em bulk mode, click alterna seleção

**Bug fixes pós-auditoria:**
- Selection cleared on inbox change (previne cross-inbox corruption)
- Selection cleared on status filter change
- toggleSelectAll: verifica IDs reais, não apenas count
- Weighted resolution rate (não mais média simples)
- Double-click guard no handleBulkAction

### v4.5.0 (2026-03-27) — Sprint E: New Features

**E2: Typing Indicator**
- Broadcast "agent-typing" event via Realtime (fire-and-forget, throttle 3s)
- ChatPanel ouve e exibe "X está digitando..." com auto-clear 4s
- Self-typing exclusion: agente não vê seu próprio indicador
- Reset automático ao trocar de conversa

**E3: Quick Reply Templates (/)**
- Digitar "/" no ChatInput mostra dropdown de templates filtráveis
- Navegação: ↑↓ + Enter/Tab para selecionar, Esc para fechar
- Carrega message_templates (tipo text) do usuário logado
- Bloqueia envio de "/xyz" quando dropdown ativo sem matches

**Bug fixes pós-auditoria:**
- Self-typing exclusion (getSessionUserId check no listener)
- typingAgent reset ao trocar conversa (previne indicador stale)
- Enter com template sem match não envia mensagem literal

### v4.4.0 (2026-03-27) — Sprint D: UX Polish

**D1: Timezone-aware date dividers**
- ChatPanel getDateLabel() usa toZonedTime(BRAZIL_TZ) para comparações de data
- "Hoje"/"Ontem" calculados no timezone correto (América/São_Paulo)
- Datas formatadas via formatBR() com locale pt-BR

**D3: loadMore debounce**
- useRef cooldown de 500ms previne double-click no "Carregar mais"
- Complementa o guard de loadingMore state (que é assíncrono)

**Bug fix: Labels/Notes overwrite on loadMore**
- fetchConversationLabels e fetchConversationNotes agora fazem merge (spread) em vez de replace
- Corrige perda de labels/notas de conversas anteriores ao carregar próxima página

**D2/D4: Já implementados** (drafts via localStorage, broadcast error toasts já completos)

### v4.3.0 (2026-03-27) — Sprint C: Data Integrity

**C1: Phone Validation**
- Webhook valida `contactPhone.length >= 10` antes de upsert em lead_database_entries
- Previne inserção de telefones vazios ou inválidos no banco de leads

**C2: Instance Validation**
- ai-agent valida `agent.instance_id === instance_id` antes de processar
- Previne invocação cross-instance (agente de instância A processando mensagem de instância B)

**C3: Optimistic Update Rollback**
- handleUpdateConversation salva versão anterior por conversa (não array inteiro)
- Em caso de erro no DB, faz rollback targeted + exibe toast de erro
- Race-safe: não sobrescreve alterações feitas em outras conversas

**C4: Sale Value Validation**
- MAX_SALE_VALUE = R$ 999.999,99 enforced em formatCurrency + parseCurrency
- Double-check com Number.isFinite + > 0 no handleSubmit antes de DB write

**C5: Constants Extraction (status_ia)**
- Criado `_shared/constants.ts` (Edge Functions) e `src/constants/statusIa.ts` (frontend)
- STATUS_IA.LIGADA / DESLIGADA / SHADOW substituem todas as magic strings
- 14 arquivos atualizados: ai-agent, activate-ia, transcribe-audio, process-follow-ups, aiRuntime, ChatPanel, ChatInput, useSendFile, HelpdeskMetricsCharts, LeadDetail

### v4.2.0 (2026-03-27) — OpenAI + Sprint A+B Fixes + Auditoria Completa

**LLM Provider:**
- OpenAI gpt-4.1-mini como LLM primário (Gemini 2.5 Flash como fallback)
- _shared/llmProvider.ts: abstração com circuit breaker para ambos providers
- Playground migrado para callLLM() (mesma API que produção)

**Sprint A — 5 Fixes Críticos:**
- Realtime: ChatPanel escutava canal errado (chat-{id} → helpdesk-realtime)
- Handoff: status_ia não sobrescreve 'desligada' com 'shadow' após handoff_to_human
- Tool IDs: appendToolResults match por index (não por nome)
- Contact names: webhook atualiza nome quando pushname muda
- .catch() adicionado no realtime fetch

**Sprint B — Resiliência:**
- Circuit breaker integrado no callLLM() (OpenAI + Gemini)
- Smart scroll: só auto-scroll se user está no bottom (não snap ao ler histórico)
- Memo props estabilizados: onReply/onMessageSent/onClearReply via useCallback
- JSON.parse try-catch no Gemini format converter
- Playground usa callLLM() em vez de Gemini direto

### v4.1.0 (2026-03-27) — Playground IA v2 + Finalizar Atendimento + Dashboard Fix

**Playground IA v2 (10 features):**
- Tool Call Inspector expandível (args + result + duration)
- Thumbs up/down com persistência em playground_evaluations
- Variable Overrides (model, temperature, max_tokens, tools on/off)
- Debounce/Buffer simulation com countdown visual
- Guardrail tester (auto-testa blocked_topics)
- System Prompt viewer colapsável
- Export conversa JSON/Markdown
- 6 Personas pré-definidas (Cliente curioso, Apressado, etc.)
- Copiar relatório completo com análise de erros e insights
- Fix: saudação não repete mais (greeting injetada como model msg)

**Finalizar Atendimento (TicketResolutionDrawer):**
- Bottom sheet (vaul) com 4 categorias: Venda/Perdido/Suporte/Spam
- Currency input R$ com máscara (VENDA)
- Motivo da perda em chips (PERDIDO)
- Tags automáticas: resultado:X, motivo:Y, valor:Z
- Move card Kanban para coluna correspondente (Fechado Ganho/Perdido)
- Atualiza lead_profile com valor da venda
- Broadcast status change

**Dashboard Performance:**
- fetchData() paralelizado com Promise.all (instances + user count)
- fetchGroupsStats() diferido (não bloqueia render inicial)
- .limit(500) em queries sem limit em HelpdeskMetricsCharts

**Bug Fixes:**
- Fix: directMemberRole not defined no CRM Kanban
- Fix: user not defined no KanbanBoard (import useAuth)
- Fix: AI Agent tabs overflow (ScrollArea horizontal + gradient fades)
- Fix: MetricsConfig redesign completo (KPIs, tools, heatmap, tokens)
- Tabelas: playground_evaluations, playground_test_suites (2 novas)

### v4.0.0 (2026-03-26) — Auditoria de Escalabilidade — 10 Sprints para 10K Usuários

**Sprint 1 — Fundação DB:**
- 5 indexes compostos (department_members, ai_debounce_queue, conv_messages, ai_agent_logs x2)
- RLS otimizado: `can_view_conversation()` unifica 4 function calls em 1 query

**Sprint 2 — Resiliência Backend:**
- Circuit breaker para Gemini/Groq/Mistral (CLOSED→OPEN→HALF_OPEN)
- Backoff exponencial (1.5s→3s→6s) em vez de retry fixo
- Tool calls paralelos no AI Agent (Promise.all para read-only tools)
- Rate limit atômico via RPC (check+insert em single transaction)
- Debounce legacy race condition fix (upsert atômico)

**Sprint 3 — Throughput Webhook:**
- Parallel I/O: media fetch + dedup + contact lookup via Promise.all (~50% menos latência)
- Profile pic fetch movido para background (non-blocking)
- Lead database insert atômico (upsert ON CONFLICT + count RPC)
- Broadcast com 3s timeout (não bloqueia se Realtime cair)
- Structured logging com request_id

**Sprint 4 — Segurança Multi-Tenant:**
- verify_jwt habilitado em 20/23 Edge Functions
- WEBHOOK_SECRET obrigatório (fail closed — retorna 503 se não configurado)
- Tabela admin_audit_log (imutável) + RPC log_admin_action()
- Audit log integrado em admin-create/delete/update-user

**Sprint 5 — Performance Frontend:**
- memo() em MessageBubble, ChatInput, ContactAvatar
- loading="lazy" + decoding="async" em todas as imagens
- Leads: Promise.all (3 queries paralelas) + removido .slice(0, 500)
- React Query: staleTime 1min + refetchOnWindowFocus true

**Sprint 6 — Paginação e Dados:**
- ChatPanel: paginação (últimas 50 msgs + "Carregar anteriores" + scroll preservado)
- Realtime: append single msg em vez de refetch total
- rate_limit_log: cleanup trigger probabilístico (1% por INSERT)
- conversations.archived + archive_old_conversations(90) RPC
- prune_ai_agent_logs(90) RPC

**Sprint 7 — Connection Pooling e Cache:**
- Singleton Supabase client no webhook (era per-request)
- Materialized view mv_user_inbox_roles + has_inbox_access_fast()

**Sprint 8 — Observabilidade:**
- Structured logger JSON (_shared/logger.ts)
- Health check endpoint (/functions/v1/health-check → 200/503)

**Sprint 9 — Escalabilidade Horizontal:**
- Job queue persistente (job_queue table + SKIP LOCKED)
- claim_jobs/complete_job RPCs para processamento concurrent-safe
- process-jobs worker Edge Function (lead_auto_add, profile_pic_fetch)
- Auto-cleanup de jobs completed/failed > 7 dias

**Infra:** 8 migrations aplicadas, 42 tabelas, 26 edge functions, 4 novos arquivos, 15 modificados

### v3.3.0 (2026-03-25) — Sprint 8+9 + Auditoria Completa Sistema

**Sprint 8 — Follow-up Automático:**
- Cadência configurável por agente (ex: 3, 7, 14 dias)
- Edge function `process-follow-ups` com cron 1h
- Template variables: {nome}, {produto}, {dias_sem_contato}, {loja}
- Reativa IA ao enviar follow-up (status_ia → ligada)
- Webhook marca follow-up como 'replied' quando lead responde
- Admin tab "Follow-up" com regras editáveis + preview timeline

**Sprint 9 — Import CSV + Web Scraping em Lote:**
- Import CSV/Excel com auto-detect de colunas + parse preço BR
- Web scraping em lote com job queue + polling de progresso
- Dedup automático por título/SKU
- Edge function `scrape-products-batch` com fila
- Tabela `scrape_jobs` para tracking

**Auditoria Completa Sistema v3 (24 functions, 33 tabelas, 44 rotas):**
- Auth adicionado no send-shift-report (cron path)
- CHECK constraints no utm_campaigns (status, type)
- FKs adicionadas: shift_report_configs, instance_connection_logs
- Memory leak fixado no Instances.tsx (setInterval)
- Typing delay UAZAPI em send/text e send/media
- Nome duplicado fix (regex GeorgeGeorge → George)
- Prompt: nunca dizer "não encontrei", nunca pedir permissão para transferir
- Contexto condicional: lead novo vs retornante

**Edge Functions:** 25 total (+ process-follow-ups, scrape-products-batch)

### v3.2.0 (2026-03-25) — Auditoria AI Agent v2 + SDR Qualification + Shadow Mode

**Auditoria Completa AI Agent (2 sprints):**
- Sprint Crítico: Gemini retry (429/500/503), empty response fallback, stack trace removido, API key sanitizada
- Sprint High: `sendTextMsg()` helper (verifica respostas UAZAPI), `broadcastEvent()` fire-and-forget, `mergeTags()` DRY
- Broadcasts usam SERVICE_ROLE_KEY (era ANON_KEY), lead profile cache (eliminada query duplicada)
- `extraction_address_enabled` + `handoff_message` adicionados ao ALLOWED_FIELDS (não salvavam antes)
- Validação no handleSave: prompts obrigatórios, temperatura 0-2, max_tokens 50-8192

**SDR Qualification Flow:**
- Termos genéricos ("verniz", "tinta") → qualifica primeiro (ambiente, marca, cor, tamanho)
- Termos específicos ("Verniz Sol Chuva Iquine") → search_products imediatamente
- Após 5 mensagens sem afunilar → handoff automático
- Prompt sem contradições: regras claras separadas para genérico vs específico
- Tool description atualizada: search_products menciona auto-carousel

**Shadow Mode pós-Handoff:**
- Após transbordo, status_ia='shadow' (era 'desligada')
- IA continua escutando: extrai tags, etiquetas, contexto para follow-up
- 'desligada' reservado para bloqueio manual (botão IA off)
- Implicit handoff detectado ANTES do envio de texto (era depois)

**Greeting Improvements:**
- Saudação enviada diretamente + STOP (não chama Gemini na 1ª interação)
- TTS na saudação quando voice ativo + lead envia áudio
- Save-first lock: previne saudação duplicada em chamadas concorrentes
- Fresh DB check (2min) em vez de cache para decidir shouldGreet

**Quick IA Toggle na tabela de Leads:**
- Botão verde/laranja por lead para ligar/desligar IA
- Toggle por instância selecionada com tooltip

**Limpar Contexto reativa IA:**
- status_ia='ligada' + ia_blocked_instances=[] ao limpar

**Debounce Atômico:**
- UPDATE WHERE processed=false AND process_after<=now() (elimina race condition)
- Apenas 1 timer callback processa (outros skipam)

**TTS Voice Configurável:**
- 6 vozes Gemini: Kore (padrão), Aoede, Charon, Fenrir, Puck, Leda
- Select no admin VoiceConfig

**Groq Whisper Retry:**
- Retry 1x em erros 429/500/503 com 1s backoff

**UI Admin Completa:**
- Campo `handoff_message` (mensagem de transbordo editável)
- Campo `business_hours` com time pickers (abertura/fechamento)
- `voice_name` selector no VoiceConfig

### v3.1.0 (2026-03-24) — Carousel AI Sales Copy + LLM Fallback Chain + Melhorias Agente

**Carousel com Copy de Vendas IA:**
- Cada card do carrossel agora tem texto único gerado por IA (não mais "Foto X de Y")
- Card 1: Nome + preço | Card 2: Copy de vendas | Card 3: Specs | Card 4: Diferencial | Card 5: Urgência/CTA
- LLM fallback chain: Groq (Llama 3.3, ~300ms) → Gemini 2.5 Flash → Mistral Small → templates estáticos
- Prompt otimizado: máx 80 chars/card, sem emojis, persuasivo, não repete título
- `parseCopyResponse()` compartilhado para validação JSON de todas as LLMs
- Timeout 3s por provider (antes 5s só Gemini)

**Melhorias AI Agent (v49→v50):**
- TTS fix: modelo `gemini-2.5-flash-preview-tts` + PCM→WAV + chunked base64
- Audio transcription flow: webhook → transcribe-audio (SERVICE_ROLE) → debounce → ai-agent
- Product search: word-by-word fallback quando ILIKE exata não encontra
- Auto-carousel: enviado automaticamente dentro de `search_products` (não depende de Gemini chamar tool)
- Carousel retry: 4 variantes UAZAPI — `{phone+jid, message}` → `{number+jid, text}` → `{phone+rawNum, message}` → `{number+rawNum, text}` (primária é phone+message para contatos individuais)
- Mensagens salvas no helpdesk: carousel, media e texto do agente em `conversation_messages` + broadcastEvent() obrigatório após cada INSERT de mídia
- Presence indicators: composing no início, recording antes de TTS
- Handoff triggers: auto-transbordo quando texto do lead contém keywords configuradas
- Tag classification melhorada: "Vocês tem X?" = compra (não dúvida)
- Import paths corrigidos: `../_shared/` (antes `./_shared/` causava falha de deploy)

**UTM Campaigns (completo):**
- CRUD completo: criar, editar, listar, detalhar campanhas
- 6 tipos: venda, suporte, promoção, evento, recall, fidelização
- QR Code gerado automaticamente por campanha
- Edge Function `go`: redirect instantâneo → wa.me com ref_code
- Atribuição automática: webhook detecta `ref_` e vincula à campanha
- Dashboard de métricas: visitas, conversões, taxa, gráfico temporal
- AI contextual: prompt do agente recebe contexto da campanha ativa

**Infra & Deploy:**
- Dockerfile multi-stage + nginx SPA + gzip + cache
- Docker Swarm + Traefik v2.11.2 + Let's Encrypt SSL
- GitHub Actions CI/CD → ghcr.io → Portainer stack
- Secrets: GROQ_API_KEY, MISTRAL_API_KEY, GEMINI_API_KEY no Supabase

**Edge Functions**: 24 total (+ go, scrape-product anteriores)
**Migrations**: + utm_campaigns, utm_visits

### v3.0.0 (2026-03-23) — Auditoria Completa + 30 Correções + Importação Rápida de Produtos

**Importação Rápida de Produtos (S6 feature):**
- **Edge Function `scrape-product`**: Scraper server-side que extrai dados de produtos de qualquer URL
- **Extração multi-camada**: JSON-LD, `__NEXT_DATA__` (Next.js), Open Graph, meta tags, CDN images, breadcrumbs HTML
- **Dados extraídos**: título, preço, descrição, categoria, subcategoria, SKU, marca, até 10 fotos
- **`findKey()` recursivo**: Busca campos específicos (`breadCrumbs`, `detailedDescription`) em qualquer nível do JSON
- **UI "Importação Rápida"**: Seção collapsible no dialog "Novo Produto" com input URL + botão Importar + barra de progresso
- **Fluxo**: Admin cola URL → Edge Function scrapa → preenche form → admin revisa/edita → salva
- **Compatível com**: Sites Next.js (Ferreira Costa), SPAs com JSON-LD, sites estáticos com OG tags, qualquer e-commerce
- **Segurança**: Auth obrigatória, timeout 20s, validação de URL, CORS configurado

**Auditoria Completa (30 sugestões implementadas):**

- **Segurança (6)**: npm audit fix, CORS hardening, JWT vault, rate limiting (3 endpoints), fetch timeouts (55+ calls), ai-agent auth
- **Banco de Dados (7)**: 10 indexes, 7 FKs, 2 UNIQUE constraints, CHECK constraints, trigger last_message_at, debounce upsert
- **Código (6)**: TypeScript stricter, ESLint no-unused-vars, 11+ tipos novos, phone utils consolidados, 2 bug fixes
- **UX/UI (8)**: Leads unificado, breadcrumbs, skeletons, CTAs, form validation, forgot password, mobile touch targets
- **Performance (3)**: staleTime 5min global, KanbanBoard refatorado (-35% linhas), error format padronizado

**Arquivos novos**: `scrape-product/index.ts`, `fetchWithTimeout.ts`, `rateLimit.ts`, `response.ts`, `useKanbanBoardData.ts`, `Breadcrumbs.tsx`, `TableSkeleton.tsx`, `FormField.tsx`
**Migrations**: 3 novas (security fixes, rate limit table, indexes/FKs/constraints)
**Edge Functions**: 21 → 22 (+ scrape-product)

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

## Módulos e Funcionalidades

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

## Infraestrutura

### Banco de Dados (38+ tabelas, 54 migrations)
- **RLS**: Habilitado em todas as tabelas (70+ policies — auditado v2.9.0 ✅)
- **FKs**: Todas com CASCADE ou SET NULL (corrigido v1.1.0). ⚠️ 7 FKs faltando identificadas em v2.9.0: conversations.assigned_to, conversation_messages.sender_id, department_members.user_id, kanban_board_members.user_id, kanban_cards.assigned_to → user_profiles
- **Indexes**: conversations (inbox_id, status, priority, assigned_to, department_id, last_message_at), conversation_messages (conv+created, conv+direction), contacts (jid UNIQUE, phone), instances (user_id, disabled), kanban_cards (board_id, column_id, assigned_to, created_by). ⚠️ 10 indexes adicionais recomendados em v2.9.0: contacts(phone), conversations(assigned_to, status), inbox_users(user_id), departments(inbox_id), lead_database_entries(phone)
- **UNIQUE faltando**: lead_database_entries(database_id, phone), message_templates(user_id, name)
- **CHECK faltando**: conversations.status/priority (ENUM recomendado), kanban_columns.position >= 0
- **Vault**: API keys armazenadas em `supabase_vault` (anon key para triggers)
- **RPC Functions**: `delete_inbox`, `get_kanban_board_counts`, `backup_query`, `is_super_admin`, `has_inbox_access`, `get_inbox_role`, `can_access_kanban_board`, `is_gerente`, `is_inbox_member`, `normalize_external_id`
- **Triggers**: 12+ triggers (updated_at automáticos, auto_summarize_on_resolve, log_instance_status_change, ensure_single_default_department)
- **Cron Jobs**: process-scheduled-messages (hourly), auto-summarize-inactive (3h) — ⚠️ JWT hardcoded nas migrations

### Edge Functions (22)
Todas com autenticação (JWT manual, cron/service, ou super_admin):
| Function | Auth | Propósito |
|----------|------|-----------|
| uazapi-proxy | JWT + instance access | Proxy para UAZAPI (17 actions, 50+ endpoints documentados) |
| whatsapp-webhook | Webhook (externo) | Receber mensagens |
| admin-create-user | super_admin | Criar usuário |
| admin-update-user | super_admin | Atualizar usuário |
| admin-delete-user | super_admin | Excluir usuário |
| activate-ia | JWT + instance access | Ativar IA na conversa |
| analyze-summaries | super_admin | Analisar motivos |
| auto-summarize | cron/service + JWT | Auto-resumir conversas |
| cleanup-old-media | cron/super_admin | Limpar mídia antiga |
| database-backup | super_admin | Backup do banco |
| fire-outgoing-webhook | JWT | Disparar webhook saída |
| group-reasons | JWT | Agrupar motivos com IA |
| process-scheduled-messages | cron/super_admin | Processar agendamentos |
| send-shift-report | cron/super_admin | Enviar relatório turno |
| summarize-conversation | JWT + inbox access | Resumir conversa |
| sync-conversations | JWT + inbox access | Sincronizar conversas |
| transcribe-audio | JWT | Transcrever áudio |
| ai-agent | Webhook (interno) | Cérebro IA (Gemini + function calling) |
| ai-agent-debounce | Webhook (interno) | Agrupa msgs 10s + typing indicator |
| ai-agent-playground | super_admin | Chat simulado para testar agente IA |
| scrape-product | JWT (user) | Importação rápida: scrape URL → dados do produto |

### Storage (3 buckets)
- `audio-messages` - Gravações de áudio
- `helpdesk-media` - Mídia do helpdesk
- `carousel-images` - Imagens de carrossel

### UAZAPI API (WhatsApp)
- **Servidor**: `https://wsmart.uazapi.com` (v2.0, baseada em Go)
- **Autenticação**: Header `token` (por instância) + `admintoken` (admin global)
- **Proxy Actions Implementadas (17)**: connect, status, list, groups, group-info, send-message, send-media, send-carousel, send-audio, send-chat, check-numbers, resolve-lids, download-media, create-instance, delete-instance, disconnect
- **Proxy Actions Planejadas (15)**: send-quickreply, send-list, send-reaction, send-location, send-contact, send-template, delete-message, group-create, group-add, group-remove, set-webhook, profile-update, contact-info, chat-list, message-list
- **Webhook Events Processados**: messages, status_ia
- **Webhook Events Não Processados**: status (entrega/leitura), connection, group, call, presence
- **Documentação completa**: Skill `/uazapi` (`.claude/commands/uazapi.md` — 1042 linhas)

### Segurança
- JWT verification manual em todas as edge functions
- CORS configurável via `ALLOWED_ORIGIN` env var — ⚠️ Default `*` se não setada (v2.9.0: deve falhar hard em produção)
- Instance tokens resolvidos server-side (nunca no frontend)
- Limites: 500 phones, 50 groups, 10 carousel cards, 12MB áudio, 10MB CSV, 50k linhas
- CSV sanitization contra injection (=, +, -, @)
- SSRF protection no fire-outgoing-webhook (bloqueia IPs privados, loopback, cloud metadata)
- Vault para armazenar keys de triggers
- ⚠️ **Pendente (v2.9.0 audit)**: Rate limiting em endpoints caros, fetch timeouts, webhook signature validation, audit logging em admin functions, rotação de JWT tokens expostos em migrations

---

## Roadmap

### Próximas Funcionalidades (📋 Planejado)

| ID | Feature | Prioridade | Módulo |
|----|---------|-----------|--------|
| ~~R1~~ | ~~Chatbot/autoresponder configurável~~ | ✅ Evoluiu para M10 | Agente IA |
| R2 | Métricas por agente (tempo resposta, satisfação) | Alta | M6 |
| R3 | Webhook signature validation (HMAC) no whatsapp-webhook | Alta | M2 |
| R4 | Rate limiting nas edge functions | Alta | Infra |
| R5 | Deploy automatizado (Vercel/Netlify) | Média | Infra |
| R6 | Notificações push/desktop para novas mensagens | Média | M2 |
| R7 | Integração com CRM externo (HubSpot, Pipedrive) | Média | M4 |
| R8 | Relatórios exportáveis (PDF/Excel) | Média | M6 |
| R9 | Multi-idioma (i18n) | Baixa | Global |
| ~~R10~~ | ~~Tema claro/escuro configurável~~ | ✅ v1.2.0 | Global |
| R11 | Quick reply templates no chat (respostas rápidas) | Alta | M2 |
| R12 | Busca global de conversas (cross-inbox) | Alta | M2 |
| R13 | Ações em massa (atribuir, status, labels) | Alta | M2 |
| R14 | Indicador de conexão realtime (online/offline) | Média | M2 |
| R15 | Histórico de atribuições de agente | Média | M2 |

### Novos Módulos & Melhorias — Estudo ClickFunnels (📋 Planejado)

| ID | Feature | Prioridade | Módulo | Inspiração |
|----|---------|-----------|--------|------------|
| R16 | Funis conversacionais WhatsApp (flow builder visual) | Média | M14 (movido) | CF Funnels + Pages |
| R17 | Catálogo de produtos + pedidos via WhatsApp | Alta | M11 (novo) | CF Products, Orders, Fulfillment |
| R18 | Custom attributes em contatos (campos key-value) | Alta | M2 | CF Contact custom_attributes |
| R19 | Tags em contatos (CRUD completo, não só em conversas) | Alta | M2 | CF Contact Tags |
| R20 | API pública REST com Bearer token auth | Alta | Infra | CF API v2 |
| R21 | Pipeline analytics (forecast, velocity, conversion rate) | Alta | M4 | CF Sales Pipeline |
| R22 | Probabilidade de fechamento por stage do Kanban | Média | M4 | CF Pipeline Stages |
| R23 | Lead scoring automático baseado em interações | Média | M2/M4 | CF Visit tracking + engagement |
| R24 | Formulários via WhatsApp (bot sequencial de perguntas) | Média | M12 (novo) | CF Forms + Submissions |
| R25 | Cursos/membership com entrega via WhatsApp | Média | M13 (novo) | CF Courses + Enrollments |
| R26 | Agendamento de reuniões Calendly-like via WhatsApp | Média | M8 | CF Scheduled Events |
| R27 | GDPR compliance (redact/anonimizar dados de contato) | Média | M2 | CF Contact Redact |
| R28 | Webhooks tipados por evento (contact.created, order.paid, etc.) | Média | Infra | CF Webhook Outgoing Events |
| R29 | Multi-workspace / hierarquia organizacional | Baixa | Infra | CF Team → Workspace |
| R30 | Image management com resize automático e CDN | Baixa | Infra | CF Images API |

### Endpoints UAZAPI Pendentes — Necessários para Novos Módulos (📋 Planejado)

| ID | Feature | Prioridade | Módulo | Endpoint UAZAPI |
|----|---------|-----------|--------|-----------------|
| R31 | Implementar send/quickreply no proxy (botões de resposta rápida, max 3) | Crítica | M10, M12, M13 | `POST /send/quickreply` |
| R32 | Implementar send/list no proxy (lista interativa com seções, max 10) | Crítica | M10, M11, M12 | `POST /send/list` |
| R33 | Implementar send/reaction no proxy (reagir a mensagens com emoji) | Média | M2 | `POST /send/reaction` |
| R34 | Implementar send/template no proxy (templates WhatsApp Business aprovados) | Média | M10 | `POST /send/template` |
| R35 | Implementar group/create + group/add + group/remove no proxy | Média | M13 | `POST /group/create,add,remove` |
| R36 | Processar webhook events: status (entrega/leitura), presence (digitando), group (join/leave) | Média | M2, M13 | Webhook events |

### Auditoria v2.9.0 — 30 Sugestões de Melhoria (📋 Planejado)

#### Segurança (Crítica/Alta)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R38 | Rodar `npm audit fix` — XSS react-router + DoS flatted | Crítica | Infra |
| R39 | Forçar ALLOWED_ORIGIN em produção — cors.ts deve falhar se env var não setada | Crítica | Segurança |
| R40 | Rotacionar JWT tokens expostos nas migrations + mover para env vars | Crítica | Segurança |
| R41 | Rate limiting per-user em transcribe-audio, summarize-conversation, analyze-summaries | Alta | Infra |
| R42 | Timeout 30s em todos os fetch() das Edge Functions | Alta | Infra |
| R43 | Remover service role key da validação do ai-agent — aceitar apenas anon key | Alta | Segurança |

#### Banco de Dados (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R44 | Criar 10 indexes faltando: contacts(phone), conversations(assigned_to, status), etc. | Alta | DB |
| R45 | Adicionar 7 FKs faltando: assigned_to, sender_id, department_members.user_id, etc. | Alta | DB |
| R46 | UNIQUE constraint em lead_database_entries(database_id, phone) | Alta | DB |
| R47 | UNIQUE constraint em message_templates(user_id, name) | Média | DB |
| R48 | CHECK constraints em conversations.status/priority (ENUM ou CHECK) | Média | DB |
| R49 | Trigger update_last_message_at em conversation_messages INSERT | Média | DB |
| R50 | Corrigir race condition ai-agent-debounce — usar upsert com onConflict | Alta | DB |

#### Código & Tipagem (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R51 | Habilitar TypeScript strict mode progressivamente | Alta | Code |
| R52 | Reativar ESLint no-unused-vars com argsIgnorePattern: "^_" | Média | Code |
| R53 | Criar TypeScript types para 11 entidades faltando (Department, KanbanBoard, etc.) | Média | Code |
| R54 | Consolidar phone/JID utils — criar /lib/jidUtils.ts centralizado | Média | Code |
| R55 | Corrigir tipo em broadcastSender.ts — groupjid: number → string | Alta | Bug |
| R56 | Corrigir normalizePhone em saveToHelpdesk.ts — últimos 8→10-11 dígitos | Alta | Bug |

#### UX/UI (Alta/Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R57 | Unificar navegação "Leads" — consolidar Broadcast/Leads e CRM/Leads | Alta | UX |
| R58 | Adicionar breadcrumbs no header principal | Média | UX |
| R59 | Implementar loading skeletons em tabelas (Leads, Broadcast History) | Média | UX |
| R60 | Empty states com CTAs de ação ("Criar primeiro quadro", etc.) | Média | UX |
| R61 | Validação inline em formulários — erros abaixo dos campos | Média | UX |
| R62 | Flow de "Esqueci minha senha" via Supabase Auth | Alta | UX |
| R63 | Responsividade Helpdesk mobile — tab switching (Lista/Chat/Info) | Alta | UX |
| R64 | Touch targets mínimo 44px em buttons mobile | Média | A11y |

#### Performance & Qualidade (Média)
| ID | Feature | Prioridade | Área |
|----|---------|-----------|------|
| R65 | Configurar staleTime global no QueryClient (5min default) | Média | Perf |
| R66 | Refatorar God Components — BackupModule (810L), KanbanBoard (679L), Leads (659L) | Média | Code |
| R67 | Padronizar formato de erro nas Edge Functions — { ok, data?, error? } | Média | API |

---

### Detalhamento dos Novos Módulos Planejados

---

#### M10 - Agente de IA WhatsApp 🔄

> **Visão**: Agente autônomo por instância que responde leads via Gemini 2.5 Flash com arquitetura multi-agente, catálogo de produtos, handoff inteligente e painel admin completo.
> Consulte `/ai-agent` para roadmap detalhado por sprint.

**Sprint 1 — MVP: Agente Responde**
| Task | Status | Descrição |
|------|--------|-----------|
| S1.1 Criar tabelas (ai_agents, logs, debounce, lead_profiles) | ✅ | 4 tabelas com RLS, indexes, triggers |
| S1.2 Edge function ai-agent-debounce | ✅ | Agrupa msgs 10s, typing indicator, cleanup queue |
| S1.3 Edge function ai-agent (cérebro) | ✅ | Gemini 2.5 Flash, function calling, saudação obrigatória |
| S1.4 Integrar no whatsapp-webhook | ✅ | Detecta IA ativa → chama debounce (fire-and-forget) |
| S1.5 Admin tab "Geral" | ✅ | Nome, saudação, personalidade, ativar, instância |
| S1.6 Admin tab "Cérebro" | ✅ | Prompt, modelo, temperatura, debounce, contexto |
| S1.7 GEMINI_API_KEY nos secrets | ✅ | Configurada via CLI |

**Sprint 2 — Catálogo e Knowledge**
| Task | Status | Descrição |
|------|--------|-----------|
| S2.1 Tabelas catálogo/knowledge/media | ✅ | 3 tabelas com full-text search index |
| S2.2 Admin tab "Catálogo" | ✅ | CRUD com upload fotos, filtros, IA descrição, foto destaque |
| S2.3 Admin tab "Conhecimento" | ✅ | FAQ CRUD + upload docs (PDF/TXT/DOC/DOCX 20MB) |
| S2.4 Tool search_products | ✅ | Gemini function calling → SQL filtros |
| S2.5 Tool send_carousel | ✅ | Carrossel de produtos WhatsApp via UAZAPI |
| S2.6 Tool send_media | ✅ | Imagem/documento via UAZAPI (image, video, document) |
| S2.7 Lógica de qualificação | ✅ | Qualificar → buscar → carrossel/mídia no system prompt |

**Sprint 3 — Handoff e Integrações**
| Task | Status | Descrição |
|------|--------|-----------|
| S3.1 Admin tab "Regras" | ✅ | Gatilhos texto, limites tempo/sentimento, cooldown, horário |
| S3.2 Tool handoff | ✅ | Gemini function calling → desativa IA, loga handoff |
| S3.3 Tools assign_label / set_tags | ✅ | Labels = pipeline, tags = "chave:valor" cumulativas |
| S3.4 Tool move_kanban | ✅ | Busca board por instance_id, move card por contact name |
| S3.5 Modo shadow | ✅ | status_ia='shadow', extrai dados sem responder |
| S3.6 Admin tab "Extração" | ✅ | ExtractionConfig.tsx, campos JSONB em ai_agents |
| S3.7 Admin tab "Guardrails" | ✅ | Tópicos bloqueados, frases proibidas, limite desconto |

**Sprint 4 — Voz, Métricas e Playground**
| Task | Status | Descrição |
|------|--------|-----------|
| S4.1 Admin tab "Voz" | ✅ | Toggle TTS, max text length config |
| S4.2 Áudio bidirecional | ✅ | TTS via Gemini → PTT se response ≤ max_text_length |
| S4.3 Admin tab "Métricas" | ✅ | KPIs, tokens, latência, tool usage, heatmap horário |
| S4.4 Admin tab "Playground" | ✅ | Chat simulado com métricas |
| S4.5 Sub-agentes configuráveis | ✅ | 5 modos (SDR/Sales/Support/Scheduling/Handoff) com prompts individuais |

**Sprint 5 — Contexto Longo e Leads**
| Task | Status | Descrição |
|------|--------|-----------|
| S5.1 Contexto longo persistente | ✅ | conversation_summaries JSONB em lead_profiles, auto-append, últimas 5 injetadas no prompt |
| S5.2 Módulo M11 "Leads" | ✅ | Página /dashboard/leads com tabela, detail panel, conversation modal, block IA, clear context |
| S5.3 Cartão do lead | ✅ | 6 seções Accordion: Perfil, Endereço, Campos Adicionais, Histórico, Ações, Arquivos |
| S5.4 Integração lead_profiles ↔ CRM | ✅ | contact_id FK em kanban_cards, auto-create card, avatar no card, estágio no Leads |
| S5.5 Duplicar config de agente | 📋 | Copiar entre instâncias |

**Edge Functions**: `ai-agent`, `ai-agent-debounce`, `ai-agent-playground`
**Tabelas**: `ai_agents`, `ai_agent_products`, `ai_agent_knowledge`, `ai_agent_media`, `ai_agent_logs`, `lead_profiles`, `ai_debounce_queue`
**Skill**: `/ai-agent` — Roadmap detalhado com exemplos de fluxo por sprint

##### T10.1 — Builder Visual Drag-and-Drop
**Descrição completa**: Interface de canvas onde o usuário arrasta e conecta blocos (nodes) para criar fluxos conversacionais. Cada node representa uma ação no WhatsApp.

**Tipos de nodes disponíveis**:
| Node | Ícone | Função | Exemplo |
|------|-------|--------|---------|
| 📨 Enviar mensagem | MessageSquare | Envia texto, mídia ou carrossel | "Olá {{nome}}! Temos uma oferta especial pra você" |
| ❓ Fazer pergunta | HelpCircle | Envia pergunta e aguarda resposta | "Qual seu orçamento? 1) Até R$500 2) R$500-2000 3) Acima de R$2000" |
| 🔀 Condição | GitBranch | Avalia resposta e direciona fluxo | Se resposta contém "1" → oferta básica; "2" → oferta premium |
| ⏱️ Delay | Clock | Aguarda tempo antes de continuar | Esperar 24h antes de enviar follow-up |
| ⚡ Ação | Zap | Executa ação no sistema | Criar card no Kanban, adicionar tag, disparar webhook |
| 🏁 Fim | Flag | Encerra o funil | Marcar contato como "qualificado" |
| 🔄 Goto | ArrowRight | Pula para outro step do funil | Voltar ao início se resposta inválida |
| 🤖 IA | Brain | Processar resposta com IA | Analisar sentimento da resposta, classificar intenção |

**Exemplo visual de fluxo**:
```
[Trigger: keyword "promo"]
    ↓
[📨 "Oi {{nome}}! Temos 3 planos incríveis"]
    ↓
[❓ "Qual área te interessa? 1) Marketing 2) Vendas 3) Suporte"]
    ↓
[🔀 Condição: resposta]
   ├─ "1" → [📨 Detalhes Marketing] → [❓ "Quer agendar uma demo?"]
   ├─ "2" → [📨 Detalhes Vendas] → [❓ "Quer agendar uma demo?"]
   ├─ "3" → [📨 Detalhes Suporte] → [❓ "Quer agendar uma demo?"]
   └─ outro → [📨 "Não entendi. Responda 1, 2 ou 3"] → [🔄 Goto: pergunta]
```

**Implementação técnica**:
- Biblioteca: React Flow (ou similar) para canvas
- Persistência: JSON serializado em `funnels.flow_data` (JSONB)
- Preview: Simulador de conversa lado a lado com o builder
- Undo/redo: Histórico de estados com Ctrl+Z

---

##### T10.2 — Templates de Funil
**Descrição completa**: Galeria de funis pré-configurados que o usuário pode clonar e customizar. Cada template inclui fluxo completo, mensagens de exemplo e configurações recomendadas.

**Templates incluídos**:

| Template | Steps | Objetivo | Conversão esperada |
|----------|-------|----------|-------------------|
| 🎯 Qualificação de Lead | 5 | Coletar nome, empresa, orçamento, necessidade | Lead qualificado no CRM |
| 🛒 Venda Direta | 7 | Apresentar produto → objeções → checkout | Pedido criado |
| 🔄 Reengajamento | 4 | Contato inativo há 30+ dias → oferta especial | Reativação |
| 👋 Onboarding | 6 | Novo cliente → tutorial → primeiro uso → feedback | Ativação |
| ⭐ NPS/Satisfação | 3 | Nota 0-10 → feedback aberto → agradecimento | Score coletado |
| 📅 Agendamento | 4 | Serviço desejado → data/hora → confirmação | Reunião marcada |
| 🎁 Lançamento | 5 | Teaser → revelação → oferta limitada → urgência → CTA | Venda no lançamento |
| 🔧 Suporte Técnico | 6 | Problema → categoria → tentativa de resolução → escalar | Ticket resolvido ou escalado |
| 📚 Mini-curso grátis | 5 | Inscrição → aula 1 (dia 1) → aula 2 (dia 2) → aula 3 (dia 3) → oferta | Venda do curso completo |
| 🏷️ Carrinho Abandonado | 3 | Lembrete (1h) → desconto (24h) → urgência (48h) | Recuperação de venda |

**Exemplo — Template "Qualificação de Lead"**:
```
Step 1: [📨] "Olá {{nome}}! Vi que você se interessou pelo nosso serviço. Posso te fazer algumas perguntas rápidas?"
Step 2: [❓] "Qual o tamanho da sua empresa? 1) 1-10 funcionários 2) 11-50 3) 51-200 4) 200+"
Step 3: [❓] "Qual seu principal desafio hoje? 1) Captar clientes 2) Reter clientes 3) Automatizar processos 4) Outro"
Step 4: [❓] "Qual seu orçamento mensal para essa solução? 1) Até R$500 2) R$500-2k 3) R$2k-5k 4) Acima de R$5k"
Step 5: [⚡] Criar card no Kanban "Leads Qualificados" + [📨] "Perfeito! Um consultor vai entrar em contato em até 2h. Obrigado!"
```

---

##### T10.3 — Condições/Branching
**Descrição completa**: Sistema de regras que avalia a resposta do contato e direciona para caminhos diferentes no funil. Suporta múltiplos tipos de condição.

**Tipos de condição**:

| Tipo | Operador | Exemplo |
|------|----------|---------|
| Texto exato | `equals` | Resposta = "sim" |
| Contém texto | `contains` | Resposta contém "preço" |
| Regex | `matches` | Resposta match `/^\d{5}-?\d{3}$/` (CEP) |
| Numérico | `between` | Resposta entre 1 e 5 |
| Lista de opções | `in` | Resposta ∈ ["1", "2", "3"] |
| Tag do contato | `has_tag` | Contato tem tag "cliente_vip" |
| Campo customizado | `attribute` | Contato.cidade = "São Paulo" |
| Horário | `time_between` | Hora atual entre 9h-18h |
| Dia da semana | `day_of_week` | Hoje é segunda a sexta |
| Timeout | `no_response` | Sem resposta há 30 minutos |
| Sentimento IA | `sentiment` | IA detectou sentimento "negativo" |
| Intenção IA | `intent` | IA classificou como "quer_cancelar" |

**Exemplo de branching complexo**:
```
[❓ "Gostaria de agendar uma demonstração?"]
    ↓
[🔀 Condição]
   ├─ contains("sim", "quero", "claro", "bora") → [📨 "Ótimo! Qual o melhor dia?"]
   ├─ contains("não", "agora não", "depois") → [⏱️ Delay 48h] → [📨 "Sem problemas! Quando quiser, é só chamar 😊"]
   ├─ contains("preço", "quanto", "valor") → [📨 "Nossos planos começam em R$97/mês..."]
   ├─ no_response(30min) → [📨 "Vi que ficou ocupado! Quando puder, me diga se quer agendar 😊"]
   └─ default → [📨 "Não entendi. Pode responder 'sim' ou 'não'?"] → [🔄 Retry max 2x]
```

---

##### T10.4 — Triggers Automáticos
**Descrição completa**: Eventos que iniciam automaticamente a execução de um funil para um contato. Múltiplos triggers podem apontar para o mesmo funil.

**Tipos de trigger**:

| Trigger | Configuração | Exemplo |
|---------|-------------|---------|
| 🔑 Keyword | Lista de palavras-chave | Contato envia "promoção" → inicia funil de vendas |
| 🏷️ Tag adicionada | Nome da tag | Contato recebe tag "lead_quente" → inicia funil de qualificação |
| 🏷️ Tag removida | Nome da tag | Contato perde tag "ativo" → inicia funil de reengajamento |
| 👤 Novo contato | Inbox/instância | Primeira mensagem → inicia funil de boas-vindas |
| 📋 Formulário enviado | ID do formulário (M12) | Preencheu form de orçamento → inicia funil de vendas |
| 🛒 Pedido criado | Status do pedido (M11) | Novo pedido → inicia funil pós-venda |
| 🛒 Carrinho abandonado | Tempo de inatividade | Pedido pendente há 1h → inicia funil de recuperação |
| 📅 Schedule (cron) | Expressão cron | Todo dia 9h → enviar dica do dia para inscritos |
| 📊 Kanban move | Board + coluna destino | Card moveu para "Negociação" → inicia funil de proposta |
| ⏰ Data específica | Campo de data do contato | 7 dias antes de `contato.data_renovacao` → inicia funil de renovação |
| 🔗 Webhook externo | Endpoint recebe POST | Sistema externo dispara evento → inicia funil |
| 💬 Inatividade | Dias sem interação | Sem mensagem há 30 dias → inicia funil de reengajamento |

**Regras de execução**:
- Um contato só pode estar em 1 execução do mesmo funil por vez
- Cooldown configurável: "não reiniciar funil se executou nos últimos X dias"
- Prioridade: se múltiplos triggers disparam, executar o de maior prioridade
- Horário de execução: respeitar janela de envio (ex: 8h-20h)

---

##### T10.5 — Variáveis Dinâmicas
**Descrição completa**: Placeholders que são substituídos por dados reais do contato, pedido ou sistema no momento do envio.

**Variáveis disponíveis**:

| Categoria | Variável | Exemplo de saída |
|-----------|----------|-----------------|
| **Contato** | `{{nome}}` | "João" |
| | `{{nome_completo}}` | "João Silva" |
| | `{{telefone}}` | "+5511999887766" |
| | `{{email}}` | "joao@email.com" |
| | `{{cidade}}` | "São Paulo" (de custom attribute) |
| | `{{tag_list}}` | "cliente_vip, plano_pro" |
| **Pedido** (M11) | `{{pedido_numero}}` | "#1234" |
| | `{{pedido_total}}` | "R$ 297,00" |
| | `{{pedido_status}}` | "Enviado" |
| | `{{pedido_tracking}}` | "BR123456789" |
| **Curso** (M13) | `{{curso_nome}}` | "Marketing Digital" |
| | `{{curso_progresso}}` | "60%" |
| | `{{proxima_aula}}` | "Módulo 3: Tráfego Pago" |
| **CRM** (M4) | `{{kanban_coluna}}` | "Negociação" |
| | `{{kanban_valor}}` | "R$ 5.000,00" |
| **Sistema** | `{{data_hoje}}` | "21/03/2026" |
| | `{{hora_atual}}` | "14:30" |
| | `{{dia_semana}}` | "sexta-feira" |
| | `{{empresa_nome}}` | "MinhaEmpresa" (system_settings) |
| **Funil** | `{{resposta_anterior}}` | Última resposta do contato |
| | `{{step_atual}}` | "3 de 7" |
| **Custom** | `{{custom.campo_x}}` | Qualquer custom attribute do contato |

**Formatadores**:
- `{{nome|upper}}` → "JOÃO"
- `{{nome|lower}}` → "joão"
- `{{nome|capitalize}}` → "João"
- `{{pedido_total|currency}}` → "R$ 297,00"
- `{{data_hoje|relative}}` → "hoje" / "amanhã" / "segunda-feira"

**Fallbacks**: `{{nome|fallback:"amigo"}}` → Se nome vazio, usa "amigo"

---

##### T10.6 — A/B Testing de Mensagens
**Descrição completa**: Testar automaticamente variações de mensagens em cada step do funil para otimizar conversão.

**Como funciona**:
1. No builder, o usuário cria 2-4 variantes de um step
2. O sistema distribui aleatoriamente (50/50 ou configurável)
3. Após N execuções (mínimo estatístico), declara vencedor
4. Opção de auto-otimizar: após vencedor, direcionar 100% para ele

**Exemplo**:
```
Step 3 — Mensagem de oferta:
  Variante A (50%): "🔥 Oferta relâmpago! 40% OFF só hoje. Quer aproveitar?"
  Variante B (50%): "Separei um desconto especial pra você: 40% OFF. Posso aplicar no seu pedido?"

Resultados após 200 execuções:
  Variante A: 34% respondeu "sim" (68/200)
  Variante B: 51% respondeu "sim" (102/200)
  → Vencedor: Variante B (+17% conversão)
```

**Métricas rastreadas por variante**:
- Taxa de resposta (respondeu vs ignorou)
- Taxa de conversão (avançou no funil vs abandonou)
- Tempo médio de resposta
- Sentimento da resposta (via IA)

**Dashboard**: Tabela comparativa com significância estatística (p-value < 0.05)

---

##### T10.7 — Métricas por Etapa
**Descrição completa**: Dashboard analítico que mostra performance de cada step do funil em formato de "funil de conversão".

**Visualizações**:

1. **Funil de conversão visual** (gráfico de barras decrescente):
```
Step 1: Mensagem inicial      ████████████████████ 1.000 (100%)
Step 2: Pergunta interesse     ███████████████     750 (75%)
Step 3: Apresentação produto   ██████████          500 (50%)
Step 4: Oferta                 ██████              300 (30%)
Step 5: Fechamento             ███                 150 (15%)
```

2. **KPIs por funil**:
| Métrica | Valor |
|---------|-------|
| Total de execuções | 1.000 |
| Taxa de conclusão | 15% |
| Tempo médio total | 2h 34min |
| Drop-off principal | Step 2→3 (33% abandono) |
| Revenue atribuído | R$ 44.850,00 |
| Custo por conversão | R$ 0 (WhatsApp) |

3. **Heatmap de abandono**: Quais steps perdem mais contatos e em que horário
4. **Comparação entre funis**: Side-by-side de múltiplos funis
5. **Timeline**: Evolução da taxa de conversão ao longo do tempo

---

##### T10.8 — Integração com CRM Kanban
**Descrição completa**: Ações automáticas no CRM Kanban (M4) disparadas por eventos do funil.

**Ações disponíveis**:

| Evento no Funil | Ação no Kanban | Exemplo |
|----------------|----------------|---------|
| Funil iniciado | Criar card | Novo lead → card na coluna "Entrada" |
| Step concluído | Mover card | Respondeu interesse → mover para "Qualificado" |
| Funil concluído | Mover card + atualizar campo | Fechou venda → "Ganho" + valor preenchido |
| Funil abandonado | Mover card | Parou de responder → "Perdido" |
| Resposta específica | Atualizar campo | Disse orçamento "R$5k+" → campo valor = 5000 |
| Tag adicionada pelo funil | Atribuir responsável | Tag "vip" → atribuir para gerente |

**Configuração no builder**: No node ⚡ Ação, selecionar:
- Board destino
- Coluna destino
- Campos a preencher (mapeamento variável → campo)
- Responsável (fixo ou regra)

**Exemplo de fluxo completo**:
```
[Trigger: keyword "orçamento"]
  → [📨 Boas-vindas + pergunta]
  → [⚡ Criar card em "Novos Leads"]
  → [❓ Coleta de dados...]
  → [⚡ Mover card para "Qualificado" + preencher valor]
  → [📨 "Nosso consultor {{responsavel}} vai te atender!"]
  → [⚡ Atribuir card ao consultor]
```

---

##### T10.9 — Pause/Resume por Contato
**Descrição completa**: Quando um agente humano precisa intervir na conversa, o funil é automaticamente pausado para evitar conflito de mensagens.

**Regras de pause automático**:
- Agente envia mensagem manual na conversa → funil pausa
- Agente clica "Pausar funil" no painel do contato → funil pausa
- Contato digita keyword de escape (ex: "atendente", "humano") → funil pausa + alerta para agentes

**Regras de resume**:
- Agente clica "Retomar funil" → continua do step onde parou
- Agente clica "Retomar do início" → reinicia o funil
- Auto-resume após X minutos sem interação do agente (configurável)
- Agente resolve conversa → funil é cancelado

**Indicadores visuais no helpdesk**:
- Badge "🤖 Funil ativo" ou "⏸️ Funil pausado" na conversa
- Nome do funil e step atual visíveis no painel do contato
- Botões de controle: ⏸️ Pausar | ▶️ Retomar | ⏹️ Cancelar | ⏭️ Pular step

---

##### T10.10 — Fallback para Humano
**Descrição completa**: Detecção automática de quando o bot/funil não consegue atender e deve transferir para um agente humano.

**Triggers de fallback**:

| Trigger | Configuração | Exemplo |
|---------|-------------|---------|
| Keyword de escape | Lista de palavras | "atendente", "humano", "falar com alguém" |
| Respostas inválidas consecutivas | Número máximo | 3 respostas que não matcham nenhuma condição |
| Sentimento negativo (IA) | Threshold | Sentimento < -0.5 em 2 mensagens seguidas |
| Timeout sem resposta | Tempo + retries | Sem resposta após 2 tentativas de reenvio |
| Assunto complexo (IA) | Classificação | IA detecta assunto fora do escopo do funil |

**Ações ao fazer fallback**:
1. Enviar mensagem ao contato: "Vou te conectar com um de nossos atendentes. Um momento! 😊"
2. Criar/reabrir conversa no helpdesk (M2)
3. Atribuir a departamento ou agente específico (configurável)
4. Passar contexto: resumo das respostas coletadas no funil
5. Adicionar nota privada com transcript do funil na conversa
6. Notificar agente via push/desktop (quando implementado - R6)

---

##### T10.11 — Delay Inteligente entre Steps
**Descrição completa**: Controle granular do timing entre mensagens para simular conversa natural e respeitar horários.

**Tipos de delay**:

| Tipo | Configuração | Uso |
|------|-------------|-----|
| Fixo | 5 segundos | Entre mensagens sequenciais (simular digitação) |
| Aleatório | 3-8 segundos | Parecer mais humano |
| Minutos/horas | 30 min, 2h | Follow-up após reflexão |
| Dias | 1 dia, 3 dias | Drip campaign |
| Horário específico | "amanhã às 9h" | Enviar no melhor horário |
| Janela de envio | 8h-20h, seg-sex | Não enviar fora de horário comercial |
| Typing indicator | 1-3s antes do envio | Mostrar "digitando..." antes de enviar |
| Condicional | "Se respondeu em < 1min, delay 3s; senão, delay 0s" | Adaptar ao ritmo do contato |

**Exemplo de drip campaign**:
```
Dia 0, 10h: [📨] "Bem-vindo ao mini-curso de Marketing Digital! 🎓"
Dia 0, 10h05: [📨] "Aula 1: Os 3 pilares do marketing..." [📎 PDF]
Dia 1, 9h: [📨] "Bom dia {{nome}}! Aula 2 já está disponível..."
Dia 2, 9h: [📨] "Última aula! Aula 3: Como escalar..."
Dia 3, 10h: [📨] "Gostou do mini-curso? Temos o curso completo com 50% OFF..."
```

---

##### T10.12 — Ações de Step
**Descrição completa**: Cada step do funil pode executar múltiplas ações além de enviar mensagens.

**Ações disponíveis**:

| Ação | Parâmetros | Exemplo |
|------|-----------|---------|
| Adicionar tag | tag_name | Adicionar "qualificado" ao contato |
| Remover tag | tag_name | Remover "lead_frio" |
| Atualizar custom attribute | key, value | Setar `orcamento = "R$5000"` |
| Criar card Kanban | board, coluna, dados | Card "João - R$5k" na coluna "Negociação" |
| Mover card Kanban | board, coluna | Mover para "Proposta Enviada" |
| Criar pedido (M11) | produto, variante | Criar pedido com produto selecionado |
| Inscrever em curso (M13) | curso_id | Inscrever no curso "Marketing Digital" |
| Enviar webhook | url, payload | POST para n8n/Zapier/Make com dados |
| Atribuir agente | user_id / regra | Atribuir conversa ao vendedor responsável |
| Enviar email | template, dados | Email de confirmação de agendamento |
| Aguardar pagamento | order_id, timeout | Pausar até pagamento confirmado ou timeout |
| Iniciar outro funil | funnel_id | Encadear funis (ex: pós-venda após checkout) |
| Enviar para grupo | group_id, mensagem | Notificar grupo interno "Novo lead qualificado!" |

**Tabelas planejadas**: `funnels`, `funnel_steps`, `funnel_step_actions`, `funnel_conditions`, `funnel_triggers`, `funnel_executions`, `funnel_execution_steps`, `funnel_ab_variants`, `funnel_step_metrics`

**Edge Functions planejadas**: `execute-funnel-step`, `evaluate-funnel-condition`, `funnel-trigger-listener`, `funnel-metrics-aggregate`

**Componentes planejados**: `FunnelBuilder`, `FunnelCanvas`, `NodePalette`, `NodeEditor`, `ConditionBuilder`, `FunnelSimulator`, `FunnelMetrics`, `FunnelTemplateGallery`, `FunnelExecutionLog`, `TriggerConfig`

---

#### M11 - E-commerce WhatsApp 📋

> **Visão**: Catálogo de produtos com pedidos, pagamentos e fulfillment integrados ao WhatsApp.
> Permite que negócios vendam diretamente pelo WhatsApp sem precisar de site ou loja virtual.

| Task | Status | Descrição |
|------|--------|-----------|
| T11.1 CRUD produtos com variantes | 📋 | Produtos, variantes (tamanho, cor), preços, imagens |
| T11.2 Coleções de produtos | 📋 | Agrupar produtos por categoria |
| T11.3 Envio de catálogo via WhatsApp | 📋 | Carrossel de produtos com botão de compra |
| T11.4 Pedidos via conversa | 📋 | Criar order a partir do chat, adicionar itens |
| T11.5 Checkout com link de pagamento | 📋 | PIX, Stripe, MercadoPago — link gerado automaticamente |
| T11.6 Fulfillment tracking | 📋 | Status do pedido (preparando → enviado → entregue) via WhatsApp |
| T11.7 Invoices automáticas | 📋 | Geração e envio de comprovante ao cliente |
| T11.8 Estoque e alertas | 📋 | Controle de estoque com notificação de baixa |
| T11.9 Relatórios de vendas | 📋 | GMV, ticket médio, produtos mais vendidos, conversão |
| T11.10 Cupons de desconto | 📋 | CRUD cupons com regras (%, fixo, frete, validade, uso único) |
| T11.11 Carrinho persistente | 📋 | Contato adiciona itens ao longo da conversa, finaliza quando quiser |
| T11.12 Catálogo web público | 📋 | Página web com produtos que redireciona para WhatsApp |

##### T11.1 — CRUD Produtos com Variantes
**Descrição completa**: Gerenciamento completo de produtos com suporte a variantes (combinações de propriedades como tamanho e cor).

**Interface do admin**:
- Lista de produtos com busca, filtros (coleção, status, preço) e bulk actions
- Form de produto: nome, descrição, imagens (drag-drop, multi-upload), preço base, SKU, peso
- Tab de variantes: definir propriedades (ex: Tamanho: P/M/G, Cor: Preto/Branco) → gera combinações automáticas
- Cada variante tem: preço próprio (ou herda), SKU, estoque, imagem própria
- Status: ativo, rascunho, arquivado

**Schema da tabela `products`**:
```sql
products: id, workspace_id, name, description, slug, status (active/draft/archived),
          base_price, compare_at_price, cost_price, sku, weight_grams,
          visible_in_catalog, featured, created_at, updated_at

product_variants: id, product_id, name, sku, price, compare_at_price,
                  stock_quantity, stock_policy (track/dont_track),
                  properties (JSONB: {"Tamanho": "M", "Cor": "Preto"}),
                  image_id, position, active

product_images: id, product_id, url, alt_text, position, storage_path,
                thumbnail_url, medium_url, large_url
```

**Exemplo**:
```
Produto: Camiseta Premium
├── Variante: P/Preto  — R$ 89,90 — Estoque: 45
├── Variante: P/Branco — R$ 89,90 — Estoque: 32
├── Variante: M/Preto  — R$ 89,90 — Estoque: 67
├── Variante: M/Branco — R$ 89,90 — Estoque: 55
├── Variante: G/Preto  — R$ 99,90 — Estoque: 28
└── Variante: G/Branco — R$ 99,90 — Estoque: 41
```

---

##### T11.2 — Coleções de Produtos
**Descrição completa**: Agrupar produtos em categorias para organização e envio seletivo de catálogo.

**Tipos de coleção**:
- **Manual**: admin seleciona produtos individualmente
- **Automática** (regras): Ex: "Todos os produtos com tag 'verão' e preço < R$100"

**Exemplos de coleções**:
| Coleção | Tipo | Regra/Produtos |
|---------|------|----------------|
| Lançamentos | Manual | 5 produtos selecionados |
| Até R$50 | Automática | `price <= 50` |
| Mais Vendidos | Automática | `orders_count > 10` nos últimos 30 dias |
| Coleção Verão | Manual | 12 produtos selecionados |
| Promoções | Automática | `compare_at_price IS NOT NULL` |

---

##### T11.3 — Envio de Catálogo via WhatsApp
**Descrição completa**: Enviar produtos como carrossel interativo no WhatsApp com botões de ação.

**Formatos de envio**:

1. **Carrossel de produtos** (já suportado pelo broadcast M3):
```
[Card 1: Imagem do produto]
  Camiseta Premium - R$ 89,90
  [Botão: 🛒 Comprar] [Botão: ℹ️ Detalhes]

[Card 2: Imagem do produto]
  Calça Jeans Slim - R$ 149,90
  [Botão: 🛒 Comprar] [Botão: ℹ️ Detalhes]
```

2. **Lista de produtos** (mensagem formatada):
```
📦 *Catálogo MinhaLoja*

1️⃣ *Camiseta Premium* — R$ 89,90
   Cores: Preto, Branco | Tam: P, M, G

2️⃣ *Calça Jeans Slim* — R$ 149,90
   Cores: Azul, Preto | Tam: 38-46

3️⃣ *Tênis Runner* — R$ 199,90
   Cores: Preto, Cinza | Tam: 38-44

👉 Responda com o número do produto para mais detalhes!
```

3. **Produto individual** (imagem + detalhes):
```
[📸 Foto do produto]
*Camiseta Premium*
💰 De ~R$ 129,90~ por *R$ 89,90*
📏 Tamanhos: P, M, G
🎨 Cores: Preto, Branco
📦 Frete: Grátis acima de R$150

Responda "COMPRAR" ou escolha:
1) Tamanho P  2) Tamanho M  3) Tamanho G
```

**Integração com funis (M10)**: O catálogo pode ser um step do funil → contato escolhe → cria pedido → checkout.

---

##### T11.4 — Pedidos via Conversa
**Descrição completa**: Criar e gerenciar pedidos diretamente a partir do chat do helpdesk.

**Fluxo do agente (via painel)**:
1. No painel do contato (M2), clicar "➕ Novo Pedido"
2. Buscar e adicionar produtos (com variante e quantidade)
3. Aplicar cupom de desconto (se houver)
4. Selecionar forma de envio
5. Gerar link de pagamento ou marcar como "pago offline"
6. Enviar resumo ao contato pelo chat

**Fluxo automático (via funil M10)**:
```
Contato: "Quero a camiseta preta M"
Bot: [⚡ Criar pedido: Camiseta Premium, Preto, M, 1x]
Bot: "Perfeito! Seu pedido ficou assim:
      🛒 1x Camiseta Premium (M/Preto) — R$ 89,90
      📦 Frete: R$ 12,90
      💰 Total: R$ 102,80
      Confirma? Responda SIM para receber o link de pagamento."
Contato: "sim"
Bot: "Aqui está seu link de pagamento: https://pay.whatspro.com/ord_abc123
      Assim que o pagamento for confirmado, te aviso! ✅"
```

**Schema da tabela `orders`**:
```sql
orders: id, workspace_id, contact_id, conversation_id, order_number (auto),
        status (pending/paid/preparing/shipped/delivered/cancelled/refunded),
        subtotal, discount_amount, shipping_amount, total,
        coupon_id, shipping_address (JSONB), notes,
        paid_at, shipped_at, delivered_at, cancelled_at,
        payment_method, payment_provider, payment_id,
        created_by (user_id), created_at, updated_at

order_items: id, order_id, product_id, variant_id, product_name, variant_name,
             quantity, unit_price, total_price, sku
```

**Status do pedido com timeline**:
```
📋 Pendente → 💳 Pago → 📦 Preparando → 🚚 Enviado → ✅ Entregue
                                                    └→ ↩️ Devolvido
              └→ ❌ Cancelado
```

---

##### T11.5 — Checkout com Link de Pagamento
**Descrição completa**: Gerar links de pagamento integrados com provedores brasileiros e internacionais.

**Provedores suportados**:

| Provedor | Métodos | Fee | Prazo |
|----------|---------|-----|-------|
| PIX (via MercadoPago) | PIX QR Code + copia-cola | 0.99% | Instantâneo |
| MercadoPago | Cartão, boleto, PIX | 4.98% + R$0.40 | 1-3 dias |
| Stripe | Cartão, Apple Pay, Google Pay | 3.99% + R$0.39 | 2 dias |
| PagSeguro | Cartão, boleto, PIX | 4.99% + R$0.40 | 1-14 dias |
| Asaas | Boleto, PIX, cartão | 2.99% | 1-3 dias |
| Manual | Transferência, dinheiro | 0% | Manual |

**Fluxo de pagamento**:
1. Pedido criado → edge function `generate-checkout-link`
2. Link gerado com dados do pedido (valor, itens, expiração)
3. Link enviado ao contato via WhatsApp
4. Contato paga → webhook do provedor → `payment-webhook`
5. Status atualizado para "paid" → notifica contato no WhatsApp:
   ```
   ✅ Pagamento confirmado!
   Pedido #1234 — R$ 102,80
   Estamos preparando seu pedido. Acompanhe por aqui! 📦
   ```
6. Se PIX: gerar QR code e enviar como imagem + código copia-cola

**Página de checkout** (mini-página web):
- Resumo do pedido com itens e valores
- Seleção de forma de pagamento
- Formulário de endereço (se envio físico)
- Botão "Pagar" → redireciona para provedor
- Webhook de retorno atualiza pedido e notifica via WhatsApp

---

##### T11.6 — Fulfillment Tracking
**Descrição completa**: Acompanhamento do pedido desde a preparação até a entrega, com notificações automáticas via WhatsApp.

**Status do fulfillment**:
```
📋 Pendente → 📦 Separando → 🏷️ Embalado → 🚚 Coletado → 🛵 Em trânsito → ✅ Entregue
```

**Notificações automáticas ao contato**:

| Evento | Mensagem WhatsApp |
|--------|-------------------|
| Pedido pago | "✅ Pagamento confirmado! Pedido #1234 está sendo preparado." |
| Em preparação | "📦 Seu pedido #1234 está sendo separado!" |
| Enviado | "🚚 Pedido #1234 foi enviado! Rastreio: {{tracking_code}} — Acompanhe: {{tracking_url}}" |
| Saiu para entrega | "🛵 Pedido #1234 saiu para entrega! Previsão: hoje até as 18h" |
| Entregue | "✅ Pedido #1234 foi entregue! Esperamos que goste 😊 Qualquer dúvida, estamos aqui!" |
| Entregue +3 dias | "⭐ Como foi sua experiência com o pedido #1234? Avalie de 1 a 5" |

**Integrações de rastreio**:
- Correios (via API)
- Jadlog, Loggi, Mandaê
- Tracking code manual (agente preenche)

---

##### T11.7 — Invoices Automáticas
**Descrição completa**: Geração automática de comprovantes/recibos de pagamento enviados ao cliente.

**Conteúdo da invoice**:
```
═══════════════════════════════
     COMPROVANTE DE PAGAMENTO
═══════════════════════════════
Pedido: #1234
Data: 21/03/2026
Cliente: João Silva

Itens:
• 1x Camiseta Premium (M/Preto)    R$ 89,90
• 1x Boné Snapback                   R$ 49,90
─────────────────────────────
Subtotal:                           R$ 139,80
Frete:                              R$ 12,90
Desconto (cupom PROMO10):          -R$ 13,98
═══════════════════════════════
TOTAL PAGO:                        R$ 138,72
Método: PIX
═══════════════════════════════
```

**Formatos**:
- Mensagem formatada no WhatsApp (como acima)
- PDF gerado automaticamente (edge function `generate-invoice-pdf`)
- Enviado como documento no chat

---

##### T11.8 — Estoque e Alertas
**Descrição completa**: Controle de quantidade em estoque com alertas automáticos quando produtos estão acabando.

**Funcionalidades**:
- Estoque por variante (ex: Camiseta M/Preta: 5 unidades)
- Desconto automático ao criar pedido pago
- Incremento ao cancelar pedido
- Alerta no admin quando estoque ≤ threshold (configurável, default: 5)
- Bloquear venda quando estoque = 0 (ou permitir backorder)
- Relatório de estoque: produtos em baixa, sem estoque, reposição sugerida

**Notificações para admin**:
```
⚠️ Estoque baixo:
• Camiseta Premium M/Preto: 3 unidades restantes
• Tênis Runner 42/Cinza: 1 unidade restante

❌ Sem estoque:
• Boné Snapback Azul: 0 unidades
```

---

##### T11.9 — Relatórios de Vendas
**Descrição completa**: Dashboard analítico com métricas de vendas e performance de produtos.

**KPIs principais**:
| Métrica | Cálculo | Exemplo |
|---------|---------|---------|
| GMV (Gross Merchandise Value) | Soma total de pedidos | R$ 45.230,00 |
| Ticket médio | GMV / nº pedidos | R$ 156,00 |
| Total de pedidos | Count orders (paid+) | 290 |
| Taxa de conversão | Pedidos / contatos que viram catálogo | 12% |
| Taxa de abandono | Pedidos pendentes / pedidos criados | 34% |
| Produto mais vendido | Order items count | Camiseta Premium (89 vendas) |
| Revenue por canal | GMV agrupado por inbox | Inbox Vendas: 70%, Inbox Suporte: 30% |

**Gráficos**:
- Vendas ao longo do tempo (diário/semanal/mensal)
- Top 10 produtos mais vendidos (barras)
- Revenue por coleção (pizza)
- Ticket médio ao longo do tempo (linha)
- Funil de conversão: visualizou → adicionou → pagou (funil)
- Mapa de calor: horários com mais vendas

---

##### T11.10 — Cupons de Desconto
**Descrição completa**: Sistema de cupons promocionais com regras flexíveis.

**Tipos de cupom**:
| Tipo | Exemplo | Descrição |
|------|---------|-----------|
| Percentual | PROMO10 → 10% OFF | Desconto percentual sobre subtotal |
| Valor fixo | VALE50 → R$50 OFF | Desconto fixo |
| Frete grátis | FRETEGRATIS | Zera custo de frete |
| Compre X ganhe Y | LEVE3PAGUE2 | 3 itens, cobra 2 |

**Regras configuráveis**:
- Validade (data início/fim)
- Uso máximo total (ex: 100 usos)
- Uso máximo por contato (ex: 1 vez)
- Valor mínimo do pedido (ex: acima de R$100)
- Produtos/coleções específicas
- Primeira compra apenas
- Combinável com outros cupons (sim/não)

**Exemplo no WhatsApp**:
```
Contato: "Tenho um cupom"
Bot: "Qual o código do seu cupom?"
Contato: "PROMO10"
Bot: "✅ Cupom PROMO10 aplicado! Você ganhou 10% de desconto.
      Subtotal: R$ 139,80
      Desconto: -R$ 13,98
      Novo total: R$ 125,82"
```

---

##### T11.11 — Carrinho Persistente
**Descrição completa**: Contato pode adicionar produtos ao longo da conversa e finalizar quando quiser.

**Fluxo de exemplo**:
```
Contato: "Quero ver as camisetas"
Bot: [Carrossel de camisetas]
Contato: [Clica "Comprar" na Camiseta Premium]
Bot: "Qual tamanho? 1) P  2) M  3) G"
Contato: "2"
Bot: "✅ Adicionado ao carrinho: 1x Camiseta Premium M/Preto — R$ 89,90
      🛒 Carrinho (1 item): R$ 89,90
      Quer continuar comprando ou finalizar?"
Contato: "Quero ver os bonés também"
Bot: [Carrossel de bonés]
Contato: [Clica "Comprar" no Boné Snapback]
Bot: "✅ Adicionado: 1x Boné Snapback — R$ 49,90
      🛒 Carrinho (2 itens): R$ 139,80
      Quer continuar comprando ou finalizar?"
Contato: "Finalizar"
Bot: "🛒 Resumo do pedido:
      • 1x Camiseta Premium M/Preto — R$ 89,90
      • 1x Boné Snapback — R$ 49,90
      📦 Frete: R$ 12,90
      💰 Total: R$ 152,70
      Tem cupom de desconto? Responda o código ou 'NÃO'"
```

**Persistência**: carrinho salvo em `carts` (contact_id, items JSONB, expires_at). Expira em 72h de inatividade.

---

##### T11.12 — Catálogo Web Público
**Descrição completa**: Página web acessível por link com catálogo de produtos que redireciona para WhatsApp.

**Funcionalidades da página**:
- URL: `https://catalogo.whatspro.com/{workspace_slug}`
- Grid de produtos com imagens, preços, filtros por coleção
- Página de produto com galeria, variantes, descrição
- Botão "Comprar pelo WhatsApp" → abre WhatsApp com mensagem pre-preenchida:
  `Olá! Gostaria de comprar: Camiseta Premium (M/Preto) — R$ 89,90`
- SEO básico (meta tags, Open Graph)
- Tema/cores personalizáveis pelo admin

**Tabelas planejadas**: `products`, `product_variants`, `product_prices`, `product_images`, `product_collections`, `product_collection_items`, `orders`, `order_items`, `invoices`, `fulfillments`, `fulfillment_locations`, `carts`, `cart_items`, `coupons`, `coupon_usages`

**Edge Functions planejadas**: `generate-checkout-link`, `payment-webhook`, `generate-invoice-pdf`, `stock-alert`, `fulfillment-notify`, `catalog-api`

**Componentes planejados**: `ProductList`, `ProductForm`, `VariantEditor`, `ImageUploader`, `CollectionManager`, `OrderList`, `OrderDetail`, `OrderTimeline`, `CheckoutConfig`, `CouponManager`, `StockDashboard`, `SalesReports`, `CatalogPreview`, `CartPanel`

---

#### M12 - Formulários WhatsApp 📋

> **Visão**: Coletar dados estruturados via conversa WhatsApp (bot sequencial de perguntas).
> Ideal para: cadastro de clientes, pesquisas de satisfação, orçamentos, inscrições em eventos.

| Task | Status | Descrição |
|------|--------|-----------|
| T12.1 Builder de formulários | 📋 | Campos: texto, número, data, select, múltipla escolha, arquivo |
| T12.2 Bot sequencial WhatsApp | 📋 | Faz perguntas uma a uma, valida resposta, salva |
| T12.3 Field sets (grupos de campos) | 📋 | Agrupar campos logicamente (dados pessoais, endereço, etc.) |
| T12.4 Banco de submissions | 📋 | Respostas consultáveis, filtráveis e exportáveis (CSV/Excel) |
| T12.5 Landing page de captura | 📋 | Página simples que redireciona para WhatsApp com funil |
| T12.6 Integração com funis (M10) | 📋 | Formulário como step do funil conversacional |
| T12.7 Webhook de submission | 📋 | Disparar webhook ao completar formulário |
| T12.8 Lógica condicional entre campos | 📋 | Mostrar/pular campo baseado em resposta anterior |
| T12.9 Validação de respostas | 📋 | CPF, email, telefone, CEP, regex customizado |
| T12.10 Auto-preencher dados conhecidos | 📋 | Se contato já tem nome/email, não perguntar novamente |

##### T12.1 — Builder de Formulários
**Descrição completa**: Interface visual para criar formulários com diferentes tipos de campos.

**Tipos de campo suportados**:

| Tipo | Input WhatsApp | Validação | Exemplo |
|------|---------------|-----------|---------|
| Texto curto | Texto livre | Max chars, regex | "Qual seu nome completo?" |
| Texto longo | Texto livre | Max chars | "Descreva seu problema em detalhes" |
| Número | Texto numérico | Min/max, inteiro/decimal | "Quantos funcionários tem sua empresa?" |
| Email | Texto com @ | Regex email | "Qual seu e-mail?" |
| Telefone | Texto numérico | Formato BR/intl | "Qual seu telefone com DDD?" |
| CPF/CNPJ | Texto numérico | Dígito verificador | "Informe seu CPF:" |
| CEP | Texto numérico | 8 dígitos, consulta ViaCEP | "Qual seu CEP?" → auto-preenche cidade/estado |
| Data | Texto formato data | dd/mm/aaaa, range | "Qual sua data de nascimento?" |
| Hora | Texto formato hora | HH:MM | "Qual o melhor horário para contato?" |
| Select (único) | Lista numerada | Opção válida | "Área: 1) Marketing 2) Vendas 3) Suporte" |
| Multi-select | Lista numerada | 1+ opções válidas | "Interesses: 1) IA 2) CRM 3) WhatsApp (ex: 1,3)" |
| Sim/Não | "sim" ou "não" | Boolean | "Já é nosso cliente?" |
| Escala (1-10) | Número | Range 1-N | "De 0 a 10, como avalia nosso atendimento?" |
| Arquivo | Enviar mídia | Tipo/tamanho | "Envie uma foto do documento" |
| Localização | Pin no mapa | Lat/lng | "Compartilhe sua localização" |
| Assinatura | Texto "ACEITO" | Exact match | "Digite ACEITO para concordar com os termos" |

**Interface do builder**:
- Drag-and-drop para reordenar campos
- Preview em tempo real (simulador de conversa WhatsApp)
- Configuração por campo: obrigatório, placeholder, help text, validação
- Duplicar campo, copiar entre formulários

---

##### T12.2 — Bot Sequencial WhatsApp
**Descrição completa**: Motor que executa o formulário no WhatsApp como uma conversa natural.

**Fluxo de execução**:
```
Bot: "📋 Vamos começar seu cadastro! São 5 perguntas rápidas."
Bot: "1/5 — Qual seu nome completo?"
Contato: "João Silva"
Bot: "2/5 — Qual seu e-mail?"
Contato: "joao@email.com"
Bot: "3/5 — Qual o tamanho da sua empresa?"
Bot: "1) 1-10 pessoas  2) 11-50  3) 51-200  4) 200+"
Contato: "2"
Bot: "4/5 — Qual seu principal desafio?"
Bot: "1) Captar clientes  2) Reter clientes  3) Automatizar  4) Outro"
Contato: "1"
Bot: "5/5 — Qual seu orçamento mensal?"
Contato: "R$ 2000"
Bot: "✅ Cadastro completo! Obrigado, João! Um consultor entrará em contato em breve."
```

**Recursos do bot**:
- Indicador de progresso ("3/7")
- Retry em resposta inválida com mensagem de ajuda (max 3 tentativas)
- Skip de campo opcional ("responda PULAR para ignorar")
- Voltar ao campo anterior ("responda VOLTAR")
- Cancelar formulário ("responda CANCELAR")
- Timeout configurável (ex: 30min sem resposta → lembrete; 24h → cancelar)
- Mensagem de encerramento customizável

---

##### T12.3 — Field Sets (Grupos de Campos)
**Descrição completa**: Organizar campos em grupos lógicos com cabeçalho e descrição.

**Exemplo**:
```
📋 Formulário de Orçamento

[Field Set 1: Dados Pessoais]
  Bot: "📝 Primeiro, seus dados pessoais:"
  → Nome completo
  → E-mail
  → Telefone

[Field Set 2: Dados da Empresa]
  Bot: "🏢 Agora, sobre sua empresa:"
  → Nome da empresa
  → CNPJ
  → Número de funcionários

[Field Set 3: Projeto]
  Bot: "🎯 Sobre o projeto:"
  → Descrição do que precisa
  → Prazo desejado
  → Orçamento disponível
```

**Funcionalidades**:
- Cabeçalho com emoji + texto ao iniciar grupo
- Campos do grupo são enviados em sequência
- Progresso mostra "Seção 2/3 — Dados da Empresa"
- Pular seção inteira se condicional não atender

---

##### T12.4 — Banco de Submissions
**Descrição completa**: Dashboard para visualizar, filtrar e exportar todas as respostas coletadas.

**Interface do admin**:
- Tabela de submissions com colunas dinâmicas (baseadas nos campos do form)
- Filtros por: data, status (completo/parcial/cancelado), campo específico
- Busca fulltext nas respostas
- Detalhes expandíveis com timeline da conversa
- Export: CSV, Excel, JSON
- Bulk actions: excluir, reenviar, adicionar tag ao contato

**Exemplo de tabela**:
```
| Data       | Nome         | Email             | Empresa    | Orçamento | Status    |
|------------|-------------|-------------------|------------|-----------|-----------|
| 21/03/2026 | João Silva  | joao@email.com    | TechCo     | R$ 2.000  | Completo  |
| 21/03/2026 | Maria Santos| maria@empresa.com | StartupX   | R$ 5.000  | Completo  |
| 20/03/2026 | Pedro Lima  | pedro@mail.com    | —          | —         | Parcial   |
```

**Métricas do formulário**:
- Total de submissions (completas vs parciais vs canceladas)
- Taxa de conclusão: 72% (quantos iniciam vs quantos terminam)
- Tempo médio para completar: 4min 32s
- Campo com maior abandono: "Qual seu CNPJ?" (18% desistem aqui)
- Respostas por dia (gráfico de linha)

---

##### T12.5 — Landing Page de Captura
**Descrição completa**: Página web simples que captura dados básicos e redireciona para WhatsApp.

**Estrutura da landing page**:
```
┌──────────────────────────────────┐
│   [Logo] MinhaEmpresa            │
│                                  │
│   Título: "Solicite seu          │
│   Orçamento Grátis!"             │
│                                  │
│   Subtítulo: "Preencha abaixo    │
│   e receba atendimento           │
│   personalizado via WhatsApp"    │
│                                  │
│   [Campo: Nome]                  │
│   [Campo: Telefone com WhatsApp] │
│   [Campo: O que precisa?]        │
│                                  │
│   [Botão: Falar no WhatsApp →]   │
│                                  │
│   "Atendimento em até 5 minutos" │
└──────────────────────────────────┘
```

**Ao submeter**:
1. Dados salvos no contato (create/upsert)
2. Redireciona para `wa.me/{numero}?text=Oi! Meu nome é {nome}...`
3. Trigger no funil (M10): novo contato com tag "landing_page_orcamento"
4. Formulário completo (M12) inicia automaticamente no WhatsApp

**Customização**: Cores, logo, campos, textos, imagem de fundo — tudo editável no admin.

---

##### T12.6 — Integração com Funis (M10)
**Descrição completa**: Usar formulário como um step dentro de um funil conversacional.

**Exemplo no builder de funis**:
```
[Trigger: keyword "orçamento"]
  → [📨 "Vou precisar de algumas informações!"]
  → [📋 Formulário: "Cadastro de Lead" (5 campos)]
  → [🔀 Condição: resposta_orcamento > 5000]
     ├─ Sim → [⚡ Criar card "Lead Premium"] → [📨 "Nosso diretor vai te atender!"]
     └─ Não → [⚡ Criar card "Lead Standard"] → [📨 "Nosso time vai te atender!"]
```

**Dados coletados pelo formulário ficam disponíveis como variáveis no funil**:
- `{{form.nome}}`, `{{form.email}}`, `{{form.orcamento}}`, etc.

---

##### T12.7 — Webhook de Submission
**Descrição completa**: Disparar webhook HTTP POST para sistema externo quando formulário é completado.

**Payload de exemplo**:
```json
{
  "event": "form.submission.completed",
  "form_id": 42,
  "form_name": "Orçamento",
  "submission_id": 789,
  "contact_id": 123,
  "contact_phone": "+5511999887766",
  "submitted_at": "2026-03-21T14:30:00Z",
  "answers": {
    "nome": "João Silva",
    "email": "joao@email.com",
    "empresa": "TechCo",
    "funcionarios": "11-50",
    "orcamento": "R$ 2.000"
  }
}
```

**Configuração**: URL + headers customizados + retry policy (3 tentativas com backoff)
**Integração**: Enviar para n8n, Zapier, Make, HubSpot, Google Sheets, etc.

---

##### T12.8 — Lógica Condicional entre Campos
**Descrição completa**: Mostrar ou pular campos baseado nas respostas anteriores.

**Exemplo**:
```
Campo 1: "Você é pessoa física ou jurídica? 1) Física  2) Jurídica"
  Se "Física" → Campo 2a: "Qual seu CPF?"
  Se "Jurídica" → Campo 2b: "Qual seu CNPJ?" → Campo 2c: "Razão social?"

Campo 3: "Já é nosso cliente? Sim/Não"
  Se "Sim" → Pular para Campo 5 (dados do projeto)
  Se "Não" → Campo 4: "Como nos conheceu? 1) Google 2) Indicação 3) Instagram 4) Outro"
```

---

##### T12.9 — Validação de Respostas
**Descrição completa**: Validar cada resposta antes de aceitar e avançar para próximo campo.

**Validações built-in**:
| Validação | Regex/Lógica | Mensagem de erro |
|-----------|-------------|------------------|
| CPF | 11 dígitos + dígito verificador | "CPF inválido. Confira e envie novamente." |
| CNPJ | 14 dígitos + dígito verificador | "CNPJ inválido." |
| Email | Regex RFC 5322 | "E-mail inválido. Exemplo: nome@email.com" |
| Telefone BR | (XX) XXXXX-XXXX ou +55... | "Telefone inválido. Use DDD + número." |
| CEP | 8 dígitos → ViaCEP | "CEP não encontrado. Confira e envie novamente." |
| Data | dd/mm/aaaa válida | "Data inválida. Use o formato DD/MM/AAAA." |
| URL | https?://... | "URL inválida. Comece com https://" |
| Custom regex | Configurável | Mensagem customizável |

---

##### T12.10 — Auto-preencher Dados Conhecidos
**Descrição completa**: Se o contato já tem dados salvos no sistema, pular o campo ou confirmar o valor existente.

**Exemplo**:
```
[Contato já tem nome e email salvos]

Bot: "📋 Vamos ao cadastro!"
Bot: "Confirma que seu nome é *João Silva*? (Sim/Não)"
Contato: "Sim"
Bot: "E seu e-mail é *joao@email.com*? (Sim/Não)"
Contato: "Não, mudou. É joao.novo@email.com"
Bot: "Atualizado! Agora, qual o tamanho da sua empresa?"
[...continua campos desconhecidos...]
```

**Configuração por campo**:
- "Pular se preenchido" — não pergunta, usa valor salvo
- "Confirmar se preenchido" — pergunta confirmação
- "Sempre perguntar" — ignora valor salvo

**Tabelas planejadas**: `forms`, `form_fields`, `form_field_sets`, `form_field_options`, `form_conditions`, `form_submissions`, `form_answers`, `form_webhooks`

**Edge Functions planejadas**: `execute-form-bot`, `validate-form-answer`, `form-submission-webhook`

**Componentes planejados**: `FormBuilder`, `FieldEditor`, `FieldList`, `ConditionBuilder`, `SubmissionTable`, `SubmissionDetail`, `FormPreview`, `LandingPageEditor`, `FormMetrics`

---

#### M13 - Cursos & Membership WhatsApp 📋

> **Visão**: Entregar conteúdo educacional e membership via WhatsApp com tracking de progresso.
> Ideal para: infoprodutores, coaches, consultores, escolas que querem entregar cursos pelo WhatsApp.

| Task | Status | Descrição |
|------|--------|-----------|
| T13.1 CRUD cursos com seções e lições | 📋 | Hierarquia: curso → seção → lição (texto, mídia, link) |
| T13.2 Enrollment via WhatsApp | 📋 | Inscrever contato e liberar acesso por mensagem |
| T13.3 Lesson completions | 📋 | Tracking de progresso (lição concluída / pendente) |
| T13.4 Drip content | 📋 | Liberar lições por tempo ou conclusão da anterior |
| T13.5 Notificações WhatsApp | 📋 | "Nova aula disponível!", lembretes de conclusão |
| T13.6 Certificado de conclusão | 📋 | Geração automática ao completar curso |
| T13.7 Área de membros (web) | 📋 | Portal web para acessar conteúdo + progresso |
| T13.8 Quizzes e avaliações | 📋 | Perguntas após cada lição para fixar aprendizado |
| T13.9 Comunidade de alunos | 📋 | Grupo WhatsApp exclusivo por curso |
| T13.10 Gamificação | 📋 | Pontos, badges, ranking entre alunos |

##### T13.1 — CRUD Cursos com Seções e Lições
**Descrição completa**: Interface de administração para criar e gerenciar cursos com estrutura hierárquica.

**Hierarquia**:
```
📚 Curso: "Marketing Digital Completo"
├── 📂 Seção 1: "Fundamentos"
│   ├── 📄 Lição 1.1: "O que é Marketing Digital" (texto + vídeo)
│   ├── 📄 Lição 1.2: "Os 4 Ps do Marketing" (texto + imagem)
│   └── 📄 Lição 1.3: "Definindo seu Público-Alvo" (texto + exercício)
├── 📂 Seção 2: "Tráfego Pago"
│   ├── 📄 Lição 2.1: "Introdução ao Google Ads" (vídeo)
│   ├── 📄 Lição 2.2: "Facebook Ads do Zero" (vídeo + PDF)
│   └── 📄 Lição 2.3: "Otimização de Campanhas" (texto + quiz)
└── 📂 Seção 3: "Vendas"
    ├── 📄 Lição 3.1: "Funis de Venda" (texto + template)
    └── 📄 Lição 3.2: "Copywriting Persuasivo" (vídeo + exercício)
```

**Tipos de conteúdo por lição**:
| Tipo | Entrega WhatsApp | Entrega Web |
|------|-----------------|-------------|
| Texto | Mensagem formatada | Artigo renderizado |
| Vídeo | Link YouTube/Vimeo + thumbnail | Player embutido |
| Áudio | Mensagem de áudio | Player de áudio |
| PDF | Documento anexado | Viewer embutido |
| Imagem | Imagem no chat | Galeria |
| Link externo | Link clicável | Iframe ou redirect |
| Exercício | Formulário via bot (M12) | Form web |
| Quiz | Perguntas via bot | Form web interativo |

**Schema**:
```sql
courses: id, workspace_id, name, description, slug, cover_image,
         status (draft/published/archived), price, max_enrollments,
         drip_enabled, drip_interval_days, created_at

course_sections: id, course_id, name, description, position, published

course_lessons: id, section_id, name, description, content_type,
                content_data (JSONB), position, published,
                duration_minutes, is_free_preview
```

---

##### T13.2 — Enrollment via WhatsApp
**Descrição completa**: Inscrever contatos em cursos e liberar acesso ao conteúdo via WhatsApp.

**Formas de enrollment**:
| Método | Descrição | Exemplo |
|--------|-----------|---------|
| Manual (admin) | Admin inscreve contato pelo painel | Clicar "Inscrever" no perfil do contato |
| Automático (pedido M11) | Ao comprar produto vinculado ao curso | Comprou "Curso Marketing" → inscrito automaticamente |
| Automático (funil M10) | Step do funil inscreve no curso | Completou funil de onboarding → inscrito no mini-curso |
| Por link | Contato acessa link → inscrito | `https://cursos.whatspro.com/marketing-digital/inscrever` |
| Por keyword | Contato envia keyword → inscrito | Envia "CURSO" → inscrito no curso da vez |
| Importação | CSV com lista de contatos | Upload de planilha com telefones |

**Mensagem de boas-vindas ao inscrever**:
```
🎓 Parabéns, {{nome}}! Você está inscrito no curso:

📚 *Marketing Digital Completo*
📝 8 lições em 3 módulos
⏱️ Duração estimada: 5 horas
📅 Início: agora!

Sua primeira aula está pronta. Quer começar? Responda *SIM*!
```

---

##### T13.3 — Lesson Completions
**Descrição completa**: Tracking de progresso de cada aluno em cada lição do curso.

**Status por lição**:
- 🔒 Bloqueada (drip não liberou ainda)
- ⬜ Disponível (não iniciada)
- 🔄 Em andamento (visualizou mas não completou)
- ✅ Concluída (marcou como concluída ou passou no quiz)

**Mensagem de progresso**:
```
Bot: [Envia conteúdo da Lição 2.1]
Bot: "Quando terminar de assistir, responda CONCLUÍDO para avançar!"
Contato: "concluído"
Bot: "✅ Lição 2.1 concluída!
      📊 Progresso: ████████░░ 75% (6/8 lições)
      ➡️ Próxima: Lição 2.2 — Facebook Ads do Zero
      Quer continuar? Responda SIM"
```

**Dashboard do admin**:
- Lista de alunos com % de conclusão
- Alunos inativos (sem progresso há X dias)
- Lição com maior taxa de desistência
- Tempo médio de conclusão por lição

---

##### T13.4 — Drip Content
**Descrição completa**: Liberar lições gradualmente ao longo do tempo ou baseado em conclusão.

**Modos de drip**:

| Modo | Configuração | Exemplo |
|------|-------------|---------|
| Por tempo fixo | X dias após inscrição | Lição 1 no dia 0, Lição 2 no dia 3, Lição 3 no dia 7 |
| Por conclusão | Próxima após completar anterior | Completou Lição 1 → libera Lição 2 |
| Híbrido | Conclusão + tempo mínimo | Completou Lição 1 + 2 dias → libera Lição 2 |
| Dia da semana | Liberar em dias específicos | Nova lição toda segunda-feira |
| Data fixa | Data específica | Módulo 3 libera em 01/04/2026 |
| Tudo liberado | Sem drip | Todas as lições disponíveis desde o início |

**Exemplo de drip por tempo**:
```
Dia 0 (inscrição):
  Bot: "🎓 Aula 1 disponível! [conteúdo]"

Dia 3:
  Bot: "📚 {{nome}}, sua Aula 2 acabou de ser liberada!
        Módulo: Tráfego Pago
        Lição: Introdução ao Google Ads
        Quer assistir agora? Responda SIM"

Dia 7:
  Bot: "📚 Aula 3 liberada! Mas percebi que você ainda não
        concluiu a Aula 2. Que tal terminar primeiro? 😊"
```

---

##### T13.5 — Notificações WhatsApp
**Descrição completa**: Mensagens automáticas para manter alunos engajados.

**Tipos de notificação**:

| Evento | Timing | Mensagem exemplo |
|--------|--------|-----------------|
| Nova aula liberada | Imediato | "📚 Nova aula disponível: {{aula_nome}}!" |
| Lembrete de aula pendente | 3 dias sem atividade | "Ei {{nome}}, a Aula 3 está te esperando! 📖" |
| Inatividade prolongada | 7 dias sem atividade | "Sentimos sua falta! Falta pouco para concluir o curso 💪" |
| Seção concluída | Imediato | "🎉 Parabéns! Você concluiu o módulo Fundamentos!" |
| Quase lá | 80% de progresso | "Falta só 1 aula para concluir! Você consegue 🚀" |
| Curso concluído | Imediato | "🏆 Parabéns! Você concluiu o curso Marketing Digital!" |
| Certificado pronto | Imediato | "📜 Seu certificado está pronto! [link]" |
| Aniversário de inscrição | 30/60/90 dias | "Faz 30 dias que você começou! Como está indo?" |

---

##### T13.6 — Certificado de Conclusão
**Descrição completa**: Gerar certificado PDF automaticamente quando aluno completa 100% do curso.

**Conteúdo do certificado**:
```
┌────────────────────────────────────────────┐
│                                            │
│          CERTIFICADO DE CONCLUSÃO          │
│                                            │
│  Certificamos que                          │
│                                            │
│         JOÃO SILVA                         │
│                                            │
│  concluiu com êxito o curso               │
│                                            │
│   "Marketing Digital Completo"             │
│                                            │
│  com carga horária de 5 horas,            │
│  realizado de 01/03/2026 a 21/03/2026.    │
│                                            │
│  MinhaEmpresa | WhatsPRO                   │
│  Código de verificação: CERT-2026-ABC123   │
│                                            │
└────────────────────────────────────────────┘
```

**Entrega**:
- PDF gerado via edge function `generate-certificate-pdf`
- Enviado como documento no WhatsApp
- Link permanente para verificação: `https://cursos.whatspro.com/certificado/CERT-2026-ABC123`
- Compartilhável (Open Graph com preview do certificado)

---

##### T13.7 — Área de Membros (Web)
**Descrição completa**: Portal web para alunos acessarem conteúdo, acompanharem progresso e baixarem materiais.

**Funcionalidades**:
- Login via magic link (enviado por WhatsApp, sem senha)
- Dashboard com cursos inscritos e progresso de cada um
- Player de vídeo, leitor de PDF, visualizador de imagens
- Marcar lição como concluída
- Download de materiais complementares
- Área de certificados
- Botão "Continuar no WhatsApp" (link direto para conversa)

**URL**: `https://membros.whatspro.com/{workspace_slug}`

---

##### T13.8 — Quizzes e Avaliações
**Descrição completa**: Perguntas após cada lição para fixar aprendizado e validar compreensão.

**Tipos de pergunta**:
| Tipo | Formato WhatsApp | Exemplo |
|------|-----------------|---------|
| Múltipla escolha | Lista numerada | "Qual é o principal KPI? 1) Cliques 2) Conversão 3) Impressões" |
| Verdadeiro/Falso | V ou F | "CTR é a taxa de cliques dividida por impressões. V ou F?" |
| Resposta curta | Texto livre (IA avalia) | "Em poucas palavras, o que é um funil de vendas?" |
| Ordenação | Números | "Ordene: 1) Consciência 2) Decisão 3) Interesse 4) Ação. Ex: 1,3,2,4" |

**Fluxo no WhatsApp**:
```
Bot: "📝 Quiz da Aula 2.1 — 3 perguntas:"
Bot: "1/3 — O Google Ads cobra por: 1) Impressão 2) Clique 3) Ambos"
Contato: "3"
Bot: "✅ Correto! O Google Ads oferece modelos CPC e CPM."
Bot: "2/3 — Qual a taxa média de cliques no Google Search? 1) 0.5% 2) 3% 3) 15%"
Contato: "1"
Bot: "❌ Incorreto. A média é cerca de 3%. Dica: releia a seção sobre CTR."
Bot: "3/3 — Quality Score vai de: 1) 1-5 2) 1-10 3) 1-100"
Contato: "2"
Bot: "✅ Correto!
      📊 Resultado: 2/3 (67%)
      ✅ Aprovado! (mínimo: 60%)
      ➡️ Próxima aula liberada: Facebook Ads do Zero"
```

**Regras**:
- Nota mínima configurável (ex: 60% para aprovar)
- Se reprovado: revisar lição e tentar novamente
- Máximo de tentativas (ex: 3)
- Feedback por resposta (explica certo/errado)

---

##### T13.9 — Comunidade de Alunos
**Descrição completa**: Grupo WhatsApp exclusivo para alunos de cada curso.

**Funcionalidades**:
- Criar grupo WhatsApp automaticamente ao publicar curso
- Adicionar aluno ao grupo ao inscrever
- Remover ao cancelar inscrição
- Mensagem de boas-vindas automática no grupo
- Regras do grupo fixadas
- Admin pode enviar comunicados para todos os alunos via broadcast (M3)

**Exemplo**:
```
[Grupo: Marketing Digital Completo — Turma 2026]

Bot: "👋 Bem-vindo(a) ao grupo, João! Aqui você pode tirar dúvidas
      com outros alunos e com o professor.

      📋 Regras:
      1. Seja respeitoso
      2. Sem spam ou vendas
      3. Dúvidas do curso aqui, suporte técnico no privado

      Estamos com 47 alunos ativos. Bons estudos! 📚"
```

---

##### T13.10 — Gamificação
**Descrição completa**: Sistema de pontos, badges e ranking para aumentar engajamento.

**Pontuação**:
| Ação | Pontos |
|------|--------|
| Completar lição | +10 pts |
| Completar seção | +50 pts |
| Completar curso | +200 pts |
| Acertar quiz 100% | +30 pts |
| Streak de 3 dias consecutivos | +20 pts |
| Streak de 7 dias | +50 pts |
| Primeiro aluno a completar lição | +15 pts (bonus early bird) |

**Badges (conquistas)**:
| Badge | Critério | Emoji |
|-------|----------|-------|
| Primeiro Passo | Completou 1ª lição | 👣 |
| Dedicado | 7 dias consecutivos | 🔥 |
| Scholar | Completou 1 curso | 🎓 |
| Mestre | Completou 3 cursos | 🏆 |
| Perfeccionista | 100% em todos os quizzes | 💎 |
| Madrugador | Completou lição antes das 7h | 🌅 |
| Velocista | Completou curso em metade do tempo estimado | ⚡ |

**Ranking via WhatsApp**:
```
Bot: "🏆 Ranking semanal — Marketing Digital:

      🥇 Maria Santos — 340 pts (🔥 streak 12 dias)
      🥈 João Silva — 280 pts (🎓 badge Scholar)
      🥉 Pedro Lima — 210 pts
      4️⃣ Ana Costa — 195 pts
      5️⃣ Lucas Oliveira — 180 pts

      Sua posição: 2º lugar (+60 pts essa semana)
      Continue assim! 💪"
```

**Tabelas planejadas**: `courses`, `course_sections`, `course_lessons`, `course_enrollments`, `lesson_completions`, `course_quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`, `certificates`, `gamification_points`, `gamification_badges`, `gamification_user_badges`

**Edge Functions planejadas**: `deliver-lesson`, `evaluate-quiz`, `generate-certificate-pdf`, `drip-content-scheduler`, `course-notification`, `gamification-engine`

**Componentes planejados**: `CourseList`, `CourseEditor`, `SectionEditor`, `LessonEditor`, `ContentTypeSelector`, `EnrollmentManager`, `ProgressDashboard`, `QuizBuilder`, `QuizResults`, `CertificatePreview`, `GamificationDashboard`, `LeaderboardWidget`, `MemberPortal`

---

### Detalhamento das Melhorias em Módulos Existentes (R18–R30)

#### R18 — Custom Attributes em Contatos (M2)
**Descrição**: Permitir campos personalizados key-value nos contatos, além dos campos fixos (nome, telefone, email).

**Interface do admin**:
- Config de atributos: nome, tipo (text, number, date, select, boolean, url), obrigatório
- Atributos visíveis no painel do contato (M2 ContactInfoPanel)
- Editáveis inline pelo agente durante atendimento
- Filtráveis na lista de conversas

**Exemplo de uso**:
```
Contato: João Silva
├── [Fixos] Nome, Telefone, Email
├── [Custom] Empresa: "TechCo Ltda"
├── [Custom] Cargo: "Diretor de Marketing"
├── [Custom] Plano: "Enterprise"
├── [Custom] MRR: "R$ 2.500"
├── [Custom] Data renovação: "15/06/2026"
└── [Custom] Fonte: "Google Ads"
```

**Uso em funis (M10)**: `{{custom.empresa}}`, `{{custom.plano}}`, `{{custom.mrr}}`
**Tabelas**: `contact_custom_fields` (definição), `contact_custom_values` (valores por contato)

---

#### R19 — Tags em Contatos (M2)
**Descrição**: Sistema de tags aplicáveis diretamente ao contato (não à conversa), persistente entre conversas.

**Diferença de labels (atual) vs tags (novo)**:
| Aspecto | Labels (atual) | Tags (novo) |
|---------|---------------|-------------|
| Aplicado a | Conversa | Contato |
| Persiste entre conversas | Não | Sim |
| Visível em | Lista de conversas | Perfil do contato + listas |
| Uso principal | Categorizar atendimento | Segmentar contato |
| Exemplo | "urgente", "aguardando retorno" | "cliente_vip", "lead_quente", "churned" |

**Exemplos de tags**:
- Segmentação: `lead`, `cliente`, `ex-cliente`, `parceiro`
- Score: `lead_quente`, `lead_morno`, `lead_frio`
- Produto: `plano_basic`, `plano_pro`, `plano_enterprise`
- Origem: `google_ads`, `instagram`, `indicacao`, `evento`
- Comportamento: `comprou_recente`, `inativo_30d`, `vip`

**Auto-tagging**: Regras automáticas (ex: "Se comprou nos últimos 30 dias → tag `comprou_recente`")

---

#### R20 — API Pública REST (Infra)
**Descrição**: API REST completa para integrações externas, inspirada na API v2 do ClickFunnels.

**Autenticação**: Bearer token por workspace
**Base URL**: `https://{workspace}.whatspro.com/api/v1`

**Endpoints planejados**:
```
Contacts:    GET/POST/PUT/DELETE  /api/v1/contacts
Tags:        GET/POST/DELETE      /api/v1/contacts/:id/tags
Conversations: GET               /api/v1/conversations
Messages:    GET/POST             /api/v1/conversations/:id/messages
Products:    GET/POST/PUT/DELETE  /api/v1/products
Orders:      GET/POST/PUT         /api/v1/orders
Funnels:     GET                  /api/v1/funnels
Courses:     GET                  /api/v1/courses
Enrollments: GET/POST             /api/v1/courses/:id/enrollments
Forms:       GET                  /api/v1/forms
Submissions: GET                  /api/v1/forms/:id/submissions
Webhooks:    GET/POST/PUT/DELETE  /api/v1/webhooks
```

**Rate limiting**: 100 requests/minuto por token
**Paginação**: cursor-based (`?after=cursor_abc&limit=25`)
**Filtros**: `?status=active&tag=vip&created_after=2026-01-01`

---

#### R21 — Pipeline Analytics (M4)
**Descrição**: Dashboard analítico para pipelines de vendas com forecast e métricas de velocidade.

**KPIs**:
| Métrica | Cálculo | Exemplo |
|---------|---------|---------|
| Pipeline Value | Soma valores de todos os cards | R$ 234.500 |
| Weighted Forecast | Σ(valor × probabilidade do stage) | R$ 87.200 |
| Win Rate | Cards "Ganho" / Total | 32% |
| Avg Deal Size | Valor médio dos cards ganhos | R$ 4.500 |
| Sales Velocity | (Nº deals × Win rate × Avg size) / Avg cycle | R$ 12.800/dia |
| Avg Cycle Time | Tempo médio de "Novo" até "Ganho" | 14 dias |
| Stage Conversion | % que avança de cada stage | Qualificado→Proposta: 65% |

---

#### R22 — Probabilidade de Fechamento por Stage (M4)
**Descrição**: Cada coluna do Kanban tem uma probabilidade associada, usada para forecast.

**Exemplo**:
```
Novo (10%) → Qualificado (25%) → Proposta (50%) → Negociação (75%) → Ganho (100%)
                                                                   → Perdido (0%)
```

---

#### R23 — Lead Scoring Automático (M2/M4)
**Descrição**: Pontuação automática do contato baseada em interações e perfil.

**Critérios de scoring**:
| Ação | Pontos | Decay |
|------|--------|-------|
| Respondeu mensagem | +5 | -1/semana |
| Clicou link | +10 | -2/semana |
| Completou formulário | +20 | — |
| Comprou produto | +50 | — |
| Abriu conversa | +3 | -1/semana |
| VIP tag | +30 | — |
| Inativo 30+ dias | -20 | — |

**Classificação automática**:
- 0-20: ❄️ Frio → tag `lead_frio`
- 21-50: 🌡️ Morno → tag `lead_morno`
- 51+: 🔥 Quente → tag `lead_quente`

---

#### R26 — Agendamento de Reuniões Calendly-like (M8)
**Descrição**: Contato escolhe data/hora disponível via WhatsApp.

**Fluxo**:
```
Bot: "Vamos agendar sua consultoria! Qual o melhor dia?"
Bot: "📅 Horários disponíveis esta semana:
      1) Ter 22/03 — 10h, 14h, 16h
      2) Qua 23/03 — 9h, 11h, 15h
      3) Qui 24/03 — 10h, 14h
      Responda com dia e hora (ex: 2, 15h)"
Contato: "2, 15h"
Bot: "✅ Agendado! Consultoria com {{agente}} em:
      📅 Qua 23/03/2026 às 15h00
      ⏱️ Duração: 30 minutos
      📍 Google Meet: {{link}}
      Vou te lembrar 1h antes! 😊"
```

**Configuração**: calendário de disponibilidade por agente, duração padrão, buffer entre reuniões, integração Google Calendar.

---

#### R27 — GDPR Compliance (M2)
**Descrição**: Anonimizar/excluir dados pessoais de contatos conforme LGPD/GDPR.

**Ações**:
- Redact: substitui dados por "[REDACTED]" (mantém histórico anônimo)
- Delete: exclui contato e todo histórico permanentemente
- Export: gera arquivo com todos os dados do contato (portabilidade)
- Consent log: registra quando/como contato deu consentimento

---

#### R28 — Webhooks Tipados por Evento (Infra)
**Descrição**: Expandir webhooks de saída para múltiplos eventos tipados.

**Eventos disponíveis**:
```
contact.created        contact.updated        contact.deleted
contact.tag.added      contact.tag.removed
conversation.created   conversation.resolved  conversation.assigned
message.received       message.sent
order.created          order.paid             order.shipped       order.delivered
form.submitted
funnel.started         funnel.completed       funnel.abandoned
course.enrolled        course.completed       lesson.completed
```

---

#### R29 — Multi-workspace (Infra)
**Descrição**: Hierarquia organizacional para agências e empresas com múltiplas marcas.

**Hierarquia**: Organização → Workspace → Inboxes/Recursos
- Uma organização pode ter múltiplos workspaces
- Cada workspace tem seus próprios contatos, produtos, funis
- Billing e usuários gerenciados na organização
- Switch entre workspaces sem logout

---

#### R30 — Image Management com Resize (Infra)
**Descrição**: Upload de imagens com geração automática de múltiplos tamanhos.

**Tamanhos gerados**:
| Nome | Dimensão | Uso |
|------|----------|-----|
| thumbnail | 100x100 | Listas, avatares |
| small | 300x300 | Cards, previews |
| medium | 600x600 | Catálogo, chat |
| large | 1200x1200 | Página de produto |
| original | Full size | Download |

**Formatos**: WebP (default, menor), JPEG (fallback), PNG (quando transparência)
**Storage**: Supabase Storage com CDN, max 10MB por imagem

---

## Guia de Auto-Atualização

> **IMPORTANTE**: Este PRD deve ser atualizado a cada nova funcionalidade implementada e testada.

### Quando atualizar:
1. **Nova feature implementada** → Adicionar task no módulo correspondente com ✅
2. **Feature em progresso** → Marcar com 🔄
3. **Feature planejada** → Adicionar no Roadmap com 📋
4. **Bug fix significativo** → Adicionar no Changelog
5. **Nova edge function** → Atualizar tabela de Edge Functions
6. **Nova tabela no banco** → Atualizar seção de Infraestrutura
7. **Mudança de arquitetura** → Atualizar Visão Geral

### Como atualizar:
1. Incrementar versão no topo (semver: major.minor.patch)
2. Adicionar entrada no Changelog com data
3. Atualizar task status no módulo afetado
4. Mover item do Roadmap para o módulo quando implementado
5. Atualizar contadores (tabelas, functions, etc.)

### Convenções de status:
- ✅ **Implementado** — Feature completa, testada e em produção
- 🔄 **Em Progresso** — Implementação iniciada
- 📋 **Planejado** — No roadmap, não iniciado
- ⚠️ **Depreciado** — Será removido em versão futura
