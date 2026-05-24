-- Carousel batching (2026-05-24): rastreia produtos já exibidos em carrosséis
-- NESTA conversa para o "mais opções" / "nenhuma dessas" trazer um lote NOVO
-- (excluindo os já mostrados) em vez de repetir os mesmos cards.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS shown_product_ids text[] DEFAULT NULL;

COMMENT ON COLUMN conversations.shown_product_ids IS
  'IDs de produtos já exibidos em carrosséis nesta conversa (carousel batching). search_products exclui estes e anexa os novos; quando esgota, retorna "todas as opções mostradas".';
