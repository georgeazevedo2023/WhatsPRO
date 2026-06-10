-- Telemetria de falha de envio de mídia (auditoria 2026-06-09: falha
-- client-side no envio de foto era invisível — nenhum rastro no DB).
-- Escrita SÓ via edge fn log-send-failure (service role); RLS sem policies
-- bloqueia anon/authenticated por completo.
CREATE TABLE IF NOT EXISTS public.media_send_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  conversation_id uuid NULL,
  instance_id text NULL,
  stage text NOT NULL CHECK (stage IN ('validate','normalize','upload','proxy','confirm','insert','unknown')),
  outcome text NOT NULL CHECK (outcome IN ('fail','hang_timeout')),
  detected_kind text NULL,
  file_size bigint NULL,
  file_type text NULL,
  raw_error text NULL,
  app_build text NULL,
  user_agent text NULL
);

ALTER TABLE public.media_send_telemetry ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_media_send_telemetry_created
  ON public.media_send_telemetry (created_at DESC);
