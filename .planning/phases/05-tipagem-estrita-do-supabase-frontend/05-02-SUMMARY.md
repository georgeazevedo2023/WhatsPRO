---
phase: 05-tipagem-estrita-do-supabase-frontend
plan: 02
subsystem: ui
tags: [typescript, types, supabase, leads, crm, any-elimination]

# Dependency graph
requires:
  - phase: 05-tipagem-estrita-do-supabase-frontend
    provides: src/types/agent.ts (ExtractionField, JsonField, etc.) and src/types/playground.ts (ToolCall, E2eResult)
provides:
  - Zero any in Leads.tsx — typed Supabase joined queries with ConvWithContact, ConvLabel, KanbanCardWithColumn interfaces
  - Zero any in LeadDetail.tsx — ContactRow/LeadProfileRow state, LogMetadata/ToolCall for ai_agent_logs, catch (err: unknown)
  - types.ts updated: ai_agents, ai_agent_logs, lead_profiles tables added; contacts.ia_blocked_instances, kanban_cards.contact_id, conversations.tags columns added
affects: [05-03, LeadDetail, Leads, AIAgentTab, CatalogConfig, KnowledgeConfig]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConvWithContact pattern: define local interface for Supabase join result shape, cast rawData as ConvWithContact[]"
    - "catch (err: unknown) + handleError(err, ...) pattern for all async error handlers"
    - "unknown as X double cast for Json fields: (value as unknown as TypedInterface[])"

key-files:
  created:
    - src/types/agent.ts
    - src/types/playground.ts
  modified:
    - src/pages/dashboard/Leads.tsx
    - src/pages/dashboard/LeadDetail.tsx
    - src/integrations/supabase/types.ts

key-decisions:
  - "Added missing tables (ai_agents, ai_agent_logs, lead_profiles) and columns (ia_blocked_instances, contact_id, tags) to types.ts rather than using (supabase as any) workarounds — this is the correct fix"
  - "Used (value as unknown as TypedInterface[]) double cast for Json fields — TypeScript requires intermediate unknown to convert between incompatible types"
  - "Created src/types/agent.ts and src/types/playground.ts in this worktree (parallel agent branches don't share files)"
  - "Baseline had 219 TS errors; after changes: 149 errors (reduced by 70 in other files as side effect of adding proper types)"

patterns-established:
  - "Join result typing: cast rawData to local interface after Supabase joined select — never cast .from() or the whole query chain"
  - "Json field cast: use (value as unknown as T[]) when converting Json | null to typed arrays"

requirements-completed: [DT-05]

# Metrics
duration: 35min
completed: 2026-03-30
---

# Phase 05 Plan 02: Replace all any in Leads.tsx and LeadDetail.tsx

**Zero any casts in both Leads.tsx and LeadDetail.tsx — typed Supabase queries with local join interfaces, types.ts backfilled with 3 missing tables and 3 missing columns**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-30T10:45:00Z
- **Completed:** 2026-03-30T11:20:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Eliminated all `any` casts in Leads.tsx: defined ConvWithContact, ConvLabel, KanbanCardWithColumn interfaces for Supabase join results; replaced `Map<string, {contact: any; convs: any[]}>` with typed map
- Eliminated all `any` casts in LeadDetail.tsx: typed useState with ContactRow/LeadProfileRow/ConvRow[], defined LogMetadata for ai_agent_logs metadata, cast ToolCall[] for tool_calls field, optional chaining for null-safe lead profile access
- Updated types.ts to add ai_agents, ai_agent_logs, lead_profiles tables plus ia_blocked_instances on contacts, contact_id on kanban_cards, tags on conversations — reducing TS errors from 219 to 149 project-wide
- Backfilled src/types/agent.ts and src/types/playground.ts (parallel agent worktree didn't have 05-01 commits)
- All catch blocks use `catch (err: unknown)` pattern per D-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace all any in Leads.tsx** - `3597454` (feat)
2. **Task 2: Replace all any in LeadDetail.tsx** - `f47c9af` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/pages/dashboard/Leads.tsx` - Zero any casts, typed join result interfaces, catch (err: unknown)
- `src/pages/dashboard/LeadDetail.tsx` - Zero any casts, typed state, LogMetadata, ToolCall, catch (err: unknown)
- `src/integrations/supabase/types.ts` - Added 3 tables + 3 columns to align with actual DB schema
- `src/types/agent.ts` - Created: ExtractionField, BusinessHours, FollowUpRule, SubAgentConfig, JsonField<T>
- `src/types/playground.ts` - Created: E2eResult, E2eLiveStep, ToolCall

## Decisions Made
- Added missing tables/columns to types.ts rather than using `(supabase as any)` workarounds — this is the proper fix since these tables genuinely exist in the DB and just weren't regenerated
- Used `(value as unknown as T[])` double-cast for `Json | null` fields (TypeScript requires intermediate `unknown` for conversions between incompatible structural types)
- Created agent.ts/playground.ts in this worktree since parallel plan 05-01 ran on a different branch/worktree and its commits weren't accessible here

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] types.ts missing tables and columns needed for typed queries**
- **Found during:** Task 1 (Leads.tsx fix)
- **Issue:** The plan assumed lead_profiles, ai_agents, ai_agent_logs existed in types.ts (line ~62 of plan: "Tables confirmed present"). In reality the auto-generated types.ts had not been updated — these tables were missing. Also contacts lacked ia_blocked_instances, kanban_cards lacked contact_id, conversations lacked tags.
- **Fix:** Added all 3 missing tables + 3 missing columns directly to types.ts with accurate Row/Insert/Update shapes derived from the DB migrations
- **Files modified:** src/integrations/supabase/types.ts
- **Verification:** TypeScript errors in Leads.tsx and LeadDetail.tsx fully resolved; total TS errors reduced from 219 to 149
- **Committed in:** 3597454 (Task 1 commit)

**2. [Rule 3 - Blocking] src/types/agent.ts and src/types/playground.ts missing from this worktree**
- **Found during:** Task 1 setup (checking imports)
- **Issue:** Plan 05-01 created these files on a parallel agent's worktree branch (339352b, 3adba94). This worktree (worktree-agent-a3d3edf9) didn't have those commits in its branch.
- **Fix:** Created both files from scratch using the same content from the git log of the other branch
- **Files modified:** src/types/agent.ts (created), src/types/playground.ts (created, with ToolCall added)
- **Verification:** Imports in LeadDetail.tsx resolve; tsc exits 0 for both target files
- **Committed in:** 3597454 and f47c9af (included in respective task commits)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to execute the task. No scope creep — all changes directly serve the goal of eliminating any casts from the two target files.

## Issues Encountered
- `Json | null` typed fields from Supabase require double-cast `(value as unknown as T[])` — direct cast from `Json` to typed interface fails TypeScript check
- Optional chaining required throughout LeadDetail.tsx after changing `const lp = profile || {}` to `const lp = leadProfile` (null-safe access to all lp.field references)

## Known Stubs
None - no stubs introduced. All data is properly wired.

## Next Phase Readiness
- Phase 05 Plan 03 (UsersManagement.tsx) can proceed — same pattern: identify any usages, define local interfaces, cast join results
- types.ts now has ai_agents, ai_agent_logs, lead_profiles — other files that used (supabase as any) for these tables may benefit from follow-up cleanup (out of scope for this plan)

---
*Phase: 05-tipagem-estrita-do-supabase-frontend*
*Completed: 2026-03-30*
