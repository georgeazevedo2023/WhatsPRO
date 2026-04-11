---
title: Arquitetura Tecnica
tags: [arquitetura, stack, supabase, edge-functions, automacao, perfis]
sources: [CLAUDE.md, docs/CONTEXTO_PROJETO.md]
updated: 2026-04-09
---

# Arquitetura Tecnica

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| Data Fetching | TanStack React Query 5 |
| Backend | Supabase Edge Functions (Deno) |
| Banco de Dados | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| WhatsApp API | UAZAPI (proxied via Edge Functions) |
| IA — Agent (LLM primario) | OpenAI gpt-4.1-mini (function calling, SDR, 9 tools) |
| IA — Agent (fallback) | Gemini 2.5 Flash → Mistral Small → templates estaticos |
| IA — TTS | Gemini 2.5 Flash Preview TTS (6 vozes) |
| IA — Transcricao | Groq API (Whisper) |
| IA — Summarizacao | Groq (Llama), fallback Mistral Small |
| IA — Carrossel | Groq → Gemini → Mistral (chain) |
| Deploy | Docker Swarm + Traefik + Nginx + SSL |
| CI/CD | GitHub Actions → ghcr.io |

## Fluxo de Dados

```
React Frontend → Supabase Edge Functions → UAZAPI (WhatsApp)
                                         → OpenAI (Agent, Function Calling)
                                         → Gemini AI (TTS, Fallback)
                                         → Groq AI (Summaries/Transcription)
React Frontend → Supabase Client (DB, Auth, Realtime, Storage)
```

## Edge Functions (31 total)

Localizacao: `supabase/functions/`
- JWT: `verify_jwt = true` (maioria), `false` em webhooks (whatsapp-webhook, form-bot) e publicas (form-public, bio-public, go, health-check)
- Shared: `_shared/` com 17 modulos compartilhados
- Circuit breaker: Gemini/Groq/Mistral (3 falhas → OPEN 30s → HALF_OPEN)
- Rate limit: RPC atomico check_rate_limit()

## Shared Modules (17)

| Modulo | Funcao |
|--------|--------|
| cors.ts | CORS dinamico (getDynamicCorsHeaders) + estatico + webhook |
| fetchWithTimeout.ts | Fetch com timeout 30s |
| circuitBreaker.ts | Circuit breaker para LLMs |
| llmProvider.ts | Abstrai chamadas LLM (OpenAI/Gemini/Groq) |
| constants.ts | STATUS_IA, VALID_KEYS, VALID_MOTIVOS |
| logger.ts | JSON structured logging |
| agentHelpers.ts | sendTextMsg, sendTts, broadcastEvent, mergeTags |
| auth.ts | Auth manual em edge functions |
| supabaseClient.ts | createServiceClient singleton |
| carousel.ts | Carrossel UAZAPI (4 variantes payload) |
| rateLimit.ts | Rate limit atomico via RPC |
| validatorAgent.ts | Audita respostas IA (score 0-10) |
| ttsProviders.ts | Chain TTS: Gemini → Cartesia → Murf → Speechify |
| response.ts | Standard response format |
| aiRuntime.ts | shouldTriggerAiAgent, debounce logic |
| leadHelper.ts | FIELD_MAP, upsertContact, upsertLead (compartilhado) |
| automationEngine.ts | Motor de automacao (7 triggers, 4 conditions, 6 actions) + triggerNpsIfEnabled |

## Arquitetura M17 — Plataforma Inteligente

### Camadas de Comportamento do AI Agent

```
Camada 4: FUNIL (orquestracao)   → "qual contexto?" (campaigns+bio+forms+kanban)
Camada 3: PERFIL (especializacao) → "como agir?" (prompt+handoff reutilizavel)
Camada 2: MOTOR (automacao)      → "quando X, faca Y" (regras deterministicas)
Camada 1: AGENT (inteligencia)   → "pense e responda" (LLM + 9 tools)
Camada 0: TOOLS (execucao)       → "execute a acao" (search, carousel, poll, handoff...)
```

### Prioridade de Contexto no Prompt

```
1. Identity + Business Info (sempre)
2. SDR Flow + Product Rules + Handoff Rules (prompt_sections)
3. Absolute Rules + Hardcoded Rules (imutaveis)
4. Knowledge Base (FAQ + documentos)
5. Sub-agents (DEPRECATED — so quando !profileData)
6. Dynamic Context (lead, campaign, form, bio, funnel, tags)
7. Profile Instructions (ULTIMA secao — PRIORIDADE MAXIMA)
```

### Enquetes e NPS

```
Admin config → poll_nps_enabled=true
Conversa resolvida → TicketResolutionDrawer → job_queue (nps_send, delay)
process-jobs → triggerNpsIfEnabled() → UAZAPI /send/menu (type=poll) → poll_messages (is_nps=true)
Lead vota → webhook poll_update → poll_responses → auto-tags → notify gerente (se nota ruim)
```

## Padroes Importantes

- UAZAPI: campos inconsistentes (PascalCase/camelCase) — sempre normalizar
- Tokens UAZAPI: resolucao server-side via uazapi-proxy — NUNCA no frontend
- Timestamps: auto-detect ms vs seconds (> 9999999999)
- LLM primario: OpenAI gpt-4.1-mini (function calling nativo)
- LLM fallback: Gemini 2.5 Flash → Mistral Small → templates
- Handoff priority: profileData > funnelData > agent (D10)
- CORS: getDynamicCorsHeaders(req) para admin-*, webhookCorsHeaders para webhooks
- instances.id e TEXT (nao UUID) — FK devem ser TEXT

## Links

- [[wiki/ai-agent]] — Agent IA em detalhe
- [[wiki/deploy]] — Infraestrutura
- [[wiki/banco-de-dados]] — Schema
- [[wiki/decisoes-chave]] — D1-D10
