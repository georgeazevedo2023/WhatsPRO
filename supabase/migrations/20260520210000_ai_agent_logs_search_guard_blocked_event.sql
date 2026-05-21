-- R126 (2026-05-20): novo event 'search_guard_blocked' registrado quando
-- evaluateSearchGuard recusa um tool call `search_products` (query genérica
-- sem expectedCategory OU expectedCategory com catalog_status='offline').
-- Sem esta entrada no CHECK constraint, o INSERT em ai_agent_logs falha
-- silenciosamente (R88: schema mismatch INSERT silencioso).

ALTER TABLE ai_agent_logs DROP CONSTRAINT IF EXISTS chk_ai_agent_logs_event;

ALTER TABLE ai_agent_logs ADD CONSTRAINT chk_ai_agent_logs_event CHECK (
  event = ANY (ARRAY[
    'message_received','response_sent','tool_called','handoff','handoff_trigger',
    'error','empty_response','label_assigned','implicit_handoff','greeting_sent',
    'shadow_extraction','excluded_product_match','sale_closed_detected',
    'objection_detected','payment_detected','brand_mentioned','client_type_detected',
    'auto_field_extracted','interesse_hallucination_blocked',
    'marca_preferida_hallucination_blocked','search_guard_blocked'
  ])
);
