# WhatsPRO - CRM Multi-Tenant WhatsApp

## Overview
WhatsPRO is a multi-tenant WhatsApp helpdesk, CRM, AI Agent, and Leads platform built with React + Supabase + UAZAPI.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **WhatsApp API**: UAZAPI (proxied through Edge Functions)
- **AI**: Gemini 2.5 Flash (AI Agent M10), Groq API (Whisper transcription, Llama summarization)
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
- AI Agent (M10): 8 tools, shadow mode, TTS, sub-agents, qualification flow
- Leads module (M11): lead cards, timeline, conversation modal, block IA, clear context
- Kanban CRM boards with custom fields + lead integration (contact_id FK)
- AI-powered conversation summaries and audio transcription
- Scheduled/recurring messages + message templates
- Shift reports via WhatsApp
- Intelligence/analytics dashboard
- Quick Product Import: paste URL → scrape → auto-fill catalog form (S6)

## Edge Functions (22 total)
Located in `supabase/functions/`. Each uses Deno runtime.
- JWT verification is disabled in config.toml (functions handle auth manually via `_shared/auth.ts`)
- Shared CORS config in `supabase/functions/_shared/cors.ts`
- Shared utilities: `fetchWithTimeout.ts` (30s timeout), `rateLimit.ts` (per-user throttle), `response.ts` (standard format)
- AI Agent: `ai-agent` (brain), `ai-agent-debounce` (10s grouping), `ai-agent-playground` (testing)
- Product Import: `scrape-product` (URL → title, price, description, images, category via JSON-LD/NEXT_DATA/OG)

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
- Media URLs from UAZAPI are temporary - use /message/download for persistent links
- Timestamps may be in seconds or milliseconds - auto-detect with > 9999999999 check
- AI Agent tools execute during Gemini function calling loop (instance token loaded early)
- Lead profiles link to contacts via contact_id (1:1), kanban_cards link via contact_id FK
- Tags on conversations use TEXT[] array with "key:value" format
- Shadow mode: status_ia='shadow' — AI extracts data without responding
