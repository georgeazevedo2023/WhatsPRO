# Playground Architecture Analysis

**Analysis Date:** 2026-04-04

## Overview

The AI Agent Playground is a super_admin-only testing interface with 4 tabs: Manual Chat, Scenarios, Results, and E2E Real. It lives at `src/pages/dashboard/AIAgentPlayground.tsx` and delegates rendering to 4 sub-components in `src/components/admin/ai-agent/playground/`.

## Component Architecture

**Page (orchestrator):**
- `src/pages/dashboard/AIAgentPlayground.tsx` (349 lines) — owns ALL state, passes props down
  - Auth guard: `useAuth().isSuperAdmin`, redirects to `/dashboard` if not super_admin
  - Session ID: random UUID substring (12 chars), generated once per mount
  - Agent selection: loads from `ai_agents` table (enabled only), stores in `agents[]` state
  - All business logic (send, replay, run scenario, run E2E, batch, export) lives here

**Tab Components (presentational):**
- `src/components/admin/ai-agent/playground/PlaygroundManualTab.tsx` — interactive chat with overrides panel, buffer mode, personas, message rating (thumbs up/down), image attach, replay
- `src/components/admin/ai-agent/playground/PlaygroundScenariosTab.tsx` — 3-column layout (gallery, chat view, execution panel), watch controls (play/pause/stop/speed)
- `src/components/admin/ai-agent/playground/PlaygroundResultsTab.tsx` — collapsible run history with pass/fail summary, tool analysis
- `src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx` — real WhatsApp E2E runner with batch support, live step visualization

**Types & Constants:**
- `src/types/playground.ts` — all interfaces (AIAgent, ChatMessage, TestScenario, E2eRunResult, etc.), TEST_SCENARIOS array (22 scenarios), TOOL_META, CATEGORY_META, PERSONAS, computeResults()

## Data Flow

### Manual Chat Flow
```
User types → handleSend() → sendToAgent([text])
  → edgeFunctionFetch('ai-agent-playground', { agent_id, messages, overrides })
  → Edge Function mirrors production logic (same prompt, tools, LLM call loop)
  → Returns { response, tool_calls, tokens, latency_ms }
  → Updates messages[] state with system (tool calls) + assistant (response) messages
```

### Scenario (Simulated) Flow
```
User selects scenario → runScenario(scenario)
  → For each step: wait (delay / watchSpeed) → sendToAgent([step.content])
  → After all steps: computeResults(scenario, messages) → PASS/FAIL
  → Stored in runHistory[] (in-memory only, not persisted)
```

### E2E Real Flow
```
User clicks "Executar E2E Real" → runE2eScenario(scenario)
  → supabase.functions.invoke('e2e-test', { agent_id, instance_id, test_number, steps })
  → e2e-test Edge Function:
    1. Finds/creates contact + conversation for test_number
    2. Resets conversation state (status_ia='ligada', tags=[], deletes old messages)
    3. For each step:
       a. INSERT incoming message to conversation_messages
       b. Calls ai-agent Edge Function directly (bypasses debounce)
       c. Waits 1s for DB writes
       d. Reads new outgoing messages + tags + logs
    4. Returns step results with tools_used, tags, latency, tokens
  → Frontend evaluates: tools_must_use, tools_must_not_use, should_handoff → PASS/FAIL
  → saveE2eResult() inserts to e2e_test_runs table (best-effort)
```

### Batch E2E Flow
```
User clicks "Rodar Todos" → runAllE2e()
  → Generates batch_id = batch_{timestamp}
  → Runs filteredScenarios sequentially with 2s delay between
  → Each scenario saved with run_type='batch' and shared batch_id
  → Abort supported via batchAbortRef
  → Toast summary at end: X passed, Y failed of Z
```

## Edge Functions

### ai-agent-playground (`supabase/functions/ai-agent-playground/index.ts`)
- Auth: `verifySuperAdmin` (JWT check)
- Mirrors production ai-agent logic with same system prompt, tool definitions, LLM call loop
- Tool execution: REAL for data queries (search_products, assign_label, set_tags, move_kanban, update_lead_profile), MOCK for WhatsApp sends (send_carousel, send_media, handoff_to_human)
- Uses shared `callLLM()` from `_shared/llmProvider.ts` with max 5 attempts
- Supports overrides: temperature, max_tokens, model, disabled_tools
- Greeting logic: just-greeting detection via `isJustGreeting()`, first-turn prepend

### e2e-test (`supabase/functions/e2e-test/index.ts`)
- Auth: `verifySuperAdmin` OR `verifyCronOrService`
- Sends REAL messages through the actual ai-agent pipeline
- Creates/finds conversation, resets state before each run
- 45s timeout per step (fetchWithTimeout)
- Returns per-step: agent_response, tools_used, tags, status_ia, latency, tokens

### e2e-scheduled (`supabase/functions/e2e-scheduled/index.ts`)
- Auth: cron/service role only
- Runs 6 hardcoded scenarios (subset of full 22) for automated monitoring
- Precondition checks (products exist, business_info configured)
- WhatsApp alert on failures (sends to alert_number via UAZAPI)
- 3s delay between scenarios, 2min timeout per scenario
- pg_cron schedule: every 6 hours (currently commented out in migration)

## Test Scenarios

**22 scenarios** defined in `src/types/playground.ts` across 17 categories:
- vendas (2): full sale flow, direct sale
- suporte (2): hours, payment
- troca (1), devolucao (1), defeito (1)
- curioso (1), vaga_emprego (1), indeciso (1)
- transbordo (1), pergunta_direta (1)
- midia (2): carousel+photo, double carousel
- audio (1), texto (1), mista (1), audio_longo (1)
- objecao (5): price, competitor, timing, quality, trust

Each scenario has:
- `steps[]`: content + optional media_type + optional delay_ms
- `expected`: tools_must_use[], tools_must_not_use[], should_handoff, should_block
- `difficulty`: easy/medium/hard
- `category`: ScenarioCategory enum

## Overrides System

Available overrides in Playground:
- `temperature`: 0-2 (Slider)
- `maxTokens`: integer
- `model`: gpt-4.1-mini, gpt-4.1-nano, gpt-4.1, gemini-2.5-flash, gemini-2.5-pro
- `disabledTools`: Set<string> of tool names to disable

## Current State & Gaps for Agent QA Framework

### What Exists
1. E2E results persist to `e2e_test_runs` table with batch_id, approval columns
2. Approval columns exist in DB (auto_approved, human_approved, human_rejected, approved_by, approved_at, reviewer_notes)
3. Automated scheduling via e2e-scheduled (pg_cron commented out)
4. computeResults evaluates tool usage, handoff, and guardrail blocking

### What's Missing (Milestone 2 Backlog)
1. **Admin Approval UI** — approval columns exist in DB but no frontend to review/approve/reject E2E results
2. **Persistent Batch History** — batch results are in DB but no UI to browse historical batches between deploys (current PlaygroundResultsTab only shows in-memory runHistory)
3. **Composite Score Bar** — no "agent evolution score" visualization tracking improvement over time
4. **Automated Test-Adjust-Retest Cycle** — e2e-scheduled runs tests but doesn't trigger adjustments or re-tests automatically
5. **E2E History Loading** — Playground doesn't load previous e2e_test_runs from DB on mount (starts empty each session)
6. **Score Trending** — no time-series view of pass rates, latency trends, or validator scores

---

*Playground architecture analysis: 2026-04-04*
