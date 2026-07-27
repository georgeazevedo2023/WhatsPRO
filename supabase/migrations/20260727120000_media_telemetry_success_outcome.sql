-- Telemetria de envio de mídia passa a registrar SUCESSO (2026-07-26/27):
-- sem evento de sucesso não dá pra medir taxa de falha por plataforma —
-- a auditoria do caso Android (Alberto, 14/07) ficou meio-cega por isso.
-- stage 'done' + outcome 'success' entram nos CHECKs; nomes dos constraints
-- são os default do Postgres pra CHECK inline (verificar antes de aplicar).
ALTER TABLE public.media_send_telemetry
  DROP CONSTRAINT IF EXISTS media_send_telemetry_stage_check;
ALTER TABLE public.media_send_telemetry
  ADD CONSTRAINT media_send_telemetry_stage_check
  CHECK (stage IN ('validate','normalize','upload','proxy','confirm','insert','done','unknown'));

ALTER TABLE public.media_send_telemetry
  DROP CONSTRAINT IF EXISTS media_send_telemetry_outcome_check;
ALTER TABLE public.media_send_telemetry
  ADD CONSTRAINT media_send_telemetry_outcome_check
  CHECK (outcome IN ('fail','hang_timeout','success'));
