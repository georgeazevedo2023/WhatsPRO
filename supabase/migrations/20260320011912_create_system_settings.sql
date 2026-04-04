
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read
CREATE POLICY "super_admin read system_settings"
  ON system_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

-- Only super_admin can insert
CREATE POLICY "super_admin insert system_settings"
  ON system_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

-- Only super_admin can update
CREATE POLICY "super_admin update system_settings"
  ON system_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

-- Only super_admin can delete
CREATE POLICY "super_admin delete system_settings"
  ON system_settings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_system_settings_timestamp();

-- Seed the known secrets with empty values so they appear in the UI
INSERT INTO system_settings (key, value, description, is_secret) VALUES
  ('GROQ_API_KEY', '', 'Chave da API Groq para IA e transcrição de áudio', true),
  ('UAZAPI_SERVER_URL', 'https://wsmart.uazapi.com', 'URL do servidor UAZAPI', false),
  ('UAZAPI_ADMIN_TOKEN', '', 'Token de administrador do UAZAPI', true),
  ('SUPABASE_MANAGEMENT_TOKEN', '', 'Token de gerenciamento do Supabase (para aplicar secrets)', true)
ON CONFLICT (key) DO NOTHING;
;
