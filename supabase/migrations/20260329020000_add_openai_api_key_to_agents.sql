-- Add OpenAI API key column to ai_agents table
-- Allows per-agent OpenAI key configuration from the admin panel
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- Comment for documentation
COMMENT ON COLUMN ai_agents.openai_api_key IS 'OpenAI API key for this agent (overrides env OPENAI_API_KEY)';
