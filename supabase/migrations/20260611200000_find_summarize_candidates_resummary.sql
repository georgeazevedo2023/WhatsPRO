-- Melhoria #1 (v7.84.0) — re-resumo por atividade nova.
--
-- O summarizer agora também detecta venda fechada (sale_closed → tag venda:fechada).
-- Sem este critério, uma venda que fecha DEPOIS do resumo gerado nunca seria vista:
-- o candidato saía da janela assim que ai_summary deixava de ser NULL.
--
-- Critério novo: conversa COM resumo volta a ser candidata quando last_message_at
-- avançou além do generated_at do resumo (fallback: expires_at - 60d, que é a
-- derivação do momento de geração). Auto-throttle: ao re-resumir, generated_at
-- vira now() > last_message_at (conversa está 1h+ inativa) → sai da janela até
-- chegar mensagem nova.
CREATE OR REPLACE FUNCTION public.find_summarize_candidates(_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id
  FROM public.conversations c
  WHERE (
      c.ai_summary IS NULL
      OR c.last_message_at > COALESCE(
        NULLIF(c.ai_summary->>'generated_at', '')::timestamptz,
        c.ai_summary_expires_at - interval '60 days'
      )
    )
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
$function$;
