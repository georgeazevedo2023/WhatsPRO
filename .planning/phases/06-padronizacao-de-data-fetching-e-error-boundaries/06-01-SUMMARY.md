---
phase: 06-padronizacao-de-data-fetching-e-error-boundaries
plan: 01
subsystem: frontend/leads
tags: [react-query, useQuery, useMutation, data-fetching, leads]
dependency_graph:
  requires: []
  provides:
    - LeadDetail.tsx React Query data fetching
    - Leads.tsx React Query data fetching + mutation
  affects:
    - src/pages/dashboard/LeadDetail.tsx
    - src/pages/dashboard/Leads.tsx
    - src/types/agent.ts
tech_stack:
  added: []
  patterns:
    - useQuery with domain-prefix queryKeys (lead-contact, lead-profile, lead-conversations, leads)
    - useMutation with invalidateQueries onSuccess
    - invalidateQueries replacing reloadKey pattern
key_files:
  created: []
  modified:
    - src/pages/dashboard/LeadDetail.tsx
    - src/pages/dashboard/Leads.tsx
    - src/types/agent.ts
decisions:
  - autoSave in LeadDetail preserved as useCallback+useEffect (per Pitfall 5 — do not migrate to useMutation)
  - reloadKey replaced by queryClient.invalidateQueries in ConversationModal onOpenChange and handleClearContext
  - handleToggleBlockInstance uses invalidateQueries instead of setContact optimistic update
  - convIds derived from convsData?.convIds to use as enabled guard for media and events queries
  - section?: string added to ExtractionField interface (pre-existing usage without type definition — Rule 2)
metrics:
  duration: "~8 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 6 Plan 1: LeadDetail + Leads React Query Migration Summary

Migrate data fetching in LeadDetail.tsx and Leads.tsx from manual useState+useEffect to React Query useQuery/useMutation, eliminating the reloadKey pattern and all manual loading state management.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate LeadDetail.tsx to useQuery | f008a9f | LeadDetail.tsx, types/agent.ts |
| 2 | Migrate Leads.tsx to useQuery+useMutation | d11e2b3 | Leads.tsx |

## What Was Built

### Task 1: LeadDetail.tsx

Replaced a monolithic `useEffect` with 8 sequential fetches with 6 parallel `useQuery` calls:

- `['lead-contact', contactId]` — fetches contact row
- `['lead-profile', contactId]` — fetches lead_profiles row
- `['lead-conversations', contactId]` — fetches conversations + labels + kanban (3 sub-queries, batched in one queryFn)
- `['lead-extraction-fields', instanceId]` — fetches ai_agents extraction_fields
- `['lead-media', contactId, convIds.length]` — fetches media files (enabled when convIds > 0)
- `['lead-events', contactId, convIds.length]` — fetches ai_agent_logs → ActionEvent[] (enabled when convIds > 0 && contact)

The `reloadKey` state was completely removed. Replaced by `queryClient.invalidateQueries` in two places:
1. `handleClearContext` — invalidates all 4 primary queries after clearing context
2. `ConversationModal.onOpenChange` — invalidates conversations + events when modal closes

`autoSave` was preserved as-is (useCallback + debounced useEffect). Per Pitfall 5 from RESEARCH.md, migrating form auto-save to useMutation would require managing optimistic state for each field independently — not worth the complexity.

Editable fields are now synced via a `useEffect` that watches `leadProfile` changes, replacing the direct `setEditOrigin/setEditEmail/...` calls that were inside the old `useEffect`.

### Task 2: Leads.tsx

Replaced `fetchLeads` useCallback + `useEffect(() => { fetchLeads(); }, [fetchLeads])` with a single `useQuery`:

```typescript
const { data: leads = [], isLoading: loading } = useQuery<LeadData[]>({
  queryKey: ['leads', selectedInstanceId],
  queryFn: async () => { ... },
  enabled: !!selectedInstanceId,
});
```

The entire body of `fetchLeads` was moved verbatim into `queryFn`. All `setLeads()`, `setLoading(true/false)` calls were removed. Early exits return `[]` instead of calling setters.

`toggleIaBlock` was migrated to `useMutation`:
- `mutationFn` performs the Supabase update
- `onSuccess` calls `invalidateQueries(['leads', selectedInstanceId])` and shows toast
- `onError` calls `handleError` (import preserved)
- The `toggleIaBlock` callback now calls `toggleIaMutation.mutate(...)` instead of inline async/await

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing field] Add `section?: string` to ExtractionField interface**
- **Found during:** Task 1 TypeScript verification
- **Issue:** LeadDetail.tsx used `f.section === 'custom'` to filter extraction fields. The `ExtractionField` interface in `src/types/agent.ts` did not have a `section` property, causing 2 TypeScript errors. The original file had the same code but was only caught now because this file was being type-checked more closely.
- **Fix:** Added `section?: string` as optional property to `ExtractionField`
- **Files modified:** `src/types/agent.ts`
- **Commit:** f008a9f (bundled with Task 1)
- **Side effect:** Overall TypeScript error count reduced from 123 to 107 (the property was missing in other callers too)

## Verification Results

```
grep -r "useSupabaseQuery" src/pages/dashboard/LeadDetail.tsx src/pages/dashboard/Leads.tsx → 0 results
grep -c "useQuery|useMutation" src/pages/dashboard/LeadDetail.tsx → 9
grep -c "useQuery|useMutation" src/pages/dashboard/Leads.tsx → 5
reloadKey occurrences in LeadDetail.tsx → 1 (comment only, no actual usage)
setContact(), setConversations(), setLoading() in LeadDetail.tsx → 0
setLeads(), setLoading() in Leads.tsx → 0
npx tsc --noEmit --project tsconfig.app.json → 107 errors (down from 123 baseline, zero new errors)
npm run build → ✓ built in 6.92s
```

## Known Stubs

None — both files fully wired to live Supabase data via React Query.

## Self-Check: PASSED
