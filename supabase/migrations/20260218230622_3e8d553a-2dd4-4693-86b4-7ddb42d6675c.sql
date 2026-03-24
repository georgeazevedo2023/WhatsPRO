
-- MIGRAÇÃO 2: RLS do CRM + funções auxiliares (após commit do enum 'gerente')

-- 2.1 Boards: revogar INSERT/UPDATE/DELETE de criadores comuns
DROP POLICY IF EXISTS "Usuários podem criar boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Criadores podem atualizar seus boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Criadores podem excluir seus boards" ON public.kanban_boards;

CREATE POLICY "Apenas super admins criam boards"
  ON public.kanban_boards FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Apenas super admins atualizam boards"
  ON public.kanban_boards FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Apenas super admins excluem boards"
  ON public.kanban_boards FOR DELETE
  USING (is_super_admin(auth.uid()));

-- 2.2 Colunas: revogar políticas dos criadores de board
DROP POLICY IF EXISTS "Criadores do board gerenciam colunas" ON public.kanban_columns;
DROP POLICY IF EXISTS "Criadores do board atualizam colunas" ON public.kanban_columns;
DROP POLICY IF EXISTS "Criadores do board excluem colunas" ON public.kanban_columns;

-- 2.3 Campos: revogar políticas dos criadores de board
DROP POLICY IF EXISTS "Criadores do board gerenciam campos" ON public.kanban_fields;
DROP POLICY IF EXISTS "Criadores do board atualizam campos" ON public.kanban_fields;
DROP POLICY IF EXISTS "Criadores do board excluem campos" ON public.kanban_fields;

-- 2.4 Atualizar função can_access_kanban_board (simplificada e segura)
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
        OR (
          b.inbox_id IS NOT NULL
          AND has_inbox_access(_user_id, b.inbox_id)
        )
      )
  )
$$;

-- 2.5 Criar função is_gerente para uso conveniente no frontend/funções
CREATE OR REPLACE FUNCTION public.is_gerente(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'gerente'
  )
$$;
