-- ============================================================
-- UTM Campaigns & Visits — Trackable links per instance
-- ============================================================

-- 0. Helper: set_updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. utm_campaigns
CREATE TABLE public.utm_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     text NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES auth.users(id),

  name            text NOT NULL,
  slug            text NOT NULL,
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),

  utm_source      text NOT NULL DEFAULT '',
  utm_medium      text NOT NULL DEFAULT '',
  utm_campaign    text NOT NULL DEFAULT '',
  utm_term        text,
  utm_content     text,

  destination_phone text NOT NULL,
  welcome_message   text NOT NULL DEFAULT '',

  campaign_type   text NOT NULL DEFAULT 'venda'
    CHECK (campaign_type IN ('venda', 'suporte', 'promocao', 'evento', 'recall', 'fidelizacao')),
  ai_template     text NOT NULL DEFAULT '',
  ai_custom_text  text NOT NULL DEFAULT '',

  starts_at       timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (slug)
);

CREATE INDEX idx_utm_campaigns_instance ON public.utm_campaigns(instance_id);
CREATE INDEX idx_utm_campaigns_slug ON public.utm_campaigns(slug);
CREATE INDEX idx_utm_campaigns_status ON public.utm_campaigns(status);

-- 2. utm_visits
CREATE TABLE public.utm_visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.utm_campaigns(id) ON DELETE CASCADE,

  ref_code        text NOT NULL,
  visitor_ip      text,
  user_agent      text,
  referrer        text,

  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  matched_at      timestamptz,

  status          text NOT NULL DEFAULT 'visited'
    CHECK (status IN ('visited', 'matched', 'expired')),

  visited_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (ref_code)
);

CREATE INDEX idx_utm_visits_campaign ON public.utm_visits(campaign_id);
CREATE INDEX idx_utm_visits_ref_code ON public.utm_visits(ref_code);
CREATE INDEX idx_utm_visits_contact ON public.utm_visits(contact_id);
CREATE INDEX idx_utm_visits_status ON public.utm_visits(status);
CREATE INDEX idx_utm_visits_visited_at ON public.utm_visits(visited_at);

-- 3. Auto-update updated_at
CREATE TRIGGER set_utm_campaigns_updated_at
  BEFORE UPDATE ON public.utm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.utm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage campaigns"
  ON public.utm_campaigns FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Gerentes view campaigns"
  ON public.utm_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = utm_campaigns.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins manage visits"
  ON public.utm_visits FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Gerentes view visits"
  ON public.utm_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.utm_campaigns c
      JOIN public.inboxes ib ON ib.instance_id = c.instance_id
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE c.id = utm_visits.campaign_id
        AND iu.user_id = auth.uid()
    )
  );
