
-- 1. Converter vendedores existentes para agentes
UPDATE public.inbox_users SET role = 'agente' WHERE role = 'vendedor';

-- 2. Dropar objetos dependentes do enum antigo
DROP POLICY IF EXISTS "Inbox admins and gestors can manage members" ON public.inbox_users;
DROP POLICY IF EXISTS "Inbox admins can manage labels" ON public.labels;
DROP FUNCTION IF EXISTS public.get_inbox_role(uuid, uuid);

-- 3. Recriar enum sem vendedor
ALTER TYPE public.inbox_role RENAME TO inbox_role_old;
CREATE TYPE public.inbox_role AS ENUM ('admin', 'gestor', 'agente');
ALTER TABLE public.inbox_users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE public.inbox_role USING role::text::public.inbox_role,
  ALTER COLUMN role SET DEFAULT 'agente';
DROP TYPE public.inbox_role_old;

-- 4. Recriar funcao get_inbox_role
CREATE OR REPLACE FUNCTION public.get_inbox_role(_user_id uuid, _inbox_id uuid)
RETURNS public.inbox_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM inbox_users
  WHERE user_id = _user_id AND inbox_id = _inbox_id
  LIMIT 1
$$;

-- 5. Recriar politicas RLS
CREATE POLICY "Inbox admins and gestors can manage members"
ON public.inbox_users
FOR ALL
USING (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role]));

CREATE POLICY "Inbox admins can manage labels"
ON public.labels
FOR ALL
USING (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role]));
