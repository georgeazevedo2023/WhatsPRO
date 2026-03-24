
-- 1. Create safe backup_query function to replace exec_sql
CREATE OR REPLACE FUNCTION public.backup_query(_action text, _table_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: Super Admin only';
  END IF;

  CASE _action
    WHEN 'list-tables' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT t.table_name, t.table_type,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      ) t;

    WHEN 'table-data' THEN
      IF _table_name IS NULL THEN
        RAISE EXCEPTION 'table_name required';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = _table_name
      ) THEN
        RAISE EXCEPTION 'Table not found in public schema';
      END IF;
      EXECUTE format(
        'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.%I ORDER BY created_at DESC NULLS LAST LIMIT 10000) t',
        _table_name
      ) INTO result;

    WHEN 'table-columns' THEN
      IF _table_name IS NULL THEN
        RAISE EXCEPTION 'table_name required';
      END IF;
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = _table_name
        ORDER BY ordinal_position
      ) t;

    WHEN 'schema' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT t.table_name, string_agg(
          '  ' || c.column_name || ' ' ||
          CASE
            WHEN c.udt_name = 'uuid' THEN 'UUID'
            WHEN c.udt_name = 'text' THEN 'TEXT'
            WHEN c.udt_name = 'bool' THEN 'BOOLEAN'
            WHEN c.udt_name = 'int4' THEN 'INTEGER'
            WHEN c.udt_name = 'int8' THEN 'BIGINT'
            WHEN c.udt_name = 'float8' THEN 'DOUBLE PRECISION'
            WHEN c.udt_name = 'timestamptz' THEN 'TIMESTAMP WITH TIME ZONE'
            WHEN c.udt_name = 'jsonb' THEN 'JSONB'
            WHEN c.udt_name = 'json' THEN 'JSON'
            WHEN c.udt_name = '_text' THEN 'TEXT[]'
            WHEN c.udt_name = '_int4' THEN 'INTEGER[]'
            WHEN c.udt_name = '_uuid' THEN 'UUID[]'
            ELSE UPPER(c.udt_name)
          END ||
          CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
          E',\n' ORDER BY c.ordinal_position
        ) as columns_def
        FROM information_schema.tables t
        JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name ORDER BY t.table_name
      ) t;

    WHEN 'primary-keys' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT tc.table_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as pk_columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        GROUP BY tc.table_name
      ) t;

    WHEN 'foreign-keys' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name
      ) t;

    WHEN 'rls-policies' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname
      ) t;

    WHEN 'db-functions' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT p.proname as function_name, pg_get_function_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type, pg_get_functiondef(p.oid) as definition
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname
      ) t;

    WHEN 'triggers' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT trigger_name, event_manipulation, event_object_table, action_timing, action_statement
        FROM information_schema.triggers WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      ) t;

    WHEN 'enums' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT t.typname as enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
        FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname
      ) t;

    WHEN 'storage-buckets' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
        FROM storage.buckets ORDER BY name
      ) t;

    WHEN 'storage-policies' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname
      ) t;

    WHEN 'indexes' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT indexname, tablename, indexdef FROM pg_indexes
        WHERE schemaname = 'public' ORDER BY tablename, indexname
      ) t;

    WHEN 'rls-status' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
        FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        ORDER BY relname
      ) t;

    ELSE
      RAISE EXCEPTION 'Invalid action: %', _action;
  END CASE;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 2. Drop the unsafe exec_sql function
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- 3. Department-based RLS for conversations
DROP POLICY IF EXISTS "Inbox users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Inbox users can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Inbox users can insert conversations" ON public.conversations;

CREATE POLICY "Inbox users can view conversations"
  ON public.conversations FOR SELECT
  USING (
    has_inbox_access(auth.uid(), inbox_id) AND (
      department_id IS NULL
      OR is_super_admin(auth.uid())
      OR get_inbox_role(auth.uid(), inbox_id) IN ('admin', 'gestor')
      OR EXISTS (
        SELECT 1 FROM department_members dm
        WHERE dm.department_id = conversations.department_id
        AND dm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Inbox users can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    has_inbox_access(auth.uid(), inbox_id) AND (
      department_id IS NULL
      OR is_super_admin(auth.uid())
      OR get_inbox_role(auth.uid(), inbox_id) IN ('admin', 'gestor')
      OR EXISTS (
        SELECT 1 FROM department_members dm
        WHERE dm.department_id = conversations.department_id
        AND dm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Inbox users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (has_inbox_access(auth.uid(), inbox_id));

-- 4. Make helpdesk-media and audio-messages buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('helpdesk-media', 'audio-messages');

-- 5. Replace public read policies with authenticated-only
DROP POLICY IF EXISTS "Public read access for helpdesk media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read audio messages" ON storage.objects;

CREATE POLICY "Authenticated users can read helpdesk media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'helpdesk-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read audio messages"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-messages' AND auth.uid() IS NOT NULL);
