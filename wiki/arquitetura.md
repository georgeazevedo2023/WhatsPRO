---
title: Arquitetura Técnica
tags: [arquitetura, stack, supabase, edge-functions]
sources: [CLAUDE.md, docs/CONTEXTO_PROJETO.md]
updated: 2026-04-07
---

# Arquitetura Técnica

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
| IA — Agent (LLM primário) | OpenAI gpt-4.1-mini (function calling, SDR, tools) |
| IA — Agent (fallback) | Gemini 2.5 Flash → Mistral Small → templates estáticos |
| IA — TTS | Gemini 2.5 Flash Preview TTS (6 vozes) |
| IA — Transcrição | Groq API (Whisper) |
| IA — Summarização | Groq (Llama), fallback Mistral Small |
| IA — Carrossel | Groq → Gemini → Mistral (chain) |
| Deploy | Docker Swarm + Traefik + Nginx + SSL |
| CI/CD | GitHub Actions → ghcr.io |

## Fluxo de Dados

```
React Frontend → Supabase Edge Functions → UAZAPI (WhatsApp)
                                         → Gemini AI (Agent, TTS)
                                         → Groq AI (Summaries/Transcription)
React Frontend → Supabase Client (DB, Auth, Realtime, Storage)
```

## Edge Functions (31 total)

Localização: `supabase/functions/`
- JWT: `verify_jwt = true` (maioria), `false` em webhooks e públicas
- Shared: `_shared/` (cors, fetchWithTimeout, rateLimit, circuitBreaker, logger, response)
- Circuit breaker: Gemini/Groq/Mistral (3 falhas → OPEN 30s → HALF_OPEN)
- Rate limit: RPC atômico check_rate_limit()

## Shared Modules (16)

cors, fetchWithTimeout, circuitBreaker, llmProvider, constants, logger, agentHelpers, auth, supabaseClient, carousel, rateLimit, validatorAgent, ttsProviders, response, aiRuntime, leadHelper

## Padrões Importantes

- UAZAPI: campos inconsistentes (PascalCase/camelCase) — sempre normalizar
- Tokens UAZAPI: resolução server-side via uazapi-proxy — NUNCA no frontend
- Timestamps: auto-detect ms vs seconds (> 9999999999)
- LLM primário do AI Agent: OpenAI gpt-4.1-mini (function calling nativo)
- LLM fallback chain do Agent: Gemini 2.5 Flash → Mistral Small → templates estáticos
- LLM carrossel: Groq → Gemini → Mistral

## Links

- [[wiki/ai-agent]] — Agent IA em detalhe
- [[wiki/deploy]] — Infraestrutura
- [[wiki/banco-de-dados]] — Schema
