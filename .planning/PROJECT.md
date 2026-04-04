# WhatsPRO

## What This Is

Multi-tenant WhatsApp CRM, Helpdesk, AI Agent, and Leads platform. Connects businesses to customers via WhatsApp with AI-powered sales qualification (SDR), real-time chat, CRM kanban boards, broadcast messaging, and campaign tracking.

## Core Value

AI Agent that qualifies leads and sells products via WhatsApp — autonomously handling 80%+ of conversations without human intervention.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: OpenAI gpt-4.1-mini (primary), Gemini 2.5 Flash (fallback), Groq (carousel copy), Mistral (tertiary fallback)
- **Data Fetching**: TanStack React Query 5

## Current State (after v1.0)

- **Codebase**: 68,884 LOC TypeScript
- **Edge Functions**: 28 functions, all using shared utilities (zero duplication)
- **Database**: 102+ migrations, 47 tables, 343 RLS policies
- **TypeScript**: noImplicitAny enabled, errors reduced from 219 to 107
- **Tests**: 198+ passing (vitest)
- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik)

## Requirements

### Validated

- ✓ Circuit breaker on all LLM calls — v1.0
- ✓ Shadow mode uses callLLM() with automatic failover — v1.0
- ✓ Tool execution isolated (executeToolSafe pattern) — v1.0
- ✓ Greeting dedup via atomic advisory lock — v1.0
- ✓ Audio transcription via job_queue with retry — v1.0
- ✓ Lead message counter atomic (no race condition) — v1.0
- ✓ Zod validation on all AI Agent config forms — v1.0
- ✓ Component decomposition (Playground 1353→276 LOC, Catalog 704→273 LOC) — v1.0
- ✓ Zero explicit `any` in Leads, LeadDetail, Playground — v1.0
- ✓ noImplicitAny enabled globally — v1.0
- ✓ React Query migration (DashboardHome, Leads, LeadDetail) — v1.0
- ✓ 9 ErrorBoundary wrappers for crash isolation — v1.0
- ✓ 28 edge functions consolidated to shared utilities — v1.0
- ✓ Configurable carousel_text per agent — v1.0
- ✓ LLM metrics logging (latency_ms, provider) — v1.0

### Active

- [ ] Agent QA Framework — admin approval flow for test results
- [ ] Persistent test history — compare runs across deploys
- [ ] Agent evolution score — composite metric dashboard
- [ ] Automated test-adjust-rerun cycle

### Out of Scope

- Mobile app — web-first, PWA sufficient
- Multi-language — PT-BR only for now
- Offline mode — real-time is core value
- Video calls — WhatsApp handles natively

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenAI as primary LLM | Better tool calling than Gemini | ✓ Good |
| noImplicitAny over strict:true | Avoids 105 pre-existing errors outside scope | ✓ Good |
| React Query over custom hooks | Standard caching, invalidation, stale-while-revalidate | ✓ Good |
| Shared utilities pattern | Zero duplication across 28 edge functions | ✓ Good |
| Job queue for audio transcription | Retry + no 90s blocking | ✓ Good |
| Zod for form validation | Type-safe, composable schemas | ✓ Good |

## Constraints

- Supabase Edge Functions: 25s gateway timeout (long-running functions continue in background)
- UAZAPI: Inconsistent field naming (PascalCase/camelCase), no auth headers on webhooks
- WhatsApp: Rate limits on message sending, carousel max 10 cards
- Gemini TTS: WAV only, 24kHz, limited voice options

---
*Last updated: 2026-04-04 after v1.0 milestone*
