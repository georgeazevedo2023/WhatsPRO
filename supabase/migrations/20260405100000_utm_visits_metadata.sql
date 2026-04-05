-- Add metadata JSONB column to utm_visits for client-side captured data
-- (screen size, language, timezone, whatsapp detection)
ALTER TABLE public.utm_visits
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
