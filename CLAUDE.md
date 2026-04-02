# WhatsPRO - CRM Multi-Tenant WhatsApp

## Overview
WhatsPRO is a multi-tenant WhatsApp helpdesk, CRM, AI Agent, and Leads platform built with React + Supabase + UAZAPI.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: Gemini 2.5 Flash (AI Agent M10), Gemini 2.5 Flash Preview TTS (voice), Groq API (Whisper transcription, Llama summarization/carousel copy), Mistral Small (carousel fallback)
- **Data Fetching**: TanStack React Query 5

## Architecture
```
React Frontend -> Supabase Edge Functions -> UAZAPI (WhatsApp)
                                          -> Gemini AI (Agent, TTS, Function Calling)
                                          -> Groq AI (Summaries/Transcription)
React Frontend -> Supabase Client (DB, Auth, Realtime, Storage)
```

## User Roles
- `super_admin` - Full access, manage instances/inboxes/users
- `gerente` - Manager, manage team within assigned inboxes, CRM, Leads
- `user` - Agent, handle conversations in assigned inboxes

## Key Features
- Multi-instance WhatsApp management
- Helpdesk with real-time chat, labels, assignments, departments
- Broadcast messaging (text, media, carousel) to groups and leads
- Lead database management with CSV import
- AI Agent (M10): 8 tools, shadow mode, TTS (6 voices), sub-agents, SDR qualification flow
- Leads module (M11): lead cards, timeline, conversation modal, block IA, clear context, quick IA toggle
- Kanban CRM boards with custom fields + lead integration (contact_id FK)
- AI-powered conversation summaries and audio transcription
- Scheduled/recurring messages + message templates
- Shift reports via WhatsApp
- Intelligence/analytics dashboard
- Quick Product Import: paste URL → scrape → auto-fill catalog form (S6)
- Global cross-inbox search (Ctrl+K) with command palette
- UTM Campaign tracking: links, QR codes, metrics, AI contextual
- TTS: AI Agent responds with audio (Gemini 2.5 Flash Preview TTS)
- Auto-carousel: multi-photo product carousel (up to 5 photos) with AI sales copy per card
- Handoff triggers: auto-transfer to human when keywords detected
- LLM Fallback Chain: Groq (Llama 3.3) → Gemini 2.5 Flash → Mistral Small → static templates

## Deployment
- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD**: GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer**: Stack "whatspro" on Hetzner CX42 (65.108.51.109)

## Edge Functions (26 total)
Located in `supabase/functions/`. Each uses Deno runtime.
- JWT verification: `verify_jwt = true` on 20 functions, `false` only on webhooks (whatsapp-webhook, fire-outgoing-webhook, go, health-check)
- Shared CORS config in `supabase/functions/_shared/cors.ts`
- Shared utilities: `fetchWithTimeout.ts` (30s timeout), `rateLimit.ts` (atomic RPC-based), `circuitBreaker.ts` (Gemini/Groq/Mistral), `logger.ts` (JSON structured), `response.ts` (standard format)
- AI Agent: `ai-agent` (brain, SDR+handoff+shadow, circuit breaker, parallel tools), `ai-agent-debounce` (10s atomic grouping, retry), `ai-agent-playground` (testing)
- Product Import: `scrape-product` (URL → title, price, description, images, category via JSON-LD/NEXT_DATA/OG)
- UTM Tracking: `go` (redirect endpoint for campaign links)
- Monitoring: `health-check` (DB + MV + env verification → 200/503)
- Background: `process-jobs` (SKIP LOCKED job queue processor for lead_auto_add, profile_pic_fetch)

## Commands
- `/prd` - Consultar PRD completo do projeto (módulos, tasks, roadmap, changelog)
- `/uazapi` - UAZAPI WhatsApp API expert reference

## PRD
O documento `PRD.md` na raiz do projeto é a fonte de verdade para funcionalidades, versionamento e roadmap.
Deve ser atualizado sempre que uma feature for implementada e testada (use `/prd` para consultar).

## Development
```bash
npm run dev          # Start dev server
npm run build        # Production build
npx supabase functions deploy <name>  # Deploy edge function
```

## Regra de Consistencia Obrigatoria (SYNC RULE)
Toda alteracao em campo configuravel, regra do agente, ou comportamento DEVE ser sincronizada automaticamente em TODOS os 6 locais abaixo. NAO esperar o usuario pedir. NAO fazer parcialmente.

**Checklist obrigatorio ao alterar qualquer feature do AI Agent:**
1. **Banco (coluna)** — campo existe em `ai_agents`? Default correto? Migration criada?
2. **Types.ts** — campo adicionado em Row, Insert e Update de `ai_agents`?
3. **Admin UI** — campo visivel e editavel no painel? Label e descricao claras?
4. **ALLOWED_FIELDS** — campo listado em `AIAgentTab.tsx` ALLOWED_FIELDS para auto-save?
5. **Backend (ai-agent)** — campo lido e usado no `index.ts`? Logica implementada?
6. **Prompt (prompt_sections)** — regra refletida no system prompt? Variavel template se aplicavel?
7. **system_settings defaults** — default atualizado para novos agentes?
8. **Documentacao** — CLAUDE.md + PRD.md atualizados?

Se QUALQUER um dos 8 itens nao estiver sincronizado, a feature esta INCOMPLETA. Verificar ANTES de reportar como concluida.

## Important Patterns
- UAZAPI responses have inconsistent field names (PascalCase/camelCase) - always handle both
- Instance tokens are resolved server-side, never exposed to frontend
- Media URLs from UAZAPI: /message/download returns persistent URLs, stored directly (no re-upload to Storage)
- Carousel AI copy: generateCarouselCopies() uses Groq→Gemini→Mistral chain with 3s timeout per provider
- Timestamps may be in seconds or milliseconds - auto-detect with > 9999999999 check
- AI Agent tools execute during Gemini function calling loop (instance token loaded early)
- Lead profiles link to contacts via contact_id (1:1), kanban_cards link via contact_id FK
- Tags on conversations use TEXT[] array with "key:value" format
- status_ia constants: use STATUS_IA.LIGADA/DESLIGADA/SHADOW from _shared/constants.ts (edge) or src/constants/statusIa.ts (frontend) — NEVER use magic strings
- Shadow mode: status_ia=STATUS_IA.SHADOW — AI extracts data without responding (auto after handoff)
- Greeting: sent directly before Gemini, save-first lock prevents duplicates, TTS when voice active. LLM tends to re-greet when lead gives name — strip "Olá, [Name]!" from response start + system prompt says NEVER greet again
- SDR flow: generic terms → qualify first, specific → search immediately
- Handoff: tool sends 1 message + breaks loop (no duplicate text), implicit detection before send
- Debounce: atomic UPDATE WHERE processed=false (eliminates race condition)
- AI Agent helpers: sendTextMsg(), sendTts(), broadcastEvent(), mergeTags(), cleanProductTitle()
- Media inserts MUST broadcast: after every conversation_messages INSERT of carousel/image in ai-agent, call broadcastEvent() — otherwise helpdesk Realtime never shows the message
- ChatPanel new-message handler fetches last 3 (not 1) to avoid race condition when carousel+text inserted in quick succession
- LLM carousel copies: Groq→Gemini→Mistral chain, Card 1 code-generated (title+price), Cards 2-5 AI
- Clear context: resets status_ia='ligada' + clears ia_blocked_instances + sets tags to ['ia_cleared:TIMESTAMP'] (NEVER [] — empty tags breaks handoff counter, causing immediate handoff on next message)
- Circuit breaker: geminiBreaker/groqBreaker/mistralBreaker (3 failures → OPEN 30s → HALF_OPEN probe)
- Rate limit: atomic RPC check_rate_limit() with global limit support (no race condition)
- Webhook: parallel I/O (media+dedup+contact via Promise.all), profile pic in background
- Lead upsert: atomic ON CONFLICT + update_lead_count_from_entries RPC (no lost updates) + phone validation (>= 10 chars)
- AI Agent instance validation: agent.instance_id must match request instance_id (prevents cross-instance invocation)
- Optimistic updates: handleUpdateConversation uses targeted rollback per conversation (not full-array replace)
- Broadcast: 3s AbortController timeout (Realtime API degradation doesn't block webhook)
- Chat pagination: last 50 messages + "Load older" button + Realtime appends single new msg
- Archiving: conversations.archived column + archive_old_conversations(90) RPC
- Job queue: job_queue table with claim_jobs (FOR UPDATE SKIP LOCKED) + process-jobs worker
- Materialized view: mv_user_inbox_roles + has_inbox_access_fast() refreshed periodically
- Audit log: admin_audit_log table (immutable) + log_admin_action() RPC on create/delete/update user
- Playground v2: tool inspector, thumbs up/down, overrides (model/temp/tools), buffer simulation, personas, guardrail tester
- Playground greeting fix: greeting injected as model message in geminiContents (not system prompt instruction)
- TicketResolutionDrawer: bottom sheet (vaul) com 4 categorias, move kanban card, aplica tags, atualiza lead_profile
- Dashboard performance: fetchData() parallelized, fetchGroupsStats() deferred, HelpdeskMetricsCharts .limit(500)
- Typing indicator: broadcastTyping() fire-and-forget via helpdesk-realtime, throttle 3s, self-exclusion, auto-clear 4s
- Quick reply templates: "/" prefix in ChatInput triggers dropdown, loads message_templates, keyboard navigation
- Date dividers: getDateLabel() uses toZonedTime(BRAZIL_TZ) for timezone-correct day boundaries
- Agent Performance: AgentPerformanceCard on DashboardHome — ranked agents with resolution rate, response time, msgs
- Bulk actions: Set<string> selectedIds + handleBulkAction (read/resolve/archive) — selection clears on inbox/status change
- Validator Agent: _shared/validatorAgent.ts — audits each AI response (score 0-10, PASS/REWRITE/BLOCK). Checks: forbidden phrases, blocked topics, discount limit, multiple questions, name frequency, invented info. Persists to ai_agent_validations table.
- Prompt Studio: ai_agents.prompt_sections JSONB — 9 editable sections (identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional) + auto-generated business_context. Template vars: {agent_name}, {personality}, {max_pre_search_questions}, {max_qualification_retries}, {max_discount_percent}. Defaults in system_settings.default_prompt_sections.
- Greeting race guard: after greeting block, checks if greeting_sent was logged in last 30s by concurrent call — prevents duplicate messages when debounce fires multiple ai-agent calls simultaneously
- TTS fallback chain: _shared/ttsProviders.ts — Gemini → Cartesia → Murf → Speechify → text. Provider chain configurable via ai_agents.tts_fallback_providers JSONB. API keys: CARTESIA_API_KEY, MURF_API_KEY, SPEECHIFY_API_KEY env vars.
- Audio split for long responses: splitAudioAndText() sends first sentence as TTS audio + full text as follow-up message (when response > voice_max_text_length and lead sent audio)
- Fuzzy product search: search_products_fuzzy() RPC — pg_trgm word-level similarity. Fallback after ILIKE exact + word-by-word. Threshold 0.3. Catches typos like "cooral"→"coral".
- Carousel config: ai_agents.carousel_text + carousel_button_1 + carousel_button_2 — customizable text and 2 buttons per card (second button optional, empty = hidden)
- Carousel fallback: when all 4 UAZAPI payload variants fail, sends up to 3 individual photos before falling back to text
- Handoff → SHADOW: all handoff types (tool, trigger, implicit) set status_ia='shadow' (not 'desligada'). AI continues extracting data silently. Only Clear Context uses 'desligada'.
- Handoff text discard: when handoff_to_human tool executes, any LLM-generated text is discarded — lead receives only the configured handoff_message
- Handoff by hours: ai_agents.handoff_message_outside_hours — separate message for outside business hours. Business hours use weekly schedule: ai_agents.business_hours JSONB {"mon":{"open":true,"start":"08:00","end":"18:00"}, ...}
- Sub-agent routing by tags: motivo:compra→sales, motivo:suporte→support, motivo:financeiro→handoff. Only injects relevant sub-agent prompt instead of all 5.
- Tag taxonomy (3 levels): motivo (intent), interesse (category from catalog), produto (specific product). Enforcement: VALID_KEYS whitelist, VALID_MOTIVOS set, VALID_OBJECOES set. Auto-extracts interesse from search_products results.
- ValidatorMetrics component: score avg, PASS/REWRITE/BLOCK rates, score distribution, top violations with severity, AI suggestions
- Validator rigor levels: moderado (score>=8 PASS), rigoroso (>=9), maximo (only 10). Config: ai_agents.validator_enabled, validator_model, validator_rigor
- AI Agent Tools (8): search_products, send_carousel, send_media, handoff_to_human, assign_label, set_tags, move_kanban, update_lead_profile
- Qualification retries: max_qualification_retries (default 2) — search_fail:N tag tracks failed searches. N >= max → force handoff. Resets on product found.
- max_pre_search_questions: max perguntas de qualificacao antes de search_products para termos genericos (default 3)
- max_lead_messages: auto-handoff apos N msgs do lead (default 8). Atomic counter via increment_lead_msg_count RPC.
- Campaign context: tag campanha:NAME on conversation → loads utm_campaigns.ai_template + ai_custom_text into system prompt
- context_long_enabled (Memoria do Lead): loads lead_profiles (full_name, city, interests, ticket, objections, conversation_summaries) into prompt
- Shared modules (15): cors.ts, fetchWithTimeout.ts, circuitBreaker.ts, llmProvider.ts, constants.ts, logger.ts, agentHelpers.ts, auth.ts, supabaseClient.ts, carousel.ts, rateLimit.ts, validatorAgent.ts, ttsProviders.ts, response.ts, aiRuntime.ts
- Admin AI Agent components (19): GeneralConfig, BrainConfig, CatalogConfig, CatalogTable, CatalogProductForm, CsvProductImport, BatchScrapeImport, KnowledgeConfig, RulesConfig, GuardrailsConfig, VoiceConfig, ExtractionConfig, MetricsConfig, ValidatorMetrics, SubAgentsConfig, BlockedNumbersConfig, FollowUpConfig, BusinessInfoConfig, PromptStudio
- Admin AI Agent tabs: Setup (GeneralConfig+BusinessInfo), Prompt Studio, Inteligencia (Brain+SubAgents+Extraction), Catalogo, Conhecimento, Seguranca (Rules+Guardrails+BlockedNumbers), Canais (Voice+FollowUp), Metricas (Metrics+ValidatorMetrics)
