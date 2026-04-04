-- Allow users with inbox access to INSERT/UPDATE lead_profiles
CREATE POLICY "user_manage_leads" ON lead_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      JOIN conversations cv ON cv.contact_id = c.id
      WHERE c.id = lead_profiles.contact_id
      AND has_inbox_access(auth.uid(), cv.inbox_id)
    )
    OR is_super_admin(auth.uid())
  );

-- Drop the old select-only policy (now covered by the ALL policy above)
DROP POLICY IF EXISTS "user_view_leads" ON lead_profiles;

NOTIFY pgrst, 'reload schema';;
