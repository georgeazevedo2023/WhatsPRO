
-- =============================================
-- KANBAN CRM MODULE - Etapa 1: Schema Completo
-- =============================================

-- 1. Enums
CREATE TYPE public.kanban_visibility AS ENUM ('shared', 'private');
CREATE TYPE public.kanban_field_type AS ENUM ('text', 'currency', 'date', 'select');

-- 2. kanban_boards — Quadros (Pipelines)
CREATE TABLE public.kanban_boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid NOT NULL,
  visibility  public.kanban_visibility NOT NULL DEFAULT 'shared',
  inbox_id    uuid REFERENCES public.inboxes(id) ON DELETE SET NULL,
  instance_id text REFERENCES public.instances(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. kanban_columns — Colunas/Etapas do Funil
CREATE TABLE public.kanban_columns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id           uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name               text NOT NULL,
  color              text NOT NULL DEFAULT '#6366f1',
  position           integer NOT NULL DEFAULT 0,
  automation_message text,
  automation_enabled boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 4. kanban_fields — Campos Personalizados do Formulário
CREATE TABLE public.kanban_fields (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name       text NOT NULL,
  field_type public.kanban_field_type NOT NULL DEFAULT 'text',
  options    jsonb,
  position   integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  required   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. kanban_cards — Os Cards/Leads
CREATE TABLE public.kanban_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  column_id   uuid NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  title       text NOT NULL,
  assigned_to uuid,
  created_by  uuid NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  tags        text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 6. kanban_card_data — Valores dos Campos Personalizados
CREATE TABLE public.kanban_card_data (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id  uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.kanban_fields(id) ON DELETE CASCADE,
  value    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, field_id)
);

-- =============================================
-- Indexes para performance
-- =============================================
CREATE INDEX idx_kanban_columns_board_id ON public.kanban_columns(board_id);
CREATE INDEX idx_kanban_fields_board_id ON public.kanban_fields(board_id);
CREATE INDEX idx_kanban_cards_board_id ON public.kanban_cards(board_id);
CREATE INDEX idx_kanban_cards_column_id ON public.kanban_cards(column_id);
CREATE INDEX idx_kanban_cards_created_by ON public.kanban_cards(created_by);
CREATE INDEX idx_kanban_cards_assigned_to ON public.kanban_cards(assigned_to);
CREATE INDEX idx_kanban_card_data_card_id ON public.kanban_card_data(card_id);

-- =============================================
-- Auto-update updated_at
-- =============================================
CREATE TRIGGER update_kanban_boards_updated_at
  BEFORE UPDATE ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Helper: verifica se usuário pode ver o board
-- =============================================
CREATE OR REPLACE FUNCTION public.can_access_kanban_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
        OR EXISTS (
          SELECT 1 FROM public.kanban_cards kc
          WHERE kc.board_id = _board_id
            AND (kc.created_by = _user_id OR kc.assigned_to = _user_id)
        )
      )
  )
$$;

-- Helper: verifica se usuário pode ver o card (respeita visibilidade)
CREATE OR REPLACE FUNCTION public.can_access_kanban_card(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kanban_cards kc
    JOIN public.kanban_boards b ON b.id = kc.board_id
    WHERE kc.id = _card_id
      AND (
        is_super_admin(_user_id)
        OR (
          b.visibility = 'shared'
          AND can_access_kanban_board(_user_id, b.id)
        )
        OR (
          b.visibility = 'private'
          AND (kc.created_by = _user_id OR kc.assigned_to = _user_id)
        )
      )
  )
$$;

-- =============================================
-- RLS — Habilitar em todas as tabelas
-- =============================================
ALTER TABLE public.kanban_boards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fields   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_data ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS — kanban_boards
-- =============================================
CREATE POLICY "Super admins gerenciam todos os boards"
  ON public.kanban_boards FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários podem criar boards"
  ON public.kanban_boards FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Usuários podem ver boards acessíveis"
  ON public.kanban_boards FOR SELECT
  USING (
    created_by = auth.uid()
    OR (inbox_id IS NOT NULL AND has_inbox_access(auth.uid(), inbox_id))
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.board_id = kanban_boards.id
        AND (kc.created_by = auth.uid() OR kc.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Criadores podem atualizar seus boards"
  ON public.kanban_boards FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Criadores podem excluir seus boards"
  ON public.kanban_boards FOR DELETE
  USING (created_by = auth.uid());

-- =============================================
-- RLS — kanban_columns (herda acesso do board)
-- =============================================
CREATE POLICY "Super admins gerenciam todas as colunas"
  ON public.kanban_columns FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem colunas de boards acessíveis"
  ON public.kanban_columns FOR SELECT
  USING (can_access_kanban_board(auth.uid(), board_id));

CREATE POLICY "Criadores do board gerenciam colunas"
  ON public.kanban_columns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores do board atualizam colunas"
  ON public.kanban_columns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores do board excluem colunas"
  ON public.kanban_columns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

-- =============================================
-- RLS — kanban_fields (herda acesso do board)
-- =============================================
CREATE POLICY "Super admins gerenciam todos os campos"
  ON public.kanban_fields FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem campos de boards acessíveis"
  ON public.kanban_fields FOR SELECT
  USING (can_access_kanban_board(auth.uid(), board_id));

CREATE POLICY "Criadores do board gerenciam campos"
  ON public.kanban_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores do board atualizam campos"
  ON public.kanban_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores do board excluem campos"
  ON public.kanban_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

-- =============================================
-- RLS — kanban_cards
-- =============================================
CREATE POLICY "Super admins gerenciam todos os cards"
  ON public.kanban_cards FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem cards respeitando visibilidade"
  ON public.kanban_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id
        AND (
          is_super_admin(auth.uid())
          OR (
            b.visibility = 'shared'
            AND can_access_kanban_board(auth.uid(), b.id)
          )
          OR (
            b.visibility = 'private'
            AND (created_by = auth.uid() OR assigned_to = auth.uid())
          )
        )
    )
  );

CREATE POLICY "Usuários criam cards em boards acessíveis"
  ON public.kanban_cards FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND can_access_kanban_board(auth.uid(), board_id)
  );

CREATE POLICY "Criadores e responsáveis atualizam cards"
  ON public.kanban_cards FOR UPDATE
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores excluem seus cards"
  ON public.kanban_cards FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_boards b
      WHERE b.id = board_id AND b.created_by = auth.uid()
    )
  );

-- =============================================
-- RLS — kanban_card_data
-- =============================================
CREATE POLICY "Super admins gerenciam todos os dados"
  ON public.kanban_card_data FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuários veem dados de cards acessíveis"
  ON public.kanban_card_data FOR SELECT
  USING (can_access_kanban_card(auth.uid(), card_id));

CREATE POLICY "Usuários inserem dados em cards acessíveis"
  ON public.kanban_card_data FOR INSERT
  WITH CHECK (can_access_kanban_card(auth.uid(), card_id));

CREATE POLICY "Usuários atualizam dados de cards acessíveis"
  ON public.kanban_card_data FOR UPDATE
  USING (can_access_kanban_card(auth.uid(), card_id));

CREATE POLICY "Usuários excluem dados de cards acessíveis"
  ON public.kanban_card_data FOR DELETE
  USING (can_access_kanban_card(auth.uid(), card_id));
