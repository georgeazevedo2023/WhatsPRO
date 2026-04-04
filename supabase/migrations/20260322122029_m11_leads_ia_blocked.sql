-- M11 Leads: Add ia_blocked to contacts for global AI blocking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ia_blocked BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contacts_ia_blocked ON contacts(ia_blocked);
;
