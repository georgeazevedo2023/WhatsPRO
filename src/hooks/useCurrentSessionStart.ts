import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_GAP_MS = 12 * 60 * 60 * 1000; // 12h sem msg = nova sessão

/**
 * Calcula o início da "sessão atual" de uma conversa: timestamp da primeira
 * mensagem que vem após o último gap ≥ 12h sem mensagens, ou após o último
 * `resolved_at` (atendente fechou). Útil para mostrar "duração da conversa
 * atual" no helpdesk sem misturar sessões antigas do mesmo lead.
 *
 * Estratégia: busca as últimas N mensagens em ordem decrescente, varre do
 * mais recente para o mais antigo, e retorna o timestamp da primeira
 * mensagem cujo `created_at` precedente tem gap ≥ 12h. Para conversas
 * curtas sem gap, retorna o timestamp da mensagem mais antiga.
 *
 * Fallback: se a query falhar ou não houver mensagens, retorna null.
 */
export function useCurrentSessionStart(
  conversationId: string | undefined,
  lastMessageAt: string | null | undefined,
  resolvedAt?: string | null,
): string | null {
  const [sessionStart, setSessionStart] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setSessionStart(null);
      return;
    }
    let cancelled = false;
    const fetchSessionStart = async () => {
      try {
        const { data, error } = await supabase
          .from('conversation_messages')
          .select('created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setSessionStart(null);
          return;
        }
        // Iterando do mais recente para o mais antigo: a sessão atual termina
        // quando achamos um gap ≥ 12h ou cruzamos o resolved_at.
        const resolvedTs = resolvedAt ? new Date(resolvedAt).getTime() : null;
        let candidateStart = data[data.length - 1].created_at as string;
        for (let i = 0; i < data.length - 1; i++) {
          const cur = new Date(data[i].created_at as string).getTime();
          const next = new Date(data[i + 1].created_at as string).getTime();
          // resolved_at corta a sessão se está entre `next` e `cur`
          if (resolvedTs !== null && resolvedTs >= next && resolvedTs <= cur) {
            candidateStart = data[i].created_at as string;
            break;
          }
          if (cur - next >= SESSION_GAP_MS) {
            candidateStart = data[i].created_at as string;
            break;
          }
        }
        setSessionStart(candidateStart);
      } catch {
        if (!cancelled) setSessionStart(null);
      }
    };
    fetchSessionStart();
    return () => {
      cancelled = true;
    };
    // lastMessageAt como dependência força re-fetch quando uma msg nova chega
  }, [conversationId, lastMessageAt, resolvedAt]);

  return sessionStart;
}

/** Helper puro pra teste — recebe array de timestamps em ordem decrescente. */
export function computeSessionStart(
  timestampsDesc: string[],
  resolvedAt?: string | null,
  gapMs = SESSION_GAP_MS,
): string | null {
  if (!timestampsDesc.length) return null;
  const resolvedTs = resolvedAt ? new Date(resolvedAt).getTime() : null;
  let candidateStart = timestampsDesc[timestampsDesc.length - 1];
  for (let i = 0; i < timestampsDesc.length - 1; i++) {
    const cur = new Date(timestampsDesc[i]).getTime();
    const next = new Date(timestampsDesc[i + 1]).getTime();
    if (resolvedTs !== null && resolvedTs >= next && resolvedTs <= cur) {
      candidateStart = timestampsDesc[i];
      break;
    }
    if (cur - next >= gapMs) {
      candidateStart = timestampsDesc[i];
      break;
    }
  }
  return candidateStart;
}

export const __TEST_GAP_MS = SESSION_GAP_MS;
