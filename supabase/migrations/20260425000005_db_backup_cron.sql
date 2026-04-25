-- M19 S8.1: pg_cron jobs para policies com backup_before_delete=true
-- Edge function db-retention-backup chamada via pg_net.http_post

-- Função utilitária: lista policies que precisam de backup e dispara o edge fn
CREATE OR REPLACE FUNCTION public.dispatch_retention_with_backup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy db_retention_policies;
  v_count integer := 0;
  v_anon_key text;
  v_request_id bigint;
  v_results jsonb := '[]'::jsonb;
BEGIN
  v_anon_key := coalesce(
    current_setting('app.settings.anon_key', true),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
  );

  IF v_anon_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_ANON_KEY not found in vault — required for cron→edge call';
  END IF;

  FOR v_policy IN
    SELECT * FROM db_retention_policies
    WHERE enabled = true
      AND backup_before_delete = true
      AND dry_run = false
  LOOP
    SELECT net.http_post(
      url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/db-retention-backup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('policy_id', v_policy.id)
    ) INTO v_request_id;

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'policy_id', v_policy.id,
      'table_name', v_policy.table_name,
      'request_id', v_request_id
    ));
  END LOOP;

  RETURN jsonb_build_object('dispatched', v_count, 'results', v_results, 'ran_at', now());
END;
$$;

COMMENT ON FUNCTION public.dispatch_retention_with_backup IS 'M19 S8.1: chamada por pg_cron weekly. Itera policies com backup_before_delete=true e dispara edge function db-retention-backup para cada.';

-- pg_cron: domingo 05:23 UTC (1h após o cleanup direto, off-minute)
SELECT cron.unschedule('db-cleanup-with-backup-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'db-cleanup-with-backup-weekly'
);

SELECT cron.schedule(
  'db-cleanup-with-backup-weekly',
  '23 5 * * 0',
  $$SELECT dispatch_retention_with_backup()$$
);
