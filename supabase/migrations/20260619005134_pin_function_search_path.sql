-- Hardening: pin search_path on project-owned functions flagged by the
-- "function_search_path_mutable" security advisor.
--
-- Value = (public, pg_temp): every body only touches objects in public or
-- pg_catalog builtins; auth.uid() is already schema-qualified. Pinning the
-- search_path closes the SECURITY DEFINER injection vector (an attacker can no
-- longer prepend a malicious schema before calling these functions).
--
-- Extension C functions (dblink_*, gbt_* / btree_gist, gtrgm_* / pg_trgm,
-- *_similarity*, *_dist) are intentionally left untouched — not project-owned.
--
-- Applied to prod prfcbfumyrrycsrcrvms on 2026-06-18 (registered version
-- 20260619005134, UTC). Verified: 0 project plpgsql/sql functions in public
-- without a pinned search_path afterwards.

-- Trigger functions (no args)
ALTER FUNCTION public.ensure_default_agent_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.ensure_single_default_department() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_instance_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_instance_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_agent_profiles_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_automation_rules_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_funnels_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_system_settings_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.user_feature_permissions_touch_updated_at() SET search_path = public, pg_temp;

-- Pure helper functions
ALTER FUNCTION public.db_alert_severity_rank(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_table_protected(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_external_id(text) SET search_path = public, pg_temp;

-- Functions with side effects on public tables
ALTER FUNCTION public.try_insert_greeting(uuid, text, text) SET search_path = public, pg_temp;

-- Orphan Fluxos v3.0 RPC (SECURITY DEFINER) — slated for drop with the schema
-- cleanup; pinned now so it stops showing in the advisor in the meantime.
ALTER FUNCTION public.install_flow_template(text, text, text, text, text, jsonb, jsonb, jsonb, boolean) SET search_path = public, pg_temp;
