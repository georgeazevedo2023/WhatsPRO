import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import type { AiSummary } from '@/types';

export interface PastConversation {
  id: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  ai_summary: AiSummary | null;
  last_message: string | null;
}

export function useContactHistory(contactId: string | undefined, currentConvId: string) {
  const [pastConversations, setPastConversations] = useState<PastConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [generatingSummaryFor, setGeneratingSummaryFor] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) return;
    setLoading(true);

    Promise.all([
      supabase.from('conversations').select('id', { count: 'exact', head: true })
        .eq('contact_id', contactId).neq('id', currentConvId),
      supabase.from('conversations')
        .select('id, status, last_message_at, created_at, ai_summary, last_message')
        .eq('contact_id', contactId).neq('id', currentConvId)
        .order('last_message_at', { ascending: false }).limit(limit),
    ]).then(([countRes, dataRes]) => {
      setTotalCount(countRes.count ?? 0);
      setPastConversations(
        (dataRes.data || []).map(c => ({ ...c, ai_summary: (c.ai_summary as unknown as AiSummary) ?? null }))
      );
    }).catch(err => handleError(err, 'Erro ao carregar histórico', 'useContactHistory'))
      .finally(() => setLoading(false));
  }, [contactId, currentConvId, limit]);

  const loadAll = useCallback(() => setLimit(200), []);

  const generateSummary = useCallback(async (convId: string) => {
    setGeneratingSummaryFor(convId);
    try {
      const result = await edgeFunctionFetch<{ summary: AiSummary }>('summarize-conversation', { conversation_id: convId });
      setPastConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, ai_summary: result.summary } : c)
      );
      toast.success('Resumo gerado!');
    } catch (err) {
      handleError(err, 'Erro ao gerar resumo', 'generateSummary');
    } finally {
      setGeneratingSummaryFor(null);
    }
  }, []);

  return { pastConversations, loading, totalCount, loadAll, generateSummary, generatingSummaryFor, hasMore: totalCount > pastConversations.length };
}
