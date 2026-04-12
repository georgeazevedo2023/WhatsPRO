# P1: Git Working Tree Cleanup — Migrations + Modified Files

**Date:** 2026-04-04
**Purpose:** Commit all untracked migration files and modified source files before starting Milestone 2 (Agent QA Framework).
**Risk Level:** MEDIUM overall (migrations are already running in production; committing them to git is documentation, not deployment)

---

## Situation Assessment

The production Supabase database is already running all 38 migrations — they were applied directly without being committed to git. Committing them now brings the repository history in sync with the live database schema. There is **no apply risk**, only **documentation risk** (misleading history).

The 5 modified files are all test/tooling changes — safe to commit independently.

---

## Complete File Inventory

### Group A: Foundation Migrations (2026-03-20) — COMPLETE SCHEMA REBUILD

These 8 files represent a full schema rewrite applied on 2026-03-20. They create every base table from scratch and must be committed together because they form a coherent unit: tables → functions → RLS enable → RLS policies → indexes/triggers.

| File | Purpose | Risk |
|------|---------|------|
| `20260320005239_01_enums_and_tables.sql` | All enums + 25 base tables | LOW — already in production |
| `20260320005444_02_functions.sql` | Core RPCs: is_super_admin, has_inbox_access, backup_query, handle_new_user, etc. | LOW |
| `20260320005458_03_rls_enable.sql` | Enable RLS on all 28 tables | LOW |
| `20260320005550_04_rls_policies.sql` | All RLS policies (100+ policies) | LOW |
| `20260320005634_05_indexes_and_triggers.sql` | All indexes + updated_at triggers | LOW |
| `20260320011313_create_storage_buckets.sql` | helpdesk-media + audio-messages buckets | LOW |
| `20260320011406_enable_realtime_publications.sql` | Realtime publications for 10 tables | LOW |
| `20260320011912_create_system_settings.sql` | system_settings table + RLS + seed data | LOW |

**Dependency order:** correct (01→02→03→04→05→storage→realtime→settings).

**Conflict risk with existing committed migrations:** The existing committed migrations (UUID-named files from 2026-01-24 to 2026-04-01) represent an older schema generation. The new named migrations overlap conceptually but are idempotent in the context of git history — they don't re-run on the remote DB. **No conflict.**

### Group B: Day-1 Fixes (2026-03-20 to 2026-03-21) — FK + POLICY PATCHES

Applied the same day or day after the foundation. Fix FK cascade rules and missing policies.

| File | Purpose | Risk |
|------|---------|------|
| `20260320202006_add_performance_indexes_and_constraints.sql` | Performance indexes + CHECK constraints on conversations | LOW |
| `20260321010846_fix_instance_fk_cascade.sql` | inboxes/scheduled_messages/kanban_boards FK → SET NULL or CASCADE | LOW |
| `20260321012602_fix_instance_delete_policies.sql` | DELETE policies for super_admin on logs + leads | LOW |
| `20260321013242_fix_inboxes_instance_id_nullable.sql` | Makes inboxes.instance_id nullable (required for ON DELETE SET NULL) | LOW |
| `20260321084057_add_delete_inbox_rpc.sql` | delete_inbox() SECURITY DEFINER RPC | LOW |
| `20260321084454_fix_inbox_fk_cascade.sql` | All inbox-referencing FKs → CASCADE or SET NULL | LOW |
| `20260321085152_fix_all_fk_cascades.sql` | Full cascade audit across all remaining FK relations | LOW |
| `20260321103213_add_missing_fks_and_indexes.sql` | Missing FKs to auth.users + 5 indexes | LOW |
| `20260321103238_add_kanban_board_counts_rpc.sql` | get_kanban_board_counts() RPC | LOW |
| `20260321103846_fix_trigger_use_dynamic_config.sql` | trigger_auto_summarize — remove hardcoded anon key | LOW |
| `20260321103924_enable_pg_net_and_fix_trigger.sql` | pg_net extension + vault.create_secret for anon key | MEDIUM — contains hardcoded anon key JWT (public anon key, not secret key — safe to commit) |
| `20260321104138_add_storage_delete_policies.sql` | Storage DELETE policies for helpdesk-media, audio, carousel | LOW |

**Note on `20260321103924`:** It calls `vault.create_secret()` with the Supabase anon key JWT. This is a **public anon key** (visible in browser network tab), not a secret key. Safe to commit. The JWT is also already present in `_02_functions.sql` (hardcoded in `trigger_auto_summarize`). Not a security concern.

### Group C: AI Agent + Feature Migrations (2026-03-22) — M10/M11 SPRINT FEATURES

| File | Purpose | Risk |
|------|---------|------|
| `20260322021531_create_ai_agent_tables_v3.sql` | ai_agents, ai_agent_logs, ai_debounce_queue, lead_profiles tables | LOW |
| `20260322022139_create_ai_agent_catalog_tables.sql` | ai_agent_products, ai_agent_knowledge, ai_agent_media tables | LOW |
| `20260322105546_sprint3_tags_extraction_fields.sql` | conversations.tags + ai_agents.extraction_fields columns | LOW |
| `20260322112242_s5_1_conversation_summaries.sql` | lead_profiles.conversation_summaries column | LOW |
| `20260322122029_m11_leads_ia_blocked.sql` | contacts.ia_blocked boolean (superseded by next migration) | LOW — safe because next migration drops/replaces it |
| `20260322135030_s5_3_lead_card_fields.sql` | lead_profiles: origin, address, email, document, birth_date, custom_fields | LOW |
| `20260322140251_s5_4_kanban_contact_id.sql` | kanban_cards.contact_id FK + index | LOW |
| `20260322175956_ia_blocked_per_instance.sql` | Drops contacts.ia_blocked, adds contacts.ia_blocked_instances TEXT[] + ai_agents.blocked_numbers | LOW |
| `20260322192552_add_reason_average_ticket_to_lead_profiles.sql` | lead_profiles.reason + average_ticket columns | LOW |
| `20260323105328_security_lead_profiles_rls.sql` | RLS policy for lead_profiles — user_manage_leads ALL policy | LOW |

**Dependency chain:** `20260322021531` must precede all M10/M11 migrations since it creates the base tables they extend.

**Duplicate column risk:** `20260322135030` adds `email` and `birth_date` to `lead_profiles`, but `20260322021531` also defines `email TEXT` and `birth_date DATE` on that table. Since the later migration uses `ADD COLUMN IF NOT EXISTS`, there is **no conflict** at apply time. Already in production without error.

### Group D: Module-Specific Features (2026-03-24 to 2026-03-25)

| File | Purpose | Risk |
|------|---------|------|
| `20260324013238_utm_campaigns.sql` | utm_campaigns + utm_visits + utm_conversions tables | LOW |
| `20260325080938_follow_up_cadences.sql` | ai_agents follow_up_enabled/rules + follow_up_executions table | LOW |
| `20260325095121_scrape_jobs.sql` | scrape_jobs table | LOW |
| `20260325110400_audit_v3_security_fixes.sql` | CHECK constraints on utm_campaigns + missing FKs on shift_report_configs and instance_connection_logs (idempotent with DO/EXCEPTION) | LOW |
| `20260325191500_ai_debounce_atomic_append.sql` | append_ai_debounce_message() atomic UPSERT RPC | LOW |
| `20260325230000_remote_schema_backfill.sql` | pg_trgm extension + rate_limit_log + trgm indexes + global_search_conversations RPC + materialized views | LOW |

**Note on `20260325110400`:** Uses DO/EXCEPTION WHEN duplicate_object blocks — fully idempotent. Already applied in production without error.

### Group E: Agent QA + OpenAI (2026-03-29) — MILESTONE 2 PREREQUISITES

| File | Purpose | Risk |
|------|---------|------|
| `20260329010000_e2e_automated_tests.sql` | e2e_test_runs table + indexes + RLS + cleanup_old_e2e_runs() | LOW |
| `20260329020000_add_openai_api_key_to_agents.sql` | ai_agents.openai_api_key column | LOW |

These are directly needed for Milestone 2. Both already applied in production.

---

## Timestamp Analysis

**Existing committed migrations:** 2026-01-24 through 2026-04-01 (UUID-named, from Supabase migration tool)

**New untracked migrations:** 2026-03-20 through 2026-03-29 (descriptively-named, written manually)

**Potential overlap concern:** The timestamp ranges overlap (March dates exist in both committed and untracked sets). However, Supabase migration history is tracked in the `supabase_migrations.schema_migrations` table by version timestamp. Since these new files have different timestamps than the existing committed files, there is **no timestamp collision**.

**Verification:** The last committed migration is `20260401000000_phase1_validator_prompt_studio_foundation.sql`. All new untracked migrations have timestamps ranging from `20260320` to `20260329` — all EARLIER than the most recent committed migration. This means they are **historical backfill** — already applied to the DB before the committed migrations.

---

## Files That Should NOT Be Committed

| File | Reason |
|------|--------|
| `.claude/worktrees/` | Ephemeral Claude Code worktree metadata — machine-specific, not project code |
| `.planning/codebase/` | Exploratory analysis files (CONCERNS.md, AI schema analysis) — internal notes, not deliverables |
| `supabase/functions/test_e2e_agent.sh` | REVIEW REQUIRED — contains hardcoded real production credentials (ANON_KEY, CONV_ID, INSTANCE_ID, INBOX_ID, JID). Should NOT be committed with secrets inline. Redact secrets or move to `.gitignore` before committing. |

**Decision on `test_e2e_agent.sh`:** The file contains the public Supabase anon key (already committed elsewhere), a specific conversation UUID, instance ID, inbox ID, and a real WhatsApp JID. The conversation/instance/inbox IDs are test-environment specifics but are not secrets per se. The JID (`5581985749970@s.whatsapp.net`) is a real phone number — consider if this should be public in the repo. Recommendation: commit with a `# TODO: move IDs to env vars` comment, or add to `.gitignore` if it's a scratch test script. **Ask the user before committing this file.**

---

## Modified Files Analysis

| File | Change | Risk | Commit With |
|------|--------|------|-------------|
| `src/test/setup.ts` | Added ResizeObserver mock (18 lines) — required for new component tests | NONE | Test files commit |
| `src/pages/dashboard/__tests__/PlaygroundEdgeCases.test.ts` | Added test `4b` — guardrail block detection with accented Portuguese | NONE | Test files commit |
| `src/pages/dashboard/__tests__/PlaygroundScenarios.test.ts` | Added `TestStep`/`TestScenario` interface definitions at top | NONE | Test files commit |
| `.claude/commands/uazapi.md` | Added Section 10: UAZAPI v2 endpoints (PIX button, poll, status/story, etc.) — 171 lines of API reference | NONE | Docs commit |
| `supabase/.temp/cli-latest` | Updated Supabase CLI version marker from previous to `v2.84.2` | NONE | Separate or omit |

---

## Recommended Commit Strategy

### Option A: 3 Commits (Recommended — clean history)

**Commit 1: Database Foundation + Features**
Commit all 38 migration files in a single commit with clear message.

```bash
git add supabase/migrations/20260320005239_01_enums_and_tables.sql
git add supabase/migrations/20260320005444_02_functions.sql
git add supabase/migrations/20260320005458_03_rls_enable.sql
git add supabase/migrations/20260320005550_04_rls_policies.sql
git add supabase/migrations/20260320005634_05_indexes_and_triggers.sql
git add supabase/migrations/20260320011313_create_storage_buckets.sql
git add supabase/migrations/20260320011406_enable_realtime_publications.sql
git add supabase/migrations/20260320011912_create_system_settings.sql
git add supabase/migrations/20260320202006_add_performance_indexes_and_constraints.sql
git add supabase/migrations/20260321010846_fix_instance_fk_cascade.sql
git add supabase/migrations/20260321012602_fix_instance_delete_policies.sql
git add supabase/migrations/20260321013242_fix_inboxes_instance_id_nullable.sql
git add supabase/migrations/20260321084057_add_delete_inbox_rpc.sql
git add supabase/migrations/20260321084454_fix_inbox_fk_cascade.sql
git add supabase/migrations/20260321085152_fix_all_fk_cascades.sql
git add supabase/migrations/20260321103213_add_missing_fks_and_indexes.sql
git add supabase/migrations/20260321103238_add_kanban_board_counts_rpc.sql
git add supabase/migrations/20260321103846_fix_trigger_use_dynamic_config.sql
git add supabase/migrations/20260321103924_enable_pg_net_and_fix_trigger.sql
git add supabase/migrations/20260321104138_add_storage_delete_policies.sql
git add supabase/migrations/20260322021531_create_ai_agent_tables_v3.sql
git add supabase/migrations/20260322022139_create_ai_agent_catalog_tables.sql
git add supabase/migrations/20260322105546_sprint3_tags_extraction_fields.sql
git add supabase/migrations/20260322112242_s5_1_conversation_summaries.sql
git add supabase/migrations/20260322122029_m11_leads_ia_blocked.sql
git add supabase/migrations/20260322135030_s5_3_lead_card_fields.sql
git add supabase/migrations/20260322140251_s5_4_kanban_contact_id.sql
git add supabase/migrations/20260322175956_ia_blocked_per_instance.sql
git add supabase/migrations/20260322192552_add_reason_average_ticket_to_lead_profiles.sql
git add supabase/migrations/20260323105328_security_lead_profiles_rls.sql
git add supabase/migrations/20260324013238_utm_campaigns.sql
git add supabase/migrations/20260325080938_follow_up_cadences.sql
git add supabase/migrations/20260325095121_scrape_jobs.sql
git add supabase/migrations/20260325110400_audit_v3_security_fixes.sql
git add supabase/migrations/20260325191500_ai_debounce_atomic_append.sql
git add supabase/migrations/20260325230000_remote_schema_backfill.sql
git add supabase/migrations/20260329010000_e2e_automated_tests.sql
git add supabase/migrations/20260329020000_add_openai_api_key_to_agents.sql
git commit -m "chore(db): backfill migration history — schema rewrite + M10/M11/UTM/E2E (2026-03-20 to 2026-03-29)

38 migrations documenting the production schema as of 2026-03-29.
Already applied on remote DB. This commit brings git in sync.

Groups:
- Foundation (01-03-20): enums, tables, functions, RLS, indexes, storage, realtime, system_settings
- Day-1 fixes (03-20 to 03-21): FK cascades, delete policies, inbox nullable, pg_net, vault
- AI Agent M10/M11 (03-22): ai_agents, catalog, lead_profiles, tags, ia_blocked, contact_id FK
- Features (03-24 to 03-25): UTM campaigns, follow-up cadences, scrape jobs, rate limit, global search
- Agent QA prereqs (03-29): e2e_test_runs table + ai_agents.openai_api_key"
```

**Commit 2: Test infrastructure**

```bash
git add src/test/setup.ts
git add "src/pages/dashboard/__tests__/PlaygroundEdgeCases.test.ts"
git add "src/pages/dashboard/__tests__/PlaygroundScenarios.test.ts"
git add "src/components/dashboard/__tests__/DashboardCharts.test.tsx"
git add "src/pages/dashboard/__tests__/AdminGuards.test.tsx"
git commit -m "test: add ResizeObserver mock + new test coverage for playground edge cases, dashboard charts, admin guards"
```

**Commit 3: Docs and tooling**

```bash
git add .claude/commands/uazapi.md
git add .clinerules
git add .planning/config.json
# supabase/.temp/cli-latest — optional, see note below
git commit -m "docs: UAZAPI v2 endpoints reference + GSD framework config"
```

### Option B: 5 Commits (Maximum traceability)

Split migrations into 5 groups (A through E) matching the groups in this document. Preferred if the team wants to bisect the schema history by feature area.

---

## Files to EXCLUDE from all commits

```
.claude/worktrees/            # machine-specific, ephemeral
.planning/codebase/           # internal analysis notes
supabase/functions/test_e2e_agent.sh  # CONTAINS REAL IDs — review first
supabase/.temp/cli-latest     # auto-generated, may conflict with other devs
```

To permanently ignore `supabase/.temp/`:
```bash
echo "supabase/.temp/" >> .gitignore
```

---

## Risk Assessment Summary

| Risk | Description | Mitigation |
|------|------------|------------|
| NONE | Applying migrations to remote DB | Migrations are ALREADY applied. Git commit is documentation only. |
| LOW | Timestamp ordering in migration history | New files are 2026-03-20 to 03-29, older than last committed file (2026-04-01). Supabase tracks applied migrations by timestamp — no re-run risk. |
| LOW | Anon key in `20260321103924` | Public anon key (not service role key). Already in browser bundles. Not a security risk. |
| MEDIUM | `test_e2e_agent.sh` real phone JID | Real WhatsApp number exposed in public repo. Review before commit. |
| LOW | `20260322122029` drops column that's re-added in `20260322175956` | Correct sequence. ia_blocked (boolean) → ia_blocked_instances (TEXT[]). Already applied in correct order. |

---

## Rollback Plan

Since all migrations are already applied to the production DB, "rollback" here means undoing the git commit — not reverting the database.

```bash
# If something in the commit was wrong, soft reset to unstage:
git reset HEAD~1

# If you need to un-apply a specific migration from the DB (rare, last resort):
# Connect to Supabase SQL Editor and manually write a reverse migration
# Example for the last migration (add_openai_api_key):
# ALTER TABLE ai_agents DROP COLUMN IF EXISTS openai_api_key;
```

There is no automated rollback for these migrations since they were applied without the Supabase CLI migration runner — they have no entry in `supabase_migrations.schema_migrations`. Supabase `db reset` would run all migrations from scratch (including these), so the rollback scenario is irrelevant for production.

---

## Execution Checklist

- [ ] Decide on `supabase/functions/test_e2e_agent.sh` — commit with redacted IDs or add to `.gitignore`
- [ ] Decide on `supabase/.temp/cli-latest` — commit or add to `.gitignore`
- [ ] Decide on `.planning/codebase/` — keep untracked or add to `.gitignore`
- [ ] Decide on `.claude/worktrees/` — add to `.gitignore` (recommended)
- [ ] Run Commit 1 (38 migrations)
- [ ] Run Commit 2 (test files)
- [ ] Run Commit 3 (docs/config)
- [ ] `git log --oneline -5` to verify history looks correct
- [ ] `git status` to confirm working tree is clean
