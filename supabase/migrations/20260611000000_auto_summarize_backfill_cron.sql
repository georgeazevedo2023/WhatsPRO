-- Religa o pipeline de resumos IA (motivos de conversa no dashboard gestor).
-- Contexto: ai_summary NUNCA foi gerado automaticamente — o trigger
-- auto_summarize_on_resolve dependia do GUC app.settings.anon_key (sempre NULL),
-- tinha URL de fallback de projeto morto (crzcpnczpuzwieyzbqev) e chamava
-- extensions.net.http_post (schema inexistente). Substituído por cron de backfill
-- no padrão dos demais jobs (vault CRON_AUTH_KEY).

-- 1) RPC de candidatos: filtra contagem de mensagens no SQL (>=3, sem private_note)
--    pra conversas curtas não estagnarem a janela de candidatos; piso de 60d alinhado
--    ao expiry do ai_summary (evita re-resumir expiradas em churn infinito).
CREATE OR REPLACE FUNCTION public.find_summarize_candidates(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.conversations c
  WHERE c.ai_summary IS NULL
    AND c.last_message_at < now() - interval '1 hour'
    AND c.last_message_at >= now() - interval '60 days'
    AND (
      SELECT count(*)
      FROM public.conversation_messages m
      WHERE m.conversation_id = c.id
        AND m.direction <> 'private_note'
    ) >= 3
  ORDER BY c.last_message_at DESC
  LIMIT _limit;
$$;

REVOKE EXECUTE ON FUNCTION public.find_summarize_candidates(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_summarize_candidates(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_summarize_candidates(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_summarize_candidates(integer) TO service_role;

-- 2) Remove o trigger morto e sua função
DROP TRIGGER IF EXISTS auto_summarize_on_resolve ON public.conversations;
DROP FUNCTION IF EXISTS public.trigger_auto_summarize();

-- 3) Cron: backfill a cada 30 min (até 30 conversas/rodada)
SELECT cron.schedule(
  'auto-summarize-backfill',
  '*/30 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/auto-summarize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{"mode":"backfill","limit":30}'::jsonb
  ) AS request_id;
  $job$
);
