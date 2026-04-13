-- =============================================================================
-- M19 S2: Armazenamento & Agregação — Schema Changes
-- T1: Fix seller_id FK em shadow_metrics (contacts → auth.users)
-- T6: metadata JSONB em lead_profiles (track_id, track_source, UTMs)
-- T7: lead_profiles.current_score + tabela lead_score_history
-- T8: tabela conversion_funnel_events (4 etapas do funil)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- T1: Corrigir FK seller_id em shadow_metrics
-- Vendedores são auth.users, não contacts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE shadow_metrics DROP CONSTRAINT IF EXISTS shadow_metrics_seller_id_fkey;

ALTER TABLE shadow_metrics
  ADD CONSTRAINT shadow_metrics_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- T6 (schema): metadata JSONB em lead_profiles
-- Armazena track_id, track_source (UAZAPI), utm_source, utm_medium
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- T7: current_score em lead_profiles (0-100, default 50)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS current_score INT NOT NULL DEFAULT 50
  CONSTRAINT lead_profiles_score_range CHECK (current_score BETWEEN 0 AND 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- T7: lead_score_history — histórico de variações de score
-- Append-only. score_delta positivo = ganho, negativo = perda
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_score_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  score_delta     INT         NOT NULL,   -- ex: +10 (tag intencao:alta), -5 (followup perdido)
  reason          TEXT        NOT NULL,   -- 'shadow_data','followup_done','followup_missed','manual'
  score_after     INT         NOT NULL,   -- score resultante após este evento
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead
  ON lead_score_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_conversation
  ON lead_score_history(conversation_id);

ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_lead_score_history" ON lead_score_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "inbox_members_view_lead_score_history" ON lead_score_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_profiles lp
      JOIN contacts ct ON ct.id = lp.contact_id
      JOIN conversations conv ON conv.contact_id = ct.id
      JOIN inboxes ib ON ib.id = conv.inbox_id
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE lp.id = lead_score_history.lead_id
        AND iu.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- T8: conversion_funnel_events — transições de etapa do funil de conversão
-- Etapas: contact → qualification → intention → conversion
-- Populada pelo aggregate-metrics (S3 shadow writes após funil visual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversion_funnel_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  lead_id         UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  stage           TEXT        NOT NULL
                    CHECK (stage IN ('contact','qualification','intention','conversion')),
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice de busca por instância + etapa (dashboard funil)
CREATE INDEX IF NOT EXISTS idx_conversion_funnel_instance
  ON conversion_funnel_events(instance_id, stage, created_at DESC);
-- Índice por lead (timeline do lead)
CREATE INDEX IF NOT EXISTS idx_conversion_funnel_lead
  ON conversion_funnel_events(lead_id, stage, created_at DESC);
-- Índice por conversa
CREATE INDEX IF NOT EXISTS idx_conversion_funnel_conversation
  ON conversion_funnel_events(conversation_id);

ALTER TABLE conversion_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_conversion_funnel_events" ON conversion_funnel_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "inbox_members_view_conversion_funnel_events" ON conversion_funnel_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = conversion_funnel_events.instance_id
        AND iu.user_id = auth.uid()
    )
  );
