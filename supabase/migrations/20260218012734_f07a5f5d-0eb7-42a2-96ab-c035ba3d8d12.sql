CREATE POLICY "Inbox members can view co-members"
ON public.inbox_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM inbox_users my_membership
    WHERE my_membership.user_id = auth.uid()
      AND my_membership.inbox_id = inbox_users.inbox_id
  )
);