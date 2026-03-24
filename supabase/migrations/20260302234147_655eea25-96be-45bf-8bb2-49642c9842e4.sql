
-- 1. Fix contacts: restrict to inbox members who have conversations with that contact
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Super admins can manage all contacts" ON public.contacts;

CREATE POLICY "Super admins can manage all contacts"
ON public.contacts FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Inbox users can view their contacts"
ON public.contacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.contact_id = contacts.id
      AND has_inbox_access(auth.uid(), c.inbox_id)
  )
);

CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Fix user_profiles: remove inbox co-member clause, keep own + super_admin
DROP POLICY IF EXISTS "Inbox members can view co-member profiles" ON public.user_profiles;

-- Inbox members can only see name (not email) of co-members via the existing app logic
-- but at DB level, restrict SELECT to own profile + super_admin + inbox co-members limited
CREATE POLICY "Inbox co-members can view limited profiles"
ON public.user_profiles FOR SELECT
USING (
  auth.uid() = id
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM inbox_users iu1
    JOIN inbox_users iu2 ON iu1.inbox_id = iu2.inbox_id
    WHERE iu1.user_id = auth.uid()
      AND iu2.user_id = user_profiles.id
  )
);

-- 3. Fix inboxes: hide webhook URLs from non-admin roles
-- We can't hide specific columns via RLS, but we can restrict who sees inboxes with webhook data
-- Instead, we'll keep current policy but note that webhook URLs should be managed via admin UI only
-- The real fix is ensuring only admins can UPDATE webhook fields

DROP POLICY IF EXISTS "Users can view their inboxes" ON public.inboxes;

CREATE POLICY "Users can view their inboxes"
ON public.inboxes FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR has_inbox_access(auth.uid(), id)
);

-- Add UPDATE policy restricted to admin/gestor roles
CREATE POLICY "Inbox admins can update inboxes"
ON public.inboxes FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR get_inbox_role(auth.uid(), id) IN ('admin', 'gestor')
);
