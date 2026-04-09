-- M17 F3: Agent Profiles (Perfis de Atendimento)
-- Unifica sub-agents + funnel_prompt em uma tabela reutilizável
-- Cada perfil = prompt + regras de handoff. Funis apontam via profile_id FK.

-- =============================================================================
-- agent_profiles: perfis de atendimento reutilizáveis
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',

  -- Handoff config
  handoff_rule TEXT DEFAULT 'so_se_pedir'
    CHECK (handoff_rule IN ('so_se_pedir', 'apos_n_msgs', 'nunca')),
  handoff_max_messages INT DEFAULT 8,
  handoff_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  handoff_message TEXT,

  -- Controle
  is_default BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(agent_id, slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agent_profiles_agent   ON agent_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_enabled ON agent_profiles(agent_id, enabled);
-- Max 1 default por agente
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profiles_default ON agent_profiles(agent_id) WHERE is_default = true;

-- =============================================================================
-- RLS (padrão automation_rules)
-- =============================================================================
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

-- Super admins: acesso total
CREATE POLICY "super_admins_manage_agent_profiles" ON agent_profiles
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Gerentes e usuários: acesso via agent → instance → inbox_users
CREATE POLICY "inbox_members_view_agent_profiles" ON agent_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_agents a
      JOIN inboxes ib ON ib.instance_id = a.instance_id
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE a.id = agent_profiles.agent_id
        AND iu.user_id = auth.uid()
    )
  );

-- Service role: acesso total (edge functions)
CREATE POLICY "service_role_agent_profiles" ON agent_profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Trigger updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_agent_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_profiles_updated_at
  BEFORE UPDATE ON agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_profiles_updated_at();

-- =============================================================================
-- funnels.profile_id FK
-- =============================================================================
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_funnels_profile ON funnels(profile_id);

-- =============================================================================
-- Data migration: sub_agents JSONB → agent_profiles rows
-- SDR vira is_default=true. Só migra enabled=true com prompt não vazio.
-- =============================================================================
INSERT INTO agent_profiles (agent_id, name, slug, prompt, is_default, position, enabled)
SELECT
  a.id,
  CASE kv.key
    WHEN 'sdr' THEN 'SDR (Qualificação)'
    WHEN 'sales' THEN 'Vendas'
    WHEN 'support' THEN 'Suporte'
    WHEN 'scheduling' THEN 'Agendamento'
    WHEN 'handoff' THEN 'Transbordo'
    ELSE initcap(kv.key)
  END,
  kv.key,
  kv.value->>'prompt',
  (kv.key = 'sdr'),
  CASE kv.key
    WHEN 'sdr' THEN 1 WHEN 'sales' THEN 2 WHEN 'support' THEN 3
    WHEN 'scheduling' THEN 4 WHEN 'handoff' THEN 5 ELSE 6
  END,
  true
FROM ai_agents a,
LATERAL jsonb_each(a.sub_agents) AS kv(key, value)
WHERE a.sub_agents IS NOT NULL
  AND jsonb_typeof(a.sub_agents) = 'object'
  AND (kv.value->>'enabled')::boolean = true
  AND coalesce(kv.value->>'prompt', '') != ''
ON CONFLICT (agent_id, slug) DO NOTHING;

-- =============================================================================
-- Data migration: funnel_prompt → agent_profiles + link profile_id
-- Para cada funil com funnel_prompt, cria perfil e vincula.
-- =============================================================================
WITH funnel_agents AS (
  SELECT f.id AS funnel_id, f.slug AS funnel_slug, f.name AS funnel_name,
         f.funnel_prompt, f.handoff_rule AS f_handoff_rule,
         f.handoff_max_messages AS f_handoff_max_msgs,
         f.handoff_department_id AS f_handoff_dept,
         a.id AS agent_id
  FROM funnels f
  JOIN ai_agents a ON a.instance_id = f.instance_id
  WHERE f.funnel_prompt IS NOT NULL AND f.funnel_prompt != ''
    AND f.profile_id IS NULL
),
inserted_profiles AS (
  INSERT INTO agent_profiles (agent_id, name, slug, prompt, handoff_rule, handoff_max_messages, handoff_department_id, is_default, enabled)
  SELECT
    fa.agent_id,
    'Funil: ' || fa.funnel_name,
    'funil-' || fa.funnel_slug,
    fa.funnel_prompt,
    COALESCE(fa.f_handoff_rule, 'so_se_pedir'),
    fa.f_handoff_max_msgs,
    fa.f_handoff_dept,
    false,
    true
  FROM funnel_agents fa
  ON CONFLICT (agent_id, slug) DO NOTHING
  RETURNING id, slug
)
UPDATE funnels f
SET profile_id = ip.id
FROM inserted_profiles ip
WHERE ip.slug = 'funil-' || f.slug
  AND f.profile_id IS NULL;
