-- Sprint 3: Add tags to conversations + extraction_fields to ai_agents

-- Tags on conversations (same pattern as kanban_cards.tags)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_conversations_tags ON conversations USING GIN (tags);

-- Extraction fields config on ai_agents (JSONB array of field definitions)
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS extraction_fields JSONB DEFAULT '[]';
;
