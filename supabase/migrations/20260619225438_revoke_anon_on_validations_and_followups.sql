-- Close the anon (unauthenticated REST) read vector on ai_agent_validations and
-- follow_up_executions. Both carry a policy intended for service_role but mistakenly
-- scoped TO public USING(true), and anon held the table GRANT -> anyone with the
-- anon key could read all rows without logging in. (Audit verified the other 16
-- always-true policies in public are correctly TO service_role and NOT exposed.)
--
-- Safe fix that does NOT break the UI: the dashboard reads these as the
-- 'authenticated' role (ValidatorMetrics / useAgentDetail / useAgentScore), which
-- keeps its own GRANT; edge functions use service_role (bypasses RLS). Only anon
-- loses access.
--
-- Applied to prod prfcbfumyrrycsrcrvms; registered version 20260619225438 (UTC).
-- Verified after: anon SELECT=false, authenticated=true, service_role=true on both.
--
-- NOT fixed here (deferred, riskier): the policy still lets any AUTHENTICATED user
-- read across tenants (USING(true) TO public). Proper tenant-scoping needs an
-- authenticated policy keyed to instance access, verified against the dashboard
-- query pattern before tightening.

REVOKE ALL ON public.ai_agent_validations FROM anon;
REVOKE ALL ON public.follow_up_executions FROM anon;
