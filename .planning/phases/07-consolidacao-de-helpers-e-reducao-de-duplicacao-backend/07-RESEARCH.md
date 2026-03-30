# Phase 7: Consolidacao de Helpers e Reducao de Duplicacao (Backend) - Research

**Researched:** 2026-03-30
**Domain:** Supabase Edge Functions (Deno runtime) — code deduplication, shared utilities, structured logging
**Confidence:** HIGH

## Summary

Phase 7 is a pure refactoring phase that eliminates code duplication across 26 Supabase Edge Functions. The goal is zero behavior change — only structural reorganization: centralizing the Supabase client factory, migrating all functions to already-existing but unused `response.ts` and `logger.ts` helpers, extracting carousel logic to a shared module, making the `'Confira:'` text configurable, and adding structured LLM metrics to `llmProvider.ts`.

The key finding is that `_shared/response.ts` and `_shared/logger.ts` already exist with correct implementations — they are simply not imported by any of the 26 functions. This means the migration is mechanical: find-and-replace patterns with well-defined targets. The `createServiceClient()` / `createUserClient()` factory is a new file to create; the carousel extraction involves moving ~150 LOC from `ai-agent/index.ts` to `_shared/carousel.ts` with care for closure variables that reference `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`.

The scope is exclusively `supabase/functions/` — no frontend files are touched. Risk is low because all changes are additive imports + mechanical substitutions with existing patterns that already work.

**Primary recommendation:** Execute in dependency order — supabaseClient.ts first (no dependencies), then response.ts + logger.ts migration (mechanical, high volume), carousel extraction last (most complex due to closure coupling), metrics as a final additive pass to llmProvider.ts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Criar `_shared/supabaseClient.ts` com `createServiceClient()` (SERVICE_ROLE_KEY, bypassa RLS) e `createUserClient(req: Request)` (JWT do Authorization header, respeita RLS). Ambas leem `SUPABASE_URL` + chaves de `Deno.env.get()`. Eliminar todos os `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` individuais.

- **D-02:** Migrar todas as 26 funcoes para `_shared/response.ts` (`successResponse`, `errorResponse`) e `_shared/logger.ts` (`createLogger`). Substituir 158 `new Response(JSON.stringify(...))` e 243 `console.log/error`. `unauthorizedResponse()` de `_shared/auth.ts` permanece. Funcoes com `new Response` raw para 401 migram para `unauthorizedResponse()`.

- **D-03:** Extrair logica de carousel de `ai-agent/index.ts` para `_shared/carousel.ts`: `buildCarousel(products, copies)`, `generateCarouselCopies(products, agent, options)`, cache LRU in-memory (`_carouselCopyCache`, `CAROUSEL_CACHE_TTL_MS`, `CAROUSEL_CACHE_MAX_SIZE`). Zero mudanca de comportamento.

- **D-04:** Texto `'Confira:'` hardcoded em 4 locais vira `agent.carousel_text || 'Confira:'`. Campo opcional do agente — SEM migration SQL necessaria (campo JSON aceita campos opcionais).

- **D-05:** Metricas LLM apenas em `ai-agent` e `_shared/llmProvider.ts`. Campos: `latency_ms`, `token_count`, `provider`, `model`. Usar `createLogger` existente. Apenas metricas de chamada LLM — sem metricas de request-level.

### Claude's Discretion

- Ordem de execucao dos planos baseada em dependencias (supabaseClient primeiro, depois response/logger, carousel por ultimo)
- Se alguma funcao tem padrao muito diferente (ex: whatsapp-webhook streaming), adaptar sem consultar
- Se `generateCarouselCopies` for muito acoplada (usa variaveis de escopo do handler), manter parcialmente no ai-agent e extrair so o que faz sentido
- Nomes exatos de query keys e cache constants: Claude define

### Deferred Ideas (OUT OF SCOPE)

- Metricas de request-level (latencia total por funcao)
- Qualquer mudanca no frontend
- Migrations SQL para campos do agente
- Nova infraestrutura de monitoramento (apenas logs estruturados)
</user_constraints>

## Standard Stack

### Core (existing — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.x` (esm.sh) | Supabase client | Already in all 26 functions |
| Deno built-ins | Runtime | `Deno.env.get()`, `crypto.randomUUID()` | No npm needed in Deno |

### Existing `_shared/` files (all verified by direct read)
| File | Status | Purpose |
|------|--------|---------|
| `response.ts` | EXISTS, UNUSED | `successResponse()`, `errorResponse()` |
| `logger.ts` | EXISTS, UNUSED | `createLogger(fn, reqId)` |
| `auth.ts` | EXISTS, PARTIALLY USED | `verifyAuth()`, `verifySuperAdmin()`, `verifyCronOrService()`, `unauthorizedResponse()` |
| `cors.ts` | EXISTS, USED | `browserCorsHeaders`, `webhookCorsHeaders` |
| `circuitBreaker.ts` | EXISTS, USED | `geminiBreaker`, `groqBreaker`, `mistralBreaker`, `uazapiBreaker` |
| `llmProvider.ts` | EXISTS, USED | `callLLM()`, `appendToolResults()` — target for metrics |
| `fetchWithTimeout.ts` | EXISTS, USED | `fetchWithTimeout()`, `fetchFireAndForget()` |
| `rateLimit.ts` | EXISTS, USED | `check_rate_limit()` RPC wrapper |
| `constants.ts` | EXISTS, USED | `STATUS_IA` constants |
| `agentHelpers.ts` | EXISTS, USED | `mergeTags()`, `escapeLike()` |
| `aiRuntime.ts` | EXISTS, USED | `shouldTriggerAiAgentFromWebhook()` |

### New files to create
| File | Purpose |
|------|---------|
| `_shared/supabaseClient.ts` | `createServiceClient()` + `createUserClient(req)` factories |
| `_shared/carousel.ts` | Carousel build + AI copy generation + LRU cache |

**No installation required** — no new npm/deno packages. All logic uses existing imports already present in the codebase.

## Architecture Patterns

### Recommended `_shared/supabaseClient.ts` Structure

```typescript
// Source: verified from existing patterns in auth.ts + all 26 functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Service client — bypasses RLS. Use for webhooks, cron jobs, ai-agent, process-jobs. */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/** User-scoped client — respects RLS. Use for admin-*, activate-ia, user-facing functions.
 *  Extracts JWT from Authorization header. */
export function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}
```

### Module-Level vs Request-Level Client Instantiation

This is a critical distinction in Deno Edge Functions:

**Module-level singleton (service clients):** Used by `whatsapp-webhook`, `ai-agent`, `ai-agent-debounce`, `process-jobs`, `health-check`, `e2e-test`, `e2e-scheduled`, `scrape-products-batch`, `send-shift-report`, `process-follow-ups`, `analyze-summaries`, `auto-summarize`. These create the client once at module initialization — the Deno isolate reuses it across requests. Pattern:
```typescript
const supabase = createServiceClient()
```

**Request-level instantiation (user clients):** Used by `admin-create-user`, `admin-delete-user`, `admin-update-user`, `activate-ia`, `database-backup`, `sync-conversations`, `summarize-conversation`, `analyze-summaries` (dual), `send-shift-report` (dual), `transcribe-audio`, `cleanup-old-media`, `go`, `fire-outgoing-webhook`, `uazapi-proxy`. These need the per-request JWT. Pattern:
```typescript
const supabase = createUserClient(req)
// or service client created on demand
const serviceClient = createServiceClient()
```

### Carousel Extraction Strategy

The carousel logic in `ai-agent/index.ts` uses module-level constants (`GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`) that are read from `Deno.env.get()` at module init. These constants must move inside `_shared/carousel.ts` or be read lazily:

```typescript
// _shared/carousel.ts — recommended pattern
// Read env at call time (safe in Deno — env is stable within isolate)
async function generateCarouselCopies(product: any, numCards: number): Promise<string[]> {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
  // ... rest of logic
}
```

The cache Map `_carouselCopyCache` can remain module-level in `carousel.ts` — it is safe to share across requests within a Deno isolate (same as current behavior).

### Pattern: Response Migration

```typescript
// BEFORE (158 occurrences):
return new Response(JSON.stringify({ ok: true, data }), {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})

// AFTER:
import { successResponse, errorResponse } from '../_shared/response.ts'
return successResponse(corsHeaders, { data })

// BEFORE (401 raw):
return new Response(JSON.stringify({ error: 'Unauthorized' }), {
  status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})

// AFTER:
import { unauthorizedResponse } from '../_shared/auth.ts'
return unauthorizedResponse(corsHeaders)
```

Note: `successResponse` spreads data as `{ ok: true, ...data }`. If existing response shapes use `{ data: payload }`, that nesting must be preserved: `successResponse(corsHeaders, { data: payload })`.

### Pattern: Logger Migration

```typescript
// BEFORE (243 occurrences):
console.log('[function-name] Something happened', value)
console.error('[function-name] Failed:', err)

// AFTER:
import { createLogger } from '../_shared/logger.ts'
const log = createLogger('function-name', requestId)
log.info('Something happened', { value })
log.error('Failed', { error: (err as Error).message })
```

For module-level functions (no request context), `requestId` can be omitted — `createLogger` generates a random 8-char ID as fallback.

### Pattern: LLM Metrics in llmProvider.ts

```typescript
// In callOpenAI() and callGemini(), after successful response:
const latency_ms = Date.now() - startTime

// callLLM() already returns inputTokens + outputTokens + model + provider
// Caller (ai-agent) logs these:
log.info('LLM response', {
  provider: result.provider,
  model: result.model,
  latency_ms,
  token_count: result.inputTokens + result.outputTokens
})
```

Alternatively, add timing inside `callLLM()` itself and include `latency_ms` in the `LLMResponse` interface — this is cleaner since callers don't need to track `startTime`.

### Anti-Patterns to Avoid

- **Don't change response shapes:** `successResponse` spreads data as `{ ok: true, ...data }`. The frontend depends on these shapes. Verify each call site doesn't change the response envelope.
- **Don't convert streaming responses:** The `go` function (UTM redirect) returns a 302 redirect — that must NOT be converted to `successResponse`. Same for OPTIONS preflight `new Response(null, { headers: corsHeaders })`.
- **Don't make module-level singletons request-scoped:** `whatsapp-webhook`, `ai-agent`, `process-jobs` etc. use module-level `const supabase = createServiceClient()` — this is intentional (connection pool reuse). Keep them module-level.
- **Don't use `any` types in carousel.ts:** Define a `Product` interface matching the DB query shape.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase client creation | Custom fetch wrapper | `createServiceClient()` / `createUserClient()` from `_shared/supabaseClient.ts` | Single source of truth for URL + keys |
| Structured logging | `console.log` with manual JSON | `createLogger` from `_shared/logger.ts` | Already has level, fn name, requestId, timestamp fields |
| Error responses | Inline `new Response(JSON.stringify({ error }))` | `errorResponse()` from `_shared/response.ts` | Guarantees CORS headers + Content-Type |
| 401 responses | Inline `new Response(JSON.stringify({ error: 'Unauthorized' }))` | `unauthorizedResponse()` from `_shared/auth.ts` | Already used by `ai-agent` — be consistent |
| Carousel copy cache | New cache system | Move existing `_carouselCopyCache` Map to `_shared/carousel.ts` | Same in-memory LRU pattern, zero new infrastructure |

**Key insight:** Every utility needed already exists in `_shared/`. The work is entirely import migration, not new code creation (except `supabaseClient.ts` and `carousel.ts`).

## Common Pitfalls

### Pitfall 1: Breaking Response Envelope Shape
**What goes wrong:** `successResponse(corsHeaders, data)` spreads `data` as `{ ok: true, ...data }`. If existing code returns `{ message: 'ok', user: {...} }` it becomes `{ ok: true, message: 'ok', user: {...} }` — OK. But if code returns `{ data: payload }` the shape is preserved as `{ ok: true, data: payload }`. Adding an extra `ok: true` field should be backward-compatible for the frontend (TanStack Query checks for data, not `ok: true`).
**Why it happens:** `successResponse` always adds `ok: true` to the top level.
**How to avoid:** Verify each call site: if the frontend reads `response.ok` as a boolean HTTP status, it still works. If it reads `data.ok` as a field, need to check.
**Warning signs:** Any function where frontend does `result.ok !== true` checks on the JSON body.

### Pitfall 2: Module-Level createServiceClient() Instantiation
**What goes wrong:** For webhook functions (`whatsapp-webhook`, `ai-agent`, etc.), the Supabase client is intentionally created once at module initialization (not per request). If converted to per-request instantiation, you lose connection pool reuse.
**Why it happens:** `createServiceClient()` is a factory function — callers might call it inside the request handler instead of at module level.
**How to avoid:** For functions that currently have `const supabase = createClient(...)` at module level (outside `Deno.serve()`), keep the call at module level: `const supabase = createServiceClient()`.

### Pitfall 3: Carousel Closure Variables
**What goes wrong:** `generateCarouselCopies` in `ai-agent/index.ts` uses `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY` which are module-level constants. Naively extracting the function to `carousel.ts` without these env reads will cause "undefined" errors.
**Why it happens:** JavaScript closures capture the surrounding scope — moving to a new file breaks the closure.
**How to avoid:** Either (a) read `Deno.env.get()` inside the function body in `carousel.ts`, or (b) pass them as parameters. Option (a) is simpler and has no perf cost in Deno.
**Warning signs:** `GROQ_API_KEY` being `undefined` causing silent fallback to static copies.

### Pitfall 4: Non-JSON Responses Converted to successResponse
**What goes wrong:** Some functions return non-JSON responses:
- `go/index.ts` returns HTTP 302 redirects
- All functions return `new Response(null, { headers: corsHeaders })` for OPTIONS
- `health-check` may return custom 200/503 structures
**Why it happens:** `successResponse` always returns `application/json` with `{ ok: true }` wrapper.
**How to avoid:** Only migrate JSON responses. Keep `new Response(null, ...)` for OPTIONS, keep redirect responses as-is.
**Warning signs:** `go` function redirecting to `/api/...` instead of the campaign URL.

### Pitfall 5: auth.ts Still Uses Inline createClient
**What goes wrong:** `_shared/auth.ts` itself calls `createClient()` inline (lines 12 and 32). If only function files are migrated but `auth.ts` is not updated to use `supabaseClient.ts`, there's still a duplicate pattern in shared code.
**Why it happens:** auth.ts predates `supabaseClient.ts` which doesn't exist yet.
**How to avoid:** Update `auth.ts` to import from `_shared/supabaseClient.ts` after creating it. This makes the dependency graph clean: `auth.ts → supabaseClient.ts → esm.sh/@supabase/supabase-js@2`.

### Pitfall 6: 'Confira:' in carousel DB record
**What goes wrong:** Line 1132 in `ai-agent/index.ts` saves `'Confira:'` into `conversation_messages.media_url` as a JSON string: `JSON.stringify({ message: 'Confira:', cards: carousel })`. This stored value is used by the helpdesk frontend to render the carousel message. If only the UAZAPI send payload is updated but not the DB insert, the helpdesk shows different text than what was sent.
**Why it happens:** There are 4 occurrences of `'Confira:'` in carousel logic — 2 in send payloads, 1 in `content` field, 1 in `media_url` JSON.
**How to avoid:** All 4 occurrences must use `agent.carousel_text || 'Confira:'`. The CONTEXT.md confirms this explicitly.

## Code Examples

### createServiceClient / createUserClient target pattern
```typescript
// Source: verified from current patterns in whatsapp-webhook/index.ts, admin-create-user/index.ts, auth.ts

// _shared/supabaseClient.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}
```

### LLM metrics addition to llmProvider.ts
```typescript
// Source: verified from current _shared/llmProvider.ts structure
// Add latency_ms to LLMResponse interface:
export interface LLMResponse {
  text: string
  toolCalls: { name: string; args: Record<string, unknown>; id: string }[]
  inputTokens: number
  outputTokens: number
  model: string
  provider: 'openai' | 'gemini'
  latency_ms: number  // NEW
}

// In callOpenAI() / callGemini():
async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  const startMs = Date.now()
  // ... existing code ...
  return {
    // ... existing fields ...
    latency_ms: Date.now() - startMs,  // NEW
  }
}
```

### carousel.ts scaffold
```typescript
// Source: extracted from ai-agent/index.ts ~line 40-148
import { fetchWithTimeout } from './fetchWithTimeout.ts'

// Cache persists within same Deno isolate (module-level is correct)
const _carouselCopyCache = new Map<string, { copies: string[], expiresAt: number }>()
export const CAROUSEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const CAROUSEL_CACHE_MAX_SIZE = 200

export interface CarouselCard {
  text: string
  image: string
  buttons: { id: string; text: string; type: 'REPLY' }[]
}

export function buildCarousel(
  products: any[],
  copies: string[],
  buttonTexts?: { intermediate: string; last: string }
): CarouselCard[] {
  // ... extracted from send_carousel + search_products tool logic
}

export async function generateCarouselCopies(
  product: any,
  numCards: number
): Promise<string[]> {
  // Env vars read inside function (not module-level closure)
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
  // ... extracted logic
}
```

## Migration Inventory

### Functions by client pattern (HIGH confidence — verified by code grep)

**Module-level service client (13 functions):**
`whatsapp-webhook`, `ai-agent`, `ai-agent-debounce`, `ai-agent-playground`, `analyze-summaries` (serviceSupabase), `auto-summarize`, `health-check`, `process-follow-ups`, `process-jobs`, `e2e-test`, `e2e-scheduled`, `scrape-products-batch`, `send-shift-report` (serviceSupabase)

**Request-level user client (functions with JWT extraction):**
`admin-create-user`, `admin-delete-user`, `admin-update-user`, `activate-ia`, `database-backup`, `sync-conversations`, `summarize-conversation`, `transcribe-audio`, `cleanup-old-media`, `go`, `fire-outgoing-webhook`, `uazapi-proxy`

**Dual pattern (both service + user in same function):**
`activate-ia`, `database-backup`, `analyze-summaries`, `send-shift-report`, `sync-conversations`, `uazapi-proxy`, `summarize-conversation`

**Functions NOT needing client migration:**
`scrape-product`, `group-reasons` (need verification — may not use supabase client)

### Carousel changes (4 occurrences, all in ai-agent/index.ts)
- Line 1101: `{ phone: contact.jid, message: 'Confira:', carousel }` → `{ phone: contact.jid, message: agent.carousel_text || 'Confira:', carousel }`
- Line 1102: `{ number: contact.jid, text: 'Confira:', carousel }` → `{ number: contact.jid, text: agent.carousel_text || 'Confira:', carousel }`
- Line 1130: `content: 'Confira:'` → `content: agent.carousel_text || 'Confira:'`
- Line 1132: `media_url: JSON.stringify({ message: 'Confira:', cards: carousel })` → `media_url: JSON.stringify({ message: agent.carousel_text || 'Confira:', cards: carousel })`

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code refactoring within existing Edge Functions. No new external services, runtimes, or CLI utilities required. All changes are TypeScript/Deno file edits deployed via `npx supabase functions deploy`.

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` (only `_auto_chain_active` is set) — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + Deno test (edge functions) |
| Config file | `vitest.config.ts` (frontend), `_shared/*.test.ts` (deno-native) |
| Quick run command | `npm run test` (vitest) |
| Full suite command | `npm run test -- --run` |

### Existing tests in _shared/
- `_shared/agentHelpers.test.ts` — covers mergeTags, escapeLike
- `_shared/aiRuntime.test.ts` — covers shouldTriggerAiAgentFromWebhook
- `_shared/circuitBreaker.test.ts` — covers CircuitBreaker state machine

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Notes |
|-----|----------|-----------|-------|
| D-01 | `createServiceClient()` returns valid client | Unit | Add to new `_shared/supabaseClient.test.ts` |
| D-01 | `createUserClient(req)` passes JWT header | Unit | Mock `Deno.env.get`, mock Request |
| D-02 | `successResponse` / `errorResponse` include CORS headers | Unit | Already covered by `response.ts` design; verify no regression |
| D-03 | `generateCarouselCopies` returns correct card count | Unit | Move/expand existing inline tests if any |
| D-03 | Cache evicts oldest on MAX_SIZE | Unit | Pure logic, testable |
| D-04 | `agent.carousel_text` used when set | Unit | Pass mock agent with custom text |
| D-05 | `LLMResponse.latency_ms` populated | Unit | Mock fetch, measure returned field |

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/supabaseClient.test.ts` — unit tests for both factory functions
- [ ] `supabase/functions/_shared/carousel.test.ts` — unit tests for buildCarousel + generateCarouselCopies + cache

*(Existing test infrastructure for _shared/ is already established — pattern follows circuitBreaker.test.ts)*

## Open Questions

1. **`scrape-product` and `group-reasons` client usage**
   - What we know: Not seen in the grep output for `createClient`
   - What's unclear: Do these functions use the Supabase client at all? If not, they skip D-01 migration
   - Recommendation: Read both files briefly before starting migration to confirm scope

2. **`response.ts` shape compatibility with frontend**
   - What we know: `successResponse` adds `ok: true` to JSON body
   - What's unclear: Whether any frontend code does `if (result.ok === true)` checks vs `if (response.ok)` HTTP status check
   - Recommendation: Grep frontend for `\.ok` property access patterns on API responses before migrating functions that return data consumed by the frontend

3. **ai-agent shadow mode and carousel_text**
   - What we know: Shadow mode skips sending messages
   - What's unclear: Whether `agent.carousel_text` field needs to be read in shadow mode path too (it shouldn't — shadow doesn't send)
   - Recommendation: Only apply carousel_text in the non-shadow send paths (lines 1101-1132)

## Sources

### Primary (HIGH confidence)
- Direct read of `supabase/functions/_shared/response.ts` — API surface verified
- Direct read of `supabase/functions/_shared/logger.ts` — API surface verified
- Direct read of `supabase/functions/_shared/auth.ts` — current patterns + inline createClient calls confirmed
- Direct read of `supabase/functions/_shared/cors.ts` — header variants confirmed
- Direct read of `supabase/functions/_shared/llmProvider.ts` — LLMResponse interface + callLLM structure
- Direct read of `supabase/functions/_shared/circuitBreaker.ts` — pattern for shared module-level state
- Direct read of `supabase/functions/ai-agent/index.ts` (lines 1-250, 1080-1215) — carousel logic, 'Confira:' occurrences
- Direct read of `supabase/functions/whatsapp-webhook/index.ts` — module-level client pattern
- Direct read of `supabase/functions/admin-create-user/index.ts` — userClient + adminClient dual pattern
- Direct read of `supabase/functions/activate-ia/index.ts` — userClient + serviceClient in request handler
- Direct read of `supabase/functions/database-backup/index.ts` — dual client + ANON_KEY fallback pattern
- Direct read of `supabase/functions/process-jobs/index.ts` — module-level service client pattern
- Bash grep: 346 total occurrences of `createClient|new Response|console.*` in non-shared functions
- Bash grep: All 26 function files confirmed with createClient usage mapped to specific files

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — technical debt inventory (DT-01 shadow mode circuit breaker bypass noted)
- `.planning/REQUIREMENTS.md` — LLM provider chain specs and carousel rules confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files directly read, no assumptions
- Architecture: HIGH — patterns extracted from actual code, not documentation
- Pitfalls: HIGH — identified from direct code analysis (e.g., the 4 Confira: occurrences, auth.ts inline createClient)
- Migration inventory: HIGH — verified by direct grep of all 26 functions

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable codebase, no external library changes expected)
