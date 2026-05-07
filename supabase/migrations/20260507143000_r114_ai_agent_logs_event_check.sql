-- R114 + R113.1 fix herdado: CHECK constraint em ai_agent_logs.event rejeitava
-- 'sale_closed_detected' (R113.1) e 'objection_detected' (R114). Insert falhava
-- silenciosamente (Supabase client não joga em error sem .error check).
--
-- Tags ainda eram setadas pelo UPDATE, mas observabilidade dos detection
-- determinísticos ficou cega. Sessão 4 sandbox investigando R114 v1 descobriu
-- ao consultar pg_constraint.

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
    'objection_detected'::text
  ]));
