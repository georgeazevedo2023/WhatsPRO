# WhatsPRO — Quick Brief for External Agents

> Concise English overview for AI agents (Claude Code, Cursor, Copilot Workspace) onboarding to the codebase. Updated 2026-07-26.

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
- **Summaries:** OpenAI gpt-4.1-mini via callLLM, Gemini fallback (since v7.82). **Carousel copy:** Groq → Gemini → Mistral

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

**Intelligence:** M10 AI Agent (9 tools), M17 F1 Automation Engine, M17 F3 Agent Profiles, M17 F4 Polls, M17 F5 NPS, M18 Fluxos v3.0 (runtime descontinuado v7.90.0 — superado pelo router do ai-agent)

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

**Architecture (as of 2026-07-25, v7.109.0 — "D6"):** a tiny **router LLM** (gpt-4.1-mini) classifies intent → the DISPATCH table in `_shared/agent/routerPipeline.ts` (7 intents; `fora_escopo` → greeting, `pagamento` → objection) hands off to one of **5 dedicated specialists** (greeting/qualification/product/objection/handoff). ⚠️ **The monolith was retired on 2026-07-25** — `routerPipeline.ts` (~932 lines) is now the ONLY brain, there is no legacy-LLM fallback left, and `ai_agents.routing_mode` is an **inert column** (no code reads it; the DB default moved to `router` and the UI selector was removed from `AIAgentTab.tsx`). Deterministic layer (`qualificationGate`, `greetingPolicy`, `responseSanitizer`) decides search-vs-qualify and sanitizes output.

**Failure paths (post-D6):**
- **Router LLM fails** (bad JSON parse / invalid intent / confidence < 0.6) → deterministic fallback to the `qualificacao` intent (`_shared/agent/router.ts`). No handoff.
- **Specialist fails / hop guard trips / pipeline throws** → `routerPipeline` returns null and `ai-agent/index.ts` runs the **graceful handoff**: sends the configured `handoff_message`, assigns the conversation to the queue, sets `status_ia='shadow'`, writes an internal note, and logs to `ai_agent_logs` with `event=implicit_handoff` + `metadata.reason=router_fallback`.
- **Rollback is no longer a flag:** redeploy `ai-agent` from commit `36f0555` (the parent commit, last one containing the monolith) via the scoop CLI. Prod was v276 before D6, v277 after.

**Handoff priority:** profileData > funnelData > agent.handoff_message (D10).

**Shadow mode:** after handoff, `conversations.status_ia='shadow'` — extracts data without responding to lead. NEVER overwrites `full_name`. ⚠️ Do not confuse this with the old routing **shadow mode** (router runs but does not answer), which no longer exists — it was removed with the monolith in v7.109.0.

## Edge Functions (43 in `supabase/functions/`; 44 ACTIVE in prod — `env-diag` is deploy-only)

Located in `supabase/functions/`. Deno runtime.

- **JWT:** `verify_jwt = true` for most. `false` for webhooks, public functions (`form-public`, `bio-public`, `go`, `health-check`), internal (`ai-agent`, `ai-agent-debounce`, `transcribe-audio`) and internal crons — source of truth: each function's `config.toml`
- **CORS:** `getDynamicCorsHeaders(req)` for browser-facing. `ALLOWED_ORIGIN` secret mandatory.
- **Shared modules (~46 in `_shared/` + `_shared/agent/`):** key ones — `cors`, `fetchWithTimeout` (30s), `circuitBreaker` (Gemini/Groq/Mistral), `llmProvider`, `constants`, `logger`, `agentHelpers`, `auth`, `supabaseClient`, `carousel`, `rateLimit`, `ttsProviders`, `response`, `aiRuntime`, `leadHelper`, `automationEngine`, `responseSanitizer`, `routerPipeline`, `specialistBase`, `qualificationGate`, `greetingPolicy`. ⚠️ `validatorAgent` retired from the hot path in v7.89.0 (deterministic validation moved to `responseSanitizer`)

**Key functions:**
- `ai-agent` (2,964 lines since 2026-07-25, was 3,440 — HIGH RISK) — brain entrypoint (router pipeline + 5 specialists; **no monolith** since v7.109.0, failures go to graceful handoff), SDR + handoff + shadow + circuit breaker
- `ai-agent-debounce` — atomic 10s grouping (no-retry on 500)
- `whatsapp-webhook` — receives msgs, parallel I/O, broadcast Realtime
- `uazapi-proxy` — proxies to UAZAPI (send-chat, send-media, send-poll, etc.)
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

- `supabase/functions/ai-agent/index.ts` (2,964 lines) and `supabase/functions/_shared/agent/routerPipeline.ts` (~932 lines — the actual brain)
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts` (only via `supabase gen types` — binário scoop, NÃO npx)

## Deployment

- **Production:** crm.wsmart.com.br (Docker Swarm + Traefik + SSL)
- **CI/CD:** GitHub Actions → ghcr.io/georgeazevedo2023/whatspro:latest
- **Portainer:** Stack "whatspro" on Hetzner CX42 (65.108.51.109)
- **Edge Functions:** binário scoop (NÃO npx) → `$env:SUPABASE_ACCESS_TOKEN=<PAT eletropiso>; supabase functions deploy <name> --project-ref prfcbfumyrrycsrcrvms --use-api` ⚠️ ref ATUAL `prfcbfumyrrycsrcrvms` (antigo `euljumeflwtljegknawy` MORTO)

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
