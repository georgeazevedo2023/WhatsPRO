
-- Fix user_profiles: drop all RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Inbox members can view co-member profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admin can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Super admin can view all profiles"
ON public.user_profiles FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all profiles"
ON public.user_profiles FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can insert profiles"
ON public.user_profiles FOR INSERT
WITH CHECK (is_super_admin(auth.uid()) OR auth.uid() = id);

CREATE POLICY "Super admin can delete profiles"
ON public.user_profiles FOR DELETE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Inbox members can view co-member profiles"
ON public.user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM inbox_users iu
    WHERE iu.user_id = auth.uid()
      AND is_inbox_member(iu.user_id, iu.inbox_id)
      AND EXISTS (
        SELECT 1 FROM inbox_users iu2
        WHERE iu2.user_id = user_profiles.id
          AND iu2.inbox_id = iu.inbox_id
      )
  )
);
