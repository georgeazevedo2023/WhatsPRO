-- M17 F4: Enquetes/Polls (WhatsApp Nativo)
-- poll_messages: enquetes enviadas. poll_responses: votos recebidos.
-- UAZAPI /send/poll + webhook poll_update.

-- =============================================================================
-- poll_messages: enquetes enviadas
-- =============================================================================
CREATE TABLE IF NOT EXISTS poll_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  message_id TEXT,                                  -- UAZAPI messageId (3EB0ABC...)
  question TEXT NOT NULL CHECK (char_length(question) <= 255),
  options TEXT[] NOT NULL,                           -- 2-12 items
  selectable_count INT NOT NULL DEFAULT 1 CHECK (selectable_count IN (0, 1)),
  auto_tags JSONB DEFAULT '{}',                     -- D2: {"Causa Animal":"tema:animal"}
  image_url TEXT,                                    -- D1: imagem enviada antes da enquete
  funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_messages_conversation ON poll_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_poll_messages_message_id   ON poll_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_poll_messages_instance     ON poll_messages(instance_id);

ALTER TABLE poll_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_poll_messages" ON poll_messages
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_poll_messages" ON poll_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = poll_messages.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_poll_messages" ON poll_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- poll_responses: votos recebidos
-- =============================================================================
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_message_id UUID NOT NULL REFERENCES poll_messages(id) ON DELETE CASCADE,
  voter_jid TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  selected_options TEXT[] NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_message_id, voter_jid)
);

CREATE INDEX IF NOT EXISTS idx_poll_responses_poll    ON poll_responses(poll_message_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_contact ON poll_responses(contact_id);

ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_poll_responses" ON poll_responses
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_poll_responses" ON poll_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM poll_messages pm
      JOIN inboxes ib ON ib.instance_id = pm.instance_id
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE pm.id = poll_responses.poll_message_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_poll_responses" ON poll_responses
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
