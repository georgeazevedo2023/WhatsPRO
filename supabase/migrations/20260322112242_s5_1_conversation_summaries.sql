-- S5.1: Persistent long context — conversation history on lead_profiles
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS conversation_summaries JSONB DEFAULT '[]';

-- Structure: array of objects:
-- [{ "date": "2026-03-22T...", "summary": "Lead buscou tinta rosa...", "products": ["Tinta Rosa"], "sentiment": "positivo", "outcome": "handoff" }]
-- Keeps last 10 entries, injected into AI prompt as historical context
;
