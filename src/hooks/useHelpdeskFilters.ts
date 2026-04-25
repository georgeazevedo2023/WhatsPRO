import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from '@/types';

interface UseHelpdeskFiltersOptions {
  conversations: Conversation[];
  conversationLabelsMap: Record<string, string[]>;
  departmentFilter: string | null;
  userId: string | undefined;
  defaultAssignmentFilter?: 'todas' | 'minhas' | 'nao-atribuidas';
}

export function useHelpdeskFilters({ conversations, conversationLabelsMap, departmentFilter, userId, defaultAssignmentFilter }: UseHelpdeskFiltersOptions) {
  const [statusFilter, setStatusFilter] = useState<string>('aberta');
  const [searchQuery, setSearchQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'todas' | 'minhas' | 'nao-atribuidas'>(defaultAssignmentFilter || 'todas');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [sortBy, setSortBy] = useState<'recentes' | 'antigas' | 'prioridade' | 'nao-lidas'>('recentes');
  const [messageSearchIds, setMessageSearchIds] = useState<Set<string>>(new Set());
  const [messageSearchCount, setMessageSearchCount] = useState(0);

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

  const filteredConversations = conversations.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = c.contact?.name?.toLowerCase().includes(q) || c.contact?.phone?.includes(q);
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

  const sortedConversations = useMemo(() => {
    const sorted = [...filteredConversations];
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
  }, [filteredConversations, sortBy]);

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
