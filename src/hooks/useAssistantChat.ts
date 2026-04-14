// M19 S5: Hook do assistente IA conversacional
// Gerencia mensagens, loading, histórico e comunicação com edge function

import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  format_type?: 'number' | 'table' | 'chart' | 'comparison';
  suggestions?: string[];
  timestamp: string;
}

interface AssistantConversation {
  id: string;
  title: string;
  updated_at: string;
}

interface AssistantResponse {
  answer: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  format_type?: 'number' | 'table' | 'chart' | 'comparison';
  suggestions?: string[];
  intent?: string;
  cached?: boolean;
}

// ── Sugestões por contexto ─────────────────────────────────────────────────

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard/gestao': [
    'Quantos leads novos esse mês?',
    'Qual a taxa de transbordo?',
    'Quem são os melhores vendedores?',
  ],
  '/dashboard/gestao/agente': [
    'Qual o custo da IA esse mês?',
    'Qual a eficiência do agente IA?',
    'Comparativo IA vs vendedores?',
  ],
  '/dashboard/gestao/transbordo': [
    'Quais os principais motivos de transbordo?',
    'Qual a taxa de transbordo?',
    'Quantas conversas estão pendentes?',
  ],
  '/dashboard/gestao/origem': [
    'De onde vêm os leads?',
    'Qual canal gera mais leads?',
    'Qual a distribuição de scores?',
  ],
};

const DEFAULT_SUGGESTIONS = [
  'Quantos leads novos esse mês?',
  'Qual o NPS médio?',
  'Qual a taxa de conversão?',
];

function getPageContext(pathname: string): string {
  if (pathname.includes('/vendedor/')) return 'Ficha do vendedor';
  if (pathname.includes('/agente')) return 'Ficha do agente IA';
  if (pathname.includes('/transbordo')) return 'Painel de transbordo';
  if (pathname.includes('/origem')) return 'Métricas de origem';
  if (pathname.includes('/assistant')) return 'Assistente IA';
  if (pathname.includes('/gestao')) return 'Dashboard de gestão';
  return 'Dashboard';
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAssistantChat(instanceId: string | null) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const msgCounter = useRef(0);
  const queryClient = useQueryClient();

  // Histórico de conversas salvas
  const conversationsQuery = useQuery({
    queryKey: ['assistant-conversations', instanceId],
    enabled: !!instanceId,
    queryFn: async (): Promise<AssistantConversation[]> => {
      if (!instanceId) return [];
      const { data, error: err } = await supabase
        .from('assistant_conversations' as any)
        .select('id, title, updated_at')
        .eq('instance_id', instanceId)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (err) throw err;
      return (data || []) as AssistantConversation[];
    },
    staleTime: 60_000,
  });

  // Sugestões iniciais baseadas na página
  const getSuggestions = useCallback((): string[] => {
    const path = window.location.pathname;
    return PAGE_SUGGESTIONS[path] || DEFAULT_SUGGESTIONS;
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback(async (message: string) => {
    if (!instanceId || !message.trim()) return;

    setError(null);
    setIsLoading(true);

    // Adicionar mensagem do user
    const userMsgId = `user-${++msgCounter.current}`;
    const userMsg: AssistantMessage = {
      id: userMsgId,
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const context = getPageContext(window.location.pathname);

      const result = await edgeFunctionFetch<AssistantResponse>('assistant-chat', {
        message: message.trim(),
        instance_id: instanceId,
        conversation_id: currentConversationId,
        context,
      });

      const assistantMsg: AssistantMessage = {
        id: `assistant-${++msgCounter.current}`,
        role: 'assistant',
        content: result.answer,
        data: result.data,
        format_type: result.format_type,
        suggestions: result.suggestions,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Refetch conversations list
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erro ao processar pergunta';
      setError(errMsg);

      const errorMsg: AssistantMessage = {
        id: `error-${++msgCounter.current}`,
        role: 'assistant',
        content: `Desculpe, ocorreu um erro. Tente novamente.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, currentConversationId, queryClient]);

  // Carregar conversa existente
  const loadConversation = useCallback(async (id: string) => {
    const { data, error: err } = await supabase
      .from('assistant_conversations' as any)
      .select('id, messages')
      .eq('id', id)
      .maybeSingle();

    if (err || !data) return;

    const loaded = (data.messages || []) as AssistantMessage[];
    // Adicionar ids se não existem
    const withIds = loaded.map((m: AssistantMessage, i: number) => ({
      ...m,
      id: m.id || `loaded-${i}`,
    }));
    setMessages(withIds);
    setCurrentConversationId(id);
    setError(null);
  }, []);

  // Limpar chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    conversations: conversationsQuery.data || [],
    loadConversation,
    currentConversationId,
    getSuggestions,
  };
}
