
-- Add entity_select to kanban_field_type enum
ALTER TYPE public.kanban_field_type ADD VALUE IF NOT EXISTS 'entity_select';

-- Create kanban_entities table
CREATE TABLE public.kanban_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins gerenciam todas as entidades"
  ON public.kanban_entities FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem entidades de boards acessíveis"
  ON public.kanban_entities FOR SELECT
  USING (can_access_kanban_board(auth.uid(), board_id));

-- Create kanban_entity_values table
CREATE TABLE public.kanban_entity_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.kanban_entities(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_entity_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins gerenciam todos os valores"
  ON public.kanban_entity_values FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem valores de entidades acessíveis"
  ON public.kanban_entity_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kanban_entities e
    WHERE e.id = kanban_entity_values.entity_id
      AND can_access_kanban_board(auth.uid(), e.board_id)
  ));

-- Add entity_id column to kanban_fields
ALTER TABLE public.kanban_fields
  ADD COLUMN entity_id uuid REFERENCES public.kanban_entities(id) ON DELETE SET NULL;
