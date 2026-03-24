CREATE POLICY "Inbox members can view co-member profiles"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM inbox_users iu1
    JOIN inbox_users iu2 ON iu1.inbox_id = iu2.inbox_id
    WHERE iu1.user_id = auth.uid()
    AND iu2.user_id = user_profiles.id
  )
);