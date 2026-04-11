-- =============================================================================
-- Fluxos Unificados v3.0 — Tabelas de Estado e Memória
-- flow_states | flow_events | lead_memory
-- =============================================================================
-- Dependências (criadas na mesma migration de Fluxos v3):
--   flows(id UUID, instance_id TEXT)
--   flow_steps(id UUID, flow_id UUID)
-- Tabelas preexistentes referenciadas:
--   instances(id TEXT), lead_profiles(id UUID), conversations(id UUID)
-- =============================================================================


-- =============================================================================
-- TABELA 1: flow_states
-- Estado ativo do lead no fluxo. 1 row ativa por lead por fluxo por vez.
-- =============================================================================

CREATE TABLE IF NOT EXISTS flow_states (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências de fluxo
  flow_id               UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  flow_step_id          UUID                 REFERENCES flow_steps(id) ON DELETE SET NULL,
  flow_version          INT         NOT NULL DEFAULT 1,

  -- Denorm para RLS e queries
  instance_id           TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,

  -- Atores
  lead_id               UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  conversation_id       UUID                 REFERENCES conversations(id) ON DELETE SET NULL,

  -- Status do estado
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','handoff','timeout','abandoned')),

  -- Dados estruturados do estado atual (ver JSONB schema abaixo)
  step_data             JSONB       NOT NULL DEFAULT '{
    "qualification_answers": {},
    "products_shown": [],
    "intent_history": [],
    "message_count": 0,
    "total_message_count": 0,
    "last_subagent": null,
    "context_vars": {}
  }'::jsonb,

  -- Array de step_ids já percorridos neste estado
  completed_steps       UUID[]      NOT NULL DEFAULT '{}',

  -- Timestamps de ciclo de vida
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint: apenas 1 estado ativo por lead por fluxo
-- Partial unique index (não pode ser feito como UNIQUE constraint com WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_flow_states_active_lead_flow
  ON flow_states(lead_id, flow_id)
  WHERE status = 'active';

-- Indexes de performance
CREATE INDEX IF NOT EXISTS idx_flow_states_instance      ON flow_states(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_flow          ON flow_states(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_lead          ON flow_states(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_status        ON flow_states(status);
CREATE INDEX IF NOT EXISTS idx_flow_states_last_activity ON flow_states(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_flow_states_conversation  ON flow_states(conversation_id) WHERE conversation_id IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER flow_states_updated_at
  BEFORE UPDATE ON flow_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE flow_states ENABLE ROW LEVEL SECURITY;

-- Política 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_flow_states" ON flow_states
  FOR ALL TO authenticated
  USING    (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Política 2: inbox_members — leitura via instância
CREATE POLICY "inbox_members_view_flow_states" ON flow_states
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   inboxes    ib
      JOIN   inbox_users iu ON iu.inbox_id = ib.id
      WHERE  ib.instance_id = flow_states.instance_id
        AND  iu.user_id = auth.uid()
    )
  );

-- Política 3: service_role — acesso total (edge functions)
CREATE POLICY "service_role_flow_states" ON flow_states
  FOR ALL TO service_role
  USING    (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 2: flow_events
-- Log imutável de cada evento de execução. Analítica + debug.
-- Append-only: sem updated_at, sem trigger de update.
-- =============================================================================

CREATE TABLE IF NOT EXISTS flow_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências principais
  flow_state_id    UUID        NOT NULL REFERENCES flow_states(id) ON DELETE CASCADE,
  flow_id          UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,       -- denorm
  instance_id      TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,  -- denorm
  lead_id          UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE, -- denorm

  -- Tipo do evento
  event_type       TEXT        NOT NULL
                     CHECK (event_type IN (
                       'flow_started',
                       'step_entered',
                       'step_exited',
                       'intent_detected',
                       'handoff_triggered',
                       'tool_called',
                       'validator_flagged',
                       'flow_completed',
                       'flow_abandoned',
                       'error'
                     )),

  -- Contexto do passo
  step_id          UUID        REFERENCES flow_steps(id) ON DELETE SET NULL,
  subagent_type    TEXT,       -- qual subagente executou (ex: 'sdr', 'qualifier', 'support')

  -- Dados de entrada/saída
  input            JSONB,      -- mensagem ou dados de entrada
  output           JSONB,      -- resposta ou resultado produzido

  -- Métricas de performance
  timing_breakdown JSONB,
  -- Estrutura esperada:
  -- { "recognition_ms": 0, "memory_ms": 0, "llm_ms": 0,
  --   "validator_ms": 0, "tts_ms": 0, "total_ms": 0 }

  -- Métricas de custo
  cost_breakdown   JSONB,
  -- Estrutura esperada:
  -- { "input_tokens": 0, "output_tokens": 0,
  --   "llm_cost_brl": 0.0, "tts_cost_brl": 0.0, "total_cost_brl": 0.0 }

  -- Detalhes de erro (quando event_type = 'error')
  error            TEXT,

  -- Append-only: apenas created_at, sem updated_at
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes de performance (queries analíticas por período e filtros comuns)
CREATE INDEX IF NOT EXISTS idx_flow_events_instance      ON flow_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_flow          ON flow_events(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_lead          ON flow_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_flow_state    ON flow_events(flow_state_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_event_type    ON flow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_flow_events_created_at    ON flow_events(created_at);
-- Índice composto para queries analíticas por instância + período
CREATE INDEX IF NOT EXISTS idx_flow_events_instance_time ON flow_events(instance_id, created_at DESC);
-- Índice composto para dashboard de fluxo
CREATE INDEX IF NOT EXISTS idx_flow_events_flow_time     ON flow_events(flow_id, created_at DESC);
-- Índice parcial para filtragem rápida de erros
CREATE INDEX IF NOT EXISTS idx_flow_events_errors        ON flow_events(instance_id, created_at DESC)
  WHERE event_type = 'error';

-- RLS
ALTER TABLE flow_events ENABLE ROW LEVEL SECURITY;

-- Política 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_flow_events" ON flow_events
  FOR ALL TO authenticated
  USING    (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Política 2: inbox_members — leitura via instância
CREATE POLICY "inbox_members_view_flow_events" ON flow_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   inboxes    ib
      JOIN   inbox_users iu ON iu.inbox_id = ib.id
      WHERE  ib.instance_id = flow_events.instance_id
        AND  iu.user_id = auth.uid()
    )
  );

-- Política 3: service_role — acesso total (edge functions)
CREATE POLICY "service_role_flow_events" ON flow_events
  FOR ALL TO service_role
  USING    (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 3: lead_memory
-- Serviço de memória do orquestrador.
-- Separa memória curta (sessão/cache, TTL) de memória longa (permanente).
-- =============================================================================

CREATE TABLE IF NOT EXISTS lead_memory (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Atores
  lead_id      UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  instance_id  TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,

  -- Tipo de memória: curta (sessão atual) ou longa (permanente banco)
  memory_type  TEXT        NOT NULL
                 CHECK (memory_type IN ('short', 'long')),

  -- Escopo da memória:
  --   'global'         → válida para todo o contexto do lead
  --   'flow:{flow_id}' → específica de um fluxo
  --   'step:{step_id}' → específica de um step
  scope        TEXT        NOT NULL DEFAULT 'global',

  -- Conteúdo da memória (estrutura varia por memory_type — ver JSONB schema)
  -- short: { summary, products_shown, intents, session_start, message_count }
  -- long:  { profile, purchases, preferences, sessions_count,
  --          first_contact, last_contact, notes }
  data         JSONB       NOT NULL DEFAULT '{}',

  -- TTL e expiração (null = permanente; curta: 3600s padrão)
  ttl_seconds  INT,
  expires_at   TIMESTAMPTZ,

  -- Métrica: quantos tokens esta entrada de memória economizou
  tokens_saved INT         NOT NULL DEFAULT 0,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garantia de unicidade: 1 registro por combinação lead+tipo+escopo
  -- Permite upsert eficiente em vez de insert+delete
  CONSTRAINT uq_lead_memory_lead_type_scope UNIQUE (lead_id, memory_type, scope)
);

-- Indexes de performance
CREATE INDEX IF NOT EXISTS idx_lead_memory_lead        ON lead_memory(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_memory_instance    ON lead_memory(instance_id);
CREATE INDEX IF NOT EXISTS idx_lead_memory_type        ON lead_memory(memory_type);
-- Índice para cleanup de entradas expiradas (pg_cron ou edge function)
CREATE INDEX IF NOT EXISTS idx_lead_memory_expires     ON lead_memory(expires_at)
  WHERE expires_at IS NOT NULL;
-- Índice composto para busca do orquestrador: lead + tipo + sem expiração definida
-- Nota: não usar now() em predicado parcial (viola IMMUTABLE do PostgreSQL)
-- Para incluir entradas ainda válidas, filtrar na query:
--   WHERE (expires_at IS NULL OR expires_at > now())
CREATE INDEX IF NOT EXISTS idx_lead_memory_lookup      ON lead_memory(lead_id, memory_type)
  WHERE expires_at IS NULL;

-- Trigger updated_at
CREATE TRIGGER lead_memory_updated_at
  BEFORE UPDATE ON lead_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE lead_memory ENABLE ROW LEVEL SECURITY;

-- Política 1: super_admins — acesso total
CREATE POLICY "super_admins_manage_lead_memory" ON lead_memory
  FOR ALL TO authenticated
  USING    (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Política 2: inbox_members — leitura via instância
CREATE POLICY "inbox_members_view_lead_memory" ON lead_memory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   inboxes    ib
      JOIN   inbox_users iu ON iu.inbox_id = ib.id
      WHERE  ib.instance_id = lead_memory.instance_id
        AND  iu.user_id = auth.uid()
    )
  );

-- Política 3: service_role — acesso total (edge functions)
CREATE POLICY "service_role_lead_memory" ON lead_memory
  FOR ALL TO service_role
  USING    (true)
  WITH CHECK (true);


-- =============================================================================
-- FUNÇÃO DE CLEANUP: lead_memory expirada
-- Pode ser invocada por pg_cron (SELECT cron.schedule(...)) ou por edge function.
-- Retorna o número de rows deletadas para logging.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_lead_memory()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM lead_memory
  WHERE  expires_at IS NOT NULL
    AND  expires_at <= now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Exemplo de agendamento via pg_cron (executar se extensão disponível):
-- SELECT cron.schedule(
--   'cleanup-expired-lead-memory',
--   '0 * * * *',   -- a cada hora
--   'SELECT public.cleanup_expired_lead_memory()'
-- );


-- =============================================================================
-- FUNÇÃO HELPER: inicializar/atualizar memória curta do lead (upsert)
-- Usada pelo orquestrador para manter step_data e contexto de sessão sincronizados.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_lead_short_memory(
  p_lead_id     UUID,
  p_instance_id TEXT,
  p_scope       TEXT,
  p_data        JSONB,
  p_ttl_seconds INT DEFAULT 3600
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id       UUID;
  v_expires  TIMESTAMPTZ;
BEGIN
  v_expires := now() + (p_ttl_seconds * INTERVAL '1 second');

  INSERT INTO lead_memory (lead_id, instance_id, memory_type, scope, data, ttl_seconds, expires_at)
  VALUES (p_lead_id, p_instance_id, 'short', p_scope, p_data, p_ttl_seconds, v_expires)
  ON CONFLICT (lead_id, memory_type, scope)
  DO UPDATE SET
    data        = EXCLUDED.data,
    ttl_seconds = EXCLUDED.ttl_seconds,
    expires_at  = EXCLUDED.expires_at,
    updated_at  = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
