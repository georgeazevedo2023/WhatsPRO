-- Bug 19 (2026-05-17): adiciona event type 'interesse_hallucination_blocked' ao
-- CHECK constraint de ai_agent_logs. Esse event eh inserido pelo handler set_tags
-- do ai-agent quando o LLM tenta cravar interesse:CAT cujo keyword nunca apareceu
-- em nenhuma msg incoming do lead — o insert sem esse event valido falha silencioso
-- (R114 lesson).
-- Tambem inclui 'auto_field_extracted' (Bug 13 fix shipado 2026-05-17, ja em uso).

ALTER TABLE ai_agent_logs DROP CONSTRAINT IF EXISTS ai_agent_logs_event_check;

ALTER TABLE ai_agent_logs ADD CONSTRAINT ai_agent_logs_event_check CHECK (event = ANY (ARRAY[
  'message_received'::text,
  'response_sent'::text,
  'tool_called'::text,
  'handoff'::text,
  'handoff_trigger'::text,
  'error'::text,
  'empty_response'::text,
  'label_assigned'::text,
  'implicit_handoff'::text,
  'greeting_sent'::text,
  'shadow_extraction'::text,
  'excluded_product_match'::text,
  'sale_closed_detected'::text,
  'objection_detected'::text,
  'payment_detected'::text,
  'brand_mentioned'::text,
  'client_type_detected'::text,
  'auto_field_extracted'::text,
  'interesse_hallucination_blocked'::text
]));
