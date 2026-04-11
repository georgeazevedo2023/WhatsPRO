# WhatsPRO — Referencia Tecnica

> Arquivo de referencia tecnica do projeto. Carregado sob demanda quando precisa entender a stack.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: OpenAI gpt-4.1-mini (primary), Gemini 2.5 Flash (fallback), Mistral Small (fallback), Groq (Whisper transcription, Llama summarization)
- **Data Fetching**: TanStack React Query 5

## Architecture

```
React Frontend -> Supabase Edge Functions -> UAZAPI (WhatsApp)
                                          -> OpenAI / Gemini / Mistral (AI Agent)
                                          -> Groq (Summaries/Transcription)
React Frontend -> Supabase Client (DB, Auth, Realtime, Storage)
```

## User Roles

| Role | Acesso |
|------|--------|
| `super_admin` | Tudo — instancias, inboxes, usuarios, agente IA, funis, automacoes |
| `gerente` | Gerencia equipe dentro dos inboxes atribuidos, CRM, leads |
| `user` | Atende conversas nos inboxes atribuidos |

## Edge Functions (31 total)

Located in `supabase/functions/`. Deno runtime.

**Config:**
- `verify_jwt = true` na maioria. `false` em: whatsapp-webhook, fire-outgoing-webhook, go, health-check, form-public, ai-agent, ai-agent-debounce, transcribe-audio
- CORS: `getDynamicCorsHeaders(req)` para browser-facing. `ALLOWED_ORIGIN` secret obrigatorio.
- Shared: `_shared/cors.ts`, `fetchWithTimeout.ts` (30s), `rateLimit.ts`, `circuitBreaker.ts`, `logger.ts`, `response.ts`

**Principais:**
- `ai-agent` — cerebro IA (~2600 linhas), SDR+handoff+shadow, circuit breaker, 9 tools
- `ai-agent-debounce` — agrupamento 10s atomico
- `ai-agent-playground` — testing sandbox
- `whatsapp-webhook` — recebe msgs do UAZAPI, parallel I/O, broadcast Realtime
- `uazapi-proxy` — proxy autenticado para UAZAPI (send-chat, send-media, send-poll, etc.)
- `scrape-product` — URL → dados do produto (JSON-LD/OG/meta)
- `form-bot` — formularios WhatsApp (FORM:slug trigger, validacoes, webhook)
- `form-public` — formularios landing page (GET def + POST submit, sem JWT)
- `bio-public` — Bio Link publico (GET page + POST capture)
- `go` — redirect UTM com landing page
- `summarize-conversation` — resumo IA da conversa
- `transcribe-audio` — Whisper via Groq
- `process-jobs` — worker SKIP LOCKED (lead_auto_add, profile_pic, NPS)
- `health-check` — DB + MV + env → 200/503
- `e2e-test` — testes E2E do AI Agent
- `automationEngine.ts` — motor de automacao (7 gatilhos, 4 condicoes, 6 acoes)

**Shared Modules (17):** cors.ts, fetchWithTimeout.ts, circuitBreaker.ts, llmProvider.ts, constants.ts, logger.ts, agentHelpers.ts, auth.ts, supabaseClient.ts, carousel.ts, rateLimit.ts, validatorAgent.ts, ttsProviders.ts, response.ts, aiRuntime.ts, leadHelper.ts, automationEngine.ts

## Deployment

- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD**: GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer**: Stack "whatspro" on Hetzner CX42 (65.108.51.109)
- **Edge Functions**: `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <name> --project-ref euljumeflwtljegknawy`

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx tsc --noEmit     # Type check
npx vitest run       # Run tests
npx supabase functions deploy <name>  # Deploy edge function
```

## Modulos (17)

Ver wiki/modulos.md para detalhes. Resumo: M1 WhatsApp, M2 Helpdesk, M3 Broadcast, M4/M11 Leads, M5 CRM Kanban, M6 Catalogo, M7 Campanhas UTM, M8 Dashboard, M9 Agendamentos, M10 AI Agent, M12 WhatsApp Forms, M13 Campanhas+Forms, M14 Bio Link, M15 Integracao Funis, M16 Funis, M17 Plataforma Inteligente (Motor+Agentico+Perfis+Enquetes+NPS).

## Documentacao Detalhada (17 Wikis — 187 Sub-Funcionalidades)

Guias detalhados com padrao dual (didatico + tecnico) em `wiki/casos-de-uso/`:
- `helpdesk-detalhado.md` — 25 sub-func (etiquetas, tags, notas, toggle IA, status, bulk, templates, midia)
- `ai-agent-detalhado.md` — 15 sub-func (9 tools, SDR, shadow, validator, TTS, profiles, NPS)
- `leads-detalhado.md` — 12 sub-func (perfil, timeline, badge origem, block IA, clear context, CSV)
- `crm-kanban-detalhado.md` — 11 sub-func (boards, cards, campos, drag&drop, acesso, funis)
- `catalogo-detalhado.md` — 10 sub-func (URL scraping, CSV, batch, busca fuzzy, imagens)
- `broadcast-detalhado.md` — 12 sub-func (4 tipos, grupos/leads, delay, agendamento, historico)
- `campanhas-detalhado.md` — 12 sub-func (link, QR, landing, metricas, atribuicao, contexto IA)
- `formularios-detalhado.md` — 13 sub-func (16 campos, 12 templates, form-bot, validacoes, webhook)
- `bio-link-detalhado.md` — 10 sub-func (5 botoes, 3 templates, captacao, analytics, contexto IA)
- `funis-detalhado.md` — 13 sub-func (wizard, 7 tipos, auto-criacao, motor, agentico, perfis)
- `motor-automacao-detalhado.md` — 9 sub-func (7 gatilhos, 4 condicoes, 6 acoes, NPS trigger)
- `enquetes-nps-detalhado.md` — 10 sub-func (4 canais, UAZAPI, votos, auto-tags, NPS, dashboard)
- `agendamentos-detalhado.md` — 6 sub-func (unico/recorrente, delay, gestao, processamento)
- `dashboard-detalhado.md` — 8 sub-func (KPIs, graficos, performance, Intelligence IA)
- `agent-qa-detalhado.md` — 8 sub-func (batches, cenarios, score, aprovacao, regressao, playground)
- `instancias-detalhado.md` — 7 sub-func (QR, status, acesso, detalhes, delete, sync)
- `deploy-detalhado.md` — 6 sub-func (Docker, CI/CD, Hetzner, edge functions, health check)
