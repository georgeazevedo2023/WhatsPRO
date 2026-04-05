-- Add landing_mode and form_slug to utm_campaigns
-- landing_mode: 'redirect' (countdown → wa.me) or 'form' (landing page form)
-- form_slug: links to whatsapp_forms.slug when mode='form'
ALTER TABLE public.utm_campaigns
  ADD COLUMN IF NOT EXISTS landing_mode text NOT NULL DEFAULT 'redirect'
    CHECK (landing_mode IN ('redirect', 'form')),
  ADD COLUMN IF NOT EXISTS form_slug text,
  ADD COLUMN IF NOT EXISTS kanban_board_id uuid REFERENCES public.kanban_boards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_utm_campaigns_landing_mode ON public.utm_campaigns(landing_mode);
