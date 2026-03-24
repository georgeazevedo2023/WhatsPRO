
-- Create kanban_board_members table for direct user access to boards
CREATE TABLE public.kanban_board_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

ALTER TABLE public.kanban_board_members ENABLE ROW LEVEL SECURITY;

-- Super admin manages all members
CREATE POLICY "Super admins gerenciam membros do board"
  ON public.kanban_board_members FOR ALL
  USING (is_super_admin(auth.uid()));

-- Users can see their own access entries
CREATE POLICY "Usuários veem seus próprios acessos"
  ON public.kanban_board_members FOR SELECT
  USING (auth.uid() = user_id);

-- Update can_access_kanban_board to include direct members
CREATE OR REPLACE FUNCTION public.can_access_kanban_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = _board_id
      AND (
        is_super_admin(_user_id)
        OR b.created_by = _user_id
        OR (b.inbox_id IS NOT NULL AND has_inbox_access(_user_id, b.inbox_id))
        OR EXISTS (
          SELECT 1 FROM public.kanban_board_members m
          WHERE m.board_id = _board_id AND m.user_id = _user_id
        )
      )
  )
$$;

-- Also update the board visibility RLS policy to include direct members
-- First drop the existing policy for boards SELECT
DROP POLICY IF EXISTS "Usuários podem ver boards acessíveis" ON public.kanban_boards;

CREATE POLICY "Usuários podem ver boards acessíveis"
  ON public.kanban_boards FOR SELECT
  USING (
    created_by = auth.uid()
    OR (inbox_id IS NOT NULL AND has_inbox_access(auth.uid(), inbox_id))
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.kanban_board_members m
      WHERE m.board_id = kanban_boards.id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.board_id = kanban_boards.id
        AND (kc.created_by = auth.uid() OR kc.assigned_to = auth.uid())
    )
  );

-- Enable realtime for kanban_board_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_board_members;
