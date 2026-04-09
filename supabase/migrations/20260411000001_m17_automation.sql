-- M17 F1+F2: Motor de Automação (automation_rules) + Funis Agênticos (funnels campos)
-- Gatilho > Condição > Ação dentro dos funis
-- Funis Agênticos: funnel_prompt + handoff_rule por funil

-- =============================================================================
-- automation_rules: motor de automação
-- =============================================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  position INT DEFAULT 0,

  -- GATILHO
  trigger_type TEXT NOT NULL,
  -- 'card_moved'|'poll_answered'|'form_completed'|'lead_created'
  -- |'conversation_resolved'|'tag_added'|'label_applied'
  trigger_config JSONB DEFAULT '{}',

  -- CONDIÇÃO
  condition_type TEXT DEFAULT 'always',
  -- 'always'|'tag_contains'|'funnel_is'|'business_hours'
  condition_config JSONB DEFAULT '{}',

  -- AÇÃO
  action_type TEXT NOT NULL,
  -- 'send_message'|'move_card'|'add_tag'|'activate_ai'|'handoff'|'send_poll'(placeholder)
  action_config JSONB DEFAULT '{}',

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_funnel   ON automation_rules(funnel_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger  ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled  ON automation_rules(funnel_id, enabled);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Super admins: acesso total
CREATE POLICY "super_admins_manage_automation_rules" ON automation_rules
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Gerentes e usuários: acesso via funil → instância
CREATE POLICY "inbox_members_view_automation_rules" ON automation_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funnels f
      JOIN inboxes ib ON ib.instance_id = f.instance_id
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE f.id = automation_rules.funnel_id
        AND iu.user_id = auth.uid()
    )
  );

-- Service role: acesso total (edge functions)
CREATE POLICY "service_role_automation_rules" ON automation_rules
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_rules_updated_at();

-- =============================================================================
-- M17 F2: Funis Agênticos — novos campos na tabela funnels
-- =============================================================================

-- Roteiro obrigatório injetado no AI Agent quando funil está ativo
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS funnel_prompt TEXT;

-- Regra de handoff do funil: 'so_se_pedir' | 'apos_n_msgs' | 'nunca'
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS handoff_rule TEXT DEFAULT 'so_se_pedir';

-- Departamento de destino do handoff do funil (override do agente)
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS handoff_department_id UUID REFERENCES departments(id);

-- Limite de mensagens antes do handoff automático (quando handoff_rule='apos_n_msgs')
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS handoff_max_messages INT DEFAULT 8;
