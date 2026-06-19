-- Drop the orphan Fluxos v3.0 schema (M18). Runtime decommissioned v7.90.0;
-- cron jobid 13 unscheduled 2026-06-19 (20260619102336).
--
-- Verified before drop (prod prfcbfumyrrycsrcrvms): flow_states=0 (runtime never
-- ran), instances.use_orchestrator=false everywhere (0 using), NO external FK,
-- NO view, NO function (besides the 2 below) and NO app code references these
-- objects (only stale comments in whatsapp-webhook + Leads.tsx). Seed rows
-- (flows=1, flow_steps=2, flow_triggers=1) were the install seed, recoverable
-- from 20260411190906_fluxos_v3_seed.sql. validator_logs (0 rows) is the orphan
-- log of the AI validator retired in v7.89.0, grouped here by the pendencias audit.
--
-- Applied to prod; registered version 20260619110935 (UTC). Verified after:
-- 0 flow_* tables, 0 orphan functions, 0 use_orchestrator column.

DROP TABLE IF EXISTS
  public.flow_events,
  public.flow_followups,
  public.flow_report_shares,
  public.flow_security_events,
  public.flow_states,
  public.flow_steps,
  public.flow_triggers,
  public.flows,
  public.guided_sessions,
  public.validator_logs
CASCADE;

DROP FUNCTION IF EXISTS public.install_flow_template(text, text, text, text, text, jsonb, jsonb, jsonb, boolean);
DROP FUNCTION IF EXISTS public.create_flow_report_share(uuid);

ALTER TABLE public.instances DROP COLUMN IF EXISTS use_orchestrator;
