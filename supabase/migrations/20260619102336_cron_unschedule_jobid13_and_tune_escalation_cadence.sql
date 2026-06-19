-- Cron hardening (2026-06-19), owner-approved after a full pg_cron audit
-- (25 active jobs, 0 failures/24h, all sub-second on the DB side).
--
-- Applied to prod prfcbfumyrrycsrcrvms; registered version 20260619102336 (UTC).
-- The one-off `TRUNCATE net._http_response` (35MB->32kB of dead pg_net rows) was
-- run as maintenance, not included here (transient TTL table, not schema).

-- 1) Unschedule dead Fluxos v3.0 cron: cleanup-guided-sessions targets the orphan
--    guided_sessions table (feature decommissioned v7.90.0, 0 rows). Independent of
--    the deferred schema drop; removed now so it can't error when the table goes.
SELECT cron.unschedule('cleanup-guided-sessions');

-- 2) Reduce cadence 1min -> 2min on escalation + abandoned-leads crons (owner-approved
--    SLA trade-off: a lead may wait up to 2min longer to escalate). Halves ~2880
--    edge-fn invocations/day. requeue-conversations (jobid 29) stays at 1min for
--    queue responsiveness.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'notify-vendor-escalation'), schedule := '*/2 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'handoff-abandoned-leads'),  schedule := '*/2 * * * *');
