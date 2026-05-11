---
title: Changelog — Pré 2026-04 — parte 3
type: changelog-archive
updated: 2026-05-11
---

# Changelog — Releases v3.x (2026-03-23 a 03-25)

> Continuação de [[wiki/changelog/2026-pre-04-part2]]. Read-only.

---

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

**UTM Campaigns v2 (completo):**
- CRUD completo: criar, editar, listar, detalhar campanhas
- 6 tipos: venda, suporte, promoção, evento, recall, fidelização
- QR Code gerado automaticamente por campanha
- Edge Function `go`: 302 redirect → React landing page `/r` (rota pública sem auth)
- Landing page React: logo WhatsApp + countdown 3..2..1 + spinner + botão fallback manual
- Captura client-side (screen, timezone, language) via POST async ao `go`, salva em utm_visits.metadata JSONB
- Supabase sandboxiza JS em edge functions — por isso landing page é React, não HTML inline
- Atribuição automática: webhook detecta `ref_` e vincula à campanha (com guards de expiração + status)
- Dashboard de métricas: visitas, conversões, taxa, gráfico temporal
- AI contextual: prompt do agente recebe contexto da campanha ativa
- Agendamento: campo `starts_at` + validação no `go` (410 antes do início)
- Controle de status: toggle active/paused/archived no form
- Clonar campanha: duplica com status pausado e slug novo
- Paginação de visitas: 50/página com navegação anterior/próxima

**M13 — Campanhas + Formulários + Funil (completo):**
- Landing page com 2 modos: redirect (countdown → wa.me) ou formulário (campos dinâmicos → submit → wa.me)
- form-public edge function: carrega form definition (GET) e processa submission (POST) sem JWT
- LandingForm: campos dinâmicos com validação client-side (CPF, email, phone, CEP, required)
- Auto-criação de lead_profile com FIELD_MAP (nome→full_name, email, cpf, cidade→city, extras→custom_fields)
- Auto-tag formulario:SLUG + origem:formulario na conversa após completion (form-bot e landing page)
- AI Agent form context: detecta tag formulario:, carrega dados do form, injeta no prompt para não repetir perguntas
- Auto-criar kanban card na primeira coluna do board vinculado à campanha
- LeadFormsSection no LeadDetail: timeline de formulários respondidos com dados expandíveis
- Abandono inteligente: tracking de form_started em utm_visits.metadata

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

