-- Canal de controle E2E (2026-05-24) — comandos recebidos via WhatsApp (instância
-- Testador) do operador humano, p/ o orquestrador (Claude Code) ler e responder.
-- Inserido pelo edge function e2e-control-webhook. RLS ON sem policy authenticated
-- (só service_role acessa: webhook insere, orquestrador lê via MCP/service key).
CREATE TABLE IF NOT EXISTS public.e2e_control_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_number TEXT,
  body TEXT,
  raw JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_e2e_control_inbox_unprocessed
  ON public.e2e_control_inbox (created_at) WHERE processed = false;
ALTER TABLE public.e2e_control_inbox ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.e2e_control_inbox IS 'Comandos do operador via WhatsApp (Testador) p/ canal de controle E2E. Insere: e2e-control-webhook.';
