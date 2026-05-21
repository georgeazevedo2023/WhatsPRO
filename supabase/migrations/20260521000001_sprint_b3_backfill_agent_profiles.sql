-- Sprint B3: Backfill agent_profiles for active agents that still rely on sub_agents JSONB.
-- Plus trigger AFTER INSERT ON ai_agents to ensure new agents always get a default profile row.

-- =============================================================================
-- Part 1: Backfill — clone of M17 F3 INSERT...SELECT, idempotent via ON CONFLICT
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
-- Part 2: Trigger — ensures every new ai_agent has at least one default profile.
-- Without this, agents created post-corte would have subAgentInstruction='' silently.
-- =============================================================================
CREATE OR REPLACE FUNCTION ensure_default_agent_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Idempotent: only inserts when no default profile exists for this agent
  INSERT INTO agent_profiles (agent_id, name, slug, prompt, is_default, position, enabled)
  VALUES (NEW.id, 'SDR (Qualificação)', 'sdr', '', true, 1, true)
  ON CONFLICT (agent_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_agents_ensure_default_profile ON ai_agents;
CREATE TRIGGER ai_agents_ensure_default_profile
  AFTER INSERT ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION ensure_default_agent_profile();
