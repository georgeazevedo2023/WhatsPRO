# WhatsPRO - CRM Multi-Tenant WhatsApp

## Overview
WhatsPRO is a multi-tenant WhatsApp helpdesk, CRM, AI Agent, and Leads platform built with React + Supabase + UAZAPI.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: OpenAI gpt-4.1-mini (AI Agent M10 — LLM primário, function calling), Gemini 2.5 Flash (fallback + TTS Preview 6 vozes), Groq API (Whisper transcription, Llama summarization/carousel copy), Mistral Small (carousel/summarization fallback)
- **Data Fetching**: TanStack React Query 5

## Architecture
```
React Frontend -> Supabase Edge Functions -> UAZAPI (WhatsApp)
                                          -> OpenAI (Agent LLM primário)
                                          -> Gemini AI (Agent fallback, TTS)
                                          -> Groq AI (Summaries/Transcription/Carousel)
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
- LLM primário: OpenAI gpt-4.1-mini (function calling). Fallback: Gemini 2.5 Flash → Mistral Small → static templates

## Deployment
- **Production**: crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD**: GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer**: Stack "whatspro" on Hetzner CX42 (65.108.51.109)

## Edge Functions (30 total)
Located in `supabase/functions/`. Each uses Deno runtime.
- JWT: `verify_jwt = true` (maioria), `false` em webhooks e públicas (whatsapp-webhook, fire-outgoing-webhook, go, health-check, form-public)
- Shared CORS config in `supabase/functions/_shared/cors.ts`
- Shared utilities: `fetchWithTimeout.ts` (30s timeout), `rateLimit.ts` (atomic RPC), `circuitBreaker.ts` (Gemini/Groq/Mistral), `response.ts` (standard format)
- AI Agent: `ai-agent` (brain, SDR+handoff+shadow, circuit breaker), `ai-agent-debounce` (10s atomic grouping), `ai-agent-playground` (testing)
- Product Import: `scrape-product` (URL → title, price, description, images, category)
- UTM Tracking: `go` (landing page countdown + client-side capture + redirect)
- Forms: `form-bot` (WhatsApp form sessions), `form-public` (public landing form)
- Monitoring: `health-check` (DB + MV + env → 200/503)
- Background: `process-jobs` (SKIP LOCKED job queue), `e2e-scheduled` (cron E2E batch)

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

## Important Patterns
- UAZAPI responses have inconsistent field names (PascalCase/camelCase) - always handle both
- Instance tokens are resolved server-side, never exposed to frontend
- Media URLs from UAZAPI: /message/download returns persistent URLs, stored directly (no re-upload to Storage)
- Carousel AI copy: generateCarouselCopies() uses Groq→Gemini→Mistral chain with 3s timeout per provider
- Timestamps may be in seconds or milliseconds - auto-detect with > 9999999999 check
- AI Agent tools execute during Gemini function calling loop (instance token loaded early)
- Lead profiles link to contacts via contact_id (1:1), kanban_cards link via contact_id FK
- Tags on conversations use TEXT[] array with "key:value" format
- Shadow mode: status_ia='shadow' — AI extracts data without responding (auto after handoff)
- Greeting: sent directly before Gemini, save-first lock prevents duplicates, TTS when voice active
- SDR flow: generic terms → qualify first, specific → search immediately
- Handoff: tool sends 1 message + breaks loop (no duplicate text), implicit detection before send
- Debounce: atomic UPDATE WHERE processed=false (eliminates race condition)
- AI Agent helpers: sendTextMsg(), sendTts(), broadcastEvent(), mergeTags(), cleanProductTitle()
- LLM carousel copies: Groq→Gemini→Mistral chain, Card 1 code-generated (title+price), Cards 2-5 AI
- Clear context: resets status_ia='ligada' + clears ia_blocked_instances
