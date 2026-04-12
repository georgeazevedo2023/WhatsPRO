-- =============================================================================
-- Fluxos Unificados v3.0 — Tabelas Shadow/Monitoramento (GRUPO 3)
-- shadow_extractions | shadow_metrics | pending_responses | flow_followups
-- Dependências: instances, conversations, lead_profiles, contacts
-- ATENÇÃO: follow_up_executions já existe (cadências AI Agent). Esta tabela
--          (flow_followups) é diferente: follow-ups humanos detectados por Shadow.
-- =============================================================================


-- =============================================================================
-- TABELA 1: shadow_extractions
-- Extrações do Shadow Analyzer — append-only, sem updated_at.
-- Batch a cada 5min produz 1 extração por dimensão por conversa.
-- 7 dimensões: lead, seller, objection, product, manager, response, followup
-- =============================================================================

CREATE TABLE IF NOT EXISTS shadow_extractions (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id          TEXT          NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  conversation_id      UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id              UUID          REFERENCES lead_profiles(id) ON DELETE SET NULL,

  -- Dimensão de inteligência extraída
  dimension            TEXT          NOT NULL CHECK (dimension IN (
                                       'lead','seller','objection','product',
                                       'manager','response','followup'
                                     )),

  -- Agrupa extrações de um mesmo batch (rastreia processamento)
  batch_id             UUID          NOT NULL,

  -- Dados extraídos (estrutura varia por dimensão — ver wiki/fluxos-shadow-mode.md)
  -- lead:      { name, city, type, summary, intentions, sentiment, score }
  -- seller:    { volume, response_time, conversion_signals, phrases_that_convert }
  -- objection: { type, how_handled, success, phrases_used, competitor_mentioned }
  -- product:   { mentioned, quantity, price, discount, status, sentiment }
  -- manager:   { insights, actions_suggested, money_on_table }
  -- response:  { pending_since, escalation_level, priority_score }
  -- followup:  { type, detected_phrase, suggested_date, suggested_message }
  extracted_data       JSONB         NOT NULL DEFAULT '{}',

  processing_cost_brl  DECIMAL(10,6) NOT NULL DEFAULT 0,
  model_used           TEXT,

  processed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
  -- Append-only: sem updated_at
);

-- Indexes de performance
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_instance      ON shadow_extractions(instance_id);
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_conversation  ON shadow_extractions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_dimension     ON shadow_extractions(dimension);
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_batch         ON shadow_extractions(batch_id);
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_processed     ON shadow_extractions(processed_at DESC);
-- Composto: query mais crítica — últimas extrações de dimensão X por conversa
CREATE INDEX IF NOT EXISTS idx_shadow_extractions_conv_dim
  ON shadow_extractions(conversation_id, dimension, processed_at DESC);

-- RLS
ALTER TABLE shadow_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_shadow_extractions" ON shadow_extractions
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_shadow_extractions" ON shadow_extractions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = shadow_extractions.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_shadow_extractions" ON shadow_extractions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 2: shadow_metrics
-- Métricas agregadas diárias/semanais/mensais por vendedor ou instância.
-- Calculadas a partir de shadow_extractions via job periódico.
-- =============================================================================

CREATE TABLE IF NOT EXISTS shadow_metrics (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id       TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  seller_id         UUID        REFERENCES contacts(id) ON DELETE SET NULL, -- null = toda instância
  period_type       TEXT        NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  period_date       DATE        NOT NULL,

  -- Métricas agregadas (estrutura padrão)
  -- { leads_count, conversations_count, messages_count, response_time_avg_seconds,
  --   conversion_rate, avg_ticket, revenue, objections_by_type,
  --   top_converting_phrases, products_mentioned, followups_done,
  --   followups_pending, followup_conversion_rate }
  metrics           JSONB       NOT NULL DEFAULT '{}',

  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade: sem seller (global da instância) — PG14 compatível (dois índices parciais)
-- Substitui UNIQUE NULLS NOT DISTINCT (PG15+) que é incompatível com Supabase PG14
CREATE UNIQUE INDEX IF NOT EXISTS uq_shadow_metrics_period_global
  ON shadow_metrics(instance_id, period_type, period_date)
  WHERE seller_id IS NULL;

-- Unicidade: com seller (por vendedor)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shadow_metrics_period_seller
  ON shadow_metrics(instance_id, seller_id, period_type, period_date)
  WHERE seller_id IS NOT NULL;

CREATE TRIGGER update_shadow_metrics_updated_at
  BEFORE UPDATE ON shadow_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes de performance
CREATE INDEX IF NOT EXISTS idx_shadow_metrics_instance  ON shadow_metrics(instance_id);
CREATE INDEX IF NOT EXISTS idx_shadow_metrics_seller    ON shadow_metrics(seller_id);
CREATE INDEX IF NOT EXISTS idx_shadow_metrics_period    ON shadow_metrics(instance_id, period_type, period_date DESC);

-- RLS
ALTER TABLE shadow_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_shadow_metrics" ON shadow_metrics
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_shadow_metrics" ON shadow_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = shadow_metrics.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_shadow_metrics" ON shadow_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 3: pending_responses
-- Fila de espera — D6 Resposta Intelligence.
-- Rastreia mensagens de clientes sem resposta do vendedor.
-- Escalada: badge 5min → notifica 15min → gestor 30min → resgate 60min → abandonado 2h
-- =============================================================================

CREATE TABLE IF NOT EXISTS pending_responses (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id               TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  conversation_id           UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id                   UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  seller_id                 UUID        REFERENCES contacts(id) ON DELETE SET NULL,

  first_unanswered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_customer_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 0=pendente, 1=badge, 2=notificado_vendedor, 3=alertado_gestor, 4=resgate_ativo
  escalation_level          INT         NOT NULL DEFAULT 0,

  -- Score de prioridade baseado no lead score (VIP escalada mais rápida)
  priority_score            INT         NOT NULL DEFAULT 50,

  status                    TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_progress','resolved','abandoned')),

  resolved_at               TIMESTAMPTZ,
  rescue_sent_at            TIMESTAMPTZ,
  rescue_message            TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pending_responses_updated_at
  BEFORE UPDATE ON pending_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Partial unique: apenas 1 registro 'pending' por conversa
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_responses_active_conversation
  ON pending_responses(conversation_id)
  WHERE status = 'pending';

-- Indexes de performance (queries de escalada em background job)
CREATE INDEX IF NOT EXISTS idx_pending_responses_instance    ON pending_responses(instance_id);
CREATE INDEX IF NOT EXISTS idx_pending_responses_status      ON pending_responses(status);
CREATE INDEX IF NOT EXISTS idx_pending_responses_escalation
  ON pending_responses(instance_id, status, escalation_level, first_unanswered_at);
-- Dashboard do vendedor
CREATE INDEX IF NOT EXISTS idx_pending_responses_seller
  ON pending_responses(seller_id, status, first_unanswered_at);

-- RLS
ALTER TABLE pending_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_pending_responses" ON pending_responses
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_pending_responses" ON pending_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = pending_responses.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_pending_responses" ON pending_responses
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABELA 4: flow_followups
-- Follow-ups detectados automaticamente pelo Shadow Analyzer (D7).
-- DIFERENTE de follow_up_executions (cadências do AI Agent — já existe).
-- Esta tabela rastreia follow-ups humanos que o vendedor deve fazer.
-- Escalada: D+0 badge → D+1 notifica → D+2 gestor → D+3 resgate automático
-- =============================================================================

CREATE TABLE IF NOT EXISTS flow_followups (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         TEXT        NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id             UUID        NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  seller_id           UUID        REFERENCES contacts(id) ON DELETE SET NULL,

  -- Tipo de detecção
  detection_type      TEXT        NOT NULL
                        CHECK (detection_type IN (
                          'vou_pensar','ta_caro','consultar_parceiro',
                          'semana_que_vem','quando_chegar','compromisso','outros'
                        )),

  detected_phrase     TEXT,           -- frase exata que gerou detecção
  suggested_date      TIMESTAMPTZ,    -- data sugerida pela IA
  suggested_message   TEXT,           -- mensagem sugerida pela IA

  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','done','overdue','escalated','auto_rescued')),

  done_at             TIMESTAMPTZ,    -- quando o vendedor fez o follow-up
  escalation_level    INT         NOT NULL DEFAULT 0,

  -- Score decay: pts/dia que o lead perde sem follow-up (normal=2, sem_followup=5)
  score_decay_rate    INT         NOT NULL DEFAULT 2,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_flow_followups_updated_at
  BEFORE UPDATE ON flow_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes de performance
CREATE INDEX IF NOT EXISTS idx_flow_followups_instance    ON flow_followups(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_followups_seller      ON flow_followups(seller_id);
CREATE INDEX IF NOT EXISTS idx_flow_followups_status      ON flow_followups(status);
CREATE INDEX IF NOT EXISTS idx_flow_followups_date        ON flow_followups(suggested_date);
-- Dashboard do vendedor: pendentes por data
CREATE INDEX IF NOT EXISTS idx_flow_followups_seller_status
  ON flow_followups(seller_id, status, suggested_date);
-- Queries de escalada
CREATE INDEX IF NOT EXISTS idx_flow_followups_escalation
  ON flow_followups(instance_id, status, escalation_level, suggested_date);

-- RLS
ALTER TABLE flow_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_manage_flow_followups" ON flow_followups
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "inbox_members_view_flow_followups" ON flow_followups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inboxes ib
      JOIN inbox_users iu ON iu.inbox_id = ib.id
      WHERE ib.instance_id = flow_followups.instance_id
        AND iu.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_flow_followups" ON flow_followups
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
