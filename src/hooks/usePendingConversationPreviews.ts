// Preview (mensagem do lead + atendente atribuído) das conversas pendentes do
// Dashboard do Gestor. Busca SÓ os ids da página VISÍVEL dos cards de Atendimento
// (lazy) — o load inicial só puxa a 1ª página, não as centenas de pendentes.
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationPreview {
  conversationId: string;
  leadMessage: string | null;
  leadMessageAt: string | null;
  assignedTo: string | null;
}

export function usePendingConversationPreviews(conversationIds: string[]) {
  // Chave estável: mesma lista (em qualquer ordem) → mesmo cache.
  const sortedKey = useMemo(() => [...conversationIds].sort(), [conversationIds]);

  return useQuery({
    queryKey: ['pending-conv-previews', sortedKey],
    enabled: conversationIds.length > 0,
    staleTime: 60_000,
    // "Ver mais" muda a chave (superset de ids) → sem isto, os previews já
    // carregados sumiriam (flash "carregando…"). Mantém os anteriores enquanto busca.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Map<string, ConversationPreview>> => {
      // RPC fora dos tipos gerados (padrão do projeto: cast `as any`, ver useManagerMetrics).
      const { data, error } = await (supabase.rpc as any)('get_pending_conversation_previews', {
        p_conversation_ids: conversationIds,
      });
      if (error) throw error;
      const map = new Map<string, ConversationPreview>();
      for (const r of (data || []) as any[]) {
        map.set(r.conversation_id, {
          conversationId: r.conversation_id,
          leadMessage: r.lead_message ?? null,
          leadMessageAt: r.lead_message_at ?? null,
          assignedTo: r.assigned_to ?? null,
        });
      }
      return map;
    },
  });
}
