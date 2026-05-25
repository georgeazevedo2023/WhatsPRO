-- R148 (2026-05-25) — observability dos early-returns PRÉ-ROUTER do ai-agent.
-- Bug: 2ª msg do lead logo após uma resposta caía no duplicate_response_guard e
-- retornava SILENCIOSAMENTE (sem ai_agent_runs, sem resposta, sem rastro em tabela
-- nenhuma — só log.info). recordEarlyReturn passa a persistir o motivo de saída em
-- ai_agent_logs com event='early_return'. Sem este event no CHECK, o INSERT falharia
-- silenciosamente (R88). Mantém a lista canônica de 20260522190000 + 'early_return'.

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
  'set_tags_duplicate_keys_rejected'::text,
  'early_return'::text
]));
