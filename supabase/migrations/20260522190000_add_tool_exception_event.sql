-- R140 (2026-05-22 v7.41.7) — observability fix.
-- Caso Sandrielly Wsmart (5b78ee46-b861) tinha search_products crashando mas
-- stack trace ficava perdido pq executeToolSafe só logava .message.
-- v7.41.7 captura err.stack via novo event 'tool_exception' que ai_agent_logs
-- precisa aceitar no CHECK constraint, senão INSERT silenciosamente falha (R88).

ALTER TABLE ai_agent_logs DROP CONSTRAINT IF EXISTS chk_ai_agent_logs_event;
ALTER TABLE ai_agent_logs ADD CONSTRAINT chk_ai_agent_logs_event CHECK (event = ANY (ARRAY[
  'message_received'::text,
  'response_sent'::text,
  'tool_called'::text,
  'tool_exception'::text,
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
  'interesse_hallucination_blocked'::text,
  'marca_preferida_hallucination_blocked'::text,
  'search_guard_blocked'::text,
  'set_tags_duplicate_keys_rejected'::text
]));
