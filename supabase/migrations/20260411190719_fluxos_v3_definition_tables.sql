-- =============================================================================
-- Fluxos Unificados v3.0 — Tabelas de Definição (GRUPO 1 — rodar PRIMEIRO)
-- flows | flow_steps | flow_triggers
-- Referenciadas por: flow_states, flow_events, validator_logs, intent_detections
-- Padrões: instance_id TEXT → instances(id), RLS via is_super_admin +
--          inbox_users join, service_role full access
-- =============================================================================


-- =============================================================================
-- TABELA 1: flows
-- Definição de um Fluxo Unificado v3.0.
-- Cada fluxo tem 13 parâmetros configuráveis (P0-P12) em config JSONB.
-- =============================================================================

CREATE TABLE IF NOT EXISTS flows (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  created_by    UUID        REFERENCES auth.users(id),

  -- Identidade
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  description   TEXT,

  -- Versionamento (lead em fluxo ativo não quebra se admin edita)
  version       INT         NOT NULL DEFAULT 1,

  -- Ciclo de vida
  published_at  TIMESTAMPTZ,            -- NULL = rascunho
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'archived')),

  -- Modo de operação (D17 — 4 modos)
  mode          TEXT        NOT NULL DEFAULT 'active'
                            CHECK (mode IN ('active', 'assistant', 'shadow', 'off')),

  -- Template de origem (null = custom, senão um dos 12 templates)
  template_id   TEXT,

  -- Vínculo opcional com funil existente
  funnel_id     UUID        REFERENCES funnels(id) ON DELETE SET NULL,

  -- Fluxo padrão quando nenhum gatilho bate
  is_default    BOOLEAN     NOT NULL DEFAULT false,

  -- 13 parâmetros de configuração (P0–P12)
  -- P0 saudacao | P1 qualificacao | P2 produtos | P3 interacoes
  -- P4 tags     | P5 seguranca    | P6 gatilhos | P7 condicoes
  -- P8 lead_score | P9 bio_link   | P10 utm     | P11 qr_code | P12 webhooks
  config        JSONB       NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (instance_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flows_instance    ON flows(instance_id);
CREATE INDEX IF NOT EXISTS idx_flows_status      ON flows(status);
CREATE INDEX IF NOT EXISTS idx_flows_mode        ON flows(mode);
CREATE INDEX IF NOT EXISTS idx_flows_published   ON flows(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flows_funnel      ON flows(funnel_id)    WHERE funnel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flows_is_default  ON flows(instance_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_flows" ON flows
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_flows" ON flows
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM inboxes   ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = flows.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_flows" ON flows
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER flows_updated_at
  BEFORE UPDATE ON flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- TABELA 2: flow_steps
-- Etapas/Subagentes de um fluxo. Cada step = 1 subagente especializado.
-- Versionado junto com o fluxo pai.
-- =============================================================================

CREATE TABLE IF NOT EXISTS flow_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id       UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,

  -- Versiona junto com o fluxo pai
  version       INT         NOT NULL DEFAULT 1,

  -- Identidade
  name          TEXT        NOT NULL,

  -- Tipo de subagente (8 tipos)
  subagent_type TEXT        NOT NULL
                            CHECK (subagent_type IN (
                              'greeting', 'qualification', 'sales', 'support',
                              'survey', 'followup', 'handoff', 'custom'
                            )),

  -- Ordem de execução (suporta árvore via exit_rules)
  position      INT         NOT NULL DEFAULT 0,

  -- Regras de saída — OBRIGATÓRIO pelo menos 1 (evita loop infinito)
  -- Formato: [{"trigger":"max_messages","value":8,"message":"...","action":"handoff_human","params":{}}]
  -- Destinos: next_step | handoff_human | handoff_department | handoff_manager
  --           | followup | another_flow | tag_and_close | do_nothing
  exit_rules    JSONB       NOT NULL DEFAULT '[]',

  -- Config específica do subagente (prompts, tools, parâmetros do step)
  step_config   JSONB       NOT NULL DEFAULT '{}',

  is_active     BOOLEAN     NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow        ON flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_position    ON flow_steps(flow_id, position);
CREATE INDEX IF NOT EXISTS idx_flow_steps_type        ON flow_steps(subagent_type);
CREATE INDEX IF NOT EXISTS idx_flow_steps_active      ON flow_steps(flow_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_flow_steps" ON flow_steps
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_flow_steps" ON flow_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM flows       fl
      JOIN inboxes     ib  ON ib.instance_id = fl.instance_id
      JOIN inbox_users iu  ON iu.inbox_id    = ib.id
      WHERE fl.id = flow_steps.flow_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_flow_steps" ON flow_steps
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER flow_steps_updated_at
  BEFORE UPDATE ON flow_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- TABELA 3: flow_triggers
-- Gatilhos que ativam um fluxo. Um fluxo pode ter N gatilhos.
-- instance_id denormalizado para RLS eficiente (evita join extra até flows).
-- =============================================================================

CREATE TABLE IF NOT EXISTS flow_triggers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,

  -- Denormalizado para RLS eficiente
  instance_id     TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,

  -- 16 tipos de gatilho
  trigger_type    TEXT        NOT NULL
                              CHECK (trigger_type IN (
                                'bio_link',             -- lead clicou em bio page
                                'utm_campaign',         -- lead veio via utm_source/medium/campaign
                                'qr_code',              -- lead escaneou QR code
                                'keyword',              -- mensagem contém palavra-chave
                                'intent',               -- AI detectou intenção específica
                                'tag_added',            -- tag adicionada à conversa
                                'form_completed',       -- formulário WhatsApp submetido
                                'poll_answered',        -- enquete respondida
                                'webhook_received',     -- webhook externo disparado
                                'schedule',             -- agendamento cronológico
                                'lead_created',         -- lead novo criado na instância
                                'funnel_entered',       -- lead entrou em funil específico
                                'card_moved',           -- card movido no Kanban
                                'conversation_started', -- nova conversa iniciada
                                'message_received',     -- qualquer mensagem recebida
                                'api'                   -- ativação via API externa
                              )),

  -- Config específica do tipo
  -- keyword:     {"keywords": ["oi","hello"], "match": "any"}
  -- utm:         {"utm_source": "instagram", "utm_campaign": "black-friday"}
  -- bio_link:    {"bio_page_id": "uuid"}
  -- schedule:    {"cron": "0 9 * * 1", "timezone": "America/Sao_Paulo"}
  -- intent:      {"intent": "produto", "confidence_min": 0.7}
  trigger_config  JSONB       NOT NULL DEFAULT '{}',

  -- Prioridade: 1–100, maior = verificado primeiro (resolve conflitos)
  priority        INT         NOT NULL DEFAULT 50
                              CHECK (priority BETWEEN 1 AND 100),

  -- Cooldown: mínimo entre ativações para o mesmo lead (0 = sem cooldown)
  cooldown_minutes INT        NOT NULL DEFAULT 0
                              CHECK (cooldown_minutes >= 0),

  -- Janela de ativação
  activation      TEXT        NOT NULL DEFAULT 'always'
                              CHECK (activation IN (
                                'always', 'business_hours', 'outside_hours', 'custom'
                              )),

  -- Fluxo de fallback: acionado quando condições não batem
  fallback_flow_id UUID       REFERENCES flows(id) ON DELETE SET NULL,

  is_active       BOOLEAN     NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_triggers_flow         ON flow_triggers(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_triggers_instance     ON flow_triggers(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_triggers_type         ON flow_triggers(trigger_type);
-- Índice crítico: lookup de gatilhos ativos por prioridade (caminho quente do engine)
CREATE INDEX IF NOT EXISTS idx_flow_triggers_priority     ON flow_triggers(instance_id, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_flow_triggers_active       ON flow_triggers(flow_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_flow_triggers_fallback     ON flow_triggers(fallback_flow_id) WHERE fallback_flow_id IS NOT NULL;

-- RLS
ALTER TABLE flow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_flow_triggers" ON flow_triggers
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_flow_triggers" ON flow_triggers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM inboxes     ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = flow_triggers.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_flow_triggers" ON flow_triggers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER flow_triggers_updated_at
  BEFORE UPDATE ON flow_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
