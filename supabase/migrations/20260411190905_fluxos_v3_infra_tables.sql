-- =============================================================================
-- Fluxos Unificados v3.0 — 4 Tabelas de Infraestrutura
-- Migration: 20260415000003_fluxos_v3_infra_tables.sql
--
-- Tabelas criadas:
--   1. intent_detections    — Log do Detector de Intents (3 camadas)
--   2. flow_security_events — Eventos de Segurança (P5)
--   3. validator_logs       — Logs do Serviço Validador
--   4. media_library        — Biblioteca de Mídia Compartilhada
--
-- Dependências: instances, lead_profiles, conversations, flow_states, auth.users
-- Nota: flows e flow_states são criadas na mesma migration batch.
-- =============================================================================


-- =============================================================================
-- TABELA 1: intent_detections
-- Registra todas as execuções do Detector Unificado de Intents (3 camadas):
--   Camada 1 - Normalização  (~5ms,   100% das msgs)
--   Camada 2 - Fuzzy Match   (~10ms,  ~60% das msgs)
--   Camada 3 - Semântico LLM (~200ms, ~20% das msgs)
-- Append-only. Candidata a particionamento futuro por created_at (range monthly).
-- =============================================================================

CREATE TABLE public.intent_detections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         TEXT        NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id             UUID        NOT NULL REFERENCES public.lead_profiles(id) ON DELETE CASCADE,

  -- Texto
  message_text        TEXT,                          -- texto original recebido (para debug)
  normalized_text     TEXT,                          -- texto após normalização (sem abrev., acentos, dedup)

  -- Intent principal
  detected_intent     TEXT        NOT NULL
    CHECK (detected_intent IN (
      'cancelamento', 'pessoa', 'suporte', 'reclamacao', 'produto',
      'orcamento', 'status', 'agendamento', 'faq', 'promocao',
      'b2b', 'continuacao', 'generico'
    )),

  -- Intents secundários (quando msg é ambígua — 2+ intents simultâneos)
  secondary_intents   TEXT[]      NOT NULL DEFAULT '{}',

  -- Camada de detecção
  detection_layer     TEXT        NOT NULL
    CHECK (detection_layer IN ('normalization', 'fuzzy', 'semantic')),

  -- Scores e métricas
  confidence          FLOAT       NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  fuzzy_score         FLOAT       CHECK (fuzzy_score >= 0.0 AND fuzzy_score <= 1.0), -- Levenshtein/Soundex, null se não fuzzy
  llm_used            BOOLEAN     NOT NULL DEFAULT false,   -- true se passou pela camada semântica
  processing_time_ms  INT         NOT NULL DEFAULT 0,       -- tempo total de detecção em ms

  -- Debug
  matched_keywords    TEXT[]      NOT NULL DEFAULT '{}',    -- palavras que fizeram match
  action_taken        TEXT,                                 -- ex: 'routed_to_sales', 'triggered_flow:uuid', 'bypassed_qualification'

  -- Append-only: sem updated_at
  -- TODO: particionar por created_at (range monthly) quando volume > 10M rows
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes de performance
CREATE INDEX idx_intent_detections_instance     ON public.intent_detections(instance_id);
CREATE INDEX idx_intent_detections_conversation ON public.intent_detections(conversation_id);
CREATE INDEX idx_intent_detections_intent       ON public.intent_detections(detected_intent);
CREATE INDEX idx_intent_detections_layer        ON public.intent_detections(detection_layer);
CREATE INDEX idx_intent_detections_created      ON public.intent_detections(created_at DESC);

-- Composite: queries frequentes no dashboard de analytics
CREATE INDEX idx_intent_detections_instance_created
  ON public.intent_detections(instance_id, created_at DESC);

-- RLS
ALTER TABLE public.intent_detections ENABLE ROW LEVEL SECURITY;

-- Policy 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_intent_detections"
  ON public.intent_detections FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy 2: inbox_members — leitura via inboxes/inbox_users da instância
CREATE POLICY "inbox_members_intent_detections"
  ON public.intent_detections FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = intent_detections.instance_id
        AND iu.user_id = auth.uid()
    )
  );

-- Policy 3: service_role — acesso total (edge functions e workers)
CREATE POLICY "service_role_intent_detections"
  ON public.intent_detections FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 2: flow_security_events
-- Registra violações detectadas pelo módulo P5 Segurança:
--   - blocked_phrases (~25 frases bloqueadas por padrão)
--   - rate_limiting (msgs por minuto)
--   - bot_detection (padrões de comportamento automatizado)
--   - content_filtering (conteúdo inapropriado)
--   - data_protection (dados sensíveis: CPF, cartão)
--   - abuse_escalation (escalada para admin)
--   - prompt_injection (tentativa de injeção no LLM)
-- Append-only. Suporta resolução manual ou automática.
-- =============================================================================

CREATE TABLE public.flow_security_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         TEXT        NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id             UUID        NOT NULL REFERENCES public.lead_profiles(id) ON DELETE CASCADE,

  -- Classificação do evento
  event_type          TEXT        NOT NULL
    CHECK (event_type IN (
      'blocked_phrase',    -- mensagem continha frase bloqueada
      'rate_limit_exceeded',-- muitas msgs por minuto
      'bot_detected',      -- padrão de bot detectado
      'content_filtered',  -- conteúdo inapropriado
      'data_protection',   -- dado sensível detectado (CPF, cartão)
      'abuse_escalated',   -- escalada para admin por abuso
      'prompt_injection'   -- tentativa de injeção de prompt no LLM
    )),

  severity            TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Detalhe estruturado (triggered_phrase, pattern_matched, rate_count, etc.)
  details             JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Ação tomada imediatamente
  action_taken        TEXT        NOT NULL
    CHECK (action_taken IN ('blocked', 'warned', 'escalated', 'logged_only')),

  -- Resolução
  auto_resolved       BOOLEAN     DEFAULT false, -- true quando resolvido automaticamente (ex: rate limit resetou)
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID        REFERENCES auth.users(id),

  -- Append-only: sem updated_at
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes de performance (dashboard de segurança)
CREATE INDEX idx_flow_security_instance     ON public.flow_security_events(instance_id);
CREATE INDEX idx_flow_security_event_type   ON public.flow_security_events(event_type);
CREATE INDEX idx_flow_security_severity     ON public.flow_security_events(severity);
CREATE INDEX idx_flow_security_created      ON public.flow_security_events(created_at DESC);

-- Composite: queries de dashboard por instância + gravidade
CREATE INDEX idx_flow_security_instance_severity
  ON public.flow_security_events(instance_id, severity, created_at DESC);

-- Partial: eventos ainda não resolvidos (monitoramento ativo)
CREATE INDEX idx_flow_security_unresolved
  ON public.flow_security_events(instance_id, created_at DESC)
  WHERE auto_resolved = false AND resolved_at IS NULL;

-- GIN: busca nos detalhes JSONB
CREATE INDEX idx_flow_security_details_gin
  ON public.flow_security_events USING GIN (details);

-- RLS
ALTER TABLE public.flow_security_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_flow_security_events"
  ON public.flow_security_events FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy 2: inbox_members — leitura via inboxes/inbox_users da instância
CREATE POLICY "inbox_members_flow_security_events"
  ON public.flow_security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = flow_security_events.instance_id
        AND iu.user_id = auth.uid()
    )
  );

-- Policy 3: service_role — acesso total (edge functions e workers)
CREATE POLICY "service_role_flow_security_events"
  ON public.flow_security_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 3: validator_logs
-- Registra todas as execuções do Validator Service:
--   - Checks automáticos sem LLM: tamanho, idioma, prompt leak, preço, repetição
--   - Score LLM 0-10 (opcional, ~30% das respostas)
--   - Brand voice check
--   - Fact-check contra catálogo
--   - Shadow mode (log sem bloquear)
-- Append-only.
-- =============================================================================

CREATE TABLE public.validator_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_state_id       UUID        NOT NULL REFERENCES public.flow_states(id) ON DELETE CASCADE,
  instance_id         TEXT        NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,

  -- Texto validado
  response_text       TEXT,

  -- Checks automáticos sem LLM
  -- Estrutura esperada:
  -- {
  --   "size_ok": true,          -- resposta dentro do limite de caracteres
  --   "language_match": true,   -- idioma da resposta bate com o da conversa
  --   "no_prompt_leak": true,   -- sem vazar conteúdo do system prompt
  --   "price_check": true,      -- preços mencionados conferem com catálogo
  --   "no_repetition": true,    -- sem repetir msgs recentes da conversa
  --   "passed_all": true        -- todos os checks passaram
  -- }
  auto_checks         JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Score LLM (0-10), null se não usou LLM para validar
  llm_score           INT         CHECK (llm_score >= 0 AND llm_score <= 10),
  llm_used            BOOLEAN     NOT NULL DEFAULT false,

  -- Brand voice (score, issues[], tone_match)
  brand_voice_check   JSONB,

  -- Fact-check catálogo (passed, wrong_price, wrong_stock, corrections[])
  factcheck_catalog   JSONB,

  -- Decisão final
  final_action        TEXT        NOT NULL
    CHECK (final_action IN (
      'approved',              -- resposta aprovada sem alterações
      'approved_with_changes', -- aprovada com correções aplicadas
      'rejected',              -- bloqueada — não enviada ao lead
      'logged_only'            -- shadow mode: registrou mas não bloqueou
    )),

  changes_made        TEXT,       -- se final_action = 'approved_with_changes', descreve o que mudou
  processing_time_ms  INT         NOT NULL DEFAULT 0,

  -- Append-only: sem updated_at
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes de performance
CREATE INDEX idx_validator_logs_instance       ON public.validator_logs(instance_id);
CREATE INDEX idx_validator_logs_flow_state     ON public.validator_logs(flow_state_id);
CREATE INDEX idx_validator_logs_conversation   ON public.validator_logs(conversation_id);
CREATE INDEX idx_validator_logs_final_action   ON public.validator_logs(final_action);
CREATE INDEX idx_validator_logs_created        ON public.validator_logs(created_at DESC);

-- Partial: entradas rejeitadas (análise de qualidade)
CREATE INDEX idx_validator_logs_rejected
  ON public.validator_logs(instance_id, created_at DESC)
  WHERE final_action = 'rejected';

-- GIN: busca nos auto_checks e brand_voice_check JSONB
CREATE INDEX idx_validator_logs_auto_checks_gin
  ON public.validator_logs USING GIN (auto_checks);

-- RLS
ALTER TABLE public.validator_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_validator_logs"
  ON public.validator_logs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy 2: inbox_members — leitura via inboxes/inbox_users da instância
CREATE POLICY "inbox_members_validator_logs"
  ON public.validator_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = validator_logs.instance_id
        AND iu.user_id = auth.uid()
    )
  );

-- Policy 3: service_role — acesso total (edge functions e workers)
CREATE POLICY "service_role_validator_logs"
  ON public.validator_logs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 4: media_library
-- Biblioteca centralizada de mídias usada cross-sistema:
--   - bio_pages (imagens de capa, avatar)
--   - carrossel AI (fotos de produto geradas ou importadas do catálogo)
--   - campanhas UTM (banners promocionais)
--   - forms (imagens de cabeçalho)
--   - mídias geradas pelo Nano Banana (Gemini 3 Pro Image)
-- Suporta updated_at (registros mutáveis: nome, tags, alt_text, used_in).
-- =============================================================================

CREATE TABLE public.media_library (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         TEXT        NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_by          UUID        REFERENCES auth.users(id),

  -- Identificação
  name                TEXT        NOT NULL,  -- ex: "Banner Black Friday 2026"
  file_url            TEXT        NOT NULL,  -- URL do arquivo no Supabase Storage

  -- Tipo e metadados do arquivo
  file_type           TEXT        NOT NULL
    CHECK (file_type IN ('image', 'video', 'audio', 'document')),
  mime_type           TEXT,                  -- 'image/png', 'image/jpeg', 'video/mp4', etc.
  file_size_bytes     INT,                   -- tamanho em bytes
  width               INT,                   -- largura em pixels (imagens/vídeos)
  height              INT,                   -- altura em pixels (imagens/vídeos)

  -- Origem da mídia
  source              TEXT        NOT NULL DEFAULT 'upload'
    CHECK (source IN (
      'upload',          -- upload manual pelo usuário
      'catalog_sync',    -- sincronizado do catálogo de produtos
      'nano_banana',     -- gerado pelo Nano Banana (IA generativa)
      'external_url'     -- URL externa (embed, CDN externo)
    )),

  -- Metadados específicos do Nano Banana (IA generativa)
  nano_banana_type    TEXT
    CHECK (nano_banana_type IN ('banner', 'product', 'promo', 'avatar', 'cover')), -- null se não for IA
  nano_banana_prompt  TEXT,                  -- prompt usado para geração (se source = 'nano_banana')

  -- Organização e rastreabilidade
  tags                TEXT[]      NOT NULL DEFAULT '{}',
  -- used_in: rastreia onde a mídia está em uso
  -- Formato: [{"type": "bio_page", "id": "uuid"}, {"type": "campaign", "id": "uuid"}]
  used_in             JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Controle de acesso e acessibilidade
  is_public           BOOLEAN     NOT NULL DEFAULT false, -- se pode ser exibido publicamente (bio link)
  alt_text            TEXT,                               -- texto alternativo para acessibilidade

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes de performance
CREATE INDEX idx_media_library_instance     ON public.media_library(instance_id);
CREATE INDEX idx_media_library_file_type    ON public.media_library(file_type);
CREATE INDEX idx_media_library_source       ON public.media_library(source);
CREATE INDEX idx_media_library_created_by   ON public.media_library(created_by);
CREATE INDEX idx_media_library_created      ON public.media_library(created_at DESC);

-- Composite: query principal da galeria por instância
CREATE INDEX idx_media_library_instance_type
  ON public.media_library(instance_id, file_type, created_at DESC);

-- GIN: busca por tags (array) — ex: WHERE tags @> ARRAY['black-friday']
CREATE INDEX idx_media_library_tags_gin
  ON public.media_library USING GIN (tags);

-- GIN: busca por used_in JSONB — ex: WHERE used_in @> '[{"type":"bio_page"}]'
CREATE INDEX idx_media_library_used_in_gin
  ON public.media_library USING GIN (used_in);

-- Trigger: manter updated_at sincronizado
CREATE TRIGGER media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Policy 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_media_library"
  ON public.media_library FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy 2: inbox_members — leitura e escrita via inboxes/inbox_users da instância
CREATE POLICY "inbox_members_media_library"
  ON public.media_library FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = media_library.instance_id
        AND iu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inboxes ib
      JOIN public.inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = media_library.instance_id
        AND iu.user_id = auth.uid()
    )
  );

-- Policy 3: service_role — acesso total (edge functions e workers)
CREATE POLICY "service_role_media_library"
  ON public.media_library FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
