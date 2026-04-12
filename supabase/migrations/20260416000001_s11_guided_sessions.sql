-- S11: Guided Flow Builder sessions
-- Armazena histórico de chat e draft_flow gerado pela IA
-- Expira em 24h via pg_cron

CREATE TABLE IF NOT EXISTS guided_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   TEXT NOT NULL,
  messages      JSONB NOT NULL DEFAULT '[]',
  draft_flow    JSONB,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guided_sessions_expires ON guided_sessions (expires_at);
CREATE INDEX idx_guided_sessions_instance ON guided_sessions (instance_id);

ALTER TABLE guided_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only" ON guided_sessions USING (false);

SELECT cron.schedule(
  'cleanup-guided-sessions',
  '0 2 * * *',
  $$DELETE FROM guided_sessions WHERE expires_at < now()$$
);
