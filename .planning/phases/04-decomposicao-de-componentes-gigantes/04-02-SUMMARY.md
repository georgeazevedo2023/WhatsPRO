---
phase: 04-decomposicao-de-componentes-gigantes
plan: "02"
subsystem: frontend/admin/ai-agent
tags: [decomposition, refactoring, catalog, component-extraction]
dependency_graph:
  requires: []
  provides: [CatalogTable, CatalogProductForm, CatalogConfig-orchestrator]
  affects: [src/components/admin/ai-agent/CatalogConfig.tsx]
tech_stack:
  added: []
  patterns: [container-presenter, prop-drilling, ui-transient-state-local]
key_files:
  created:
    - src/components/admin/ai-agent/CatalogTable.tsx
    - src/components/admin/ai-agent/CatalogProductForm.tsx
  modified:
    - src/components/admin/ai-agent/CatalogConfig.tsx
decisions:
  - "handleImportFromUrl and handleGenerateDescription moved to CatalogProductForm (UI-transient dialog handlers, only touch form state)"
  - "fileInputRef created inside CatalogProductForm (UI-local ref to file input inside Dialog)"
  - "Product interface and EMPTY_PRODUCT exported from CatalogConfig for sub-component imports"
  - "EMPTY_PRODUCT also exported so CatalogProductForm can reset form on import without prop threading"
  - "hasActiveFilters cast to !!boolean before passing to CatalogTable (was string|boolean in orchestrator)"
metrics:
  duration_seconds: 378
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 02: CatalogConfig Decomposition Summary

CatalogConfig.tsx (704 LOC) decomposed into orchestrator (273 LOC) + CatalogTable (filters/grid/bulk) + CatalogProductForm (dialog/images/import/AI-description), resolving DT-08-catalog with zero behavior change.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract CatalogTable sub-component | 924d049 | CatalogTable.tsx (created), CatalogConfig.tsx (modified) |
| 2 | Extract CatalogProductForm, slim orchestrator | 0d80712 | CatalogProductForm.tsx (created), CatalogConfig.tsx (rewritten) |

## What Was Built

### CatalogTable.tsx (new — 198 LOC)
- Filters bar: search input, category Select, stock Select, sort Select, clear button
- Products grid: loading state, empty state, filtered-empty state
- Bulk actions bar: select-all checkbox, enable/disable/delete buttons
- Product card grid (grid-cols-1/2/3/4) with image, info, hover actions (edit/delete)
- `CatalogTableProps` interface with full callback delegation (no domain state)

### CatalogProductForm.tsx (new — 318 LOC)
- Product Dialog with all form fields (title, category, subcategory, price, SKU, description)
- Quick Import collapsible (URL scraping via scrape-product edge function)
- AI description generation via Gemini 2.5 Flash API
- Image upload zone (drag-and-drop + click), image grid with featured/reorder/delete
- Stock/enabled toggles
- Delete AlertDialog confirmation
- Local state: `importUrl`, `importOpen`, `importStatus`, `importing`, `generatingDesc`, `fileInputRef`

### CatalogConfig.tsx (slimmed — 273 LOC, was 704)
- Keeps: state declarations, fetchProducts, categories/filtered memoization
- Keeps: toggleSelect, toggleSelectAll, handleBulkAction
- Keeps: openNew, openEdit, handleSave, handleDelete
- Keeps: handleFileUpload, removeImage, setFeaturedImage
- Return JSX: header + CsvProductImport collapsible + BatchScrapeImport collapsible + `<CatalogTable .../>` + `<CatalogProductForm .../>`

## Verification Results

- `wc -l CatalogConfig.tsx` = 273 (< 300 target) — PASS
- `npx tsc --noEmit` = clean (exit 0) — PASS
- `npx vitest run` = 173 passed, 3 skipped, 0 failures — PASS
- Both new files exist — PASS
- `<CatalogTable` and `<CatalogProductForm` in CatalogConfig.tsx — PASS
- No inline filter bar JSX in CatalogConfig.tsx — PASS
- No Dialog/AlertDialog JSX in CatalogConfig.tsx — PASS
- No `handleImportFromUrl` in CatalogConfig.tsx — PASS
- No `handleGenerateDescription` in CatalogConfig.tsx — PASS

## Deviations from Plan

None - plan executed exactly as written. The "revised approach" described in Task 2 (moving dialog-local handlers into CatalogProductForm) was the intended approach per the plan document.

## Known Stubs

None — all data is fully wired. CatalogTable receives live `products`/`filtered` arrays from orchestrator. CatalogProductForm receives live `form` state and triggers real Supabase calls via callbacks.

## Self-Check: PASSED
