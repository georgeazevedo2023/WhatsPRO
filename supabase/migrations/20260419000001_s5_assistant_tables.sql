-- M19-S5: IA Conversacional — Tabelas do Assistente
-- assistant_conversations: historico de conversas gestor ↔ IA
-- assistant_cache: cache de queries parametrizadas (TTL 5min)

-- ============================================================
-- 1. assistant_conversations
-- ============================================================

CREATE TABLE public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assistant_conversations IS 'Historico de conversas do assistente IA de metricas (gestor ↔ IA)';

CREATE INDEX idx_assistant_convs_instance ON public.assistant_conversations(instance_id);
CREATE INDEX idx_assistant_convs_user ON public.assistant_conversations(user_id);
CREATE INDEX idx_assistant_convs_updated ON public.assistant_conversations(updated_at DESC);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_assistant_conversations
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own assistant conversations"
  ON public.assistant_conversations
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. assistant_cache
-- ============================================================

CREATE TABLE public.assistant_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

COMMENT ON TABLE public.assistant_cache IS 'Cache de queries do assistente IA (TTL 5min, dedup por hash)';

CREATE UNIQUE INDEX idx_assistant_cache_lookup
  ON public.assistant_cache(instance_id, query_hash);

-- RLS
ALTER TABLE public.assistant_cache ENABLE ROW LEVEL SECURITY;

-- Gerentes e super_admins podem ler cache (edge fn usa service role para write)
CREATE POLICY "Managers read assistant cache"
  ON public.assistant_cache
  FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_gerente(auth.uid()));

-- Service role (edge fn) pode inserir/atualizar/deletar cache
CREATE POLICY "Service can manage assistant cache"
  ON public.assistant_cache
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (is_super_admin(auth.uid()) OR is_gerente(auth.uid()));

-- ============================================================
-- 3. Cleanup: cron para limpar cache expirado (a cada hora)
-- ============================================================

-- Nota: a edge function assistant-chat tambem limpa cache expirado
-- antes de inserir novos registros. O cron e um fallback.
SELECT cron.schedule(
  'cleanup-assistant-cache',
  '15 * * * *',
  $$DELETE FROM public.assistant_cache WHERE expires_at < now()$$
);
