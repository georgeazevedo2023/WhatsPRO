-- D28 follow-up: adiciona 'excluded_product_match' à whitelist de eventos de ai_agent_logs.
-- Sem isso, INSERT do log com esse event falha silenciosamente (Supabase JS retorna {error}
-- em vez de throw, e o ai-agent não tem try/catch ali). Comportamento da feature D28
-- não é afetado, apenas a observabilidade.
--
-- Aplicado direto em prod via API REST em 2026-04-30 11:06 UTC.

ALTER TABLE public.ai_agent_logs DROP CONSTRAINT IF EXISTS chk_ai_agent_logs_event;

ALTER TABLE public.ai_agent_logs ADD CONSTRAINT chk_ai_agent_logs_event CHECK (
  event = ANY (ARRAY[
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
    'excluded_product_match'::text
  ])
);

COMMENT ON CONSTRAINT chk_ai_agent_logs_event ON public.ai_agent_logs IS
  'Whitelist de event types. Adicionar valor novo aqui antes de logar via INSERT na tabela.';
