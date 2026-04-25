-- Add conversation visibility permissions to inbox_users
-- can_view_all: user can see conversations across ALL departments (not just their own)
-- can_view_unassigned: user can see unassigned conversations in their departments

ALTER TABLE public.inbox_users
  ADD COLUMN IF NOT EXISTS can_view_all boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_unassigned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_all_in_dept boolean NOT NULL DEFAULT true;

-- Comment for documentation
COMMENT ON COLUMN public.inbox_users.can_view_all IS 'When true, user can see conversations in all departments of this inbox, not just their own';
COMMENT ON COLUMN public.inbox_users.can_view_unassigned IS 'When true, user can see unassigned conversations (assigned_to IS NULL) in their departments';
COMMENT ON COLUMN public.inbox_users.can_view_all_in_dept IS 'When true, user can see all conversations in own departments (including assigned to others). When false, only sees own assigned conversations.';

-- Update the optimized RLS function to respect can_view_all
-- This replaces the function from 20260326010100_optimize_conversation_rls.sql
CREATE OR REPLACE FUNCTION public.can_view_conversation(
  _user_id uuid,
  _inbox_id uuid,
  _department_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- First: must have inbox access (mandatory gate)
    SELECT 1 FROM inbox_users iu
    WHERE iu.user_id = _user_id
      AND iu.inbox_id = _inbox_id
  )
  AND (
    -- Then: department-level access (any one of these)
    _department_id IS NULL                                          -- no department assigned
    OR EXISTS (                                                     -- is super_admin
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = _user_id AND ur.role = 'super_admin'
    )
    OR EXISTS (                                                     -- is admin/gestor of inbox
      SELECT 1 FROM inbox_users iu2
      WHERE iu2.user_id = _user_id
        AND iu2.inbox_id = _inbox_id
        AND iu2.role IN ('admin', 'gestor')
    )
    OR EXISTS (                                                     -- has can_view_all permission
      SELECT 1 FROM inbox_users iu3
      WHERE iu3.user_id = _user_id
        AND iu3.inbox_id = _inbox_id
        AND iu3.can_view_all = true
    )
    OR EXISTS (                                                     -- is member of department
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = _department_id
        AND dm.user_id = _user_id
    )
  )
$$;
