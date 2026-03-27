import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation } from '@/types';

function mediaPreview(mediaType: string): string {
  switch (mediaType) {
    case 'image': return '📷 Foto';
    case 'video': return '🎥 Vídeo';
    case 'audio': return '🎵 Áudio';
    case 'document': return '📎 Documento';
    default: return '';
  }
}

const PAGE_SIZE = 50;

export function useHelpdeskConversations(selectedInboxId: string, statusFilter: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [conversationLabelsMap, setConversationLabelsMap] = useState<Record<string, string[]>>({});
  const [conversationNotesSet, setConversationNotesSet] = useState<Set<string>>(new Set());

  const mapConversations = useCallback((data: Record<string, unknown>[]): Conversation[] => {
    return data.map((c: Record<string, unknown>) => ({
      ...c,
      contact: c.contacts,
      inbox: c.inboxes,
      last_message: c.last_message || null,
      ai_summary: c.ai_summary || null,
      department_name: (c.departments as Record<string, unknown> | null)?.name || null,
    })) as Conversation[];
  }, []);

  const buildQuery = useCallback(() => {
    let query = supabase
      .from('conversations')
      .select('id, inbox_id, contact_id, status, priority, assigned_to, department_id, is_read, last_message_at, last_message, status_ia, tags, ai_summary, created_at, contacts(id, phone, jid, name, profile_pic_url), inboxes(id, name, instance_id, webhook_outgoing_url), departments(id, name)')
      .eq('inbox_id', selectedInboxId)
      .eq('archived', false)
      .order('last_message_at', { ascending: false });

    if (statusFilter !== 'todas') {
      query = query.eq('status', statusFilter);
    }
    return query;
  }, [selectedInboxId, statusFilter]);

  const fetchConversationLabels = useCallback(async (convIds: string[]) => {
    if (convIds.length === 0) {
      setConversationLabelsMap({});
      return;
    }
    const { data } = await supabase
      .from('conversation_labels')
      .select('conversation_id, label_id')
      .in('conversation_id', convIds);

    const map: Record<string, string[]> = {};
    (data || []).forEach(cl => {
      if (!map[cl.conversation_id]) map[cl.conversation_id] = [];
      map[cl.conversation_id].push(cl.label_id);
    });
    setConversationLabelsMap(map);
  }, []);

  const fetchConversationNotes = useCallback(async (convIds: string[]) => {
    if (convIds.length === 0) {
      setConversationNotesSet(new Set());
      return;
    }
    // Only fetch distinct conversation_ids that have notes (lighter than fetching all note rows)
    const { data } = await supabase
      .from('conversation_messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .eq('direction', 'private_note')
      .limit(convIds.length); // max 1 per conversation is enough to know it has notes

    const noteSet = new Set<string>((data || []).map((m: { conversation_id: string }) => m.conversation_id));
    setConversationNotesSet(noteSet);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user || !selectedInboxId) return;
    setLoading(true);
    try {
      const { data, error } = await buildQuery().range(0, PAGE_SIZE - 1);
      if (error) throw error;

      const rows = data || [];
      setHasMoreConversations(rows.length === PAGE_SIZE);

      const convIds = rows.map((c: { id: string }) => c.id);
      await Promise.all([
        fetchConversationLabels(convIds),
        fetchConversationNotes(convIds),
      ]);

      setConversations(mapConversations(rows));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedInboxId, buildQuery, mapConversations, fetchConversationLabels, fetchConversationNotes]);

  const loadMoreConversations = useCallback(async () => {
    if (!user || !selectedInboxId || loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = conversations.length;
      const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;

      const rows = data || [];
      setHasMoreConversations(rows.length === PAGE_SIZE);

      const convIds = rows.map((c: { id: string }) => c.id);
      await Promise.all([
        fetchConversationLabels(convIds),
        fetchConversationNotes(convIds),
      ]);

      setConversations(prev => [...prev, ...mapConversations(rows)]);
    } catch (err) {
      console.error('Error loading more conversations:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, selectedInboxId, loadingMore, conversations.length, buildQuery, mapConversations, fetchConversationLabels, fetchConversationNotes]);

  // Reset selected conversation when inbox changes
  useEffect(() => {
    setSelectedConversation(prev => {
      if (prev && prev.inbox_id !== selectedInboxId) return null;
      return prev;
    });
  }, [selectedInboxId]);

  // Fetch conversations when dependencies change
  useEffect(() => {
    if (selectedInboxId) {
      fetchConversations();
    }
  }, [fetchConversations]);

  // Realtime via broadcast
  useEffect(() => {
    if (!selectedInboxId) return;

    // Track current fetch to avoid stale closure on fetchConversations
    let isMounted = true;

    const channel = supabase
      .channel('helpdesk-conversations')
      .on('broadcast', { event: 'new-message' }, (payload) => {
        const data = payload.payload;
        if (data?.inbox_id !== selectedInboxId || !isMounted) return;

        setConversations(prev => {
          const exists = prev.some(c => c.id === data.conversation_id);
          if (exists) {
            const updated = prev.map(c =>
              c.id === data.conversation_id
                ? { ...c, last_message: data.content || mediaPreview(data.media_type) || c.last_message, last_message_at: data.created_at, is_read: false }
                : c
            );
            return updated.sort((a, b) =>
              new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
            );
          }
          // New conversation not in list — refetch (debounced to avoid race)
          if (isMounted) {
            setTimeout(() => { if (isMounted) fetchConversations(); }, 500);
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'assigned-agent' }, (payload) => {
        const { conversation_id, assigned_to } = payload.payload || {};
        if (!conversation_id) return;
        setConversations(prev =>
          prev.map(c => c.id === conversation_id ? { ...c, assigned_to: assigned_to ?? null } : c)
        );
        setSelectedConversation(prev =>
          prev?.id === conversation_id ? { ...prev, assigned_to: assigned_to ?? null } : prev
        );
      })
      .on('broadcast', { event: 'status-changed' }, (payload) => {
        const { conversation_id, status } = payload.payload || {};
        if (!conversation_id || !status) return;
        setConversations(prev => {
          // If filter is active and status doesn't match, remove from list
          if (statusFilter !== 'todas' && status !== statusFilter) {
            return prev.filter(c => c.id !== conversation_id);
          }
          return prev.map(c => c.id === conversation_id ? { ...c, status } : c);
        });
        setSelectedConversation(prev =>
          prev?.id === conversation_id ? { ...prev, status } : prev
        );
      })
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [selectedInboxId, statusFilter, fetchConversations]);

  return {
    conversations,
    setConversations,
    selectedConversation,
    setSelectedConversation,
    loading,
    loadingMore,
    hasMoreConversations,
    conversationLabelsMap,
    conversationNotesSet,
    fetchConversations,
    fetchConversationLabels,
    loadMoreConversations,
  };
}
