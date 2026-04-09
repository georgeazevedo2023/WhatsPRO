-- M17 F5: NPS + Métricas
-- Campos de NPS na ai_agents + is_nps na poll_messages

-- =============================================================================
-- ai_agents: NPS config fields
-- =============================================================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_enabled BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_delay_minutes INT DEFAULT 5;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_question TEXT DEFAULT 'Como voce avalia nosso atendimento?';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_options JSONB DEFAULT '["Excelente","Bom","Regular","Ruim","Pessimo"]';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_notify_on_bad BOOLEAN DEFAULT true;

-- =============================================================================
-- poll_messages: flag NPS
-- =============================================================================
ALTER TABLE poll_messages ADD COLUMN IF NOT EXISTS is_nps BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_poll_messages_is_nps ON poll_messages(is_nps) WHERE is_nps = true;

-- =============================================================================
-- notifications table (if not exists) for NPS bad note alerts
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_own_notifications" ON notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "service_role_notifications" ON notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
