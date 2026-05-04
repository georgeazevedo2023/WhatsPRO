# WhatsPRO — Quick Brief for External Agents

> Concise English overview for AI agents (Claude Code, Cursor, Copilot Workspace) onboarding to the codebase. Updated 2026-05-04.

## Overview

WhatsPRO is a multi-tenant WhatsApp helpdesk + CRM + AI Agent + leads + campaigns + funnels + automation platform. **Production:** crm.wsmart.com.br.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query 5
- **Backend:** Supabase (PostgreSQL 17, Auth, Storage, Realtime, Edge Functions on Deno)
- **WhatsApp API:** UAZAPI (proxied via `uazapi-proxy` edge fn)
- **AI Agent LLM (primary):** OpenAI gpt-4.1-mini (native function calling)
- **AI Agent LLM (fallback chain):** Gemini 2.5 Flash → Mistral Small → static templates
- **TTS:** Gemini 2.5 Flash Preview TTS (6 voices)
- **Transcription:** Groq (Whisper)
- **Summaries / carousel copy:** Groq (Llama) → Gemini → Mistral

## Architecture

```
React Frontend → Supabase Edge Functions → UAZAPI (WhatsApp)
                                        → OpenAI (Agent LLM, function calling)
                                        → Gemini (fallback + TTS)
                                        → Groq (transcription, summaries)
React Frontend → Supabase Client (DB, Auth, Realtime, Storage)
```

## User Roles

- `super_admin` — Full access (instances, inboxes, users, AI agent, funnels, automation, deploy)
- `gerente` — Manage team within assigned inboxes, CRM, leads, dashboard
- `user` — Handle conversations in assigned inboxes

## Modules (M1–M19)

**Communication:** M1 WhatsApp Instances, M2 Helpdesk, M3 Broadcast, M12 WhatsApp Forms

**Intelligence:** M10 AI Agent (9 tools), M17 F1 Automation Engine, M17 F3 Agent Profiles, M17 F4 Polls, M17 F5 NPS, M18 Fluxos v3.0 (orchestrator)

**CRM & Leads:** M11 Leads Database, M5 CRM Kanban, M6 Catalog (with URL scraping + fuzzy search)

**Capture & Funnels:** M7 UTM Campaigns, M14 Bio Link, M15 Funnel Integration, M16 Funnels (Fusão Total — orchestrates campaigns + bio + forms + kanban)

**Analytics & Operations:** M8 Dashboard / Intelligence, M9 Scheduled Messages / Templates, M19 Manager Dashboard + Conversational AI Assistant + DB Monitoring & Auto-Cleanup + Service Categories Stages+Score (S10 v2/v3) + Excluded Products (D28) + dynamic VALID_KEYS (D29) + Avatares em Storage (resolves WhatsApp CDN 403)

## AI Agent (M10) — 9 tools

| Tool | Purpose |
|------|---------|
| `search_products` | Fuzzy search in product catalog (pg_trgm) |
| `send_carousel` | Up to 5 photos with AI sales copy |
| `send_media` | Single image/video/audio/document |
| `handoff_to_human` | Transfer to human agent (one message + breaks loop) |
| `assign_label` | Apply label to conversation |
| `set_tags` | Structured tags (motivo, interesse, produto) |
| `move_kanban` | Move card in CRM board |
| `update_lead_profile` | Update lead's full_name, city, interests, etc. |
| `send_poll` | Native WhatsApp poll (2-12 clickable options) — added in M17 F4 |

**SDR flow:** generic terms → qualify first; specific terms → search immediately. Search fail → enrichment → handoff with qualification chain. Max lead messages → auto-handoff.

**Handoff priority:** profileData > funnelData > agent.handoff_message (D10).

**Shadow mode:** after handoff, `status_ia='shadow'` — extracts data without responding to lead. NEVER overwrites `full_name`.

## Edge Functions (39 total)

Located in `supabase/functions/`. Deno runtime.

- **JWT:** `verify_jwt = true` for most. `false` for: webhooks (`whatsapp-webhook`, `fire-outgoing-webhook`), public (`form-public`, `bio-public`, `go`, `health-check`), and internal (`ai-agent`, `ai-agent-debounce`, `transcribe-audio`)
- **CORS:** `getDynamicCorsHeaders(req)` for browser-facing. `ALLOWED_ORIGIN` secret mandatory.
- **Shared modules (17):** `cors`, `fetchWithTimeout` (30s), `circuitBreaker` (Gemini/Groq/Mistral), `llmProvider`, `constants`, `logger`, `agentHelpers`, `auth`, `supabaseClient`, `carousel`, `rateLimit`, `validatorAgent`, `ttsProviders`, `response`, `aiRuntime`, `leadHelper`, `automationEngine`

**Key functions:**
- `ai-agent` (~2600 lines, HIGH RISK) — brain, SDR + handoff + shadow + circuit breaker
- `ai-agent-debounce` — atomic 10s grouping (no-retry on 500)
- `whatsapp-webhook` — receives msgs, parallel I/O, broadcast Realtime
- `uazapi-proxy` — proxies to UAZAPI (send-chat, send-media, send-poll, etc.)
- `orchestrator` — Fluxos v3.0 conversational orchestrator (M18)
- `form-bot` / `form-public` — WhatsApp forms + landing forms
- `bio-public` — Bio Link page + lead capture
- `go` — UTM redirect with countdown landing
- `aggregate-metrics` — daily aggregation cron (M19 S2)
- `assistant-chat` — conversational AI assistant (M19 S5)
- `db-retention-backup` / `db-cleanup-old-backups` — DB monitoring & auto-cleanup (M19 S8.1)

## Critical Conventions

- UAZAPI responses have inconsistent field names (PascalCase/camelCase) — always handle both
- Instance tokens resolved server-side, NEVER exposed to frontend
- Media URLs from UAZAPI `/message/download` are persistent — store directly, no re-upload
- `instances.id` is **TEXT** (not UUID) — FKs must be TEXT
- `lead_profiles.contact_id` is the FK that connects leads to contacts (1:1)
- `kanban_cards.contact_id` connects cards to contacts
- Tags on conversations: TEXT[] with "key:value" format. Helper `mergeTags()` in `agentHelpers.ts`
- NEVER empty tags `[]` — always keep at least 1 tag (e.g., `ia_cleared:TIMESTAMP`)
- `instances` UAZAPI poll endpoint is `/send/menu` (type=poll), NOT `/send/poll`

## High-Risk Files (DO NOT modify without explicit approval)

- `supabase/functions/ai-agent/index.ts` (~2600 lines)
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts` (only via `npx supabase gen types`)

## Deployment

- **Production:** crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD:** GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer:** Stack "whatspro" on Hetzner CX42 (65.108.51.109)
- **Edge Functions:** `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <name> --project-ref euljumeflwtljegknawy`

## Source of Truth

- **`PRD.md`** — Versioned changelog + roadmap + module specs (always update after shipping a feature)
- **`CLAUDE.md`** — Orchestrator instructions for Claude Code (auto-loaded)
- **`RULES.md`** — Detailed rules (integrity, delivery, SYNC RULE, CORS)
- **`ARCHITECTURE.md`** — Tech reference
- **`PATTERNS.md`** — Implementation patterns by area
- **`wiki/`** — 31 detailed case-of-use docs + visão produto + arquitetura + module wikis

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx tsc --noEmit     # Type check (must be 0 errors)
npx vitest run       # Run tests (must pass 100%)
```
