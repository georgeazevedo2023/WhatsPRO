-- Add max_qualification_retries to ai_agents
-- Controls how many qualification questions the AI asks before handing off
-- when search_products returns 0 results.
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS max_qualification_retries INT NOT NULL DEFAULT 2;

COMMENT ON COLUMN ai_agents.max_qualification_retries IS
  'Number of qualification questions AI asks before handoff when product not found (default 2)';
