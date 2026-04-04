
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_gerente(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'gerente')
$$;

CREATE OR REPLACE FUNCTION public.has_inbox_access(_user_id uuid, _inbox_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM inbox_users WHERE user_id = _user_id AND inbox_id = _inbox_id)
$$;

CREATE OR REPLACE FUNCTION public.is_inbox_member(_user_id uuid, _inbox_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.inbox_users WHERE user_id = _user_id AND inbox_id = _inbox_id);
$$;

CREATE OR REPLACE FUNCTION public.get_inbox_role(_user_id uuid, _inbox_id uuid)
RETURNS public.inbox_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM inbox_users WHERE user_id = _user_id AND inbox_id = _inbox_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_kanban_board(_user_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (
    is_super_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.kanban_board_members m WHERE m.board_id = _board_id AND m.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.inbox_users iu
      INNER JOIN public.kanban_boards b ON b.inbox_id = iu.inbox_id AND b.id = _board_id
      WHERE iu.user_id = _user_id AND b.inbox_id IS NOT NULL
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_kanban_card(_user_id uuid, _card_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_cards kc
    JOIN public.kanban_boards b ON b.id = kc.board_id
    WHERE kc.id = _card_id AND (
      is_super_admin(_user_id)
      OR (b.visibility = 'shared' AND can_access_kanban_board(_user_id, b.id))
      OR (b.visibility = 'private' AND (kc.created_by = _user_id OR kc.assigned_to = _user_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.normalize_external_id(ext_id text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN ext_id LIKE '%:%' THEN split_part(ext_id, ':', 2) ELSE ext_id END
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_single_default_department()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.departments SET is_default = false
    WHERE inbox_id = NEW.inbox_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_instance_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.instance_connection_logs (instance_id, event_type, description, metadata, user_id)
    VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'connected' THEN 'connected' ELSE 'disconnected' END,
      CASE WHEN NEW.status = 'connected' THEN 'Conectado ao WhatsApp' ELSE 'Desconectado do WhatsApp' END,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'owner_jid', NEW.owner_jid),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_auto_summarize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    PERFORM extensions.net.http_post(
      url := 'https://euljumeflwtljegknawy.supabase.co/functions/v1/auto-summarize',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bGp1bWVmbHd0bGplZ2tuYXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjYzMTQsImV4cCI6MjA4OTU0MjMxNH0.TAem9XE_b7Sx-rlHpZiU40rXKvwYWCBnqwLlAFYetJk'
      ),
      body := jsonb_build_object('conversation_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backup_query(_action text, _table_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden: Super Admin only'; END IF;
  CASE _action
    WHEN 'list-tables' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT t.table_name, t.table_type,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name
      ) t;
    WHEN 'table-data' THEN
      IF _table_name IS NULL THEN RAISE EXCEPTION 'table_name required'; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = _table_name) THEN
        RAISE EXCEPTION 'Table not found in public schema';
      END IF;
      EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.%I ORDER BY created_at DESC NULLS LAST LIMIT 10000) t', _table_name) INTO result;
    WHEN 'table-columns' THEN
      IF _table_name IS NULL THEN RAISE EXCEPTION 'table_name required'; END IF;
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _table_name ORDER BY ordinal_position
      ) t;
    WHEN 'schema' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT t.table_name, string_agg(
          '  ' || c.column_name || ' ' ||
          CASE WHEN c.udt_name = 'uuid' THEN 'UUID' WHEN c.udt_name = 'text' THEN 'TEXT'
            WHEN c.udt_name = 'bool' THEN 'BOOLEAN' WHEN c.udt_name = 'int4' THEN 'INTEGER'
            WHEN c.udt_name = 'int8' THEN 'BIGINT' WHEN c.udt_name = 'float8' THEN 'DOUBLE PRECISION'
            WHEN c.udt_name = 'timestamptz' THEN 'TIMESTAMP WITH TIME ZONE' WHEN c.udt_name = 'jsonb' THEN 'JSONB'
            WHEN c.udt_name = 'json' THEN 'JSON' WHEN c.udt_name = '_text' THEN 'TEXT[]'
            WHEN c.udt_name = '_int4' THEN 'INTEGER[]' WHEN c.udt_name = '_uuid' THEN 'UUID[]'
            ELSE UPPER(c.udt_name) END ||
          CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
          E',\n' ORDER BY c.ordinal_position) as columns_def
        FROM information_schema.tables t
        JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' GROUP BY t.table_name ORDER BY t.table_name
      ) t;
    WHEN 'primary-keys' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT tc.table_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as pk_columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY' GROUP BY tc.table_name
      ) t;
    WHEN 'foreign-keys' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY' ORDER BY tc.table_name
      ) t;
    WHEN 'rls-policies' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname
      ) t;
    WHEN 'db-functions' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT p.proname as function_name, pg_get_function_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type, pg_get_functiondef(p.oid) as definition
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname
      ) t;
    WHEN 'triggers' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT trigger_name, event_manipulation, event_object_table, action_timing, action_statement
        FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name
      ) t;
    WHEN 'enums' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT t.typname as enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
        FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname
      ) t;
    WHEN 'storage-buckets' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT id, name, public, file_size_limit, allowed_mime_types, created_at FROM storage.buckets ORDER BY name
      ) t;
    WHEN 'storage-policies' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname
      ) t;
    WHEN 'indexes' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
      ) t;
    WHEN 'rls-status' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result FROM (
        SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
        FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname
      ) t;
    ELSE RAISE EXCEPTION 'Invalid action: %', _action;
  END CASE;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Auth trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
;
