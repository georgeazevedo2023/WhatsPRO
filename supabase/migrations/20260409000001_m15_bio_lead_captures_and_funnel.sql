-- ============================================================
-- M15 — Bio Lead Captures table + Funnel foundation
-- Creates bio_lead_captures (was missing migration) with
-- contact_id FK for lead tracking integration
-- ============================================================

-- 1. bio_lead_captures — captura de leads via Bio Link
CREATE TABLE IF NOT EXISTS public.bio_lead_captures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bio_page_id     uuid NOT NULL REFERENCES public.bio_pages(id) ON DELETE CASCADE,
  bio_button_id   uuid REFERENCES public.bio_buttons(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  name            text,
  phone           text,
  email           text,
  extra_data      jsonb,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_lead_captures_page ON public.bio_lead_captures(bio_page_id);
CREATE INDEX IF NOT EXISTS idx_bio_lead_captures_contact ON public.bio_lead_captures(contact_id);

-- 2. RLS
ALTER TABLE public.bio_lead_captures ENABLE ROW LEVEL SECURITY;

-- Admin pode ler capturas das próprias páginas
CREATE POLICY "bio_lead_captures_select_via_page" ON public.bio_lead_captures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_lead_captures.bio_page_id
        AND bp.created_by = auth.uid()
    )
  );

-- Service role insere (bio-public edge function)
CREATE POLICY "bio_lead_captures_insert_service" ON public.bio_lead_captures
  FOR INSERT WITH CHECK (true);

-- 3. Garantir que lead_profiles.origin existe (idempotente)
ALTER TABLE public.lead_profiles ADD COLUMN IF NOT EXISTS origin TEXT;
