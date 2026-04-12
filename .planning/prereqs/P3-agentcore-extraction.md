# P3: agentCore.ts Extraction — Technical Analysis

**Analyzed:** 2026-04-04
**Files analyzed:**
- `supabase/functions/ai-agent/index.ts` — 2458 lines (production)
- `supabase/functions/ai-agent-playground/index.ts` — 373 lines (testing)
- `supabase/functions/_shared/agentHelpers.ts` — 227 lines (shared)
- `supabase/functions/_shared/llmProvider.ts` — 307 lines (shared)
- `supabase/functions/_shared/aiRuntime.ts` — 122 lines (shared)

---

## 1. What Is Already Shared

The `_shared/` directory already contains significant extracted logic:

| Module | What It Provides | Used by Both? |
|--------|-----------------|---------------|
| `agentHelpers.ts` | `buildBusinessInfoSection`, `buildKnowledgeInstruction`, `buildExtractionInstruction`, `buildSubAgentInstruction`, `buildGeminiContents`, `isJustGreeting`, `resolveGreetingText`, `validateSetTags`, `validateLeadProfileUpdate`, `normalizeCarouselProductIds`, `escapeLike`, `mergeTags` | YES — playground imports most of these |
| `llmProvider.ts` | `callLLM`, `appendToolResults`, `LLMMessage`, `LLMToolDef` types | YES — both import directly |
| `validatorAgent.ts` | `validateResponse`, `countMsgsSinceNameUse`, `ValidatorConfig` | Production only |
| `ttsProviders.ts` | `ttsWithFallback`, `splitAudioAndText` | Production only |
| `carousel.ts` | `generateCarouselCopies`, `cleanProductTitle` | Production only |
| `circuitBreaker.ts` | `geminiBreaker`, `groqBreaker`, `mistralBreaker`, `uazapiBreaker` | Production only |
| `aiRuntime.ts` | Follow-up logic, queue state, webhook trigger helpers | Neither agent directly (used by debounce/webhook) |

---

## 2. What Is Duplicated (With Line Numbers)

### 2.1 Tool Definitions Array

Both files define the same 8 tools (`search_products`, `send_carousel`, `send_media`, `assign_label`, `set_tags`, `move_kanban`, `update_lead_profile`, `handoff_to_human`) as `LLMToolDef[]` arrays.

**Production** (`ai-agent/index.ts` lines 942–1012): verbose descriptions, includes `availableLabelNames` injected into `assign_label` description dynamically.

**Playground** (`ai-agent-playground/index.ts` lines 213–230): identical structure, same 8 tools, same parameter schemas. Descriptions are slightly shorter. Also injects `availableLabelNames` into `assign_label`. Filtered by `disabledTools` override.

**Divergence risk:** If a tool parameter is added for M2 (e.g., an `approval_required` flag), it must be updated in both files. This already happened — the description for `search_products` differs between files (production says "envia carrossel AUTOMATICAMENTE — NÃO chame send_carousel depois"; playground omits this instruction).

**Extractable as:** `buildToolDefinitions(availableLabelNames: string[], disabledTools?: string[]): LLMToolDef[]`

### 2.2 System Prompt Construction

**Production** (`ai-agent/index.ts` lines 781–886): Uses `prompt_sections` JSONB from DB, `replaceVars()` template expansion, builds 9 named sections, assembles final prompt by joining with `\n\n`. Includes `hardcodedRules` block (lines 847–864), `dynamicContext` block (lines 834–844), and `leadContextBlock` (lines 831–832).

**Playground** (`ai-agent-playground/index.ts` lines 80–179): Is a **hardcoded older version** of the system prompt. It does NOT use `prompt_sections`. It duplicates much of the same logic in a flat string (SDR flow, tags rules, tool send rules, objections detection) but the text diverged when production switched to Prompt Studio / `prompt_sections`.

**Key finding:** The playground system prompt is ALREADY diverged from production. The playground does NOT use `buildBusinessInfoSection` from `agentHelpers.ts` for its business section — it calls the function correctly at line 87, but then the surrounding boilerplate text around it differs from production. The production `hardcodedRules` block (40+ lines, lines 847–864) does NOT exist at all in the playground prompt.

**Extractable as:** `buildSystemPrompt(agent, context: SystemPromptContext): string` — but this is the highest-risk extraction because the playground currently intentionally has a simplified prompt (no Prompt Studio, no hardcoded rules block).

### 2.3 LLM Call Loop

**Production** (`ai-agent/index.ts` lines 1959–2212): While-loop up to 5 attempts (`maxAttempts=5`), `MAX_TOOL_ROUNDS=3`, token ceiling safety (8192), backoff on error (1500ms * 2^attempt), parallel vs sequential tool execution logic (lines 2002–2019), pending-questions injection (lines 2026–2035), follow-up call for pending questions (lines 2076–2093), handoff loop-break (line 2021), final text-only forced call (lines 2043–2068), validator integration, hardcoded question guard.

**Playground** (`ai-agent-playground/index.ts` lines 316–341): Simple while-loop up to 5 attempts. NO backoff. NO token ceiling. NO pending-questions injection. NO parallel tool dispatch. NO validator. Pure sequential: call LLM → if tools, execute all sequentially → append → continue; else break.

**Verdict:** The loops share the same conceptual structure (callLLM → toolCalls → appendToolResults → repeat) but production has 8+ additional behaviors that playground intentionally omits. **Not cleanly extractable** without introducing a hook/callback system.

### 2.4 `search_products` Tool Implementation

**Production** (`ai-agent/index.ts` lines 1073–1535): ~460 lines. Full pipeline: ILIKE exact phrase → word-by-word AND fallback → fuzzy pg_trgm fallback → post-search AND filter → brand detection → enrichment flow (paths A/B/C) → auto-send carousel/media via UAZAPI → broadcastEvent.

**Playground** (`ai-agent-playground/index.ts` lines 235–251): ~17 lines. Direct ILIKE query only. No fallbacks. No enrichment. No auto-send. Returns text list.

**Verdict:** Fundamentally different implementations for the same tool. Production sends to WhatsApp; playground simulates. No common extraction candidate.

### 2.5 `set_tags` Tool Implementation

**Production** (`ai-agent/index.ts` lines 1672–1717): Validates tag keys against `VALID_KEYS`, `VALID_MOTIVOS`, `VALID_OBJECOES` sets, then uses atomic `merge_conversation_tags` RPC with in-memory fallback, updates `conversation.tags` local reference.

**Playground** (`ai-agent-playground/index.ts` lines 275–276): Calls `validateSetTags()` from `agentHelpers.ts` — validation only, no DB write.

**Verdict:** The validation sets (`VALID_KEYS`, `VALID_MOTIVOS`, `VALID_OBJECOES`) in production are NOT exported to `agentHelpers.ts`. They could be extracted as constants. The full `set_tags` implementation cannot be shared because production writes to DB; playground only validates.

**Partially extractable:** Export `VALID_TAG_KEYS`, `VALID_MOTIVOS`, `VALID_OBJECOES` as constants to `agentHelpers.ts` so both files use the same taxonomy. Currently the playground's `validateSetTags()` does NOT validate against these sets (only checks for `:`), creating a silent taxonomy divergence.

### 2.6 `handoff_to_human` Tool Implementation

**Production** (`ai-agent/index.ts` lines 1830–1915): Chooses handoff message based on business hours, sends empathy if negative reason, sends via UAZAPI, sets SHADOW status, auto-assigns "Atendimento Humano" label, builds qualification chain, logs, broadcasts, persists chain to lead_profiles.

**Playground** (`ai-agent-playground/index.ts` lines 290–292): Returns mock string `[HANDOFF] Conversa transferida...`. No side effects.

**Verdict:** Architecturally incompatible — production requires UAZAPI context, playground mocks it.

### 2.7 `move_kanban` Tool Implementation

**Production** (`ai-agent/index.ts` lines 1720–1783): Full DB read+write — finds board by `instance_id`, finds column, finds or auto-creates card by `contact_id`, updates `column_id`, logs.

**Playground** (`ai-agent-playground/index.ts` lines 278–285): Read-only — validates board and column exist, returns confirmation string, no card creation/move.

**Verdict:** Shared validation logic (find board by `instance_id`, find column by name) could be extracted, but write operations diverge by design.

### 2.8 Message Count Variable: `activeSubAgents`

**Bug found:** Line 2353 in production references `activeSubAgents.length` but `activeSubAgents` is never defined in the file. This is a latent TypeScript error (Deno may coerce it as `undefined.length` → runtime crash). This needs fixing regardless of extraction work.

---

## 3. Proposed `agentCore.ts` Interface (If Extracted)

```typescript
// supabase/functions/_shared/agentCore.ts

// ── Tool taxonomy constants (currently duplicated / incomplete in playground) ──
export const VALID_TAG_KEYS = new Set([
  'motivo', 'interesse', 'produto', 'objecao', 'sentimento', 'cidade', 'nome',
  'search_fail', 'ia', 'ia_cleared', 'servico', 'agendamento', 'marca_indisponivel',
  'acabamento', 'marca_preferida', 'quantidade', 'area', 'aplicacao',
  'enrich_count', 'qualificacao_completa',
])
export const VALID_MOTIVOS = new Set([
  'saudacao', 'compra', 'troca', 'orcamento', 'duvida_tecnica',
  'suporte', 'financeiro', 'emprego', 'fornecedor', 'informacao', 'fora_escopo',
])
export const VALID_OBJECOES = new Set([
  'preco', 'concorrente', 'prazo', 'indecisao', 'qualidade', 'confianca', 'necessidade', 'outro',
])

// ── Tool definitions builder ──
export interface ToolDefsOptions {
  availableLabelNames: string[]
  disabledTools?: string[]
}
export function buildToolDefinitions(opts: ToolDefsOptions): LLMToolDef[]

// ── System prompt builder context ──
export interface SystemPromptContext {
  agent: AgentRow
  isReturningLead: boolean
  leadName: string | null
  leadContext: string           // built from lead_profiles
  campaignContext: string       // built from utm_campaigns
  leadMsgCount: number
  maxLeadMessages: number
  availableLabelNames: string[]
  currentLabelNames: string[]
  knowledgeInstruction: string  // from buildKnowledgeInstruction()
  extractionInstruction: string // from buildExtractionInstruction()
  subAgentInstruction: string   // from buildSubAgentInstruction()
}
export function buildSystemPrompt(ctx: SystemPromptContext): string

// ── LLM loop hook interface (for M2 approval callbacks) ──
export interface LoopHooks {
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<void>
  onToolResult?: (name: string, result: string) => Promise<void>
  onResponse?: (text: string) => Promise<void>
}
```

Note: the `buildSystemPrompt()` export makes the most sense for reducing divergence, but it requires the playground to adopt `prompt_sections` — which is a behavioral change, not just refactoring.

---

## 4. Extraction Scope Recommendation

### Option A: FULL Extraction
Extract tool definitions, system prompt builder, and LLM loop into `agentCore.ts`.

**Problems:**
- The LLM loops are architecturally different (production has 8+ behaviors playground intentionally lacks)
- System prompt requires playground to adopt `prompt_sections` — behavioral change
- Tool executors are fundamentally different (real vs mock) — cannot share
- Estimated effort: 3–5 days of careful refactoring + re-testing all E2E scenarios

**NOT recommended** for this phase.

### Option B: MINIMAL Extraction (Recommended)
Extract only what is clearly safe and has immediate divergence risk:

1. **Export tag taxonomy constants** to `agentHelpers.ts`: `VALID_TAG_KEYS`, `VALID_MOTIVOS`, `VALID_OBJECOES` (currently production-only; playground's `validateSetTags` does not enforce them, creating silent bugs)
2. **Export `buildToolDefinitions()`** to `agentHelpers.ts`: both files build identical parameter schemas; the only dynamic part (`availableLabelNames`) is already a parameter at call sites
3. **Fix the `activeSubAgents` bug** in production (line 2353 — undefined variable reference)
4. **Update playground's `validateSetTags`** to use the exported taxonomy constants

**Effort:** 2–4 hours. ~60 lines move to `agentHelpers.ts`. Both call sites update their imports. Low blast radius.

### Option C: DEFER
Do nothing now. Accept divergence risk.

**Problems:**
- M2 will add approval hooks and scoring callbacks. The LLM loop is the primary place these hooks go. If both loops are independent, M2 must implement the hooks twice.
- The tool definitions array will need a new `approval_required` parameter for M2 — without shared definitions, it must be added in two places.
- The `hardcodedRules` block is the most dangerous area: if a safety rule is added to production's system prompt, the playground will silently not test it.

**NOT recommended** — divergence will compound.

---

## 5. Risk Assessment

| Extraction Target | Risk | Rationale |
|-------------------|------|-----------|
| Tag taxonomy constants | LOW | Pure constant export, no logic change |
| `buildToolDefinitions()` | LOW | Parameter schemas are stable; only `availableLabelNames` is dynamic |
| `buildSystemPrompt()` | MEDIUM | Requires playground to adopt `prompt_sections`; behavioral change, needs E2E testing |
| LLM call loop | HIGH | Production loop has 8 behaviors playground intentionally omits; a hook-based abstraction would need careful design to not break prod behavior |
| Tool executors | HIGH | Real vs mock split is by design; sharing would require an interface + two implementations (DI pattern) |

**Overall extraction risk for Option B (Minimal):** LOW

---

## 6. Step-by-Step Extraction Plan (Option B — Minimal)

### Step 1: Fix `activeSubAgents` bug in production (ai-agent/index.ts line 2353)
The variable `activeSubAgents` is referenced but never defined. It should be `activeSub` (the variable set at line 766). This is a latent crash risk.

**Fix:** Change line 2353 from:
```typescript
sub_agent: activeSubAgents.length > 0 ? 'multi' : 'orchestrator',
```
to:
```typescript
sub_agent: activeSub ? activeMode : 'orchestrator',
```

### Step 2: Export tag taxonomy constants from `agentHelpers.ts`

Add to `agentHelpers.ts`:
```typescript
export const VALID_TAG_KEYS = new Set([...])
export const VALID_MOTIVOS = new Set([...])
export const VALID_OBJECOES = new Set([...])
```

Update `ai-agent/index.ts` `set_tags` case to import these constants instead of declaring them inline.

Update `validateSetTags()` in `agentHelpers.ts` to use `VALID_TAG_KEYS` and `VALID_MOTIVOS` for validation (currently only checks for `:` presence).

### Step 3: Export `buildToolDefinitions()` from `agentHelpers.ts`

```typescript
export function buildToolDefinitions(
  availableLabelNames: string[],
  disabledTools: string[] = [],
): LLMToolDef[]
```

- Move the 8-tool array from production into this function
- Production call site: `const toolDefs = buildToolDefinitions(availableLabelNames)`
- Playground call site: `const toolDefs = buildToolDefinitions(availableLabelNames, overrides?.disabled_tools || [])`

This ensures if M2 adds a tool or changes a parameter schema, it is done once.

### Step 4: Update playground's tool descriptions to match production

When building the shared function, reconcile the description differences (production has more precise instructions than playground). Use production descriptions as canonical.

### Step 5: Verify tests pass

Run existing tests against `agentHelpers.ts` — the file already has `agentHelpers.test.ts`. Add tests for:
- `VALID_TAG_KEYS` export shape
- `validateSetTags` rejecting invalid keys/motivos
- `buildToolDefinitions` returns correct count and names

---

## 7. M2 Prerequisite Assessment

**Is this extraction a hard prerequisite for M2 (approval hooks, scoring callbacks)?**

**Answer: NO — but Option B is strongly recommended BEFORE M2 work begins.**

Rationale:
- M2's approval hooks go into the LLM loop, not the tool definitions. The loop cannot be safely shared yet (see risk table above).
- M2's scoring callbacks need to be wired into the tool execution path. Both agents need them, but they can be added to each independently for M2 if extraction is deferred.
- However, if M2 adds a new tool (e.g., `request_approval`), and tool definitions are not yet shared, the tool must be added to both files — and the playground must mock it. This is low-risk but annoying.
- The `activeSubAgents` bug MUST be fixed before any M2 work because M2 will add to the logging section where the bug is.

**Recommended sequence:**
1. Do Option B (Minimal) extraction — 2–4 hours — before M2 sprint planning
2. Plan M2's hook interface once it is clear what events need to be observed (production only? both?)
3. If M2 requires hooks in both agents, design the hook interface in `agentCore.ts` at M2 planning time, not now

---

## 8. What the Playground Does NOT Test (Divergence Gaps)

These production behaviors have no playground coverage and will remain untested regardless of extraction:

| Production Behavior | Lines | Playground Coverage |
|--------------------|-------|---------------------|
| Business hours check | 210–267 | NONE |
| Handoff triggers (config-driven) | 288–397 | NONE |
| Lead message counter + auto-handoff | 406–429 | NONE |
| Shadow mode extraction | 512–606 | NONE |
| Greeting deduplication (RPC lock) | 633–710 | NONE (simulates inline) |
| Duplicate response guard (15s) | 713–735 | NONE |
| Enrichment flow (paths A/B/C) | 1197–1293 | NONE |
| Carousel/media auto-send | 1315–1494 | MOCKED |
| Validator agent | 2130–2195 | NONE |
| Hardcoded question guard | 2197–2209 | NONE |
| TTS send | 2269–2300 | NONE |
| Implicit handoff detection | 2236–2254 | NONE |
| Profile summary update | 2370–2407 | NONE |
| `hardcodedRules` system prompt block | 847–864 | NONE (playground uses different prompt) |

These gaps exist because playground intentionally mocks UAZAPI and has no real conversation context. Extraction does not close these gaps — only a real E2E test harness does.

---

## 9. Decision Summary

| Decision | Answer | Rationale |
|----------|--------|-----------|
| Extract to `agentCore.ts`? | NO (not yet) | Scope mismatch between agents makes full extraction high-risk |
| Minimal extraction to `agentHelpers.ts`? | YES — do before M2 | Tag taxonomy and tool definitions are safely extractable now |
| Fix `activeSubAgents` bug? | YES — immediately | Latent crash at line 2353, no test coverage |
| Update `validateSetTags` to enforce taxonomy? | YES — with step 2 | Silent drift risk; playground accepts tags production would reject |
| Is extraction a hard M2 prerequisite? | NO | M2 hooks can be added independently; minimal extraction reduces but does not eliminate dual-maintenance risk |
| Estimated effort (Option B)? | 2–4 hours | ~60 lines to move, 2 import sites to update, expand existing tests |
| Extraction risk? | LOW (Option B) | Constants + pure function; no behavioral changes to either runtime |
