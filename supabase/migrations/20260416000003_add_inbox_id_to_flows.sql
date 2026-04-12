-- =============================================================================
-- Adiciona inbox_id à tabela flows
-- Permite associar um fluxo a uma caixa de entrada específica da instância.
-- Opcional: NULL = aceita mensagens de qualquer inbox da instância.
-- =============================================================================

ALTER TABLE flows
  ADD COLUMN IF NOT EXISTS inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL;

COMMENT ON COLUMN flows.inbox_id IS 'Caixa de entrada (inbox) associada ao fluxo. Opcional — NULL aceita qualquer inbox da instância.';
