-- R115 Fase 1: novos events de detection determinística pra dashboard do gestor.
-- payment_detected, brand_mentioned, client_type_detected.
-- Pattern do R114 — events específicos garantem observabilidade da detection
-- determinística sem depender só das tags na conversation.

ALTER TABLE public.ai_agent_logs DROP CONSTRAINT IF EXISTS ai_agent_logs_event_check;

ALTER TABLE public.ai_agent_logs ADD CONSTRAINT ai_agent_logs_event_check
  CHECK (event = ANY (ARRAY[
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
    'client_type_detected'::text
  ]));
