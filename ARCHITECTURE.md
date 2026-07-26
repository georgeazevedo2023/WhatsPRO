# WhatsPRO — Referencia Tecnica

> Arquivo de referencia tecnica do projeto. Carregado sob demanda quando precisa entender a stack.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: OpenAI gpt-4.1-mini (primary), Gemini 2.5 Flash (fallback), Mistral Small (fallback), Groq (Whisper transcription). Resumos: OpenAI gpt-4.1-mini via `callLLM` + Gemini fallback (desde v7.82)
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

## Edge Functions (43 no `supabase/functions/`; 44 ACTIVE em prod — `env-diag` é deploy-only)

Located in `supabase/functions/`. Deno runtime.

**Config:**
- `verify_jwt = true` na maioria. `false` nos webhooks, funções públicas (form-public, bio-public, go, health-check), internas (ai-agent, ai-agent-debounce, transcribe-audio) e crons internos — fonte da verdade: o `config.toml` de cada função
- CORS: `getDynamicCorsHeaders(req)` para browser-facing. `ALLOWED_ORIGIN` secret obrigatorio.
- Shared: `_shared/cors.ts`, `fetchWithTimeout.ts` (30s), `rateLimit.ts`, `circuitBreaker.ts`, `logger.ts`, `response.ts`

**Principais:**
- `ai-agent` — entrada do cerebro IA (2.964 linhas desde 2026-07-25; era 3.440). O cérebro em si é o **router pipeline** (`_shared/agent/routerPipeline.ts`, ~932 lin): router LLM classifica a intent → tabela DISPATCH (7 intents) despacha pros **5 specialists** (greeting/qualif/produto/objeção/handoff; `fora_escopo`→greeting, `pagamento`→objection). ⚠️ **O monolito foi APOSENTADO em 2026-07-25 (v7.109.0, "D6")** — não existe mais LLM de fallback: falha do router LLM (parse/intent inválida/confiança <0.6) cai em fallback determinístico pra intent `qualificacao`; falha de specialist / hop guard / exceção do pipeline dispara **transbordo gracioso** (`handoff_message` configurada + fila + `status_ia=shadow` + nota interna + log `ai_agent_logs` `event=implicit_handoff`, `metadata.reason=router_fallback`). `ai_agents.routing_mode` virou **coluna inerte** (nenhum código lê). Rollback do D6 = redeploy do commit `36f0555` via CLI scoop (prod era v276, hoje v277). SDR + handoff + shadow, circuit breaker, 9 tools
- `ai-agent-debounce` — agrupamento 10s atomico
- `ai-agent-playground` — testing sandbox
- `whatsapp-webhook` — entrada das msgs (chamado pelo **n8n**, NÃO direto do UAZAPI — ver "Fluxo de entrada"), parallel I/O, broadcast Realtime
- `uazapi-proxy` — proxy autenticado para UAZAPI (send-chat, send-media, send-poll, etc.)
- `scrape-product` — URL → dados do produto (JSON-LD/OG/meta)
- `form-bot` — formularios WhatsApp (FORM:slug trigger, validacoes, webhook)
- `form-public` — formularios landing page (GET def + POST submit, sem JWT)
- `bio-public` — Bio Link publico (GET page + POST capture)
- `go` — redirect UTM com landing page
- `summarize-conversation` — resumo IA da conversa
- `transcribe-audio` — Whisper via Groq
- `health-check` — DB + MV + env → 200/503
- `e2e-test` — testes E2E do AI Agent
- `automationEngine.ts` — motor de automacao (7 gatilhos, 4 condicoes, 6 acoes)

**Fluxo de entrada de mensagens (ingestão) — IMPORTANTE:** o UAZAPI **NÃO** chama a edge function direto. A instância UAZAPI aponta o webhook pro **n8n** (`https://fluxwebhook.wsmart.com.br/webhook/<path>`); o n8n (Webhook node → Set → **HTTP Request** POST, body = `$json.body` cru) é quem chama a edge fn `whatsapp-webhook` (`.../functions/v1/whatsapp-webhook`). Cadeia completa: **UAZAPI → n8n → HTTP Request → `whatsapp-webhook` → DB → ai-agent-debounce**. **Consequência:** atrasos/lotes de entrega podem vir do **n8n** (fila/retry/restart) — a edge fn só roda quando o n8n entrega; ela NÃO é o endpoint que o WhatsApp/UAZAPI atinge. Setup por instância: [[wiki/migracao-eletropiso-558781592373]] ("Próximos passos").

**Shared Modules (~46 em `_shared/` + subpasta `_shared/agent/`):** principais — cors.ts, fetchWithTimeout.ts, circuitBreaker.ts, llmProvider.ts, constants.ts, logger.ts, agentHelpers.ts, auth.ts, supabaseClient.ts, carousel.ts, rateLimit.ts, ttsProviders.ts, response.ts, aiRuntime.ts, leadHelper.ts, automationEngine.ts, responseSanitizer.ts, routerPipeline.ts, specialistBase.ts, qualificationGate.ts, greetingPolicy.ts. ⚠️ `validatorAgent.ts` aposentado do hot path na v7.89.0 (validação determinística migrou pra `responseSanitizer.ts`)

## Deployment

- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD**: GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer**: Stack "whatspro" on Hetzner CX42 (65.108.51.109)
- **Edge Functions**: binário scoop (NÃO npx) → `$env:SUPABASE_ACCESS_TOKEN=<PAT eletropiso>; supabase functions deploy <name> --project-ref prfcbfumyrrycsrcrvms --use-api` ⚠️ ref ATUAL `prfcbfumyrrycsrcrvms` (antigo `euljumeflwtljegknawy` MORTO). Detalhe: CLAUDE.md "🚀 Deploy & Supabase".

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx tsc --noEmit     # Type check
npx vitest run       # Run tests
```
```powershell
# Deploy edge function — binário scoop, NÃO npx (npx falha: uv_spawn)
supabase functions deploy <name> --project-ref prfcbfumyrrycsrcrvms --use-api
```

## Modulos (19)

Ver wiki/modulos.md para detalhes. Resumo: M1 WhatsApp, M2 Helpdesk, M3 Broadcast, M4/M11 Leads, M5 CRM Kanban, M6 Catalogo, M7 Campanhas UTM, M8 Dashboard, M9 Agendamentos, M10 AI Agent, M12 WhatsApp Forms, M13 Campanhas+Forms, M14 Bio Link, M15 Integracao Funis, M16 Funis, M17 Plataforma Inteligente (Motor+Agentico+Perfis+Enquetes+NPS), M18 Fluxos v3.0 (runtime descontinuado v7.90.0), M19 Plataforma de Metricas & IA Conversacional + DB Monitoring.

## Documentacao Detalhada (31 Wikis em wiki/casos-de-uso/)

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
