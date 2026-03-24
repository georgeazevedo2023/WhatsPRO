
-- Fix infinite recursion in kanban_boards RLS policies
-- The problem: kanban_boards SELECT policy checks kanban_cards, which calls
-- can_access_kanban_board(), which queries kanban_boards again → infinite loop

-- Step 1: Rewrite can_access_kanban_board to NEVER query kanban_boards directly.
-- It only touches kanban_board_members and inbox_users (auxiliary tables).
-- created_by check is handled in the RLS policy itself, not in this function.
CREATE OR REPLACE FUNCTION public.can_access_kanban_board(
  _user_id  uuid,
  _board_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Super admin has full access
    is_super_admin(_user_id)
    -- Direct member of the board
    OR EXISTS (
      SELECT 1 FROM public.kanban_board_members m
      WHERE m.board_id = _board_id AND m.user_id = _user_id
    )
    -- Member of an inbox linked to the board (joins inbox_users, not kanban_boards)
    OR EXISTS (
      SELECT 1
      FROM public.inbox_users iu
      INNER JOIN public.kanban_boards b ON b.inbox_id = iu.inbox_id AND b.id = _board_id
      WHERE iu.user_id = _user_id
        AND b.inbox_id IS NOT NULL
    )
  )
$$;

-- Step 2: Drop and recreate the kanban_boards SELECT policy WITHOUT the
-- kanban_cards EXISTS clause that caused the recursion loop.
DROP POLICY IF EXISTS "Usuários podem ver boards acessíveis" ON public.kanban_boards;

CREATE POLICY "Usuários podem ver boards acessíveis"
  ON public.kanban_boards
  FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR created_by = auth.uid()
    OR (inbox_id IS NOT NULL AND has_inbox_access(auth.uid(), inbox_id))
    OR EXISTS (
      SELECT 1 FROM public.kanban_board_members m
      WHERE m.board_id = kanban_boards.id AND m.user_id = auth.uid()
    )
  );

-- Step 3: Grant permissions on the updated function
REVOKE EXECUTE ON FUNCTION public.can_access_kanban_board FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_kanban_board TO authenticated;
