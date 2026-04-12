-- =============================================================================
-- Fix: UNIQUE NULLS NOT DISTINCT (PG15+) → dois índices parciais (PG14 compatível)
-- Necessário porque shadow_metrics foi criada com constraint inválida para PG14
-- Supabase usa PostgreSQL 14 — NULLS NOT DISTINCT só está disponível no PG15+
-- =============================================================================

-- Remove constraint se existir (para ambientes onde migration foi aplicada com erro)
ALTER TABLE shadow_metrics DROP CONSTRAINT IF EXISTS uq_shadow_metrics_period;

-- Cria índices parciais equivalentes (PG14 compatível)
-- Semântica idêntica ao NULLS NOT DISTINCT: NULL seller_id é tratado como valor único

-- Unicidade: sem seller (global da instância)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shadow_metrics_period_global
  ON shadow_metrics(instance_id, period_type, period_date)
  WHERE seller_id IS NULL;

-- Unicidade: com seller (por vendedor)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shadow_metrics_period_seller
  ON shadow_metrics(instance_id, seller_id, period_type, period_date)
  WHERE seller_id IS NOT NULL;
