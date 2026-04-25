-- M19 S8 Camada 3: Auto-Cleanup com retenção configurável (slice seguro)
-- DEFERIDO para S8.1: edge function db-backup-jsonl + bucket db-backups
-- Policy `conversation_messages` permanece BLOQUEADA até backup integration

CREATE TABLE IF NOT EXISTS public.db_retention_policies (
  id serial PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  days_to_keep integer NOT NULL CHECK (days_to_keep > 0),
  condition_sql text DEFAULT NULL,
  enabled boolean NOT NULL DEFAULT false,
  dry_run boolean NOT NULL DEFAULT true,
  backup_before_delete boolean NOT NULL DEFAULT false,
  description text,
  last_run_at timestamptz,
  last_deleted_count integer DEFAULT 0,
  last_deleted_bytes bigint DEFAULT 0,
  last_backup_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.db_cleanup_log (
  id bigserial PRIMARY KEY,
  policy_id integer REFERENCES db_retention_policies(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  was_dry_run boolean NOT NULL,
  candidate_count integer,
  deleted_count integer DEFAULT 0,
  deleted_bytes bigint DEFAULT 0,
  backup_path text,
  duration_ms integer,
  error_message text,
  ran_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_db_cleanup_log_policy_ran
  ON db_cleanup_log(policy_id, ran_at DESC);

ALTER TABLE public.db_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage policies"
  ON public.db_retention_policies FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins read cleanup log"
  ON public.db_cleanup_log FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Whitelist de tabelas protegidas (nunca deletar destas)
CREATE OR REPLACE FUNCTION public.is_table_protected(_table_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _table_name = ANY(ARRAY[
    'lead_profiles', 'contacts', 'ai_agents', 'conversations',
    'inboxes', 'instances', 'departments', 'inbox_users',
    'department_members', 'user_profiles', 'user_roles',
    'user_instance_access', 'kanban_boards', 'kanban_columns',
    'kanban_cards', 'campaigns', 'forms', 'bio_pages', 'funnels',
    'agent_profiles', 'automation_rules', 'instance_goals',
    'flows', 'db_retention_policies', 'db_cleanup_log',
    'db_alert_state', 'notifications'
  ]);
$$;

COMMENT ON FUNCTION public.is_table_protected IS 'M19 S8 Camada 3: tabelas-núcleo protegidas contra retenção automática.';

-- Função principal: aplica uma policy
CREATE OR REPLACE FUNCTION public.apply_retention_policy(_policy_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy db_retention_policies;
  v_started timestamptz := clock_timestamp();
  v_count integer;
  v_delete_sql text;
  v_count_sql text;
  v_log_id bigint;
  v_error text;
  v_ran_by uuid := auth.uid();
BEGIN
  SELECT * INTO v_policy FROM db_retention_policies WHERE id = _policy_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'policy_not_found', 'policy_id', _policy_id);
  END IF;

  -- Bloqueio: tabela protegida
  IF is_table_protected(v_policy.table_name) THEN
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, error_message, ran_by)
    VALUES (v_policy.id, v_policy.table_name, v_policy.dry_run,
            'forbidden: table is in protected whitelist', v_ran_by);
    RETURN jsonb_build_object('error', 'protected_table', 'table_name', v_policy.table_name);
  END IF;

  -- Bloqueio: requer backup mas integração não shipada (S8.1)
  IF v_policy.backup_before_delete AND NOT v_policy.dry_run THEN
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, error_message, ran_by)
    VALUES (v_policy.id, v_policy.table_name, false,
            'backup integration deferred to S8.1; only dry_run is allowed for this policy', v_ran_by);
    RETURN jsonb_build_object('error', 'backup_not_implemented',
                              'message', 'Esta policy exige backup JSONL (S8.1 — não shipado). Mantenha em dry_run.');
  END IF;

  -- Build query: DELETE FROM <table> WHERE <created_at|last_message_at> < now() - <days> AND <condition>
  -- Usa updated_at se existir, senão created_at (descoberto em runtime)
  v_count_sql := FORMAT(
    'SELECT count(*) FROM %I WHERE created_at < now() - interval %L %s',
    v_policy.table_name,
    (v_policy.days_to_keep || ' days')::text,
    CASE WHEN v_policy.condition_sql IS NOT NULL AND length(trim(v_policy.condition_sql)) > 0
         THEN 'AND (' || v_policy.condition_sql || ')'
         ELSE '' END
  );

  BEGIN
    EXECUTE v_count_sql INTO v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, error_message, ran_by, duration_ms)
    VALUES (v_policy.id, v_policy.table_name, v_policy.dry_run, v_error, v_ran_by,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer);
    RETURN jsonb_build_object('error', 'count_failed', 'message', v_error);
  END;

  IF v_policy.dry_run THEN
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, candidate_count,
                                deleted_count, ran_by, duration_ms)
    VALUES (v_policy.id, v_policy.table_name, true, v_count, 0, v_ran_by,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer)
    RETURNING id INTO v_log_id;

    UPDATE db_retention_policies SET last_run_at = now(), updated_at = now() WHERE id = v_policy.id;

    RETURN jsonb_build_object(
      'dry_run', true,
      'table_name', v_policy.table_name,
      'candidate_count', v_count,
      'log_id', v_log_id
    );
  END IF;

  -- Real delete (sem backup — apenas para policies sem backup_before_delete)
  v_delete_sql := FORMAT(
    'DELETE FROM %I WHERE created_at < now() - interval %L %s',
    v_policy.table_name,
    (v_policy.days_to_keep || ' days')::text,
    CASE WHEN v_policy.condition_sql IS NOT NULL AND length(trim(v_policy.condition_sql)) > 0
         THEN 'AND (' || v_policy.condition_sql || ')'
         ELSE '' END
  );

  BEGIN
    EXECUTE v_delete_sql;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, error_message, ran_by, duration_ms)
    VALUES (v_policy.id, v_policy.table_name, false, v_error, v_ran_by,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer);
    RETURN jsonb_build_object('error', 'delete_failed', 'message', v_error);
  END;

  INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, candidate_count,
                              deleted_count, ran_by, duration_ms)
  VALUES (v_policy.id, v_policy.table_name, false, v_count, v_count, v_ran_by,
          EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer)
  RETURNING id INTO v_log_id;

  UPDATE db_retention_policies
     SET last_run_at = now(),
         last_deleted_count = v_count,
         updated_at = now()
   WHERE id = v_policy.id;

  RETURN jsonb_build_object(
    'dry_run', false,
    'table_name', v_policy.table_name,
    'deleted_count', v_count,
    'log_id', v_log_id
  );
END;
$$;

COMMENT ON FUNCTION public.apply_retention_policy IS 'M19 S8 Camada 3: aplica uma retention policy. Respeita dry_run, whitelist e bloqueia policies que precisam de backup ainda não shipado.';

-- Aplica todas as policies habilitadas (chamada por pg_cron)
CREATE OR REPLACE FUNCTION public.apply_all_retention_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy db_retention_policies;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  FOR v_policy IN
    SELECT * FROM db_retention_policies WHERE enabled = true
  LOOP
    BEGIN
      v_result := apply_retention_policy(v_policy.id);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'policy_id', v_policy.id,
        'table_name', v_policy.table_name,
        'result', v_result
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'policy_id', v_policy.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;
  RETURN jsonb_build_object('ran_at', now(), 'count', jsonb_array_length(v_results), 'results', v_results);
END;
$$;

COMMENT ON FUNCTION public.apply_all_retention_policies IS 'M19 S8 Camada 3: chamada por pg_cron weekly. Itera policies enabled.';

-- Permissões
GRANT EXECUTE ON FUNCTION public.apply_retention_policy(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_all_retention_policies() TO authenticated;

-- Seed: 6 policies sugeridas (todas OFF + dry_run=true por segurança)
INSERT INTO public.db_retention_policies (table_name, days_to_keep, condition_sql, backup_before_delete, description) VALUES
  ('ai_debounce_queue', 1, 'processed = true', false, 'Fila volátil de debounce processada'),
  ('instance_connection_logs', 30, NULL, false, 'Logs operacionais de conexão de instância'),
  ('ai_agent_logs', 30, NULL, false, 'Logs de execução do AI Agent'),
  ('flow_events', 60, NULL, false, 'Eventos do orquestrador de fluxos'),
  ('shadow_metrics', 180, NULL, false, 'Métricas brutas do shadow mode'),
  ('conversation_messages', 120, $$conversation_id IN (SELECT id FROM conversations WHERE status = 'resolvida')$$, true,
   'Mensagens de conversas resolvidas há mais de 120 dias. EXIGE BACKUP JSONL (S8.1).')
ON CONFLICT (table_name) DO NOTHING;

-- pg_cron weekly: domingo 04:13 UTC (off-peak, off-minute)
SELECT cron.unschedule('db-cleanup-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'db-cleanup-weekly'
);

SELECT cron.schedule(
  'db-cleanup-weekly',
  '13 4 * * 0',
  $$SELECT apply_all_retention_policies()$$
);
