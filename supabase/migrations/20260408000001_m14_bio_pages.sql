-- ============================================================
-- M14 — Bio Link Pages
-- Bio pages tipo Linktree integradas ao WhatsPRO
-- ============================================================

-- 1. bio_pages
CREATE TABLE public.bio_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     text NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES auth.users(id),

  slug            text NOT NULL,
  title           text NOT NULL,
  description     text,
  avatar_url      text,

  -- Aparência
  bg_color        text NOT NULL DEFAULT '#25D366',
  bg_type         text NOT NULL DEFAULT 'solid'
    CHECK (bg_type IN ('solid', 'gradient')),
  bg_gradient_to  text,
  button_style    text NOT NULL DEFAULT 'filled'
    CHECK (button_style IN ('filled', 'outline', 'soft')),
  button_radius   text NOT NULL DEFAULT 'full'
    CHECK (button_radius IN ('full', 'lg', 'md')),
  button_color    text NOT NULL DEFAULT '#25D366',
  text_color      text NOT NULL DEFAULT '#ffffff',

  -- Template base
  template        text NOT NULL DEFAULT 'simples'
    CHECK (template IN ('simples', 'shopping', 'negocio')),

  -- Analytics
  view_count      integer NOT NULL DEFAULT 0,

  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (instance_id, slug)
);

CREATE INDEX idx_bio_pages_instance ON public.bio_pages(instance_id);
CREATE INDEX idx_bio_pages_slug ON public.bio_pages(slug);
CREATE INDEX idx_bio_pages_created_by ON public.bio_pages(created_by);

-- 2. bio_buttons
CREATE TABLE public.bio_buttons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bio_page_id         uuid NOT NULL REFERENCES public.bio_pages(id) ON DELETE CASCADE,

  position            integer NOT NULL DEFAULT 0,
  label               text NOT NULL,

  -- Tipo de destino
  type                text NOT NULL DEFAULT 'url'
    CHECK (type IN ('url', 'whatsapp', 'form', 'social')),

  -- url / form
  url                 text,
  form_slug           text,

  -- whatsapp
  phone               text,
  pre_message         text,
  whatsapp_tag        text,

  -- social
  social_platform     text
    CHECK (social_platform IN ('instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'whatsapp', 'twitter', 'pinterest', 'telegram')),

  -- Layout visual
  layout              text NOT NULL DEFAULT 'stack'
    CHECK (layout IN ('stack', 'featured', 'social_icon')),
  thumbnail_url       text,
  featured_image_url  text,

  -- Analytics
  click_count         integer NOT NULL DEFAULT 0,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_buttons_page ON public.bio_buttons(bio_page_id, position);

-- 3. updated_at trigger para bio_pages
CREATE TRIGGER set_bio_pages_updated_at
  BEFORE UPDATE ON public.bio_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.bio_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_buttons ENABLE ROW LEVEL SECURITY;

-- bio_pages: admin lê/escreve próprias páginas
CREATE POLICY "bio_pages_select_own" ON public.bio_pages
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "bio_pages_insert_own" ON public.bio_pages
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "bio_pages_update_own" ON public.bio_pages
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "bio_pages_delete_own" ON public.bio_pages
  FOR DELETE USING (created_by = auth.uid());

-- bio_buttons: herda acesso via bio_page_id
CREATE POLICY "bio_buttons_select_via_page" ON public.bio_buttons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_buttons.bio_page_id
        AND bp.created_by = auth.uid()
    )
  );

CREATE POLICY "bio_buttons_insert_via_page" ON public.bio_buttons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_buttons.bio_page_id
        AND bp.created_by = auth.uid()
    )
  );

CREATE POLICY "bio_buttons_update_via_page" ON public.bio_buttons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_buttons.bio_page_id
        AND bp.created_by = auth.uid()
    )
  );

CREATE POLICY "bio_buttons_delete_via_page" ON public.bio_buttons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_buttons.bio_page_id
        AND bp.created_by = auth.uid()
    )
  );

-- 5. RPCs atômicas para analytics (service role — sem RLS)
CREATE OR REPLACE FUNCTION public.increment_bio_view(p_bio_page_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.bio_pages
  SET view_count = view_count + 1
  WHERE id = p_bio_page_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_bio_click(p_button_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.bio_buttons
  SET click_count = click_count + 1
  WHERE id = p_button_id;
$$;
