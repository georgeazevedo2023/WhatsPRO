
-- 1. Drop existing RESTRICTIVE policies on user_roles
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- 2. Recreate as PERMISSIVE
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can view all roles"
ON public.user_roles FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- 3. Cleanup orphaned data from deleted user
DELETE FROM public.user_roles WHERE user_id = '66de650f-171f-4a89-bcfc-ed41e2cf6219';
DELETE FROM public.user_profiles WHERE id = '66de650f-171f-4a89-bcfc-ed41e2cf6219';
