-- Sprint C1 (2026-05-23): Tabela ai_agent_runs — trace por hop do router → specialist.
--
-- Cada turno do AI Agent (em modo router) gera 1+ rows aqui:
--   hop 0: router (classifyIntent) — populado com intent + confidence + reason no metadata
--   hop 1: specialist (product/qualif/handoff/objection/etc.) — populado com tools_called
--
-- Em modo monolith (default), só 1 row por turno com specialist='monolith' (telemetria opcional).
--
-- Permite debug imediato ("LLM ignorou regra X" → log mostra qual specialist + intent + tools)
-- + métrica de hop loops (> 1% = bug).

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  turn_id UUID,                       -- mesmo turn_id agrupa hops do mesmo turno
  hop_n INT NOT NULL DEFAULT 0,
  specialist TEXT NOT NULL CHECK (specialist IN (
    'router', 'monolith',
    'greeting', 'qualification', 'product', 'handoff', 'objection', 'payment', 'fora_escopo'
  )),
  intent TEXT,                        -- output do router (se specialist='router')
  confidence NUMERIC,                 -- 0-1 (router output)
  model TEXT,                         -- gpt-5-nano | gpt-5-mini | gpt-4.1-mini | etc.
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  tools_called JSONB,                 -- array de { name, args, result_preview }
  prompt_chars INT,                   -- tamanho do prompt assembled (medição de "compactação")
  metadata JSONB,                     -- reason do router, error msg, fallback flags
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index principal pra dashboards: queries por conversa ordenadas decrescente
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_conv_created
  ON ai_agent_runs (conversation_id, created_at DESC);

-- Index pra métrica de hop loops e accuracy do router por intent
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_specialist_created
  ON ai_agent_runs (agent_id, specialist, created_at DESC);

-- RLS: service_role tem acesso total (edge functions). Outros roles bloqueados por default.
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ai_agent_runs TO service_role;
-- Dashboard "Roteamento" (Sprint C7) lerá via RPC SECURITY DEFINER, não via select direto.
-- Sem policy explícita pra authenticated = sem acesso direto = sem leak entre tenants.

COMMENT ON TABLE ai_agent_runs IS
  'Sprint C: trace por hop do router → specialist. 1 row por hop. Em modo monolith, 1 row por turno com specialist=monolith.';
COMMENT ON COLUMN ai_agent_runs.turn_id IS
  'UUID gerado pelo ai-agent no início do turno. Agrupa todos os hops do mesmo evento.';
COMMENT ON COLUMN ai_agent_runs.hop_n IS
  'Ordem do hop dentro do turn_id. 0=router, 1=specialist. Max 2 (anti-loop).';
COMMENT ON COLUMN ai_agent_runs.intent IS
  'Output do classifyIntent: saudacao | qualificacao | produto | handoff | objecao | pagamento | fora_escopo.';
