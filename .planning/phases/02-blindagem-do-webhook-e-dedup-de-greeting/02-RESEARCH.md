# Phase 2: Blindagem do Webhook e Dedup de Greeting — Research

**Researched:** 2026-03-29
**Domain:** Supabase Edge Functions — RPC error handling, atomic greeting deduplication fallback
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Área 2 — Retry de transcrição de áudio**
- D-01: Usar `job_queue` como mecanismo primário (não fallback). O webhook insere um job em vez de chamar `transcribe-audio` diretamente.
- D-02: `process-jobs` executa o job chamando `transcribe-audio` via HTTP (que já tem internamente Gemini → Groq chain).
- D-03: `max_retries = 1` para jobs de transcrição. Se falhar na 1ª tentativa, process-jobs tenta 1 vez mais.
- D-04: Se todas as tentativas falharem, job marcado como `failed` — apenas log, sem fallback adicional.
- D-05: Tipo do job: `transcribe_audio`. Payload: `{ messageId, audioUrl, mimeType, conversationId }`.

**Área 3 — Contador atômico de mensagens**
- D-06: Adicionar coluna `lead_msg_count INTEGER NOT NULL DEFAULT 0` na tabela `conversations` via nova migration.
- D-07: Operação atômica: `UPDATE conversations SET lead_msg_count = lead_msg_count + 1 RETURNING lead_msg_count`.
- D-08: Resetar `lead_msg_count = 0` quando "clear context" é acionado (ação `ia_cleared`).
- D-09: Check de limite continua usando `agent.max_lead_messages || 8`. Tag `ia_cleared:TIMESTAMP` substituída pelo reset direto.

**Tarefas de refatoração**
- D-10: Mover `mergeTags()` de `ai-agent/index.ts:164` para `_shared/agentHelpers.ts`. Atualizar 5 usos.
- D-11: `unauthorizedResponse()` já existe em `_shared/auth.ts:81`. Atualizar `whatsapp-webhook/index.ts:95` e `ai-agent/index.ts:190`.

### Claude's Discretion

**Área 1 — Fallback do greeting dedup**
Abordagem conservadora indicada na CONTEXT:
- Se `try_insert_greeting` lançar erro (DB error, timeout): **pular greeting silenciosamente** (log + return early).
- Evita duplicatas em cenários de falha. Lead perde o greeting em caso de erro de DB, o que é preferível a receber greeting duplicado.

### Deferred Ideas (OUT OF SCOPE)

None — discussão se manteve dentro do escopo da fase.
</user_constraints>

---

## Summary

Phase 2 addresses five hardening tasks in the AI Agent / Webhook layer. This research focuses specifically on **Task 1: greeting dedup fallback** — the single area left to Claude's discretion in CONTEXT.md.

The current implementation calls the `try_insert_greeting` RPC and destructures only `data`, silently ignoring the `error` field. When the RPC fails (DB error, timeout, connection drop, advisory lock contention at DB level), `greetResult` is `null`. The condition `!greetResult?.inserted` evaluates to `true`, which causes the code to **treat an RPC failure identically to a detected duplicate**, returning `greeting_duplicate` — and the greeting is silently skipped. This is actually the desired conservative behavior, but it is happening accidentally rather than intentionally, and the caller has no visibility into whether the skip was a legitimate duplicate or a fault.

The fix is minimal: destructure `error` alongside `data`, log separately when an error occurs, and keep the same skip-on-failure behavior — but with an explicit log message distinguishing the two cases. This makes the fallback intentional and observable.

**Primary recommendation:** Add explicit `error` destructuring at line 695. Log a warning when error is non-null before the `!greetResult?.inserted` guard. No behavior change — same safe skip-on-failure outcome, but now auditable.

---

## Standard Stack

No new libraries required for this phase. All patterns use existing infrastructure:

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Supabase JS client | @2 (esm.sh) | RPC calls, DB queries | Already imported |
| Deno runtime | (platform) | Edge function host | Already in use |
| `_shared/logger.ts` | (project) | Structured JSON logs | Already imported in ai-agent |
| `_shared/auth.ts` | (project) | `unauthorizedResponse()` | Already exists, not yet imported |
| `_shared/agentHelpers.ts` | (project) | Destination for `mergeTags()` | Already exists |

**No npm install needed.**

---

## Architecture Patterns

### Pattern 1: RPC with Full Error Destructuring (Debounce Model)

The canonical pattern in this codebase is to destructure both `data` and `error` from RPC calls and branch on error explicitly. The debounce function demonstrates this cleanly:

```typescript
// Source: supabase/functions/ai-agent-debounce/index.ts:115-128
const { data: queueData, error: queueError } = await supabase
  .rpc('append_ai_debounce_message', { ... })
  .single()

let queued = queueData as DebounceQueueRow | null
if (queueError) {
  console.warn('[debounce] append_ai_debounce_message unavailable, falling back to legacy queue flow:', queueError.message)
  queued = await legacyQueueMessage(...)
}
```

The greeting dedup call does NOT follow this pattern — it discards the error silently:

```typescript
// Source: supabase/functions/ai-agent/index.ts:695-701 (CURRENT — BROKEN)
const { data: greetResult } = await supabase   // ← error is discarded
  .rpc('try_insert_greeting', { ... })
  .single()

if (!greetResult?.inserted) {   // ← true for BOTH duplicate AND rpc failure
  console.log('[ai-agent] Greeting duplicate detected (atomic lock) — skipping')
  return ...
}
```

### Pattern 2: Skip-on-Failure (Conservative Fallback)

The conservative decision in CONTEXT.md (skip greeting when RPC fails) aligns with the shadow mode error handling pattern:

```typescript
// Source: supabase/functions/ai-agent/index.ts:636-639
} catch (shadowErr) {
  // Circuit breaker already tracked the failure in callLLM — just log and continue
  console.warn('[ai-agent] Shadow mode LLM failed:', (shadowErr as Error).message)
}
```

Shadow mode: fail quietly, log, continue. Same principle applies to greeting dedup fallback.

### Corrected Greeting Dedup Pattern

```typescript
// Target pattern for ai-agent/index.ts greeting block
const { data: greetResult, error: greetError } = await supabase
  .rpc('try_insert_greeting', {
    p_conversation_id: conversation_id,
    p_content: greetingText,
    p_external_id: `ai_greeting_${Date.now()}`,
  })
  .single()

if (greetError) {
  console.warn('[ai-agent] try_insert_greeting RPC failed — skipping greeting to avoid duplicate:', greetError.message)
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_rpc_error' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

if (!greetResult?.inserted) {
  console.log('[ai-agent] Greeting duplicate detected (advisory lock) — skipping')
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_duplicate' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

Key differences from current code:
1. `error` is now destructured (was silently dropped)
2. Two distinct log messages — one for RPC failure, one for legitimate duplicate
3. Two distinct `reason` values in the response body — `greeting_rpc_error` vs `greeting_duplicate`
4. Behavior on failure: **unchanged** — still skips safely

### Anti-Patterns to Avoid

- **Retry on greeting RPC failure:** If RPC fails due to DB overload, retrying will likely fail again and delay the main LLM response. The cost of a missed greeting is lower than cascading DB pressure. Do not retry.
- **In-memory dedup as fallback:** Edge function invocations are stateless — an in-memory Map does not survive across concurrent requests (different isolates). This would not prevent duplicates.
- **Sending greeting anyway on RPC failure:** Violates the dedup guarantee. Two concurrent ai-agent calls would both send the greeting since neither RPC locked the row.
- **Throwing/re-throwing on RPC error:** Would cause the entire ai-agent invocation to return 500, which would trigger debounce retry — causing the greeting dedup problem again on retry.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Greeting deduplication | Custom lock logic | Existing `try_insert_greeting` RPC | Already uses `pg_advisory_xact_lock` — correct and deployed |
| Error logging | Custom logger | Existing `createLogger` from `_shared/logger.ts` | Already imported in ai-agent, structured JSON format |
| 401 responses | Inline `new Response(JSON.stringify({error:'Unauthorized'}),...)` | `unauthorizedResponse()` from `_shared/auth.ts:81` | Already exists, used by D-11 |

**Key insight:** The entire greeting dedup infrastructure already exists and is correct. The only gap is the missing `error` destructuring in the caller. This is a 3-line change, not a new mechanism.

---

## Existing RPC: `try_insert_greeting` — Full Analysis

**Location:** `supabase/migrations/20260328120000_audit_security_fixes.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION try_insert_greeting(
  p_conversation_id UUID,
  p_content TEXT,
  p_external_id TEXT DEFAULT NULL
) RETURNS TABLE(inserted BOOLEAN, message_id UUID)
```

**Internal logic:**
1. Acquires `pg_advisory_xact_lock(hashtext(p_conversation_id::text))` — transaction-scoped, blocks concurrent calls for same conversation
2. Checks if any `outgoing` message exists in last 30 seconds for the conversation
3. If duplicate found: returns `(FALSE, NULL)`
4. If no duplicate: inserts message, returns `(TRUE, <new_uuid>)`

**Return paths (normal execution):**
| Scenario | `inserted` | `message_id` | Client side |
|----------|-----------|-------------|-------------|
| No duplicate — inserted | `TRUE` | UUID | Proceed to send |
| Duplicate detected | `FALSE` | `NULL` | Skip greeting |

**Failure modes (abnormal execution):**
| Failure Mode | What the Supabase client returns | Current code behavior | Correct behavior |
|-------------|----------------------------------|----------------------|-----------------|
| DB connection error | `{ data: null, error: {...} }` | Treats as duplicate (skips) | Log warning + skip (same outcome, intentional) |
| RPC function not found (PGRST202) | `{ data: null, error: {...} }` | Treats as duplicate (skips) | Log error + skip (same outcome, intentional) |
| `pg_advisory_xact_lock` deadlock timeout | `{ data: null, error: {...} }` | Treats as duplicate (skips) | Log warning + skip (same outcome, intentional) |
| Row insert fails (UNIQUE violation on external_id) | `{ data: null, error: {...} }` | Treats as duplicate (skips) | Log warning + skip (same outcome, intentional) |
| `.single()` on empty result set | `{ data: null, error: PGRST116 }` | Treats as duplicate (skips) | Note: RPC always returns 1 row, this should not occur |

**Conclusion:** In all failure modes, skipping is the safe behavior. The fix is purely about making the skip *intentional and logged* rather than *accidental and invisible*.

---

## Common Pitfalls

### Pitfall 1: Confusing `.single()` error semantics with RPC failure

**What goes wrong:** The Supabase JS client's `.single()` modifier returns `{ data: null, error: PGRST116 }` when the query returns 0 rows. However, `try_insert_greeting` always returns exactly 1 row (either `(TRUE, uuid)` or `(FALSE, NULL)`). So `PGRST116` from `.single()` would only appear if the RPC itself fails before returning rows.

**Why it happens:** Developers conflate "no rows" with "RPC error" when using `.single()`.

**How to avoid:** The fix does not change `.single()`. The RPC contract guarantees 1 row, so the `.single()` modifier is correct and should stay.

### Pitfall 2: Changing the reason string breaks downstream observers

**What goes wrong:** If logging or monitoring systems (e.g., `ai_agent_logs`) are filtered by `reason: 'greeting_duplicate'`, changing the reason string to something else for the RPC-failure case would cause those logs to be miscounted.

**How to avoid:** Use a new, distinct reason value for the RPC failure case (`greeting_rpc_error`). Do not rename the existing `greeting_duplicate` reason.

### Pitfall 3: Adding retry logic creates the duplicate problem it tried to solve

**What goes wrong:** If the developer adds a retry on RPC failure (e.g., 1 attempt after 500ms), concurrent requests could both fail on the RPC, both retry, one succeeds first, the second then also succeeds before the 30s window — sending duplicate greetings.

**How to avoid:** No retry on greeting RPC failure. Confirmed by CONTEXT.md conservative approach.

### Pitfall 4: The `error` field is type `PostgrestError | null` not a thrown exception

**What goes wrong:** Developer wraps the RPC call in `try/catch` and expects exceptions, but the Supabase JS client returns errors in the result object, not as thrown exceptions.

**How to avoid:** Use destructuring `{ data, error }` pattern. The RPC call itself will not throw — errors come through the `error` field.

---

## Code Examples

### Current (broken) call site — `ai-agent/index.ts:695`

```typescript
// Source: supabase/functions/ai-agent/index.ts:695-708
// PROBLEM: error field discarded — RPC failure is indistinguishable from detected duplicate
const { data: greetResult } = await supabase
  .rpc('try_insert_greeting', {
    p_conversation_id: conversation_id,
    p_content: greetingText,
    p_external_id: `ai_greeting_${Date.now()}`,
  })
  .single()

if (!greetResult?.inserted) {
  console.log('[ai-agent] Greeting duplicate detected (atomic lock) — skipping')
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_duplicate' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

### Fixed call site (target)

```typescript
// TARGET: error destructured, two distinct log/reason paths
const { data: greetResult, error: greetError } = await supabase
  .rpc('try_insert_greeting', {
    p_conversation_id: conversation_id,
    p_content: greetingText,
    p_external_id: `ai_greeting_${Date.now()}`,
  })
  .single()

if (greetError) {
  console.warn('[ai-agent] try_insert_greeting RPC failed — skipping greeting to avoid duplicate:', greetError.message)
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_rpc_error' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

if (!greetResult?.inserted) {
  console.log('[ai-agent] Greeting duplicate detected (advisory lock) — skipping')
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'greeting_duplicate' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const savedMsgId = greetResult.message_id  // unchanged — only reached when inserted=true
```

### Canonical fallback model in the codebase (debounce)

```typescript
// Source: supabase/functions/ai-agent-debounce/index.ts:115-129
const { data: queueData, error: queueError } = await supabase
  .rpc('append_ai_debounce_message', { ... })
  .single()

let queued = queueData as DebounceQueueRow | null
if (queueError) {
  console.warn('[debounce] append_ai_debounce_message unavailable, falling back to legacy queue flow:', queueError.message)
  queued = await legacyQueueMessage(...)
}
```

Note: the debounce uses an active fallback (in-memory merge). For greeting dedup, the "fallback" is simply to skip — no alternative execution path needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Direct greeting send (no dedup) | `try_insert_greeting` advisory lock RPC | Migration 20260328120000 | Eliminates concurrent duplicate greetings |
| `error` field discarded | `error` field checked explicitly (after this phase) | Phase 2 | Makes RPC failure observable and intentional |

**Deprecated/outdated:**
- Inline `new Response(JSON.stringify({ error: 'Unauthorized' }), ...)` at `ai-agent/index.ts:190` and `whatsapp-webhook/index.ts:95`: replaced by `unauthorizedResponse()` import from `_shared/auth.ts` (D-11).

---

## Open Questions

1. **Should `greeting_rpc_error` be logged to `ai_agent_logs` table?**
   - What we know: The table exists and other events are logged there (e.g., `greeting_sent`, `shadow_extraction`)
   - What's unclear: Whether an ops team reviews `ai_agent_logs` for error rates, or if console logs suffice
   - Recommendation: Log to console only (matching the shadow mode error handling pattern). Adding a DB log insert when DB is already failing risks cascading error. The planner can decide if an `ai_agent_logs` insert is desired.

2. **Does the `log` variable (createLogger) exist at the greeting block scope?**
   - What we know: `const log = createLogger('ai-agent', request_id || ...)` is at line 197, inside the main request handler — same scope as the greeting block at line 693
   - What's unclear: Whether the planner prefers `log.warn(...)` (structured) or `console.warn(...)` (inline) for the new error path
   - Recommendation: Use `log.warn(...)` to be consistent with the structured logging pattern established in Phase 1.

---

## Environment Availability

Step 2.6: SKIPPED — this phase contains no new external dependencies. All changes are code edits to existing edge functions and a new migration on an already-deployed Supabase project.

---

## Validation Architecture

Config has no `workflow.nyquist_validation` key — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| Task 1 | `greetError` non-null → skip with `greeting_rpc_error` reason | unit | `npx vitest run src/pages/dashboard/__tests__/ --reporter=verbose` | ❌ Wave 0 |
| Task 1 | `greetResult.inserted=false` → skip with `greeting_duplicate` reason (unchanged) | unit | same | ❌ Wave 0 |
| Task 1 | `greetResult.inserted=true` → proceed to send (unchanged) | unit | same | ❌ Wave 0 |

Note: greeting dedup logic is in `ai-agent/index.ts` (Deno Edge Function). Unit tests for Deno functions use the existing `vitest.config.ts` pattern established in Phase 1 (covers `supabase/functions/_shared/`). The greeting block is harder to unit test directly without extracting it to a shared helper — the planner may choose to test the RPC error handling path via integration test or via a pure helper extraction. This is a planner decision.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No new test files strictly required for the 3-line greeting fix — existing pattern is observable via console logs
- [ ] If planner wants test coverage: extract greeting RPC error handling into a testable pure function in `_shared/agentHelpers.ts` and add test file `supabase/functions/_shared/__tests__/greetingDedup.test.ts`

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` relevant to this phase:

| Directive | Applies To |
|-----------|-----------|
| `status_ia` constants: use `STATUS_IA.LIGADA/DESLIGADA/SHADOW` from `_shared/constants.ts` — NEVER use magic strings | Any status_ia update in this phase |
| Instance tokens resolved server-side, never exposed to frontend | N/A (backend-only phase) |
| Debounce: atomic UPDATE WHERE processed=false eliminates race condition | Already implemented, not changing |
| Webhook: parallel I/O (media+dedup+contact via Promise.all) | Maintain when modifying whatsapp-webhook |
| `unauthorizedResponse()` should be used (DT-11 / D-11 decision) | ai-agent:190, whatsapp-webhook:95 |
| Greeting: save-first lock prevents duplicates, TTS when voice active | Do not alter TTS or save-first logic — only add error branch |
| Edge function verify_jwt: ai-agent has `verify_jwt=false` (called by debounce) | Do not change config |
| LLM Fallback Chain: Groq → Gemini → Mistral | Not touched by this phase |

---

## Sources

### Primary (HIGH confidence)

- `supabase/functions/ai-agent/index.ts:695-710` — Current greeting dedup call site (read directly)
- `supabase/migrations/20260328120000_audit_security_fixes.sql:7-37` — `try_insert_greeting` RPC full implementation (read directly)
- `supabase/functions/ai-agent-debounce/index.ts:115-129` — Canonical RPC error handling pattern with fallback (read directly)
- `supabase/functions/_shared/auth.ts:80-86` — `unauthorizedResponse()` existing helper (read directly)
- `supabase/functions/_shared/agentHelpers.ts` — Current shared helpers, destination for `mergeTags()` (read directly)
- `.planning/phases/02-blindagem-do-webhook-e-dedup-de-greeting/02-CONTEXT.md` — Locked decisions and scope (read directly)
- `.planning/STATE.md` — DT-03 (Fallback de Greeting Dedup Ausente) confirmed as critical debt (read directly)

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — Project constraints and patterns (read directly, authoritative for this codebase)
- `.planning/REQUIREMENTS.md:1.2` — Greeting dedup rule: `RPC try_insert_greeting (advisory lock atômico)` (read directly)

---

## Metadata

**Confidence breakdown:**
- Task 1 (greeting fallback): HIGH — root cause confirmed by direct code inspection; fix is a 3-line change with canonical model in same codebase
- Task 2 (job_queue transcription): HIGH — decisions fully locked in CONTEXT.md; job_queue infrastructure confirmed working in STATE.md
- Task 3 (atomic counter): HIGH — decision locked (D-06 to D-09); column addition + atomic update is a standard pattern
- Task 4 (mergeTags migration): HIGH — source location confirmed (ai-agent:164), 5 usages confirmed by grep, destination confirmed (_shared/agentHelpers.ts)
- Task 5 (error response standardization): HIGH — `unauthorizedResponse()` confirmed at `_shared/auth.ts:81`; two call sites confirmed at ai-agent:190 and whatsapp-webhook:95

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable domain — edge function patterns do not change frequently)
