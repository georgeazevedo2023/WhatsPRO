ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE lead_profiles ADD COLUMN IF NOT EXISTS average_ticket NUMERIC;
NOTIFY pgrst, 'reload schema';;
