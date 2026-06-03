-- Hardening do backend de envio agendado (auditoria do Disparador 2026-06-03).
-- Fecha 4 riscos reais: envio duplicado (sem claim atômico), sem retry em
-- falha UAZAPI, mensagens presas em 'processing', logs sem retenção, e
-- agendamento sem rate-limit nem validação de acesso à instância.

-- B1. Colunas de retry (nullable-safe; defaults seguros)
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;

-- B2. Claim atômico — espelha o padrão claim_jobs do process-jobs.
-- Marca até p_limit mensagens devidas como 'processing' com FOR UPDATE SKIP
-- LOCKED (dois crons concorrentes nunca pegam a mesma) e devolve as linhas
-- com o token da instância embutido (formato esperado pela edge function).
CREATE OR REPLACE FUNCTION public.claim_scheduled_messages(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH to_claim AS (
    SELECT id
    FROM scheduled_messages
    WHERE status = 'pending' AND next_run_at <= now()
    ORDER BY next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  claimed AS (
    UPDATE scheduled_messages sm
    SET status = 'processing', updated_at = now()
    FROM to_claim tc
    WHERE sm.id = tc.id
    RETURNING sm.*
  )
  SELECT coalesce(jsonb_agg(
    to_jsonb(c) || jsonb_build_object('instances', jsonb_build_object('token', i.token))
  ), '[]'::jsonb)
  INTO v_result
  FROM claimed c
  LEFT JOIN instances i ON i.id = c.instance_id;

  RETURN v_result;
END;
$$;

-- B4a. Re-enfileira mensagens presas em 'processing' (crash do isolate entre
-- etapas deixava a conversa "processando" para sempre).
CREATE OR REPLACE FUNCTION public.requeue_stuck_scheduled_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE scheduled_messages
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing' AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- B4b. Retenção de logs (hoje crescem para sempre).
CREATE OR REPLACE FUNCTION public.purge_scheduled_message_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM scheduled_message_logs WHERE executed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- B5. Guard server-side no agendamento: valida acesso à instância e rate-limit.
-- Fecha o gap da RLS (que só checava user_id, não o acesso real à instância).
CREATE OR REPLACE FUNCTION public.enforce_scheduled_message_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access boolean;
  v_recent integer;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM instances i WHERE i.id = NEW.instance_id AND i.user_id = NEW.user_id)
    OR EXISTS (SELECT 1 FROM user_instance_access uia WHERE uia.instance_id = NEW.instance_id AND uia.user_id = NEW.user_id)
    OR is_super_admin(NEW.user_id)
  INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'forbidden: user has no access to instance %', NEW.instance_id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_recent
  FROM scheduled_messages
  WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour';

  IF v_recent >= 500 THEN
    RAISE EXCEPTION 'rate_limit: too many scheduled messages in the last hour (max 500)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_message_guards ON public.scheduled_messages;
CREATE TRIGGER trg_scheduled_message_guards
  BEFORE INSERT ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scheduled_message_guards();

-- Estas funções são SÓ para a edge function/cron (service_role). claim_*
-- devolve tokens de instância — NUNCA pode ser executável por anon/authenticated.
-- Postgres concede EXECUTE a PUBLIC por padrão, então revogar explicitamente.
REVOKE EXECUTE ON FUNCTION public.claim_scheduled_messages(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.requeue_stuck_scheduled_messages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_scheduled_message_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_messages(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stuck_scheduled_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_scheduled_message_logs() TO service_role;

-- Crons (pg_cron) — padrão do db_retention.sql.
SELECT cron.unschedule('requeue-stuck-scheduled-messages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'requeue-stuck-scheduled-messages');
SELECT cron.schedule('requeue-stuck-scheduled-messages', '*/5 * * * *',
  $$SELECT public.requeue_stuck_scheduled_messages()$$);

SELECT cron.unschedule('purge-scheduled-message-logs')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-scheduled-message-logs');
SELECT cron.schedule('purge-scheduled-message-logs', '40 4 * * *',
  $$SELECT public.purge_scheduled_message_logs()$$);
