-- ============================================================
-- FASE 1: Fundação — Validator Agent + Prompt Studio + Tags + Carousel + Horário
-- Sprint: AI Agent v2 (30 perguntas validadas)
-- ============================================================

-- 1. Tabela ai_agent_validations (scoring do Validator Agent)
CREATE TABLE IF NOT EXISTS public.ai_agent_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','REWRITE','BLOCK')),
  violations JSONB DEFAULT '[]',
  bonuses JSONB DEFAULT '[]',
  rewritten_text TEXT,
  suggestion TEXT,
  block_action TEXT,
  model TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validations_agent_created
  ON public.ai_agent_validations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validations_score
  ON public.ai_agent_validations(score);
CREATE INDEX IF NOT EXISTS idx_validations_conversation
  ON public.ai_agent_validations(conversation_id, created_at DESC);

ALTER TABLE public.ai_agent_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on validations"
  ON public.ai_agent_validations FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ai_agent_validations IS
  'Validator Agent scoring: each AI response is scored 0-10 before sending to lead';

-- 2. Novas colunas em ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS prompt_sections JSONB DEFAULT '{}';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS carousel_text TEXT DEFAULT 'Confira nossas opções:';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS carousel_button_1 TEXT DEFAULT 'Eu quero!';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS carousel_button_2 TEXT DEFAULT 'Mais informações';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS handoff_message_outside_hours TEXT DEFAULT 'Sua mensagem foi recebida e retornaremos assim que possível! 😊';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_pre_search_questions INT NOT NULL DEFAULT 3;
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS validator_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS validator_model TEXT DEFAULT 'gpt-4.1-nano';
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS validator_rigor TEXT DEFAULT 'moderado' CHECK (validator_rigor IN ('moderado','rigoroso','maximo'));
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS tts_fallback_providers JSONB DEFAULT '["cartesia","murf","speechify"]';

COMMENT ON COLUMN public.ai_agents.prompt_sections IS
  'Prompt Studio: 10 seções editáveis do system prompt';
COMMENT ON COLUMN public.ai_agents.carousel_text IS
  'Texto exibido antes dos cards do carrossel no WhatsApp';
COMMENT ON COLUMN public.ai_agents.carousel_button_1 IS
  'Texto do botão principal de cada card do carrossel';
COMMENT ON COLUMN public.ai_agents.carousel_button_2 IS
  'Texto do botão secundário (vazio = sem 2o botão)';
COMMENT ON COLUMN public.ai_agents.handoff_message_outside_hours IS
  'Mensagem de transbordo enviada fora do horário comercial';
COMMENT ON COLUMN public.ai_agents.max_pre_search_questions IS
  'Max perguntas de qualificação antes de buscar produtos (termos genéricos). 0=busca imediata';
COMMENT ON COLUMN public.ai_agents.validator_enabled IS
  'Ativar Validator Agent (audita cada resposta antes de enviar)';
COMMENT ON COLUMN public.ai_agents.validator_model IS
  'Modelo do Validator Agent (recomendado: gpt-4.1-nano)';
COMMENT ON COLUMN public.ai_agents.validator_rigor IS
  'Nível de rigor: moderado, rigoroso, maximo';
COMMENT ON COLUMN public.ai_agents.tts_fallback_providers IS
  'Cadeia de fallback TTS: Gemini → providers listados → texto';

-- 3. Migrar business_hours formato antigo → grade semanal
UPDATE public.ai_agents
SET business_hours = jsonb_build_object(
  'mon', jsonb_build_object('open', true, 'start', business_hours->>'start', 'end', business_hours->>'end'),
  'tue', jsonb_build_object('open', true, 'start', business_hours->>'start', 'end', business_hours->>'end'),
  'wed', jsonb_build_object('open', true, 'start', business_hours->>'start', 'end', business_hours->>'end'),
  'thu', jsonb_build_object('open', true, 'start', business_hours->>'start', 'end', business_hours->>'end'),
  'fri', jsonb_build_object('open', true, 'start', business_hours->>'start', 'end', business_hours->>'end'),
  'sat', jsonb_build_object('open', false),
  'sun', jsonb_build_object('open', false)
)
WHERE business_hours IS NOT NULL
  AND business_hours ? 'start'
  AND NOT business_hours ? 'mon';

COMMENT ON COLUMN public.ai_agents.business_hours IS
  'Grade semanal: {"mon":{"open":true,"start":"08:00","end":"18:00"}, ...}';

-- 4. Busca fuzzy pg_trgm em ai_agent_products
CREATE INDEX IF NOT EXISTS idx_ai_agent_products_title_trgm
  ON public.ai_agent_products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_agent_products_description_trgm
  ON public.ai_agent_products USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_agent_products_category_trgm
  ON public.ai_agent_products USING gin (category gin_trgm_ops);

DROP FUNCTION IF EXISTS public.search_products_fuzzy(UUID, TEXT, DOUBLE PRECISION, INT);
DROP FUNCTION IF EXISTS public.search_products_fuzzy(UUID, TEXT, REAL, INT);

CREATE FUNCTION public.search_products_fuzzy(
  _agent_id UUID,
  _query TEXT,
  _threshold REAL DEFAULT 0.3,
  _limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, subcategory TEXT,
  description TEXT, price NUMERIC, images TEXT[], in_stock BOOLEAN,
  sim REAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(_query)), ' ')) AS word
    WHERE length(trim(_query)) > 0
  ),
  product_words AS (
    SELECT
      p.id, p.title, p.category, p.subcategory,
      p.description, p.price, p.images, p.in_stock,
      unnest(string_to_array(
        lower(p.title) || ' ' || lower(COALESCE(p.category,'')) || ' ' || lower(COALESCE(p.subcategory,'')),
        ' '
      )) AS pword
    FROM ai_agent_products p
    WHERE p.agent_id = _agent_id AND p.enabled = true
  ),
  word_matches AS (
    SELECT
      pw.id, pw.title, pw.category, pw.subcategory,
      pw.description, pw.price, pw.images, pw.in_stock,
      MAX(similarity(pw.pword, qw.word)) AS best_sim
    FROM product_words pw
    CROSS JOIN query_words qw
    WHERE similarity(pw.pword, qw.word) > _threshold
    GROUP BY pw.id, pw.title, pw.category, pw.subcategory,
             pw.description, pw.price, pw.images, pw.in_stock
  )
  SELECT wm.id, wm.title, wm.category, wm.subcategory,
         wm.description, wm.price, wm.images, wm.in_stock,
         wm.best_sim AS sim
  FROM word_matches wm
  ORDER BY wm.best_sim DESC
  LIMIT _limit;
$$;

COMMENT ON FUNCTION public.search_products_fuzzy IS
  'Busca fuzzy word-level: compara cada palavra da query contra cada palavra do título/categoria. Captura erros de digitação.';

-- 5. Default Prompt Sections e Sub-Agent Prompts em system_settings
INSERT INTO public.system_settings (key, value) VALUES (
  'default_prompt_sections',
  '{
    "identity": "Você é {agent_name}, um assistente virtual de WhatsApp.\n\nPersonalidade: {personality}\n\nRegras gerais:\n- Responda SEMPRE em português do Brasil\n- Seja conciso (máximo 3-4 frases por resposta)\n- Use emojis com moderação (1-2 por mensagem)\n- Você é um SDR de alta performance\n- NUNCA dispense uma venda",
    "sdr_flow": "QUALIFICAÇÃO ZERO-CALL:\na) GENÉRICA → NÃO busque! Faça até {max_pre_search_questions} perguntas\nb) COM MARCA → search_products IMEDIATO\nc) MODELO COMPLETO → search_products IMEDIATO",
    "product_rules": "REGRAS DE PRODUTOS:\n- 0 resultados → qualificação → handoff\n- 1 produto 1 foto → foto com título+preço\n- 1 produto 2+ fotos → carrossel multi-foto\n- 2-5 produtos → carrossel\n- 10+ → afunilar ou handoff\nAPÓS MÍDIA: não repita preços, pergunte se interessa",
    "handoff_rules": "TRANSBORDO:\n- Lead confirma interesse → handoff\n- Lead pede humano → handoff\n- 0 resultados qualificados → valorize + handoff\n- B2B → Vendas Corporativas\n- Emprego → RH\n- Financeiro → Financeiro\nOrdem: set_tags → update_lead_profile → handoff_to_human",
    "tags_labels": "TAGS (3 níveis):\n- motivo: saudacao|compra|troca|orcamento|duvida_tecnica|suporte|financeiro|emprego|fornecedor|informacao|fora_escopo\n- interesse: categoria do catálogo\n- produto: nome específico\n- objecao: preco|concorrente|prazo|indecisao|qualidade\n- sentimento: positivo|neutro|negativo|frustrado",
    "absolute_rules": "REGRAS ABSOLUTAS:\n1. NUNCA dizer não temos/não encontrei/em falta\n2. APENAS 1 pergunta por mensagem\n3. Nome do lead max 1x a cada 3-4 msgs\n4. NUNCA pedir permissão para transferir\n5. NUNCA inventar preços/prazos/info\n6. NUNCA mencionar concorrentes\n7. Desconto max {max_discount_percent}%\n8. Handoff envia só a mensagem configurada",
    "objections": "OBJEÇÕES:\n1. Classifique: set_tags objecao:TIPO\n2. Salve: update_lead_profile(objections)\n3. Contorne com empatia + benefícios\n4. Após 2 tentativas sem sucesso → handoff",
    "additional": ""
  }'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_settings (key, value) VALUES (
  'default_sub_agent_prompts',
  '{
    "sdr": {"label":"SDR (Qualificação)","prompt":"Agente de qualificação. Colete: nome, motivo, interesse. UMA pergunta por vez. Marca mencionada → busca imediata."},
    "sales": {"label":"Vendas","prompt":"Agente de vendas. Use search_products. 1 prod=foto, 2+=carousel. Após mídia pergunte se interessa. Confirmou → handoff."},
    "support": {"label":"Suporte","prompt":"Agente de suporte. Responda com KB/FAQ. Não sabe → handoff. Nunca invente."},
    "scheduling": {"label":"Agendamento","prompt":"Agente de agendamento. Colete data, horário, tipo. Confirme dados. Registre com set_tags."},
    "handoff": {"label":"Transbordo","prompt":"Agente de transbordo. Colete dados finais. set_tags + update_lead_profile. handoff_to_human com motivo detalhado. Nunca pergunte se pode transferir."}
  }'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
