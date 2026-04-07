-- M16: Funnels - Camada de orquestracao que unifica Campanhas + Bio Link + Formularios
-- Cada funil orquestra utm_campaigns, bio_pages e whatsapp_forms sob um conceito unico

CREATE TABLE IF NOT EXISTS funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),

  -- Identidade
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'sorteio', 'captacao', 'venda', 'vaga', 'lancamento', 'evento', 'atendimento'
  )),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  icon TEXT,

  -- Links para recursos orquestrados (auto-criados pelo wizard)
  campaign_id UUID REFERENCES utm_campaigns(id) ON DELETE SET NULL,
  bio_page_id UUID REFERENCES bio_pages(id) ON DELETE SET NULL,
  form_id UUID REFERENCES whatsapp_forms(id) ON DELETE SET NULL,
  kanban_board_id UUID REFERENCES kanban_boards(id) ON DELETE SET NULL,

  -- AI Agent context
  ai_template TEXT,
  ai_custom_text TEXT,

  -- Handoff customizado por funil
  handoff_message TEXT,
  handoff_message_outside_hours TEXT,
  handoff_department TEXT,
  max_messages_before_handoff INTEGER DEFAULT 8,

  -- Config especifica do tipo (JSONB flexivel)
  settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(instance_id, slug)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_funnels_instance ON funnels(instance_id);
CREATE INDEX IF NOT EXISTS idx_funnels_status ON funnels(status);
CREATE INDEX IF NOT EXISTS idx_funnels_type ON funnels(type);
CREATE INDEX IF NOT EXISTS idx_funnels_campaign ON funnels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_funnels_bio_page ON funnels(bio_page_id);
CREATE INDEX IF NOT EXISTS idx_funnels_form ON funnels(form_id);

-- RLS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

-- Super admins: full CRUD
CREATE POLICY "super_admins_manage_funnels" ON funnels
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Gerentes: read-only nos funis de instancias que tem acesso
CREATE POLICY "gerentes_view_funnels" ON funnels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN inbox_users iu ON iu.user_id = p.id
      JOIN inboxes i ON i.id = iu.inbox_id
      WHERE p.id = auth.uid()
        AND p.role = 'gerente'
        AND i.instance_id = funnels.instance_id
    )
  );

-- Service role: full access (para edge functions)
CREATE POLICY "service_role_funnels" ON funnels
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_funnels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER funnels_updated_at
  BEFORE UPDATE ON funnels
  FOR EACH ROW
  EXECUTE FUNCTION update_funnels_updated_at();

-- RPC para contar leads por funil (via tag funil:SLUG nas conversas)
CREATE OR REPLACE FUNCTION get_funnel_lead_count(p_funnel_slug TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT c.contact_id)::INTEGER
  FROM conversations c
  WHERE ('funil:' || p_funnel_slug) = ANY(c.tags)
    AND c.contact_id IS NOT NULL;
$$;
