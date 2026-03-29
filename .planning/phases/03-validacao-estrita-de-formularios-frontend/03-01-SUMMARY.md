---
phase: 03-validacao-estrita-de-formularios-frontend
plan: 01
subsystem: frontend/admin
tags: [validation, zod, forms, inline-errors, ai-agent, settings]
dependency_graph:
  requires: []
  provides:
    - Zod validation schemas for AI Agent config panels
    - Inline error display for numeric/enum fields
    - Auto-save guard via fieldErrorsRef
    - Phone validation in Settings.tsx
  affects:
    - src/components/admin/AIAgentTab.tsx
    - src/components/admin/ai-agent/BrainConfig.tsx
    - src/components/admin/ai-agent/RulesConfig.tsx
    - src/components/admin/ai-agent/GuardrailsConfig.tsx
    - src/components/admin/ai-agent/VoiceConfig.tsx
    - src/components/admin/ai-agent/ExtractionConfig.tsx
    - src/components/admin/ai-agent/BlockedNumbersConfig.tsx
    - src/pages/dashboard/Settings.tsx
tech_stack:
  added:
    - zod (already installed, now used in frontend schemas)
  patterns:
    - Zod .partial() schemas for individual field updates
    - SCHEMA_MAP routing pattern (field set → schema)
    - fieldErrorsRef + updateFieldErrors for stale-closure-safe guard in auto-save
    - Local state validation (ExtractionConfig, BlockedNumbersConfig) vs prop-based (others)
key_files:
  created:
    - src/components/admin/ai-agent/validationSchemas.ts
    - src/components/admin/__tests__/agentValidationSchemas.test.ts
  modified:
    - src/components/admin/AIAgentTab.tsx
    - src/components/admin/ai-agent/BrainConfig.tsx
    - src/components/admin/ai-agent/RulesConfig.tsx
    - src/components/admin/ai-agent/GuardrailsConfig.tsx
    - src/components/admin/ai-agent/VoiceConfig.tsx
    - src/components/admin/ai-agent/ExtractionConfig.tsx
    - src/components/admin/ai-agent/BlockedNumbersConfig.tsx
    - src/pages/dashboard/Settings.tsx
decisions:
  - temperature schema uses max(1) — Slider physically limits to 1.0; D-07's 2.0 upper bound deferred
  - ExtractionConfig and BlockedNumbersConfig use local state (not fieldErrors prop) to avoid AIAgentTab coupling for array-item add operations
  - max_tokens Input no longer clamps via Math.min/max in onChange — Zod validation handles range feedback instead
  - BrainConfig model Input remains a Select with fixed options — enum validation in Zod guards against programmatic misuse only
metrics:
  duration_minutes: 15
  completed_date: "2026-03-29"
  tasks_completed: 5
  files_modified: 10
  tests_added: 15
---

# Phase 03 Plan 01: Strict Frontend Form Validation — Summary

**One-liner:** Zod schemas per AI Agent config panel + inline field errors + auto-save guard via fieldErrorsRef, resolving DT-06.

## What Was Built

Added strict Zod validation to all AI Agent config panels and Settings.tsx phone field.

**validationSchemas.ts** — 4 schemas exported:
- `brainSchema`: model (enum of 5 models), temperature (0-1), max_tokens (100-8192), all `.partial()`
- `rulesSchema`: handoff_cooldown_minutes (5-1440), max_lead_messages (1-50), all `.partial()`
- `guardrailsSchema`: max_discount_percent (0-100, nullable), `.partial()`
- `voiceSchema`: voice_max_text_length (10-500), `.partial()`
- `SCHEMA_MAP`: routes field keys to schemas for efficient lookup
- `BRAIN_FIELDS`, `RULES_FIELDS`, `GUARDRAILS_FIELDS`, `VOICE_FIELDS`: field-set routing

**AIAgentTab.tsx** — orchestration layer:
- `fieldErrors` state + `fieldErrorsRef` (stale-closure-safe guard)
- `updateFieldErrors` keeps ref in sync with state
- `handleChange` validates via SCHEMA_MAP before scheduling auto-save
- `doSave` guard: `if (Object.keys(fieldErrorsRef.current).length > 0) return`
- `max_lead_messages` added to `ALLOWED_FIELDS`
- `fieldErrors` prop passed to BrainConfig, RulesConfig, GuardrailsConfig, VoiceConfig

**4 Config Panels** — display-only consumers:
- BrainConfig: `{fieldErrors?.model && ...}`, `{fieldErrors?.temperature && ...}`, `{fieldErrors?.max_tokens && ...}`
- RulesConfig: `{fieldErrors?.handoff_cooldown_minutes && ...}` + new `max_lead_messages` field (default 8, range 1-50)
- GuardrailsConfig: `{fieldErrors?.max_discount_percent && ...}`
- VoiceConfig: `{fieldErrors?.voice_max_text_length && ...}`, `min={10}` (was `min={50}`)

**ExtractionConfig** — local validation:
- `keyError` state, cleared on each keystroke
- `addField()` validates key matches `^[a-z][a-z0-9_]*$` before proceeding

**BlockedNumbersConfig** — local validation:
- `numberError` state, cleared on each keystroke
- `addNumber()` validates phone matches `^\d{10,15}$` before proceeding

**Settings.tsx** — phone validation:
- `recipientError` state
- onChange validates `^\d{10,13}$`, sets error when non-empty + invalid
- Shows error `<p>` or helper text conditionally
- Save button disabled when `recipientError` present

## Tests

15 new unit tests in `agentValidationSchemas.test.ts` covering:
- brainSchema: 6 cases (valid, temperature>1, max_tokens<100, invalid model, partial, empty)
- rulesSchema: 3 cases (valid, cooldown<5, max_lead_messages>50)
- guardrailsSchema: 3 cases (valid, >100, null accepted)
- voiceSchema: 3 cases (valid, <10, >500)

All 173 tests pass (15 new + 158 pre-existing).

## Deviations from Plan

**1. [Rule 1 - Bug] max_tokens onChange no longer clamps**
- **Found during:** Task 2 — BrainConfig max_tokens Input
- **Issue:** Original code clamped: `Math.min(8192, Math.max(100, v))`, which prevented Zod from ever seeing an out-of-range value and showing a validation error
- **Fix:** Removed clamping from onChange; Zod schema now triggers the inline error; user sees feedback instead of silent correction
- **Files modified:** src/components/admin/ai-agent/BrainConfig.tsx
- **Commit:** 28411d4

## Known Stubs

None — all validation wired end-to-end. Error messages display, auto-save blocks, and phone save button disables.

## Self-Check: PASSED

- validationSchemas.ts: FOUND
- agentValidationSchemas.test.ts: FOUND
- Commit 6d9fd5d (Task 0): FOUND
- Commit 70e010e (Task 1): FOUND
- Commit 28411d4 (Task 2): FOUND
- Commit 8d14190 (Task 3): FOUND
- Commit eddbaa7 (Task 4): FOUND
- max_lead_messages in ALLOWED_FIELDS: FOUND
- No fieldErrors prop in ExtractionConfig/BlockedNumbersConfig: OK
- brainSchema + SCHEMA_MAP exported: FOUND
