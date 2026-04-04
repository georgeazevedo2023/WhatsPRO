-- Change ia_blocked from boolean to array of instance_ids
-- Contacts blocked per instance, not globally
ALTER TABLE contacts DROP COLUMN IF EXISTS ia_blocked;
ALTER TABLE contacts ADD COLUMN ia_blocked_instances TEXT[] DEFAULT '{}';

-- Blocked numbers list per AI agent (for internal team, suppliers, etc.)
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS blocked_numbers TEXT[] DEFAULT '{}';
;
