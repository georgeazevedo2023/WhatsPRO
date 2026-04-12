-- =============================================================================
-- S12: Migração por Instância + Flow Report Shares
-- =============================================================================

-- 1. Flag por instância (granular — substitui flag global em produção)
ALTER TABLE instances ADD COLUMN IF NOT EXISTS use_orchestrator BOOL NOT NULL DEFAULT false;

-- 2. Links públicos compartilháveis de métricas (30 dias de validade)
CREATE TABLE IF NOT EXISTS flow_report_shares (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  flow_id    UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  is_active  BOOL        NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_report_shares_token ON flow_report_shares(token) WHERE is_active = true;
CREATE INDEX idx_flow_report_shares_flow  ON flow_report_shares(flow_id);

ALTER TABLE flow_report_shares ENABLE ROW LEVEL SECURITY;

-- Leitura pública pelo token (sem auth — link público de 30 dias)
CREATE POLICY "public_token_read" ON flow_report_shares
  FOR SELECT USING (is_active = true AND expires_at > now());
-- Escritas exclusivamente via RPC SECURITY DEFINER (sem policy de escrita)

-- 3. RPC: cria share e retorna token
CREATE OR REPLACE FUNCTION create_flow_report_share(p_flow_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  INSERT INTO flow_report_shares (flow_id)
  VALUES (p_flow_id)
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;
