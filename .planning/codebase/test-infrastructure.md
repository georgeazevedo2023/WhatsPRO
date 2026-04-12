# Test Infrastructure Analysis

**Analysis Date:** 2026-04-04

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`
- Environment: jsdom

**Run Commands:**
```bash
npm run test          # vitest run (single pass)
npm run test:watch    # vitest (watch mode)
```

**Setup File:** `src/test/setup.ts`
- Imports `@testing-library/jest-dom` for DOM matchers
- Mocks: `window.matchMedia`, `window.ResizeObserver`
- Minimal setup — no Supabase mocks, no fetch mocks, no global fixtures

## Test File Organization

**Location:** Co-located `__tests__/` directories next to source files

**Pattern:**
```
src/
  components/admin/ai-agent/__tests__/
    audit-fixes.test.ts
    returning-greeting.test.ts
  components/admin/__tests__/
    agentValidationSchemas.test.ts
  components/dashboard/__tests__/
    DashboardCharts.test.tsx
  hooks/__tests__/
    useDepartments.test.ts
    useInboxes.test.ts
    useInstances.test.ts
    useUserProfiles.test.ts
  pages/dashboard/__tests__/
    AdminGuards.test.tsx
    PlaygroundEdgeCases.test.ts
    PlaygroundGreeting.test.ts
    PlaygroundIntegration.test.ts
    PlaygroundMediaAudio.test.ts
    PlaygroundPrompt.test.ts
    PlaygroundScenarios.test.ts
    PlaygroundTools.test.ts
  test/
    example.test.ts
    setup.ts
```

**Include paths (vitest.config.ts):**
```typescript
include: [
  "src/**/*.{test,spec}.{ts,tsx}",
  "supabase/functions/_shared/**/*.{test,spec}.{ts,tsx}",
]
```

## Test File Count: ~17 files

### By Category

**Playground Tests (7 files):**
- `PlaygroundScenarios.test.ts` — computeResults PASS/FAIL logic (5 tests)
- `PlaygroundEdgeCases.test.ts` — computeScenarioResults + greeting edge cases (10 tests)
- `PlaygroundGreeting.test.ts` — greeting flow
- `PlaygroundIntegration.test.ts` — integration scenarios
- `PlaygroundMediaAudio.test.ts` — media/audio handling
- `PlaygroundPrompt.test.ts` — prompt generation
- `PlaygroundTools.test.ts` — tool execution

**AI Agent Tests (2 files):**
- `audit-fixes.test.ts` — debounce merge, handoff patterns, label escape, number validation, BrainConfig clamping (5 describe blocks, ~12 tests)
- `returning-greeting.test.ts` — greeting for returning leads

**Hook Tests (4 files):**
- `useDepartments.test.ts`, `useInboxes.test.ts`, `useInstances.test.ts`, `useUserProfiles.test.ts`

**Other (3 files):**
- `agentValidationSchemas.test.ts` — Zod schema tests
- `AdminGuards.test.tsx` — admin route guards
- `DashboardCharts.test.tsx` — chart components

## Test Patterns

### Import from Shared Edge Function Code
Tests import directly from Deno edge function shared modules:
```typescript
import { computeScenarioResults, isJustGreeting, buildPlaygroundResponse } from '../../../../supabase/functions/_shared/agentHelpers.ts'
import { buildLegacyQueueUpdate, createQueuedMessage } from '../../../../../supabase/functions/_shared/aiRuntime.ts'
```
This works because Vitest resolves `.ts` imports that Deno edge functions use. The shared code is pure TypeScript with no Deno-specific APIs.

### Message Factory Helper
```typescript
const mkMsg = (role: 'user' | 'assistant' | 'system', content: string, extras?: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(), role, content, timestamp: new Date(), ...extras,
});
```

### Tool Call Testing Pattern
```typescript
// System messages carry tool calls (same as production behavior)
mkMsg('system', '', { tool_calls: [{ name: 'search_products', args: {} }, { name: 'set_tags', args: {} }] })
```

### Scenario Expected Pattern
```typescript
const expected: ScenarioExpected = {
  tools_must_use: ['search_products', 'set_tags'],
  tools_must_not_use: [],
  should_handoff: false,
  should_block: false,
}
```

### Describe/It Structure
```typescript
describe('computeScenarioResults — PASS/FAIL logic', () => {
  it('1. PASS when all expected tools used', () => { ... })
  it('2. FAIL when expected tool missing', () => { ... })
})
```
Tests are numbered with comments for traceability.

## Mocking Patterns

### No Global Supabase Mock
There is no global Supabase client mock in setup.ts. Tests that need Supabase either:
1. Import pure functions that don't touch Supabase (most common pattern)
2. Use component-level mocking (for React component tests)

### No Fetch Mock
No global fetch interceptor. Edge function tests use real shared module logic (pure functions), not HTTP calls.

### Component Tests (React Testing Library)
Used for `AdminGuards.test.tsx` and `DashboardCharts.test.tsx` — standard `render()` + query pattern with `@testing-library/react`.

## Coverage

**Requirements:** None enforced (no coverage thresholds in vitest.config.ts)
**Coverage command:** Not configured (no `--coverage` script)

## E2E Testing (Non-Vitest)

The project has a separate E2E test layer that runs via Supabase Edge Functions, NOT via Vitest:

**Edge Function E2E:** `supabase/functions/e2e-test/index.ts`
- Sends real messages through actual ai-agent pipeline
- Results stored in `e2e_test_runs` table
- Triggered from Playground UI or via `e2e-scheduled` cron

**E2E Shell Script:** `supabase/functions/test_e2e_agent.sh`
- Exists but may be a manual test helper

## Coverage Gaps

### Critical Gaps
1. **No unit tests for validatorAgent.ts** — validator logic (scoring, parsing, rigor thresholds) has zero test coverage
2. **No unit tests for ai-agent/index.ts** — the main production edge function (greeting logic, handoff detection, tool execution, debounce handling) is untested at the unit level
3. **No mock for Supabase client** — prevents testing any component or function that queries the database
4. **No E2E result assertions** — E2E tests run via edge functions but Vitest doesn't validate their results

### Medium Gaps
5. **No tests for MetricsConfig or ValidatorMetrics components** — complex data aggregation with no coverage
6. **No tests for PlaygroundManualTab** — the most interactive component, untested
7. **No snapshot tests** — no visual regression protection
8. **No test for edgeFunctionFetch** — the HTTP client used by Playground

### Low Priority Gaps
9. **No performance benchmarks** — no tests for latency thresholds
10. **No test for e2e-scheduled** — the automated scheduler has no unit tests

## Recommendations for Agent QA Framework

1. **Add validatorAgent unit tests** — test buildValidatorPrompt(), parseValidatorResponse(), countMsgsSinceNameUse(), rigor threshold logic
2. **Create Supabase mock helper** — enable testing of components that query ai_agent_validations, e2e_test_runs
3. **Add E2E result validation tests** — import e2e-scheduled evaluation logic and test with fixtures
4. **Consider adding vitest coverage** — at minimum for `_shared/` modules

---

*Test infrastructure analysis: 2026-04-04*
