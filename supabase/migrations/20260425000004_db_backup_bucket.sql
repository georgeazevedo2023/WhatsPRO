-- M19 S8.1: Bucket privado para backups JSONL antes de DELETE
-- Estrutura: db-backups/YYYY/MM/{table}_{ISO_timestamp}.jsonl.gz

-- Cria bucket privado (público=false; acesso só via signed URLs ou service_role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'db-backups',
  'db-backups',
  false,
  104857600, -- 100 MB por arquivo (mais que suficiente para JSONL.gz)
  ARRAY['application/gzip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS em storage.objects: somente super_admin pode listar/baixar/deletar deste bucket
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Super admins read db-backups'
  ) THEN
    CREATE POLICY "Super admins read db-backups"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'db-backups' AND is_super_admin(auth.uid()));
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Super admins delete db-backups'
  ) THEN
    CREATE POLICY "Super admins delete db-backups"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'db-backups' AND is_super_admin(auth.uid()));
  END IF;

  -- INSERT/UPDATE não precisam de policy para usuários — apenas service_role
  -- escreve aqui (via edge function). Usuários autenticados não fazem upload.
END $$;

-- Função helper: aplica DELETE após backup (chamada pelo edge fn)
-- Bypassa o block "backup_before_delete + dry_run=false" do apply_retention_policy
-- Usa o mesmo padrão de logging
CREATE OR REPLACE FUNCTION public.apply_retention_after_backup(
  _policy_id integer,
  _backup_path text,
  _ran_by uuid DEFAULT NULL
)
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
  v_log_id bigint;
  v_error text;
BEGIN
  SELECT * INTO v_policy FROM db_retention_policies WHERE id = _policy_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'policy_not_found');
  END IF;

  IF is_table_protected(v_policy.table_name) THEN
    RETURN jsonb_build_object('error', 'protected_table');
  END IF;

  IF NOT v_policy.enabled OR v_policy.dry_run THEN
    RETURN jsonb_build_object('error', 'policy_not_enabled_or_in_dry_run');
  END IF;

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
    INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, backup_path, error_message, ran_by, duration_ms)
    VALUES (v_policy.id, v_policy.table_name, false, _backup_path, v_error, _ran_by,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer);
    RETURN jsonb_build_object('error', 'delete_failed', 'message', v_error);
  END;

  INSERT INTO db_cleanup_log (policy_id, table_name, was_dry_run, candidate_count,
                              deleted_count, backup_path, ran_by, duration_ms)
  VALUES (v_policy.id, v_policy.table_name, false, v_count, v_count, _backup_path, _ran_by,
          EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::integer)
  RETURNING id INTO v_log_id;

  UPDATE db_retention_policies
     SET last_run_at = now(),
         last_deleted_count = v_count,
         last_backup_path = _backup_path,
         updated_at = now()
   WHERE id = v_policy.id;

  RETURN jsonb_build_object(
    'dry_run', false,
    'table_name', v_policy.table_name,
    'deleted_count', v_count,
    'backup_path', _backup_path,
    'log_id', v_log_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_retention_after_backup(integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_retention_after_backup(integer, text, uuid) TO service_role;

COMMENT ON FUNCTION public.apply_retention_after_backup IS 'M19 S8.1: chamada pelo edge function db-retention-backup APÓS upload do JSONL bem-sucedido. Faz o DELETE e loga.';
