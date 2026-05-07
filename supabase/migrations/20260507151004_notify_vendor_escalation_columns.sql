-- =============================================================================
-- Gap C — colunas pra rastrear escalation 5min/10min sem violar UNIQUE
-- =============================================================================

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS re_pinged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_log_escalation
  ON public.notification_log(sent_at)
  WHERE status = 'sent' AND (re_pinged_at IS NULL OR manager_alerted_at IS NULL);

COMMENT ON COLUMN public.notification_log.re_pinged_at IS
  'Gap C escalation: timestamp do re-ping enviado quando vendor não respondeu em 5min.';
COMMENT ON COLUMN public.notification_log.manager_alerted_at IS
  'Gap C escalation: timestamp do alerta enviado ao gerente quando vendor não respondeu em 10min.';
