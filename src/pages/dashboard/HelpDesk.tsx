import { useState, useMemo, useCallback, useEffect } from 'react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useHelpdeskInboxes } from '@/hooks/useHelpdeskInboxes';
import { useHelpdeskConversations } from '@/hooks/useHelpdeskConversations';
import { useHelpdeskFilters } from '@/hooks/useHelpdeskFilters';
import { Inbox as InboxIcon, Circle, Clock, CheckCircle2, LayoutList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationList } from '@/components/helpdesk/ConversationList';
import { ChatPanel } from '@/components/helpdesk/ChatPanel';
import { ContactInfoPanel } from '@/components/helpdesk/ContactInfoPanel';
import { ManageLabelsDialog } from '@/components/helpdesk/ManageLabelsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Conversation, Message, AiSummary } from '@/types';

export type { Conversation, Message, AiSummary };

const HelpDesk = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const inboxParam = searchParams.get('inbox');
  const deptParam = searchParams.get('dept');
  const convParam = searchParams.get('conv');
  const isMobile = useIsMobile();

  // Layout state
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);

  // Bulk selection (state only — handlers defined after statusFilter/setConversations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Inbox state
  const {
    inboxes, selectedInboxId, setSelectedInboxId,
    inboxLabels, fetchLabels,
    departmentFilter, setDepartmentFilter,
  } = useHelpdeskInboxes(inboxParam, deptParam);

  // Departments
  const allInboxIds = inboxes.map(ib => ib.id);
  const { departmentsByInbox: allInboxDepts } = useDepartments({ inboxIds: allInboxIds, enabled: allInboxIds.length > 0 });
  const { departments: inboxDepartments } = useDepartments({ inboxId: selectedInboxId, enabled: !!selectedInboxId });

  // Filters (needs statusFilter before conversations)
  const [statusFilter, setStatusFilter] = useState<string>('aberta');

  // Conversations
  const {
    conversations, setConversations,
    selectedConversation, setSelectedConversation,
    loading, loadingMore, hasMoreConversations,
    conversationLabelsMap, conversationNotesSet,
    fetchConversations, fetchConversationLabels, loadMoreConversations,
  } = useHelpdeskConversations(selectedInboxId, statusFilter);

  const { namesMap: agentNamesMap } = useUserProfiles();

  // Auto-select conversation from ?conv= param (from global search)
  useEffect(() => {
    if (!convParam || loading || conversations.length === 0) return;
    const found = conversations.find(c => c.id === convParam);
    if (found) {
      setSelectedConversation(found);
      if (isMobile) setMobileView('chat');
      // Clear the conv param from URL
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('conv');
        return next;
      }, { replace: true });
    }
  }, [convParam, loading, conversations]);

  // Filters
  const {
    searchQuery, setSearchQuery,
    labelFilter, setLabelFilter,
    assignmentFilter, setAssignmentFilter,
    priorityFilter, setPriorityFilter,
    sortBy, setSortBy,
    sortedConversations,
    messageSearchCount,
  } = useHelpdeskFilters({
    conversations,
    conversationLabelsMap,
    departmentFilter,
    userId: user?.id,
  });

  // Bulk action handler (needs statusFilter + setConversations from above)
  const handleBulkAction = useCallback(async (action: 'read' | 'resolve' | 'archive' | 'assign', value?: string) => {
    if (selectedIds.size === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    try {
      let updates: Record<string, unknown> = {};
      if (action === 'read') updates = { is_read: true };
      else if (action === 'resolve') updates = { status: 'resolvida' };
      else if (action === 'archive') updates = { archived: true };
      else if (action === 'assign' && value) updates = { assigned_to: value };

      const { error } = await supabase.from('conversations').update(updates).in('id', ids);
      if (error) throw error;

      setConversations(prev => {
        if (action === 'resolve' && statusFilter !== 'todas' && statusFilter !== 'resolvida') {
          return prev.filter(c => !selectedIds.has(c.id));
        }
        if (action === 'archive') {
          return prev.filter(c => !selectedIds.has(c.id));
        }
        return prev.map(c => selectedIds.has(c.id) ? { ...c, ...updates } as typeof c : c);
      });

      clearSelection();
      toast({ title: `${ids.length} conversa${ids.length > 1 ? 's' : ''} atualizada${ids.length > 1 ? 's' : ''}` });
    } catch (err) {
      console.error('Bulk action error:', err);
      toast({ title: 'Erro na ação em massa', variant: 'destructive' });
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedIds, statusFilter, bulkProcessing, setConversations, clearSelection]);

  // Handlers
  const handleSync = async () => {
    if (!selectedInboxId || syncing) return;
    setSyncing(true);
    try {
      const result = await edgeFunctionFetch<{ synced: number; errors: number }>('sync-conversations', { inbox_id: selectedInboxId });
      toast({
        title: 'Sincronização concluída',
        description: `${result.synced} conversas sincronizadas${result.errors > 0 ? `, ${result.errors} erros` : ''}`,
      });
      fetchConversations();
    } catch (err: unknown) {
      console.error('Sync error:', err);
      toast({
        title: 'Erro na sincronização',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (isMobile) setMobileView('chat');

    if (!conversation.is_read) {
      const { error: readErr } = await supabase
        .from('conversations')
        .update({ is_read: true })
        .eq('id', conversation.id);
      if (readErr) console.error('[HelpDesk] Error marking as read:', readErr);

      setConversations(prev =>
        prev.map(c => c.id === conversation.id ? { ...c, is_read: true } : c)
      );
    }
  }, [isMobile, setSelectedConversation, setConversations]);

  const handleUpdateConversation = useCallback(async (id: string, updates: Partial<Omit<Conversation, 'ai_summary'>>) => {
    // Capture the previous version of THIS conversation for targeted rollback
    const prevVersion = conversations.find(c => c.id === id);
    const wasSelected = selectedConversation?.id === id;
    const prevSelectedSnapshot = wasSelected ? { ...selectedConversation } : null;

    // Apply optimistic update immediately
    setConversations(prev => {
      if (updates.status && statusFilter !== 'todas' && updates.status !== statusFilter) {
        return prev.filter(c => c.id !== id);
      }
      return prev.map(c => c.id === id ? { ...c, ...updates } : c);
    });
    if (wasSelected) {
      setSelectedConversation(prev => prev ? { ...prev, ...updates } : null);
    }

    // Persist to DB
    const { error } = await supabase.from('conversations').update(updates).eq('id', id);
    if (error) {
      console.error('[HelpDesk] Error updating conversation:', error);
      // Targeted rollback — restore only this conversation, preserving other changes
      if (prevVersion) {
        setConversations(prev => {
          const exists = prev.some(c => c.id === id);
          return exists
            ? prev.map(c => c.id === id ? prevVersion : c)
            : [...prev, prevVersion]; // Re-add if it was filtered out
        });
      }
      if (wasSelected && prevSelectedSnapshot) {
        setSelectedConversation(prevSelectedSnapshot as Conversation | null);
      }
      toast({ title: 'Erro ao atualizar conversa', description: error.message, variant: 'destructive' });
      return;
    }

    // Broadcast status change for other tabs/agents
    if (updates.status) {
      import('@/lib/helpdeskBroadcast').then(({ broadcastStatusChanged }) =>
        broadcastStatusChanged(id, updates.status as string)
      );
    }
  }, [statusFilter, selectedConversation, conversations, setConversations, setSelectedConversation]);

  const handleLabelsChanged = useCallback(() => {
    fetchLabels();
    const convIds = conversations.map(c => c.id);
    fetchConversationLabels(convIds);
  }, [fetchLabels, conversations, fetchConversationLabels]);

  const handleAgentAssigned = useCallback((conversationId: string, agentId: string) => {
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, assigned_to: agentId } : c)
    );
    setSelectedConversation(prev =>
      prev?.id === conversationId ? { ...prev, assigned_to: agentId } : prev
    );
  }, []);

  const handleInboxChange = useCallback((val: string) => {
    setSelectedConversation(null);
    setLabelFilter(null);
    clearSelection();
    if (val.includes('|')) {
      const [inboxId, deptId] = val.split('|');
      setSelectedInboxId(inboxId);
      setDepartmentFilter(deptId);
    } else {
      setSelectedInboxId(val);
      setDepartmentFilter(null);
    }
    if (isMobile) setMobileView('list');
  }, [isMobile, setSelectedConversation, setLabelFilter, setSelectedInboxId, setDepartmentFilter, clearSelection]);

  const inboxSelectValue = departmentFilter
    ? `${selectedInboxId}|${departmentFilter}`
    : selectedInboxId;

  const statusTabs = [
    { value: 'aberta', label: 'Atendendo', icon: Circle, color: 'text-emerald-500', count: conversations.filter(c => c.status === 'aberta').length },
    { value: 'pendente', label: 'Aguardando', icon: Clock, color: 'text-yellow-500', count: conversations.filter(c => c.status === 'pendente').length },
    { value: 'resolvida', label: 'Resolvidas', icon: CheckCircle2, color: 'text-blue-500', count: conversations.filter(c => c.status === 'resolvida').length },
    { value: 'todas', label: 'Todas', icon: LayoutList, color: 'text-muted-foreground', count: conversations.length },
  ];

  // Shared header
  const unifiedHeader = (
    <div className="shrink-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <InboxIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-sm leading-tight truncate">Atendimento</h2>
            {inboxes.length > 0 && (
              <Select value={inboxSelectValue} onValueChange={handleInboxChange}>
                <SelectTrigger className="h-5 text-[10px] border-0 bg-transparent p-0 gap-1 text-muted-foreground hover:text-foreground shadow-none focus:ring-0 w-auto max-w-[180px]" aria-label="Selecionar caixa de entrada">
                  <InboxIcon className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  <SelectValue placeholder="Selecionar inbox" />
                </SelectTrigger>
                <SelectContent>
                  {inboxes.map(inbox => {
                    const depts = allInboxDepts[inbox.id] || [];
                    return (
                      <SelectGroup key={inbox.id}>
                        <SelectItem value={inbox.id}>
                          {inbox.name}
                        </SelectItem>
                        {depts.map(dept => (
                          <SelectItem key={dept.id} value={`${inbox.id}|${dept.id}`} className="pl-8 text-xs text-muted-foreground">
                            ↳ {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2.5">
        <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1" role="tablist" aria-label="Filtro por status">
          {statusTabs.map(tab => {
            const TabIcon = tab.icon;
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); clearSelection(); }}
                aria-pressed={active}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TabIcon className={cn('w-3 h-3', active ? tab.color : 'text-muted-foreground/60')} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1',
                    active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border/30" />
    </div>
  );

  const selectedId = selectedConversation?.id || null;

  const listProps = useMemo(() => ({
    conversations: sortedConversations,
    selectedId,
    searchQuery,
    onSearchChange: setSearchQuery,
    onSelect: handleSelectConversation,
    loading,
    inboxLabels,
    conversationLabelsMap,
    labelFilter,
    onLabelFilterChange: setLabelFilter,
    inboxId: selectedInboxId,
    onLabelsChanged: handleLabelsChanged,
    agentNamesMap,
    conversationNotesSet,
    assignmentFilter,
    onAssignmentFilterChange: setAssignmentFilter,
    priorityFilter,
    onPriorityFilterChange: setPriorityFilter,
    inboxDepartments,
    departmentFilter,
    onDepartmentFilterChange: setDepartmentFilter,
    hasMore: hasMoreConversations,
    loadingMore,
    onLoadMore: loadMoreConversations,
    sortBy,
    onSortChange: setSortBy,
    messageSearchCount,
    selectedIds,
    onToggleSelect: toggleSelect,
    onToggleSelectAll: toggleSelectAll,
    onClearSelection: clearSelection,
    onBulkAction: handleBulkAction,
  }), [sortedConversations, selectedId, searchQuery, loading, inboxLabels,
    conversationLabelsMap, labelFilter, selectedInboxId, agentNamesMap,
    conversationNotesSet, assignmentFilter, priorityFilter, inboxDepartments,
    departmentFilter, hasMoreConversations, loadingMore, sortBy, messageSearchCount,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection, handleBulkAction,
    handleSelectConversation, handleLabelsChanged, loadMoreConversations, fetchConversationLabels]);

  const labelsDialog = selectedInboxId && (
    <ManageLabelsDialog
      open={manageLabelsOpen}
      onOpenChange={setManageLabelsOpen}
      inboxId={selectedInboxId}
      labels={inboxLabels}
      onChanged={handleLabelsChanged}
    />
  );

  const assignedLabelIds = useMemo(() =>
    selectedConversation ? conversationLabelsMap[selectedConversation.id] || [] : [],
    [selectedConversation, conversationLabelsMap]
  );

  const chatPanelProps = useMemo(() => ({
    conversation: selectedConversation,
    onUpdateConversation: handleUpdateConversation,
    inboxLabels,
    assignedLabelIds,
    onLabelsChanged: handleLabelsChanged,
    agentNamesMap,
    onAgentAssigned: handleAgentAssigned,
  }), [selectedConversation, inboxLabels, assignedLabelIds, agentNamesMap,
    handleUpdateConversation, handleLabelsChanged, handleAgentAssigned]);

  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] -m-4 overflow-hidden">
        {mobileView === 'list' && (
          <>
            {unifiedHeader}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ConversationList {...listProps} />
            </div>
          </>
        )}
        {mobileView === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatPanel
              {...chatPanelProps}
              onBack={() => setMobileView('list')}
              onShowInfo={() => setMobileView('info')}
            />
          </div>
        )}
        {mobileView === 'info' && selectedConversation && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ContactInfoPanel
              conversation={selectedConversation}
              onUpdateConversation={handleUpdateConversation}
              onBack={() => setMobileView('chat')}
              inboxLabels={inboxLabels}
              assignedLabelIds={conversationLabelsMap[selectedConversation.id] || []}
              onLabelsChanged={handleLabelsChanged}
              agentNamesMap={agentNamesMap}
            />
          </div>
        )}
        {labelsDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {unifiedHeader}
      {labelsDialog}
      <div className="flex flex-1 overflow-hidden rounded-xl border border-border/50 bg-card/30">
        {showConversationList && (
          <div className="w-80 lg:w-96 border-r border-border/50 flex flex-col shrink-0 overflow-hidden">
            <ConversationList {...listProps} />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatPanel
            {...chatPanelProps}
            onToggleInfo={() => setShowContactInfo(prev => !prev)}
            showingInfo={showContactInfo}
            onToggleList={() => setShowConversationList(prev => !prev)}
            showingList={showConversationList}
          />
        </div>

        {selectedConversation && showContactInfo && (
          <div className="w-64 lg:w-72 border-l border-border/50 flex flex-col shrink-0 overflow-hidden">
            <ContactInfoPanel
              conversation={selectedConversation}
              onUpdateConversation={handleUpdateConversation}
              inboxLabels={inboxLabels}
              assignedLabelIds={conversationLabelsMap[selectedConversation.id] || []}
              onLabelsChanged={handleLabelsChanged}
              agentNamesMap={agentNamesMap}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpDesk;
