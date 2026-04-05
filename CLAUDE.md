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
- UTM Campaign tracking: links, QR codes, metrics, AI contextual, landing page with countdown + client-side capture
- TTS: AI Agent responds with audio (Gemini 2.5 Flash Preview TTS)
- Auto-carousel: multi-photo product carousel (up to 5 photos) with AI sales copy per card
- Handoff triggers: auto-transfer to human when keywords detected
- LLM Fallback Chain: Groq (Llama 3.3) → Gemini 2.5 Flash → Mistral Small → static templates

## Deployment
- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD**: GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer**: Stack "whatspro" on Hetzner CX42 (65.108.51.109)

## Edge Functions (28 total)
Located in `supabase/functions/`. Each uses Deno runtime.
- JWT verification: `verify_jwt = true` on 20 functions, `false` only on webhooks (whatsapp-webhook, fire-outgoing-webhook, go, health-check)
- Shared CORS config in `supabase/functions/_shared/cors.ts`
- Shared utilities: `fetchWithTimeout.ts` (30s timeout), `rateLimit.ts` (atomic RPC-based), `circuitBreaker.ts` (Gemini/Groq/Mistral), `logger.ts` (JSON structured), `response.ts` (standard format)
- AI Agent: `ai-agent` (brain, SDR+handoff+shadow, circuit breaker, parallel tools), `ai-agent-debounce` (10s atomic grouping, retry), `ai-agent-playground` (testing)
- Product Import: `scrape-product` (URL → title, price, description, images, category via JSON-LD/NEXT_DATA/OG)
- UTM Tracking: `go` (landing page with countdown + client-side capture + WhatsApp deep link fallback)
- Monitoring: `health-check` (DB + MV + env verification → 200/503)
- Background: `process-jobs` (SKIP LOCKED job queue processor for lead_auto_add, profile_pic_fetch)
- WhatsApp Forms: `form-bot` (processador de sessões de formulário WhatsApp — initiation FORM:slug + continuation + validações + webhook externo)
- Landing Forms: `form-public` (public GET form definition + POST submit → contact + lead_profile + form_submission + utm match + kanban card)

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

## Regras de Integridade de Dados e Comunicação

### NUNCA reportar dados falsos ou inconsistentes
- NUNCA dar nota/score parcial e depois mudar para pior — avaliar somente com dados completos
- NUNCA dizer que algo funciona baseado em teste parcial — só confirmar após teste E2E completo
- NUNCA quebrar código em produção — testar localmente antes de deploy quando possível
- Se um resultado contradiz resultado anterior, explicar POR QUE mudou antes de dar novo resultado
- Auditorias e notas devem ser baseadas no cenário mais completo e realista, não em testes isolados

## Sequência de Correção de Erros do AI Agent (OBRIGATÓRIA — 4 NÍVEIS)
Quando um teste E2E detectar erro no comportamento do agente, corrigir NESTA ORDEM:
1. **Código + Prompt hardcoded** — bug no fluxo, lógica errada, guard faltando. Fix no index.ts ou _shared/.
2. **Instrução no Validator Agent** — validator não detectou o erro? Adicionar regra no validatorAgent.ts (leadQuestions, catalogPrices, nome exato). Validator REWRITE corrige antes de enviar.
3. **FAQ/Q&A na Knowledge Base** — para textos genéricos, perguntas cotidianas, ou respostas que o LLM erra repetidamente. Inserir na ai_agent_knowledge como FAQ. O LLM consulta antes de responder.
4. **Fallback: Mensagem de transbordo + Handoff** — quando NENHUMA das 3 camadas anteriores resolve, o agente envia mensagem empática e faz handoff_to_human. ÚLTIMO recurso. Lead nunca fica sem resposta.

Regra especial: **frustração + handoff no mesmo batch = handoff direto.** Quando msgs agrupadas contêm frustração ("absurdo", "demora") E trigger de handoff ("gerente", "atendente"), vai direto pro handoff sem tentar processar. Não tenta responder empatia + produto — transfere imediatamente.

NUNCA pular etapas. Se o erro é de código, não resolver com FAQ. Se o validator deveria ter pegado, corrigir o validator ANTES de criar FAQ. Handoff é o ÚLTIMO recurso — só quando o agente genuinamente não consegue ajudar. Lead NUNCA fica sem resposta.

## Protocolo Obrigatório de Entrega (NUNCA PULAR)
Toda feature implementada DEVE seguir esta sequência completa antes de ser considerada pronta:

1. **Implementar** — código funcional, sem `as any`, sem magic strings
2. **TypeScript** — `npx tsc --noEmit` deve retornar 0 erros
3. **Testes** — escrever testes para o novo código. `npx vitest run` deve passar 100%
4. **Auditoria** — verificar: nenhum arquivo proibido tocado, dados legados preservados, RLS correto
5. **Commit** — mensagem descritiva com escopo (feat/fix/chore + módulo)
6. **Documentar** — atualizar CLAUDE.md + PRD.md + memory/MEMORY.md

NUNCA reportar feature como concluída sem todos os 6 passos verificados.

## Sistema de Contexto — Roadmap M2 (Agent QA Framework)

Estado atual (atualizar após cada feature):
- [x] Pré-requisitos: bug fix activeSubAgents, 38 migrations, types.ts, e2e_test_batches
- [x] F1: Histórico Persistente de Batches — BatchHistoryTab + hooks (commit 4fe98ad)
- [x] F2: Fluxo de Aprovação Admin — useE2eApproval + ApprovalQueue + ReviewDrawer (commit 95ad466)
- [x] F3: Barra de Evolução (Score Composto) — agentScoring + useAgentScore + AgentScoreBar (commit 95ad466)
- [x] F4: Ciclo Automatizado Teste → Ajuste → Re-teste — migration + e2e-scheduled + UI (E2eSchedulePanel + RegressionBadge + BatchHistoryPanel)

Arquivos HIGH RISK — nunca tocar sem aprovação explícita:
- supabase/functions/ai-agent/index.ts (2458 linhas, zero testes de integração)
- supabase/functions/ai-agent-playground/index.ts
- supabase/functions/e2e-test/index.ts
- src/integrations/supabase/types.ts (só via `npx supabase gen types`, nunca editar manual)

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
- Tab focus refresh: useTabFocusRefresh() in AppRoutes — when tab hidden 30s+, revalidates Supabase session + invalidates all React Query caches + dispatches instances-updated event. Fixes stale data on tab return (Chrome suspends inactive tabs).
- Dashboard performance: fetchData() parallelized, fetchGroupsStats() deferred, HelpdeskMetricsCharts .limit(500)
- Typing indicator: broadcastTyping() fire-and-forget via helpdesk-realtime, throttle 3s, self-exclusion, auto-clear 4s
- Quick reply templates: "/" prefix in ChatInput triggers dropdown, loads message_templates, keyboard navigation
- Date dividers: getDateLabel() uses toZonedTime(BRAZIL_TZ) for timezone-correct day boundaries
- Agent Performance: AgentPerformanceCard on DashboardHome — ranked agents with resolution rate, response time, msgs
- Bulk actions: Set<string> selectedIds + handleBulkAction (read/resolve/archive) — selection clears on inbox/status change
- Validator Agent: _shared/validatorAgent.ts — audits each AI response (score 0-10, PASS/REWRITE/BLOCK). Checks: forbidden phrases, blocked topics, discount limit, multiple questions, name frequency, invented info. Persists to ai_agent_validations table.
- Prompt Studio: ai_agents.prompt_sections JSONB — 9 editable sections (identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional) + auto-generated business_context. Template vars: {agent_name}, {personality}, {max_pre_search_questions}, {max_qualification_retries}, {max_discount_percent}. Defaults in system_settings.default_prompt_sections.
- Greeting race guard: after greeting block, checks if greeting_sent was logged in last 30s by concurrent call — prevents duplicate messages when debounce fires multiple ai-agent calls simultaneously
- Greeting + question: when lead's first msg is a real question (not just "oi"), greeting is sent AND function continues to LLM to answer. Only pure greetings stop after greeting. This prevents losing substantive questions on first contact.
- Question-aware handoff triggers: INFO_TERMS set (horario, preco, endereco, etc.) are NOT matched as handoff triggers when the lead is asking a question ("Qual o horário?"). Pure handoff triggers ("atendente", "humano") always match.
- Business hours weekly format: supports both legacy {"start":"08:00","end":"18:00"} and weekly {"mon":{"open":true,"start":"08:00","end":"18:00"},...} formats. Day keys: sun/mon/tue/wed/thu/fri/sat.
- Duplicate guard 15s (excludes greetings): checks NON-greeting outgoing msgs in last 15s. Greetings (external_id `ai_greeting_*`) are excluded because they should NOT block the next real LLM response from being processed.
- Debounce NO RETRY on 500: the 500 from ai-agent is gateway timeout (Supabase ~25s limit), NOT a crash — function keeps running in background. Retry was creating duplicate executions. Removed entirely.
- Empty LLM response = silent: when LLM returns empty text, NEVER send fallback to lead. Return silently with log. "Desculpe não consegui processar" must NEVER reach the lead.
- Hardcoded safety rules in system prompt: NUNCA dizer "não encontrei/não temos/sem estoque" — lead never sees search failures. Tool returns marked [INTERNO] when search fails.
- Question-aware triggers expanded: INFO_TERMS includes desconto, parcelar, parcela, frete, negociar, prazo, garantia, troca, devolução, pix. Prefixes: faz, fazem, aceita, aceitam. Lead asking "Faz desconto no pix?" does NOT trigger handoff.
- Negative sentiment empathy: when handoff_to_human is called with a negative sentiment reason, an empathy message is sent BEFORE the handoff message. Lead never receives cold handoff on frustration.
- Hardcoded prompt: LLM must read ALL lines of grouped messages and NEVER re-ask something lead already said. NEVER repeat questions from history.
- TTS fallback chain: _shared/ttsProviders.ts — Gemini → Cartesia → Murf → Speechify → text. Provider chain configurable via ai_agents.tts_fallback_providers JSONB. API keys: CARTESIA_API_KEY, MURF_API_KEY, SPEECHIFY_API_KEY env vars.
- Audio split for long responses: splitAudioAndText() sends first sentence as TTS audio + full text as follow-up message (when response > voice_max_text_length and lead sent audio)
- Fuzzy product search: search_products_fuzzy() RPC — pg_trgm word-level similarity. Fallback after ILIKE exact + word-by-word. Threshold 0.3. Catches typos like "cooral"→"coral".
- Post-search AND filter: after EVERY search (primary + fallbacks), filter results to keep only products matching ALL query words. Prevents "tinta iquine branco" from returning Coral (matches "tinta"+"branco" but not "iquine"). If strict filter removes everything, keeps original results.
- Search pipeline order: 1) ILIKE exact phrase → 2) word-by-word AND → 3) fuzzy pg_trgm → post-filter AND on ALL results. NEVER return products that don't match the brand/keyword the lead specified.
- Carousel config: ai_agents.carousel_text + carousel_button_1 + carousel_button_2 — customizable text and 2 buttons per card (second button optional, empty = hidden)
- Carousel fallback: when all 4 UAZAPI payload variants fail, sends up to 3 individual photos before falling back to text
- Handoff → SHADOW: all handoff types (tool, trigger, implicit, max_lead_messages) set status_ia='shadow' (not 'desligada'). Final conversation update SKIPS status_ia when handoff happened (won't overwrite SHADOW). Only Clear Context uses 'desligada'.
- Handoff only on explicit request: handoff_to_human is ONLY for (1) lead explicitly asks "vendedor/atendente/gerente", (2) persistent negative sentiment, (3) unanswerable questions. Price/discount/payment/delivery questions are NEVER handoff — agent answers from business_info.
- Shadow extraction fields: in SHADOW mode, LLM extracts via update_lead_profile (full_name, city, interests, reason, average_ticket, objections, notes) + set_tags (cidade:X, quantidade:Y, orcamento:Z). Prompt instructs to extract EVERYTHING.
- Grouped messages structured format: when debounce combines 2+ messages, they are formatted as "[Mensagem 1]: text\n[Mensagem 2]: text" so LLM addresses each statement. Dedup filter removes incoming msgs already in contextMessages to prevent duplication.
- Price in tool return: when search_products sends carousel, the tool return includes product list with prices (resultText) so LLM can answer "Quanto custa?" with exact values. Instruction: "Se o lead PERGUNTAR preço → RESPONDA com valor exato".
- Shadow name protection: shadow mode NEVER overwrites existing full_name in lead_profile. Prevents "Obrigado Pedro!" from replacing lead name with seller name. Shadow prompt explicitly says to ignore non-lead names when name already exists.
- Agent only uses admin data: business_info section lists ONLY what admin configured. Missing fields are explicitly flagged in prompt ("INFORMAÇÕES NÃO CADASTRADAS: X, Y"). Agent MUST handoff on unconfigured topics — NEVER invent info. Rule: "Se NÃO está aqui, NÃO invente." Test scenarios MUST match real admin config — never assume data that isn't in the DB.
- Price always numeric: when search_products returns products after carousel, tool return includes resultText with prices. Hardcoded rule forces LLM to ALWAYS include R$XX,XX in response. "Nunca responda sobre preço sem citar o valor."
- TTS preview no admin: botão de teste de voz funciona quando GEMINI_API_KEY está na system_settings (SecretsTab). Edge Functions leem dos secrets do Supabase (Deno.env), admin frontend lê de system_settings. Ambos precisam estar configurados.
- Handoff text discard: when handoff_to_human tool executes, any LLM-generated text is discarded — lead receives only the configured handoff_message
- Handoff by hours: ai_agents.handoff_message_outside_hours — separate message for outside business hours. Business hours use weekly schedule: ai_agents.business_hours JSONB {"mon":{"open":true,"start":"08:00","end":"18:00"}, ...}
- Sub-agent routing by tags: motivo:compra→sales, motivo:suporte→support, motivo:financeiro→handoff. Only injects relevant sub-agent prompt instead of all 5.
- Tag taxonomy (3 levels): motivo (intent), interesse (category from catalog), produto (specific product). Enforcement: VALID_KEYS whitelist, VALID_MOTIVOS set, VALID_OBJECOES set. Auto-extracts interesse from search_products results.
- ValidatorMetrics component: score avg, PASS/REWRITE/BLOCK rates, score distribution, top violations with severity, AI suggestions
- Validator rigor levels: moderado (score>=8 PASS), rigoroso (>=9), maximo (only 10). Config: ai_agents.validator_enabled, validator_model, validator_rigor
- AI Agent Tools (8): search_products, send_carousel, send_media, handoff_to_human, assign_label, set_tags, move_kanban, update_lead_profile
- Qualification retries: max_qualification_retries (default 2) — search_fail:N tag tracks failed searches. N >= max → force handoff. Resets on product found.
- Enrichment flow: max_enrichment_questions (default 2) — when search returns 0 AND lead is well-qualified (interesse:X tag exists or 3+ query terms), agent enters enrichment phase: asks contextual questions (acabamento, marca_preferida, quantidade, area) before handoff. Tags: enrich_count:N, qualificacao_completa:true. Handoff includes qualification_chain: "Nome > Interesse > Produto > Acabamento > Marca".
- Enrichment tags: acabamento, marca_preferida, quantidade, area, aplicacao, enrich_count, qualificacao_completa — all in VALID_KEYS. buildEnrichmentInstructions() generates contextual suggestions per category. buildQualificationChain() builds structured chain for handoff reason + lead_profiles.notes.
- Brand demand tracking: tag marca_indisponivel:X auto-set when brand not in catalog.
- Auto-tag interesse on 0 results: category detected from query keywords (tinta→tintas, verniz→seladores_e_vernizes, manta→impermeabilizantes) even when search returns 0.
- Paint qualification order: hardcoded prompt rule — (1) ambiente interno/externo, (2) cor/acabamento, (3) marca. NEVER ask marca before cor.
- leadName from lead_profiles ONLY: never use contact.name (WhatsApp pushName). leadFullName = leadProfile?.full_name || null.
- Hardcoded question guard: after validator, count "?" in response — if >1, truncate to first question only. Validator LLM (gpt-4.1-nano) miscounts scores, so this is a code-level safety net.
- max_pre_search_questions: max perguntas de qualificacao antes de search_products para termos genericos (default 3)
- max_lead_messages: auto-handoff apos N msgs do lead (default 8). Atomic counter via increment_lead_msg_count RPC.
- Campaign context: tag campanha:NAME on conversation → loads utm_campaigns.ai_template + ai_custom_text into system prompt
- context_long_enabled (Memoria do Lead): loads lead_profiles (full_name, city, interests, ticket, objections, conversation_summaries) into prompt
- Shared modules (15): cors.ts, fetchWithTimeout.ts, circuitBreaker.ts, llmProvider.ts, constants.ts, logger.ts, agentHelpers.ts, auth.ts, supabaseClient.ts, carousel.ts, rateLimit.ts, validatorAgent.ts, ttsProviders.ts, response.ts, aiRuntime.ts
- Admin AI Agent components (19): GeneralConfig, BrainConfig, CatalogConfig, CatalogTable, CatalogProductForm, CsvProductImport, BatchScrapeImport, KnowledgeConfig, RulesConfig, GuardrailsConfig, VoiceConfig, ExtractionConfig, MetricsConfig, ValidatorMetrics, SubAgentsConfig, BlockedNumbersConfig, FollowUpConfig, BusinessInfoConfig, PromptStudio
- Admin AI Agent tabs: Setup (GeneralConfig+BusinessInfo), Prompt Studio, Inteligencia (Brain+SubAgents+Extraction), Catalogo, Conhecimento, Seguranca (Rules+Guardrails+BlockedNumbers), Canais (Voice+FollowUp), Metricas (Metrics+ValidatorMetrics)
- Batch history: e2e_test_batches (UUID PK) → e2e_test_runs.batch_uuid FK. runAllE2e() creates batch row at start, completes it after loop. useE2eBatchHistory/useE2eBatchRuns/useCreateBatch/useCompleteBatch in src/hooks/useE2eBatchHistory.ts
- BatchHistoryTab: 5th tab in AIAgentPlayground, shows last 30 batches per agent, expandable run detail, score bar (green>=80%, yellow>=60%, red<60%)
- M2 F1 composite_score formula (simple): Math.round((passed/total)*100) — full weighted formula comes in F3
- Admin pages: `WhatsappFormsPage` — `/dashboard/forms`
- WhatsApp Forms (M12): forms scoped por agent_id. Trigger via FORM:<slug>. form-bot intercepta no webhook antes do AI agent. Validações: CPF (dígito verificador), email (regex), CEP (8 dígitos), scale (range), select (número ou texto), yes_no (sim/não), signature (exact match). Max 3 retries por campo. Webhook externo POST ao completar.
- Forms templates: FORM_TEMPLATES em src/types/forms.ts — 12 templates built-in. Novos forms criados com createForm() geram slug único (name→kebab-case + timestamp36).
- UTM Campaign v2: `go` edge function faz 302 → React landing page `/r` (Supabase sandboxiza JS em edge functions). React page mostra logo WhatsApp + countdown 3s + spinner, captura dados client-side (screen, timezone, language) via POST async ao `go`, e redireciona pra wa.me após countdown.
- UTM visits metadata: coluna `metadata` JSONB em utm_visits armazena dados client-side (screen_width, screen_height, language, timezone).
- Campaign redirect flow: Link → go (grava visita + ref_code) → 302 → crm.wsmart.com.br/r?n=&wa=&ref=&p= → React countdown → wa.me. Rota `/r` é pública (sem auth).
- Campaign starts_at: validação no `go` — retorna 410 se campanha ainda não começou. UI no CampaignForm permite agendar início.
- Campaign attribution guards: webhook checa `status='active'` E `expires_at` antes de tagar conversa com `campanha:NOME`. Campanhas pausadas/arquivadas/expiradas não geram attribution.
- Campaign clone: botão "Clonar" no CampaignTable cria cópia com status='paused', slug novo, sem datas. Redireciona pra edit.
- Campaign visits pagination: useCampaignVisits paginado (50/página com range query). CampaignDetail mostra anterior/próxima.
- Campaign landing_mode: 'redirect' (countdown → wa.me) ou 'form' (formulário na landing page). Admin escolhe no CampaignForm com toggle visual. form_slug aponta pra whatsapp_forms.slug.
- Campaign kanban_board_id: auto-criar card na primeira coluna do board selecionado quando lead submete form ou utm_visit é matched.
- form-public edge function: GET ?slug= retorna form definition (sem JWT). POST { slug, ref_code, phone, data } cria contact + lead_profile + form_submission + match utm_visit + auto-create kanban card.
- LandingForm component: renderiza campos dinâmicos do formulário na landing page com validação client-side (CPF checksum, email regex, phone 10+ digitos, CEP 8 digitos). Submit via form-public → redirect wa.me.
- CampaignRedirect modes: mode=redirect mostra countdown (existente). mode=form&fs=SLUG carrega form via form-public GET e renderiza LandingForm. Após submit, redirect pra WhatsApp.
- Lead auto-creation from form: FIELD_MAP mapeia field_key → lead_profiles columns (nome→full_name, email→email, cpf→cpf, cidade→city). Campos extras → custom_fields JSONB. Upsert ON CONFLICT contact_id.
- Form-bot auto-tag: após completion, taga conversa com `formulario:SLUG` + `origem:formulario` via mergeTags. Também faz upsert lead_profile com dados coletados (mesmo FIELD_MAP do form-public).
- AI Agent form context: detecta tag `formulario:SLUG` na conversa, carrega submission do form_submissions, injeta dados no prompt como `<form_data>`. Instrui LLM a NÃO perguntar informações já coletadas.
- LeadFormsSection: componente no LeadDetail mostra "Formulários respondidos" com badge de contagem, template_type, data, preview dos 2 primeiros campos. Clique expande pra ver todos os dados coletados.
