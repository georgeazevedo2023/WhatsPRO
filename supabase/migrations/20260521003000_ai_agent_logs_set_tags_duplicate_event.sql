-- R127 (2026-05-20): novo event 'set_tags_duplicate_keys_rejected' registrado
-- quando validateSetTagsInput detecta 2+ valores na mesma chave (especialmente
-- interesse:portas + interesse:janelas). Sem esta entrada no CHECK constraint,
-- o INSERT em ai_agent_logs falha silenciosamente (R88).

ALTER TABLE ai_agent_logs DROP CONSTRAINT IF EXISTS chk_ai_agent_logs_event;

ALTER TABLE ai_agent_logs ADD CONSTRAINT chk_ai_agent_logs_event CHECK (
  event = ANY (ARRAY[
    'message_received','response_sent','tool_called','handoff','handoff_trigger',
    'error','empty_response','label_assigned','implicit_handoff','greeting_sent',
    'shadow_extraction','excluded_product_match','sale_closed_detected',
    'objection_detected','payment_detected','brand_mentioned','client_type_detected',
    'auto_field_extracted','interesse_hallucination_blocked',
    'marca_preferida_hallucination_blocked','search_guard_blocked',
    'set_tags_duplicate_keys_rejected'
  ])
);
