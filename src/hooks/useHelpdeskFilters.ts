import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { leadFullName } from '@/lib/contactDisplayName';
import { sanitizeSearchTerm, extractDigits, mergeServerMatches } from '@/lib/helpdeskServerSearch';
import { CONVERSATION_LIST_SELECT, mapConversationRows } from '@/hooks/useHelpdeskConversations';
import type { Conversation } from '@/types';

interface UseHelpdeskFiltersOptions {
  conversations: Conversation[];
  conversationLabelsMap: Record<string, string[]>;
  departmentFilter: string | null;
  userId: string | undefined;
  defaultAssignmentFilter?: 'todas' | 'minhas' | 'nao-atribuidas';
  /** Caixa atual — habilita a busca server-side (3+ chars) em TODOS os status. */
  inboxId?: string;
}

export function useHelpdeskFilters({ conversations, conversationLabelsMap, departmentFilter, userId, defaultAssignmentFilter, inboxId }: UseHelpdeskFiltersOptions) {
  const [statusFilter, setStatusFilter] = useState<string>('aberta');
  const [searchQuery, setSearchQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'todas' | 'minhas' | 'nao-atribuidas'>(defaultAssignmentFilter || 'todas');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [sortBy, setSortBy] = useState<'recentes' | 'antigas' | 'prioridade' | 'nao-lidas'>('recentes');
  const [messageSearchIds, setMessageSearchIds] = useState<Set<string>>(new Set());
  const [messageSearchCount, setMessageSearchCount] = useState(0);
  // Busca server-side (3+ chars): conversas da caixa em QUALQUER status cujo contato
  // case por telefone/pushname/nome extraído. A lista carregada é paginada (50) e
  // filtrada por status no servidor — sem isso, buscar o número de uma conversa
  // resolvida/antiga dava 0 resultados (caso real 558196970061, 2026-06-11).
  const [serverMatches, setServerMatches] = useState<Conversation[]>([]);

  // Search messages when searchQuery has 3+ chars
  useEffect(() => {
    if (searchQuery.length < 3) {
      setMessageSearchIds(new Set());
      setMessageSearchCount(0);
      return;
    }
    const timer = setTimeout(async () => {
      const convIds = conversations.map(c => c.id);
      if (convIds.length === 0) return;
      const { data } = await supabase
        .from('conversation_messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .ilike('content', `%${searchQuery}%`)
        .limit(50);
      if (data) {
        const ids = new Set(data.map((d: { conversation_id: string }) => d.conversation_id));
        setMessageSearchIds(ids);
        setMessageSearchCount(ids.size);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, conversations]);

  // Busca server-side por contato (telefone/pushname/nome extraído) — debounce 500ms
  useEffect(() => {
    const q = sanitizeSearchTerm(searchQuery);
    if (q.length < 3 || !inboxId) {
      setServerMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const digits = extractDigits(q);
        const orParts = [`name.ilike.%${q}%`];
        if (digits.length >= 4) orParts.push(`phone.like.%${digits}%`);
        const [contactsRes, profilesRes] = await Promise.all([
          supabase.from('contacts').select('id').or(orParts.join(',')).limit(30),
          supabase.from('lead_profiles').select('contact_id').ilike('full_name', `%${q}%`).limit(30),
        ]);
        const contactIds = [...new Set([
          ...(contactsRes.data || []).map((r: { id: string }) => r.id),
          ...(profilesRes.data || []).map((r: { contact_id: string }) => r.contact_id),
        ])];
        if (contactIds.length === 0) {
          setServerMatches([]);
          return;
        }
        const { data } = await supabase
          .from('conversations')
          .select(CONVERSATION_LIST_SELECT)
          .eq('inbox_id', inboxId)
          .eq('archived', false)
          .in('contact_id', contactIds)
          .order('last_message_at', { ascending: false })
          .limit(20);
        setServerMatches(mapConversationRows(data || []));
      } catch {
        setServerMatches([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, inboxId]);

  const filteredConversations = conversations.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = c.contact?.name?.toLowerCase().includes(q)
        || leadFullName(c.contact)?.toLowerCase().includes(q)
        || c.contact?.phone?.includes(q);
      const matchesMessage = messageSearchIds.has(c.id);
      if (!matchesName && !matchesMessage) return false;
    }
    if (labelFilter) {
      const convLabels = conversationLabelsMap[c.id] || [];
      if (!convLabels.includes(labelFilter)) return false;
    }
    if (assignmentFilter === 'minhas' && c.assigned_to !== userId) return false;
    if (assignmentFilter === 'nao-atribuidas' && c.assigned_to !== null) return false;
    if (priorityFilter !== 'todas' && c.priority !== priorityFilter) return false;
    if (departmentFilter && c.department_id !== departmentFilter) return false;
    return true;
  });

  // Resultado do servidor entra DEPOIS do filtro client-side (dedup por id):
  // se o servidor achou pelo termo buscado, o usuário quer ver — independente
  // de status/atribuição/prioridade locais.
  const searchActive = sanitizeSearchTerm(searchQuery).length >= 3;
  const withServerMatches = searchActive
    ? mergeServerMatches(filteredConversations, serverMatches)
    : filteredConversations;

  const sortedConversations = useMemo(() => {
    const sorted = [...withServerMatches];
    switch (sortBy) {
      case 'antigas':
        return sorted.sort((a, b) => new Date(a.last_message_at || 0).getTime() - new Date(b.last_message_at || 0).getTime());
      case 'prioridade': {
        const priorityOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
        return sorted.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
      }
      case 'nao-lidas':
        return sorted.sort((a, b) => (a.is_read === b.is_read ? 0 : a.is_read ? 1 : -1));
      default:
        return sorted.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
    }
  }, [withServerMatches, sortBy]);

  return {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    labelFilter,
    setLabelFilter,
    assignmentFilter,
    setAssignmentFilter,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    sortedConversations,
    messageSearchCount,
  };
}
