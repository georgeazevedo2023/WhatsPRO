-- =============================================================================
-- Fluxos v3.0 — Seed (S1)
-- 1 flow SDR Comercial + 2 steps (greeting + qualification) + 3 triggers
-- Idempotente: skip se slug 'sdr-seed' já existe
-- =============================================================================

DO $$
DECLARE
  v_instance_id TEXT;
  v_flow_id     UUID;
BEGIN
  -- Requer instância existente
  SELECT id INTO v_instance_id FROM instances ORDER BY created_at LIMIT 1;

  IF v_instance_id IS NULL THEN
    RAISE NOTICE '[seed] Nenhuma instância encontrada — seed ignorado.';
    RETURN;
  END IF;

  -- Idempotente: não reinserir se já existe
  IF EXISTS (SELECT 1 FROM flows WHERE slug = 'sdr-seed') THEN
    RAISE NOTICE '[seed] Flow sdr-seed já existe — seed ignorado.';
    RETURN;
  END IF;

  -- ── Flow ─────────────────────────────────────────────────────────────────
  INSERT INTO flows (
    instance_id, name, slug, description,
    mode, is_default, published_at, version
  ) VALUES (
    v_instance_id,
    'SDR Comercial (Seed)',
    'sdr-seed',
    'Fluxo de exemplo S1 — saudação + qualificação BANT. Não usar em produção.',
    'active',
    false,
    now(),
    1
  ) RETURNING id INTO v_flow_id;

  -- ── Step 1: Greeting ──────────────────────────────────────────────────────
  INSERT INTO flow_steps (
    flow_id, version, name, subagent_type, position, exit_rules, step_config
  ) VALUES (
    v_flow_id, 1, 'Saudação', 'greeting', 0,
    '[{
      "trigger": "max_messages",
      "value": 3,
      "message": "Vou te conectar com um atendente. Até logo!",
      "action": "handoff_human"
    }]',
    '{
      "extract_name": true,
      "context_depth": "standard",
      "new_lead_message": "Olá! 👋 Bem-vindo. Qual é o seu nome?",
      "returning_lead_message": "Bem-vindo de volta, {nome}! Como posso ajudar?"
    }'
  );

  -- ── Step 2: Qualification (BANT) ─────────────────────────────────────────
  INSERT INTO flow_steps (
    flow_id, version, name, subagent_type, position, exit_rules, step_config
  ) VALUES (
    v_flow_id, 1, 'Qualificação BANT', 'qualification', 1,
    '[
      {
        "trigger": "qualification_complete",
        "message": "Perfeito! Vou verificar as melhores opções para você.",
        "action": "next_step"
      },
      {
        "trigger": "max_messages",
        "value": 10,
        "message": "Vou te conectar com um consultor. Até já!",
        "action": "handoff_human"
      }
    ]',
    '{
      "questions": [
        {
          "key": "budget",
          "label": "Qual o orçamento disponível para este projeto?",
          "type": "currency_brl",
          "required": true
        },
        {
          "key": "authority",
          "label": "Você é o responsável pela tomada de decisão?",
          "type": "boolean",
          "required": true
        },
        {
          "key": "need",
          "label": "Qual o principal desafio que quer resolver?",
          "type": "text",
          "required": true
        },
        {
          "key": "timeline",
          "label": "Qual o prazo para implementar a solução?",
          "type": "select",
          "options": ["Imediato", "1-3 meses", "3-6 meses", "Mais de 6 meses"],
          "required": false
        }
      ],
      "max_questions": 5,
      "required_count": 2,
      "mode": "fixed",
      "smart_fill": true,
      "smart_fill_max_age_days": 90,
      "fallback_retries": 2,
      "post_action": "next_step"
    }'
  );

  -- ── Trigger 1: Keyword (alta prioridade) ─────────────────────────────────
  INSERT INTO flow_triggers (
    flow_id, instance_id, trigger_type, priority, cooldown_minutes, trigger_config, is_active
  ) VALUES (
    v_flow_id, v_instance_id, 'keyword', 10, 0,
    '{"keywords": ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hello", "oii", "oiii"]}',
    true
  );

  -- ── Trigger 2: Lead Created ───────────────────────────────────────────────
  INSERT INTO flow_triggers (
    flow_id, instance_id, trigger_type, priority, cooldown_minutes, trigger_config, is_active
  ) VALUES (
    v_flow_id, v_instance_id, 'lead_created', 5, 0,
    '{"delay_minutes": 0}',
    true
  );

  -- ── Trigger 3: First message (fallback) ──────────────────────────────────
  INSERT INTO flow_triggers (
    flow_id, instance_id, trigger_type, priority, cooldown_minutes, trigger_config, is_active
  ) VALUES (
    v_flow_id, v_instance_id, 'message_received', 1, 60,
    '{"first_message_only": true}',
    true
  );

  RAISE NOTICE '[seed] ✅ Flow sdr-seed criado: id=%, 2 steps, 3 triggers (instance: %)',
    v_flow_id, v_instance_id;
END;
$$;
