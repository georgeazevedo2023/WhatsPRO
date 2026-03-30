---
phase: 7
slug: consolidacao-de-helpers-e-reducao-de-duplicacao-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (frontend) + manual grep verification (backend edge functions) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (frontend) + grep checks (instant) |

---

## Sampling Rate

- **After every task commit:** Run grep-based verification (zero raw createClient/Response/console)
- **After every plan wave:** Run `npx vitest run` for frontend regression + grep sweep
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | createServiceClient + createUserClient | grep | `grep -r "createServiceClient\|createUserClient" supabase/functions/` | N/A (new file) | pending |
| 07-02-01 | 02 | 1 | response.ts + logger.ts adoption | grep | `grep -c "new Response(JSON.stringify" supabase/functions/` (target: 0 outside _shared) | existing | pending |
| 07-03-01 | 03 | 2 | carousel.ts extraction | grep | `grep -c "generateCarouselCopies\|buildCarousel" supabase/functions/_shared/carousel.ts` | N/A (new file) | pending |
| 07-03-02 | 03 | 2 | Confira configurable | grep | `grep "'Confira:'" supabase/functions/ai-agent/index.ts` (target: 0) | existing | pending |
| 07-04-01 | 04 | 2 | LLM metrics | grep | `grep "latency_ms\|token_count" supabase/functions/_shared/llmProvider.ts` | existing | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. vitest already configured. Edge function tests use grep-based verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge functions deploy correctly | All functions must deploy without errors | Requires Supabase CLI deploy | `npx supabase functions deploy <name>` for each modified function |
| Frontend compatibility with successResponse | `ok: true` field doesn't break existing fetch handlers | Behavioral | Test key flows in browser (dashboard, admin, helpdesk) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
