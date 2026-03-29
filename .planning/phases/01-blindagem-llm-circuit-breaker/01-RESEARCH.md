# Phase 01: Blindagem do LLM Provider e Circuit Breaker - Research

**Researched:** 2026-03-29
**Domain:** Deno Edge Functions — LLM Provider abstraction, Circuit Breaker, AI Agent loop
**Confidence:** HIGH (all findings from direct source code audit + verified external docs)

---

## Summary

This phase addresses five concrete defects in the AI Agent backend, all identified in STATE.md as CRITICA technical debt. The work is entirely contained within three files (`_shared/llmProvider.ts`, `_shared/circuitBreaker.ts`, `supabase/functions/ai-agent/index.ts`) plus the existing test file (`_shared/aiRuntime.test.ts`). No new dependencies are required.

The most impactful defect (DT-02) is that shadow mode at line 604-638 of `ai-agent/index.ts` calls the Gemini API directly via `fetchWithTimeout`, bypassing both `callLLM()` and the `geminiLLMBreaker` circuit breaker. If Gemini is unavailable, shadow mode will make unprotected requests with no fallback and no failure tracking. The fix is to rewrite the shadow mode block to use `callLLM()` with a Gemini-prefixed model, which already has the correct conversion logic.

The model ID default `'gpt-4.1-mini'` (DT-01) is confirmed as a **valid** OpenAI API model ID as of April 2025. The concern in STATE.md is a false alarm — no fix is needed here, but the audit should confirm the constant is used consistently across `callOpenAI()` line 64 and `callLLM()` line 210 and `ai-agent/index.ts` line 1405. All three already use the same string, so this is low risk.

The tool loop (DT related to task 3 and 4) has a `MAX_TOOL_ROUNDS = 3` guard at line 1421 but has no protection against tool `executeTool()` itself throwing an exception inside the loop — if a DB call fails during tool execution, the exception propagates to the outer `try/catch` which retries the whole LLM call rather than treating it as a tool failure. This can cause redundant LLM calls. Additionally, there is no per-request token accumulation ceiling beyond the LLM's own `max_tokens` parameter; a pathological sequence of tool rounds can accumulate unbounded input tokens.

Correlation IDs (task 5) are partially implemented: `createLogger()` in `_shared/logger.ts` already generates a UUID per call, but it is not used in `ai-agent/index.ts` or `ai-agent-debounce/index.ts` — they use raw `console.log`. The debounce function passes `conversation_id` to ai-agent but no explicit `request_id` field. Adding a `request_id` to the debounce → agent HTTP call and threading it through `createLogger` is low-risk and contained.

**Primary recommendation:** Fix the five tasks in order of risk: shadow mode circuit breaker (highest production risk) → tool execution exception isolation → max-token enforcement → correlation IDs → model ID audit (confirm-only). Write unit tests for all scenarios in `aiRuntime.test.ts` using vitest.

---

## Standard Stack

### Core (already in project — no new installs required)

| Component | Location | Purpose |
|-----------|----------|---------|
| `CircuitBreaker` | `_shared/circuitBreaker.ts` | Shared class + named instances (`geminiBreaker`, `groqBreaker`, `mistralBreaker`, `uazapiBreaker`) |
| `callLLM()` | `_shared/llmProvider.ts` | OpenAI-primary + Gemini-fallback with circuit breaker, model routing |
| `appendToolResults()` | `_shared/llmProvider.ts` | Builds tool result messages compatible with both providers |
| `createLogger()` | `_shared/logger.ts` | Structured JSON logger with per-request ID |
| `fetchWithTimeout()` | `_shared/fetchWithTimeout.ts` | AbortController-based timeout wrapper |
| `STATUS_IA` | `_shared/constants.ts` | `LIGADA` / `DESLIGADA` / `SHADOW` — never use magic strings |
| vitest | `vitest.config.ts` | Test runner; includes `supabase/functions/_shared/**/*.test.ts` |

### Key Identifiers in ai-agent/index.ts

| Variable | Line | Current Value |
|----------|------|--------------|
| `MAX_TOOL_ROUNDS` | 1421 | `3` — loop guard (working) |
| `maxAttempts` | 1420 | `5` — LLM retry limit (working) |
| `llmModel` | 1405 | `agent.model \|\| 'gpt-4.1-mini'` |
| Shadow mode block | 586-639 | Direct Gemini fetch, bypasses callLLM |
| Shadow model selection | 605 | `agent.model?.startsWith('gemini-') ? agent.model : 'gemini-2.5-flash'` |

---

## Architecture Patterns

### Pattern 1: Shadow Mode — Current (BROKEN) vs Correct

**Current implementation** (lines 604-628, ai-agent/index.ts):
```typescript
// PROBLEM: Direct fetch — no circuit breaker, no fallback
const shadowUrl = `https://generativelanguage.googleapis.com/v1beta/models/${shadowGeminiModel}:generateContent`
const shadowRes = await fetchWithTimeout(shadowUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
  body: JSON.stringify({ ... generationConfig: { temperature: 0.2, maxOutputTokens: 256 } }),
})
```

**Correct implementation** — route through `callLLM()`:
```typescript
// Use Gemini-prefixed model so callLLM routes to Gemini first, OpenAI as fallback
const shadowModelId = agent.model?.startsWith('gemini-') ? agent.model : 'gemini-2.5-flash'

// Convert shadow tools to LLMToolDef[] format (OpenAI JSON Schema, not Gemini format)
const shadowToolDefs: LLMToolDef[] = [
  {
    name: 'set_tags',
    description: 'Adiciona tags à conversa',
    parameters: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } }, required: ['tags'] },
  },
  {
    name: 'update_lead_profile',
    description: 'Atualiza perfil do lead',
    parameters: { type: 'object', properties: { full_name: { type: 'string' }, city: { type: 'string' }, interests: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' }, objections: { type: 'array', items: { type: 'string' } } } },
  },
]

try {
  const shadowResult = await callLLM({
    systemPrompt: shadowPrompt,
    messages: [{ role: 'user', content: incomingText }],
    tools: shadowToolDefs,
    temperature: 0.2,
    maxTokens: 256,
    model: shadowModelId,
  })

  for (const tc of shadowResult.toolCalls) {
    await executeShadowTool(tc.name, tc.args || {})
  }
} catch (shadowErr) {
  // Circuit breaker already tracked the failure — just log and continue
  console.warn('[ai-agent] Shadow mode LLM failed:', (shadowErr as Error).message)
}
```

**Why this works:** `callLLM()` with a `gemini-*` model uses the Gemini-preferred path first, then falls back to OpenAI if Gemini's circuit breaker is open. The `geminiLLMBreaker` instance in `llmProvider.ts` (line 20) is separate from the shared `geminiBreaker` exported from `circuitBreaker.ts` — the LLM provider manages its own breaker state internally.

**Critical note:** Shadow mode's tool definitions are currently in Gemini format (`OBJECT`, `ARRAY` — uppercase). When converting to `callLLM()`, they must use OpenAI JSON Schema format (`object`, `array` — lowercase). The `callGemini()` function in `llmProvider.ts` handles the conversion internally via `convertToolsToGemini()`.

### Pattern 2: Tool Execution Exception Isolation

**Current problem:** In the tool execution block (lines 1451-1466), `executeTool()` is called without its own try/catch. If a DB call inside `executeTool()` throws, the exception bubbles to the outer `while` loop's `catch` at line 1502. That catch retries the whole LLM call (up to `maxAttempts = 5`), which is incorrect — the LLM call succeeded, only the tool execution failed.

**Correct pattern:**
```typescript
// Wrap individual tool execution to prevent DB failures from triggering LLM retries
async function executeToolSafe(name: string, args: Record<string, any>): Promise<string> {
  try {
    return await executeTool(name, args)
  } catch (err) {
    console.error(`[ai-agent] Tool ${name} threw exception:`, (err as Error).message)
    return `Erro interno ao executar ${name}. Responda ao lead sem usar este resultado.`
  }
}
```

Then replace all `executeTool(...)` calls in the loop with `executeToolSafe(...)`. This ensures the LLM loop continues even if a single tool's DB call fails, and the error string returned is meaningful to the LLM.

### Pattern 3: Max-Token Enforcement in Tool Loop

**Current problem:** The tool loop accumulates `inputTokens` and `outputTokens` per iteration but never checks against a ceiling. Each tool round appends tool results to `llmMessages`, growing the context. With `MAX_TOOL_ROUNDS = 3` and a complex conversation, the context can approach or exceed the model's limit, causing the provider to return a 400 error.

**Pattern to implement:**
```typescript
const MAX_INPUT_TOKENS = agent.max_tokens ? agent.max_tokens * 4 : 4096 // heuristic: context ceiling
let totalInputTokens = 0

// Inside the loop, after accumulating:
totalInputTokens += llmResult.inputTokens
if (totalInputTokens > MAX_INPUT_TOKENS) {
  console.warn(`[ai-agent] Token ceiling reached (${totalInputTokens} > ${MAX_INPUT_TOKENS}) — forcing text-only response`)
  // Truncate llmMessages to last N messages
  llmMessages = llmMessages.slice(-6) // Keep last 3 exchange pairs
  // Force text-only final call
  break
}
```

**Note:** A simpler approach is to enforce a hard context window trim when `toolRounds >= 1` — append only the last tool result pair instead of the full accumulated history. This is lower risk than token counting.

### Pattern 4: Correlation IDs

**Current flow:** debounce → ai-agent HTTP call at line 178 of `ai-agent-debounce/index.ts` passes only `conversation_id`, `instance_id`, `messages`, `agent_id`.

**Correct pattern:**
1. In `ai-agent-debounce/index.ts`: generate `request_id = crypto.randomUUID()` at the start of the request handler, add it to the body passed to ai-agent, and log it.
2. In `ai-agent/index.ts`: extract `request_id` from the body (fallback: generate one), pass it to `createLogger('ai-agent', request_id)`, and use `log.info/warn/error` instead of raw `console.log/warn/error` throughout.
3. In `callLLM()`: optionally accept an optional `requestId` parameter to tag LLM-level logs.

**Key insight:** `createLogger` in `_shared/logger.ts` already supports this — it takes `functionName` and `requestId`, outputs structured JSON with `req` field. The infrastructure is in place but not wired up.

### Pattern 5: Model ID Audit (Confirm-Only)

`gpt-4.1-mini` is a **valid** OpenAI API model ID (released 2025-04-14, also accepts the pinned alias `gpt-4.1-mini-2025-04-14`). The concern in STATE.md DT-01 was that it might be invalid, but it is not. The three locations that reference this string are:

| Location | Line | Value |
|----------|------|-------|
| `callOpenAI()` | 64 | `req.model \|\| 'gpt-4.1-mini'` |
| `callLLM()` | 210 | `req.model \|\| 'gpt-4.1-mini'` |
| `ai-agent/index.ts` | 1405 | `agent.model \|\| 'gpt-4.1-mini'` |

All three agree. No change needed beyond adding a comment confirming the model ID is intentional.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker for shadow LLM | Custom fetch + try/catch in shadow block | `callLLM()` + existing `geminiLLMBreaker` | The breaker instance already survives across Deno isolate requests; duplication creates split state |
| Tool format conversion | Manual Gemini → OpenAI schema conversion | Pass `LLMToolDef[]` to `callLLM()` — `convertToolsToGemini()` handles it | The conversion is already tested in `callGemini()` |
| New correlation ID system | New table, middleware, tracing library | `createLogger()` in `_shared/logger.ts` | Already outputs structured JSON with `req` field |
| Retry logic for tool failures | Custom retry loop in `executeTool()` | Return error string, let LLM decide | LLM can recover from a single tool failure gracefully; blind retries cause duplicate side effects (double message sends) |

---

## Common Pitfalls

### Pitfall 1: Gemini Tool Format (Object vs object)

**What goes wrong:** Shadow mode currently uses Gemini-native tool format with uppercase type names (`OBJECT`, `ARRAY`, `STRING`). When switching to `callLLM()`, the tools must be in OpenAI JSON Schema format (`object`, `array`, `string` — lowercase). If uppercase names are passed to `callLLM()`, `callGemini()` will pass them through directly, but `callOpenAI()` will reject them with a 400 validation error.

**How to avoid:** In the shadow mode refactor, define tools as `LLMToolDef[]` with lowercase JSON Schema types. The `convertToolsToGemini()` function in `llmProvider.ts` handles conversion to Gemini format internally.

**Warning signs:** OpenAI 400 error in logs with "invalid enum value" or "expected lowercase" in the error body.

### Pitfall 2: Two Separate Gemini Circuit Breakers

**What goes wrong:** There are two independent Gemini circuit breakers in the codebase:
- `geminiLLMBreaker` (private, line 20 of `llmProvider.ts`) — tracks failures in `callLLM()`
- `geminiBreaker` (exported, line 104 of `circuitBreaker.ts`) — used for carousel copy calls in `ai-agent/index.ts`

These are intentionally separate (different workloads), but the plan must not confuse them. Shadow mode should go through `callLLM()` which uses `geminiLLMBreaker`, NOT through `geminiBreaker.call()` directly.

**Warning signs:** Shadow mode bypasses the LLM provider abstraction and calls `geminiBreaker.call(() => fetch(...))` — this is still wrong because it bypasses OpenAI fallback.

### Pitfall 3: executeShadowTool Defined After Shadow Block

**What goes wrong:** In the current code, `executeShadowTool()` is defined at line 642 **after** the shadow mode block that calls it (line 625). This works in JavaScript/TypeScript because function declarations are hoisted, but since `executeShadowTool` is defined as an `async function` statement (not an arrow function), it IS hoisted. However, if the refactor moves the shadow block or changes how `executeShadowTool` is defined, this ordering must be preserved.

**How to avoid:** Keep `executeShadowTool` as a named `async function` declaration (not an arrow function assigned to a `const`) so it remains hoisted.

### Pitfall 4: Tool Loop Break Condition with Exception Isolation

**What goes wrong:** Currently `executeTool()` inside `handoff_to_human` case does NOT throw — it returns a string. The loop break at line 1469 checks `toolCallsLog.some(t => t.name === 'handoff_to_human')`. If `executeToolSafe()` wraps this and a DB write inside handoff fails silently (returning an error string), the `toolCallsLog` entry still records the tool name, so the loop still breaks correctly. No change needed to the break logic.

**How to avoid:** Verify that `executeToolSafe()` still pushes to `toolCallsLog` even on exception — the push at line 1454 happens before the result is used, so this is safe.

### Pitfall 5: Token Counting Is Approximate

**What goes wrong:** OpenAI and Gemini return `usage` token counts after each call. Using these counts to enforce a ceiling is sound but the values are post-call — you cannot prevent an oversized request, only detect it. Enforcing a ceiling means truncating `llmMessages` *before* the next call based on the accumulated count from previous calls.

**How to avoid:** The enforcement is a safety valve, not an exact gate. A simple message-count trim (keep last N messages) is more predictable than token arithmetic and avoids dependency on provider-specific count formats.

---

## Code Examples

### Shadow Mode Tool Definitions (correct LLMToolDef format)
```typescript
// Source: llmProvider.ts LLMToolDef interface (line 34-38)
const shadowToolDefs: LLMToolDef[] = [
  {
    name: 'set_tags',
    description: 'Adiciona tags à conversa no formato chave:valor',
    parameters: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags formato chave:valor' },
      },
      required: ['tags'],
    },
  },
  {
    name: 'update_lead_profile',
    description: 'Atualiza perfil do lead com dados coletados',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        city: { type: 'string' },
        interests: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
        objections: { type: 'array', items: { type: 'string' } },
      },
    },
  },
]
```

### Correlation ID Threading
```typescript
// ai-agent-debounce/index.ts — generate and pass request_id
const request_id = crypto.randomUUID()
const log = createLogger('ai-agent-debounce', request_id)

// ... in the processAfterDelay closure:
const agentResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/ai-agent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({
    conversation_id,
    instance_id,
    messages: claimedMessages,
    agent_id: agentId,
    request_id, // NEW: thread correlation ID
  }),
}, 30000)

// ai-agent/index.ts — extract and use request_id
const { conversation_id, instance_id, messages: queuedMessages, agent_id, request_id } = body
const log = createLogger('ai-agent', request_id || crypto.randomUUID().substring(0, 8))
```

### Test Structure for aiRuntime.test.ts
```typescript
// Tests should be added to supabase/functions/_shared/aiRuntime.test.ts
// Current file imports from aiRuntime.ts — new tests can import from llmProvider.ts / circuitBreaker.ts
// but ONLY pure functions (no Deno.env, no fetch)

// Example: circuit breaker state machine
import { CircuitBreaker } from './circuitBreaker.ts'

describe('CircuitBreaker', () => {
  it('opens after threshold failures', () => {
    const cb = new CircuitBreaker('test', { threshold: 2, resetMs: 60000 })
    cb.onFailure()
    expect(cb.isOpen).toBe(false) // 1 failure, not yet open
    cb.onFailure()
    expect(cb.isOpen).toBe(true)  // 2 failures = threshold
  })

  it('transitions to HALF_OPEN after resetMs', () => {
    // Requires time manipulation — use fake timers or test the state logic
  })
})
```

**Note:** Tests that call `callLLM()` directly cannot run in vitest because they depend on `Deno.env` (unavailable in Node/jsdom). Only pure logic extracted from the LLM loop can be unit tested. The acceptance criteria test for "shadow mode uses callLLM()" must be verified by code review, not automated test.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Gemini-only AI agent | OpenAI primary + Gemini fallback via `callLLM()` | Already implemented in normal mode |
| Direct `fetch()` in shadow mode | Must be changed to `callLLM()` | This phase |
| `console.log` with string interpolation | `createLogger()` structured JSON | Infrastructure exists, not wired in ai-agent |
| Tool execution with no isolation | Must add try/catch per tool | This phase |

---

## Open Questions

1. **Should `executeShadowTool` remain inline or be moved to `agentHelpers.ts`?**
   - What we know: It is 25 lines and only used in shadow mode. The ROADMAP Phase 2 already plans to consolidate helpers.
   - What's unclear: Moving it now would be out of scope for Phase 1 but reduce duplication.
   - Recommendation: Keep it inline for Phase 1. Phase 2 consolidates helpers.

2. **Should the shadow mode also support OpenAI as primary (not just fallback)?**
   - What we know: The current shadow model selection prefers Gemini: `agent.model?.startsWith('gemini-') ? agent.model : 'gemini-2.5-flash'`
   - What's unclear: Some agents may have `agent.model = 'gpt-4.1-mini'` and shadow mode would still call Gemini first.
   - Recommendation: Use `agent.model || 'gemini-2.5-flash'` directly — if the agent's model is `gpt-4.1-mini`, `callLLM()` will correctly route OpenAI-first. Shadow mode does not need to force Gemini.

3. **Token ceiling — what value is safe?**
   - What we know: `gpt-4.1-mini` has a 1M token context window. Shadow mode has `maxOutputTokens: 256` so token blowup is not a concern there. The ceiling matters for the normal tool loop.
   - Recommendation: Use `Math.min(agent.max_tokens * 8, 8192)` as a simple accumulated input token ceiling. If exceeded, trim `llmMessages` to last 6 messages before next call.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code-only changes to existing Edge Functions. No new external dependencies. The existing `OPENAI_API_KEY`, `GEMINI_API_KEY` env vars are assumed configured (required for the agent to function at all).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (version in package.json) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run supabase/functions/_shared/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Task | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| T-01: Model ID audit | `'gpt-4.1-mini'` is consistent in 3 locations | code review | n/a (static audit) | n/a |
| T-02: Shadow uses callLLM | Shadow block no longer calls `fetchWithTimeout` directly to Gemini URL | code review + unit | `npx vitest run supabase/functions/_shared/aiRuntime.test.ts` | ✅ exists |
| T-03: Tool exception isolation | Tool failure returns error string, does not propagate to LLM catch | unit | `npx vitest run supabase/functions/_shared/aiRuntime.test.ts` | ✅ exists |
| T-04: Max token enforcement | After token ceiling, llmMessages is trimmed | unit | `npx vitest run supabase/functions/_shared/aiRuntime.test.ts` | ✅ exists |
| T-05: Correlation IDs | request_id flows from debounce to ai-agent to LLM logs | code review + unit | `npx vitest run supabase/functions/_shared/aiRuntime.test.ts` | ✅ exists |
| Circuit breaker state | CLOSED → OPEN → HALF_OPEN transitions | unit | `npx vitest run supabase/functions/_shared/aiRuntime.test.ts` | ✅ exists |

**Key constraint:** Tests for `callLLM()`, `callGemini()`, `callOpenAI()` require `Deno.env` and cannot run in vitest (Node environment). Only pure logic (circuit breaker state machine, tool format validation, token counting helpers) can be unit tested. The critical behavior — "shadow mode uses callLLM()" — is validated by code review (grep for the removed direct fetch URL).

### Sampling Rate
- **Per task commit:** `npx vitest run supabase/functions/_shared/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Tests for `CircuitBreaker` state transitions — currently no tests exist for `circuitBreaker.ts`
- [ ] Tests for shadow tool format validation (LLMToolDef with lowercase types)
- [ ] Tests for `executeToolSafe` error isolation behavior

Existing `aiRuntime.test.ts` covers debounce helpers and `shouldTriggerAiAgentFromWebhook`. New tests for this phase should be added to the same file or a new `circuitBreaker.test.ts` file (also picked up by vitest config glob).

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase |
|-----------|----------------|
| `status_ia` constants: use `STATUS_IA.LIGADA/DESLIGADA/SHADOW` from `_shared/constants.ts` — NEVER use magic strings | Shadow mode refactor must continue using `STATUS_IA.SHADOW` constant |
| Circuit breaker: `geminiBreaker/groqBreaker/mistralBreaker` (3 failures → OPEN 30s → HALF_OPEN probe) | Shadow mode must use the LLM provider's internal `geminiLLMBreaker`, not the carousel `geminiBreaker` |
| AI Agent helpers: `sendTextMsg()`, `sendTts()`, `broadcastEvent()`, `mergeTags()`, `cleanProductTitle()` | These are defined inline in `ai-agent/index.ts` — shadow mode refactor must not break their closure scope |
| Debounce: atomic UPDATE WHERE processed=false (eliminates race condition) | Correlation IDs must be added without altering the atomic claim logic |
| Edge Functions use Deno runtime | No Node.js APIs; `crypto.randomUUID()` is available in Deno |
| `verify_jwt = false` on `ai-agent` and `ai-agent-debounce` | Internal calls authenticated via ANON_KEY check; adding `request_id` to body does not affect auth |
| NEVER expose instance token to frontend | No frontend changes in this phase — no risk |

---

## Sources

### Primary (HIGH confidence)
- Direct source code audit: `supabase/functions/_shared/llmProvider.ts` — full file read
- Direct source code audit: `supabase/functions/_shared/circuitBreaker.ts` — full file read
- Direct source code audit: `supabase/functions/ai-agent/index.ts` — full file read (all 1700 lines)
- Direct source code audit: `supabase/functions/_shared/agentHelpers.ts` — full file read
- Direct source code audit: `supabase/functions/_shared/aiRuntime.ts` + `aiRuntime.test.ts` — full file read
- Direct source code audit: `supabase/functions/_shared/logger.ts` — full file read
- `.planning/STATE.md` — DT-01 through DT-04 defect descriptions
- `.planning/REQUIREMENTS.md` — Section 1.8 (LLM Providers), 1.9 (Circuit Breaker), 1.4 (Shadow Mode)

### Secondary (MEDIUM confidence)
- OpenAI official docs (developers.openai.com): confirmed `gpt-4.1-mini` is a valid model ID (released 2025-04-14), not just `gpt-4.1-mini-2025-04-14`
- WebSearch: confirmed GPT-4.1 family released April 14, 2025

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Shadow mode defect (DT-02): HIGH — confirmed by direct code inspection, line 604 calls `fetchWithTimeout` to Gemini URL directly
- Model ID validity: HIGH — confirmed by official OpenAI docs
- Tool exception isolation gap: HIGH — confirmed by reading the while loop; no try/catch wraps `executeTool()` calls
- Max-token enforcement: MEDIUM — the gap is real but the impact depends on typical usage patterns; no production data available
- Correlation ID infrastructure: HIGH — `createLogger` exists and works; the gap is only the wiring

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (30 days — stable Deno/Supabase edge runtime)
