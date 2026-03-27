-- Sprint 1 / Migration 3: Optimize Conversation RLS Policies
-- Purpose: Reduce per-row function call overhead from 4-5 separate lookups to 1 unified function
-- Risk: HIGH — altering RLS policies can lock users out if buggy
--
-- Current behavior (per row evaluated):
--   1. has_inbox_access(uid, inbox_id)       → SELECT EXISTS FROM inbox_users
--   2. department_id IS NULL                  → free check
--   3. is_super_admin(uid)                    → SELECT EXISTS FROM user_roles
--   4. get_inbox_role(uid, inbox_id) IN (...)  → SELECT role FROM inbox_users
--   5. EXISTS (SELECT 1 FROM department_members ...) → seq scan (now indexed)
--   Total: up to 4 separate index lookups PER ROW
--
-- New behavior: 1 function call that does a single optimized query
--
-- ROLLBACK (restore original policies):
--   DROP POLICY IF EXISTS "Inbox users can view conversations" ON public.conversations;
--   DROP POLICY IF EXISTS "Inbox users can update conversations" ON public.conversations;
--   CREATE POLICY "Inbox users can view conversations" ON public.conversations FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id) AND (department_id IS NULL OR is_super_admin(auth.uid()) OR (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role])) OR (EXISTS (SELECT 1 FROM department_members dm WHERE dm.department_id = conversations.department_id AND dm.user_id = auth.uid()))));
--   CREATE POLICY "Inbox users can update conversations" ON public.conversations FOR UPDATE USING (has_inbox_access(auth.uid(), inbox_id) AND (department_id IS NULL OR is_super_admin(auth.uid()) OR (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role])) OR (EXISTS (SELECT 1 FROM department_members dm WHERE dm.department_id = conversations.department_id AND dm.user_id = auth.uid()))));
--   DROP FUNCTION IF EXISTS public.can_view_conversation(uuid, uuid, uuid);

-- Step 1: Create optimized unified check function
-- This replaces 4 separate function calls with 1 query that short-circuits on each condition.
-- SECURITY DEFINER: bypasses RLS on lookup tables (same as existing functions)
-- STABLE: result doesn't change within same transaction (allows planner caching)
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
    _department_id IS NULL                                          -- no department filter
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
    OR EXISTS (                                                     -- is member of department
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = _department_id
        AND dm.user_id = _user_id
    )
  )
$$;

-- Step 2: Replace SELECT policy (used on every conversation query)
-- Using a single transaction to avoid window without policy
DROP POLICY IF EXISTS "Inbox users can view conversations" ON public.conversations;
CREATE POLICY "Inbox users can view conversations"
  ON public.conversations
  FOR SELECT
  USING (can_view_conversation(auth.uid(), inbox_id, department_id));

-- Step 3: Replace UPDATE policy (same logic)
DROP POLICY IF EXISTS "Inbox users can update conversations" ON public.conversations;
CREATE POLICY "Inbox users can update conversations"
  ON public.conversations
  FOR UPDATE
  USING (can_view_conversation(auth.uid(), inbox_id, department_id));

-- Note: INSERT policy unchanged (only checks has_inbox_access, no department logic)
-- Note: Super admin ALL policy unchanged (separate policy, evaluated in parallel by PG)
