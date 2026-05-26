-- Premium #2 Cart Engine (2026-05-25) — pedido estruturado por conversa.
-- Mesmo padrão runtime de conversations.shown_product_ids (v7.49.0): estado da
-- conversa, não config de ai_agents (não dispara a SYNC RULE de 8 locais).
-- Array de itens: [{ product_id, name, qty, unit_price, added_at }].
-- SDR/qualificação: monta o pedido e entrega ao vendedor no handoff. SEM checkout/
-- pagamento/frete (isso é o M11 T11.11 separado).

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cart_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN conversations.cart_items IS
  'Cart Engine (premium #2): pedido estruturado do lead montado pelo ai-agent via add_to_cart/update_cart. Array [{product_id,name,qty,unit_price,added_at}]. Entregue itemizado no handoff. Não é checkout (sem pagamento/frete).';
