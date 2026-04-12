-- =============================================================================
-- Fix: upsert_lead_long_memory RPC
-- Correção do bug B#2 (S5): PostgREST .upsert({ onConflict: 'col,col,col' })
-- falha ao tentar fazer ON CONFLICT matching — PostgREST não consegue localizar
-- a constraint nomeada pela lista de colunas.
--
-- Solução: RPC idêntica à upsert_lead_short_memory, mas sem TTL/expires_at.
-- Memória longa é permanente (expires_at = NULL).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_lead_long_memory(
  p_lead_id     UUID,
  p_instance_id TEXT,
  p_scope       TEXT,
  p_data        JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO lead_memory (lead_id, instance_id, memory_type, scope, data)
  VALUES (p_lead_id, p_instance_id, 'long', p_scope, p_data)
  ON CONFLICT (lead_id, memory_type, scope)
  DO UPDATE SET
    data       = EXCLUDED.data,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
