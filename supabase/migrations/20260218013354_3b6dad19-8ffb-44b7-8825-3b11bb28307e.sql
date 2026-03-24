
-- Step 1: Drop the recursive policies
DROP POLICY IF EXISTS "Inbox members can view co-members" ON public.inbox_users;
DROP POLICY IF EXISTS "Inbox members can view co-member profiles" ON public.user_profiles;

-- Step 2: Create SECURITY DEFINER function to check inbox membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_inbox_member(_user_id uuid, _inbox_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inbox_users
    WHERE user_id = _user_id AND inbox_id = _inbox_id
  );
$$;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.is_inbox_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_inbox_member TO authenticated;

-- Step 3: Recreate inbox_users policy using the safe function (no recursion)
CREATE POLICY "Inbox members can view co-members"
ON public.inbox_users
FOR SELECT
USING (
  public.is_inbox_member(auth.uid(), inbox_id)
);

-- Step 4: Recreate user_profiles policy using the safe function (no recursion)
CREATE POLICY "Inbox members can view co-member profiles"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.inbox_users iu
    WHERE iu.user_id = auth.uid()
      AND public.is_inbox_member(iu.user_id, iu.inbox_id)
      AND EXISTS (
        SELECT 1 FROM public.inbox_users iu2
        WHERE iu2.user_id = user_profiles.id
          AND iu2.inbox_id = iu.inbox_id
      )
  )
);
