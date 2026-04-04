-- S5.3: Lead Card — new fields on lead_profiles
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}';
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
;
