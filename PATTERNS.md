# WhatsPRO — Padroes de Implementacao

> Consultar ANTES de implementar. Organizado por area. Cada padrao tem o contexto de QUANDO usar.

---

## UAZAPI / WhatsApp

- Responses tem field names inconsistentes (PascalCase/camelCase) — sempre tratar ambos
- Instance tokens resolvidos server-side, NUNCA expostos ao frontend
- Media URLs: /message/download retorna URLs persistentes, armazenar diretamente (sem re-upload ao Storage)
- Timestamps podem ser em segundos ou milissegundos — auto-detect com `> 9999999999`
- Broadcast: 3s AbortController timeout (degradacao do Realtime API nao bloqueia webhook)
- Webhook: parallel I/O (media+dedup+contact via Promise.all), profile pic em background
- Endpoint interativos: `/send/menu` (type=poll/list/quickreply), NAO `/send/poll`

## AI Agent / LLM

- Tools executam durante Gemini function calling loop (instance token carregado early)
- Circuit breaker: geminiBreaker/groqBreaker/mistralBreaker (3 falhas → OPEN 30s → HALF_OPEN probe)
- Rate limit: RPC atomico check_rate_limit() com global limit (sem race condition)
- Debounce: atomico UPDATE WHERE processed=false (elimina race condition). NO RETRY em 500
- Greeting: save-first lock previne duplicatas. Guard 30s contra chamadas concorrentes
- Greeting + question: saudacao pura para, pergunta real continua pro LLM
- Strip re-greet: remove "Ola, [Nome]!" do inicio da resposta LLM
- Greeting normalizacao: regex dedup letras repetidas ("oiiiiii" → "oi")
- Shadow: extrai via update_lead_profile + set_tags. NUNCA sobrescreve full_name existente
- Handoff: tool envia 1 msg + breaks loop (no duplicate text). Texto LLM descartado
- Handoff → SHADOW: todos os tipos setam status_ia='shadow'. Final update SKIPS status_ia quando handoff happened
- Handoff so em: pedido explicito, sentimento negativo, pergunta sem resposta. Preco/desconto = agente responde
- Question-aware triggers: INFO_TERMS (horario, preco, desconto, parcelar, frete, etc.) NAO matcham como handoff quando lead perguntando
- Empatia negativa: sentimento negativo → mensagem empatica ANTES do handoff
- Empty response = silencio. NUNCA enviar fallback. NUNCA dizer "nao encontrei/nao temos"
- Hardcoded prompt: LLM deve ler TODAS as linhas de msgs agrupadas. NUNCA re-ask algo ja dito
- Agent Profiles: profileData > funnelData > agent em handoff. `<profile_instructions>` ultima secao
- Sub-agents DEPRECATED: so rodam quando `!profileData` (backward compat)
- Agent instance validation: agent.instance_id must match request instance_id

## Catalogo / Busca

- Fuzzy: search_products_fuzzy() RPC com pg_trgm (threshold 0.3, word-level similarity)
- Pipeline: ILIKE exact → word-by-word AND → fuzzy → post-filter AND em ALL results
- Post-filter: mantem so produtos que matcham TODAS as palavras (filtra marca errada)
- 1 produto = send_media, 2+ = send_carousel
- Carousel copy: Groq→Gemini→Mistral chain, 3s timeout. Card 1 code-generated, Cards 2-5 AI
- Carousel config: carousel_text + carousel_button_1 + carousel_button_2 (segundo opcional)
- Carousel fallback: 4 variantes UAZAPI → ate 3 fotos individuais → texto
- Price always numeric: LLM DEVE incluir R$XX,XX. "Nunca responda sobre preco sem citar o valor"
- Auto-tag interesse: categoria detectada de keywords (tinta→tintas, verniz→seladores) mesmo com 0 resultados
- Brand demand: marca_indisponivel:X auto-set quando marca nao no catalogo
- Paint qualification: ambiente → cor/acabamento → marca. NUNCA marca antes de cor

## Validator

- validatorAgent.ts: audita cada resposta (score 0-10, PASS/REWRITE/BLOCK)
- Checks: frases proibidas, topicos bloqueados, desconto limite, multiplas perguntas, info inventada, frequencia nome
- Rigor: moderado (>=8), rigoroso (>=9), maximo (so 10)
- Safety net: codigo conta "?" — se >1, trunca para 1a pergunta (Validator LLM miscounts)
- Persiste em ai_agent_validations

## TTS / Voz

- Chain: Gemini → Cartesia → Murf → Speechify → texto
- Config: ai_agents.tts_fallback_providers JSONB. Env vars: CARTESIA_API_KEY, MURF_API_KEY, SPEECHIFY_API_KEY
- Audio split: splitAudioAndText() — 1a frase como audio + full text como follow-up
- Preview admin: funciona quando GEMINI_API_KEY esta em system_settings (SecretsTab)

## Prompt Studio

- ai_agents.prompt_sections JSONB — 9 secoes editaveis + business_context auto-gerado
- Template vars: {agent_name}, {personality}, {max_pre_search_questions}, {max_qualification_retries}, {max_discount_percent}
- Defaults em system_settings.default_prompt_sections

## SDR / Qualificacao

- Generico → qualifica (max_pre_search_questions, default 3). Especifico → busca imediata
- Search fail → enrichment (max_enrichment_questions, default 2) → handoff com qualification_chain
- max_lead_messages (default 8) → auto-handoff. Atomico via increment_lead_msg_count RPC
- Tags: search_fail:N, enrich_count:N, qualificacao_completa:true
- Enrichment: buildEnrichmentInstructions() gera sugestoes por categoria. buildQualificationChain() estrutura chain

## Tags

- Taxonomy 3 niveis: motivo (intent), interesse (category), produto (specific)
- Enforcement: VALID_KEYS whitelist, VALID_MOTIVOS set, VALID_OBJECOES set
- TEXT[] em conversations.tags formato "key:value". Helper mergeTags() em agentHelpers.ts
- NUNCA tags vazias [] — sempre manter pelo menos 1 tag

## Helpdesk / Realtime

- Chat pagination: ultimas 50 msgs + "Load older" + Realtime appends new msg
- ChatPanel new-message: fetch last 3 (nao 1) para pegar carousel+text pairs
- Media inserts DEVEM broadcastEvent() — sem isso helpdesk nao exibe
- Typing indicator: broadcastTyping() fire-and-forget, throttle 3s, self-exclusion, auto-clear 4s
- Quick reply: "/" prefix no ChatInput, loads message_templates, keyboard nav
- Date dividers: getDateLabel() com toZonedTime(BRAZIL_TZ)
- Tab focus refresh: useTabFocusRefresh() — tab hidden 30s+ → revalida sessao + invalida caches
- Optimistic updates: handleUpdateConversation usa targeted rollback (nao full-array replace)
- TicketResolutionDrawer: vaul bottom sheet, 4 categorias, move kanban, tags, lead_profile, NPS

## Leads / CRM

- Lead profiles: contact_id FK (1:1). kanban_cards: contact_id FK
- leadName: lead_profiles.full_name ONLY (nunca contact.name = WhatsApp pushName)
- Lead upsert: atomico ON CONFLICT + update_lead_count_from_entries RPC + phone >= 10 chars
- leadHelper.ts: FIELD_MAP compartilhado. upsertContactFromPhone(), upsertLeadFromFormData(). NUNCA duplicar
- Clear context: tags=['ia_cleared:TIMESTAMP'], ai_summary=null, status_ia='ligada', ia_blocked_instances=[]
- OriginBadge: verde Bio, azul Campanha, roxo Formulario, laranja Funil

## Campanhas / Funis / Forms / Bio

- Campaign redirect: Link → go (302) → /r (React countdown) → wa.me. Rota /r publica
- Campaign attribution: webhook checa status='active' + expires_at antes de tagar
- Campaign landing_mode: 'redirect' (countdown) ou 'form' (formulario na landing)
- form-public: GET sem JWT + POST → contact + lead_profile + form_submission + kanban card
- form-bot: FORM:slug trigger, validacoes (CPF checksum, email, CEP), max 3 retries, webhook externo
- Bio: bio-public action='capture' cria contact+lead_profile real via leadHelper. Tags: origem:bio + bio_page:SLUG
- Bio→Form attribution: bio_page=SLUG&bio_btn=ID na URL
- Funnel: tabela funnels orquestra campaigns+bio+forms+kanban. Tag funil:SLUG em 3 edge functions
- Funnel handoff: prioridade funil > agent. Max_messages do funil
- Funnel templates: funnelTemplates.ts — kanban columns, bio defaults, campaign defaults por tipo
- Motor automacao: automationEngine.ts — 7 gatilhos, 4 condicoes, 6 acoes. form-bot dispara form_completed

## Banco de Dados

- Materialized view: mv_user_inbox_roles + has_inbox_access_fast() refreshed periodicamente
- Audit log: admin_audit_log table (imutavel) + log_admin_action() RPC
- Job queue: job_queue com claim_jobs (FOR UPDATE SKIP LOCKED) + process-jobs worker
- Archiving: conversations.archived + archive_old_conversations(90) RPC
- instances.id e TEXT (nao UUID) — FK para instances deve usar TEXT

## NPS / Enquetes

- NPS: 5 campos em ai_agents (poll_nps_enabled/delay/question/options/notify_on_bad)
- Trigger: triggerNpsIfEnabled() no automationEngine. Guard: sentimento:negativo → nao envia
- Nota ruim → notifica gerentes via notifications table
- Poll: /send/menu (type=poll), 2-12 opcoes, 255 chars max, NUNCA opcoes numeradas
- poll_messages + poll_responses. is_nps flag. Webhook poll_update handler

## Admin AI Agent

- 20 componentes: GeneralConfig, BrainConfig, CatalogConfig, CatalogTable, CatalogProductForm, CsvProductImport, BatchScrapeImport, KnowledgeConfig, RulesConfig, GuardrailsConfig, VoiceConfig, ExtractionConfig, MetricsConfig, ValidatorMetrics, ProfilesConfig, BlockedNumbersConfig, FollowUpConfig, BusinessInfoConfig, PromptStudio, PollConfigSection
- 8 tabs: Setup, Prompt Studio, Inteligencia, Catalogo, Conhecimento, Seguranca, Canais, Metricas

## Playground / QA

- Playground v2: tool inspector, thumbs up/down, overrides (model/temp/tools), buffer simulation, personas
- Playground greeting: injetado como model message em geminiContents (nao system prompt)
- Batch history: e2e_test_batches → e2e_test_runs.batch_uuid FK
- Score: Math.round((passed/total)*100). Verde>=80%, amarelo>=60%, vermelho<60%
