-- M10 Sprint 2: Catálogo, Knowledge, Media

CREATE TABLE public.ai_agent_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  sku TEXT,
  title TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  description TEXT,
  price DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  in_stock BOOLEAN NOT NULL DEFAULT true,
  images TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  position INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'faq',
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'support',
  title TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  tags TEXT[] DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_products_agent ON public.ai_agent_products(agent_id);
CREATE INDEX idx_ai_products_category ON public.ai_agent_products(category, subcategory);
CREATE INDEX idx_ai_products_search ON public.ai_agent_products USING gin(to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));
CREATE INDEX idx_ai_knowledge_agent ON public.ai_agent_knowledge(agent_id);
CREATE INDEX idx_ai_media_agent ON public.ai_agent_media(agent_id);

-- RLS
ALTER TABLE public.ai_agent_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_products" ON public.ai_agent_products FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "sa_knowledge" ON public.ai_agent_knowledge FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "sa_media" ON public.ai_agent_media FOR ALL USING (is_super_admin(auth.uid()));

-- Auto-update
CREATE TRIGGER ai_products_updated_at BEFORE UPDATE ON public.ai_agent_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;
