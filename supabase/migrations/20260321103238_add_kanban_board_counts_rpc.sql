
CREATE OR REPLACE FUNCTION public.get_kanban_board_counts()
RETURNS TABLE (
  board_id uuid,
  column_count bigint,
  card_count bigint,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id AS board_id,
    COALESCE(col.cnt, 0) AS column_count,
    COALESCE(card.cnt, 0) AS card_count,
    COALESCE(mem.cnt, 0) AS member_count
  FROM kanban_boards b
  LEFT JOIN (SELECT board_id, COUNT(*) AS cnt FROM kanban_columns GROUP BY board_id) col ON col.board_id = b.id
  LEFT JOIN (SELECT board_id, COUNT(*) AS cnt FROM kanban_cards GROUP BY board_id) card ON card.board_id = b.id
  LEFT JOIN (SELECT board_id, COUNT(*) AS cnt FROM kanban_board_members GROUP BY board_id) mem ON mem.board_id = b.id;
$$;
;
