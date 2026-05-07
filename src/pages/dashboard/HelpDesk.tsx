import { useState, useMemo, useCallback, useEffect } from 'react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useHelpdeskInboxes } from '@/hooks/useHelpdeskInboxes';
import { useHelpdeskConversations } from '@/hooks/useHelpdeskConversations';
import { useHelpdeskFilters } from '@/hooks/useHelpdeskFilters';
import { useActiveQueueEvents } from '@/hooks/useActiveQueueEvents';
import { Inbox as InboxIcon, Circle, Clock, CheckCircle2, LayoutList, Lock, User, UserMinus, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationList } from '@/components/helpdesk/ConversationList';
import QueuePauseToggle from '@/components/helpdesk/QueuePauseToggle';
import { VendorNotificationBanner } from '@/components/helpdesk/VendorNotificationBanner';
import { ChatPanel } from '@/components/helpdesk/ChatPanel';
import { ContactInfoPanel } from '@/components/helpdesk/ContactInfoPanel';
import { ManageLabelsDialog } from '@/components/helpdesk/ManageLabelsDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Conversation, Message, AiSummary } from '@/types';

export type { Conversation, Message, AiSummary };

const HelpDesk = () => {
  const { user, isSuperAdmin } = useAuth();
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
    inboxes, inboxesLoading, selectedInboxId, setSelectedInboxId,
    inboxLabels, fetchLabels,
    departmentFilter, setDepartmentFilter,
    userPermissions,
  } = useHelpdeskInboxes(inboxParam, deptParam);

  const noInboxAccess = !inboxesLoading && inboxes.length === 0;
  const emptyAccessState = (
    <EmptyState
      icon={isSuperAdmin ? InboxIcon : Lock}
      title={isSuperAdmin ? 'Nenhuma caixa de entrada disponível' : 'Você não tem acesso a nenhuma caixa'}
      desc={
        isSuperAdmin
          ? 'Conecte uma instância e crie a primeira caixa de entrada para começar a atender.'
          : 'Solicite ao administrador da instância para liberar pelo menos uma caixa de entrada para você.'
      }
    />
  );

  const defaultAssignmentFilter = isSuperAdmin ? 'todas' as const : 'minhas' as const;

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
    conversationLabelsMap, conversationNotesSet, draftSet,
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
    defaultAssignmentFilter,
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

  // Status filter options — now rendered inside ConversationList (no longer top tabs)
  const statusOptions = [
    { value: 'aberta', label: 'Atendendo', icon: Circle, color: 'text-emerald-500' },
    { value: 'pendente', label: 'Aguardando', icon: Clock, color: 'text-yellow-500' },
    { value: 'resolvida', label: 'Resolvidas', icon: CheckCircle2, color: 'text-blue-500' },
    { value: 'todas', label: 'Todas', icon: LayoutList, color: 'text-muted-foreground' },
  ];

  // Escopo (assignment) tabs — now the primary navigation. Counts respect current
  // status + department, so they reflect what the attendant can act on right now.
  const tabBase = conversations.filter(c =>
    !departmentFilter || c.department_id === departmentFilter
  );
  const canSeeUnassigned = isSuperAdmin || !!userPermissions?.canViewUnassigned;
  const canSeeAll = isSuperAdmin || !!userPermissions?.canViewAllInDept || !!userPermissions?.canViewAll;
  // shortLabel = mobile (cabe em ~88px por tab quando pane=320px); label = desktop ≥sm
  const assignmentTabs = [
    {
      value: 'minhas' as const,
      label: 'Minhas',
      shortLabel: 'Minhas',
      icon: User,
      color: 'text-emerald-500',
      count: tabBase.filter(c => c.assigned_to === user?.id).length,
      visible: true,
    },
    {
      value: 'nao-atribuidas' as const,
      label: 'Não atribuídas',
      shortLabel: 'Livres',
      icon: UserMinus,
      color: 'text-amber-500',
      count: tabBase.filter(c => c.assigned_to === null).length,
      visible: canSeeUnassigned,
    },
    {
      value: 'todas' as const,
      label: 'Todas',
      shortLabel: 'Todas',
      icon: Users,
      color: 'text-muted-foreground',
      count: tabBase.length,
      visible: canSeeAll,
    },
  ].filter(t => t.visible);

  // Cap counts visualmente para evitar quebra (3 dígitos estouram tab estreito)
  const formatCount = (n: number) => (n > 99 ? '99+' : String(n));

  // Shared header — mobile-first, 2 rows: inbox pill + escopo tabs.
  // Removido o título "Atendimento" (redundante com breadcrumb + sidebar ativa)
  // ganhando ~40px verticais. Tabs com touch target ≥44px no mobile.
  const unifiedHeader = (
    <div className="shrink-0">
      {/* Row 1 — inbox como pill prominente, tappable */}
      {inboxes.length > 0 && (
        <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
          <Select value={inboxSelectValue} onValueChange={handleInboxChange}>
            <SelectTrigger
              aria-label="Selecionar caixa de entrada"
              className="h-10 sm:h-9 px-3 gap-2 rounded-lg bg-secondary/60 hover:bg-secondary/80 border-border/40 text-sm font-medium text-foreground transition-colors w-auto max-w-full flex-1"
            >
              <InboxIcon className="w-4 h-4 shrink-0 text-primary" />
              <SelectValue placeholder="Selecionar inbox" />
            </SelectTrigger>
            <SelectContent>
              {inboxes.map(inbox => {
                const depts = allInboxDepts[inbox.id] || [];
                return (
                  <SelectGroup key={inbox.id}>
                    <SelectItem value={inbox.id}>{inbox.name}</SelectItem>
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
          {/* D30 Sprint F: pause toggle pessoal — só aparece se user é membro de algum dept */}
          <QueuePauseToggle />
        </div>
      )}

      {/* Notif handoff: banner contextual quando janela WhatsApp 24h expirou/vai expirar */}
      <div className="px-3 pb-2">
        <VendorNotificationBanner />
      </div>

      {/* Row 2 — escopo tabs full-width, touch target 44px mobile / 36px desktop */}
      <div className="px-3 pb-2">
        <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1" role="tablist" aria-label="Filtro por escopo">
          {assignmentTabs.map(tab => {
            const TabIcon = tab.icon;
            const active = assignmentFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setAssignmentFilter(tab.value); clearSelection(); }}
                aria-pressed={active}
                title={tab.label}
                className={cn(
                  'flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground active:bg-card/40'
                )}
              >
                <TabIcon className={cn('w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0', active ? tab.color : 'text-muted-foreground/60')} />
                <span className="truncate">
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
                {tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] sm:text-[9px] font-bold tabular-nums min-w-[18px] h-[18px] sm:min-w-[16px] sm:h-4 flex items-center justify-center rounded-full px-1 shrink-0',
                    active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {formatCount(tab.count)}
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

  // D30 Sprint F: badge "Em fila — Lucas (3:42)" + countdown ao vivo + Realtime updates
  const { events: queueEvents, secondsRemaining: queueSecondsRemaining } = useActiveQueueEvents();

  // D30 R94: quando queueEvents muda (broadcast queue-update do cron / assignAgent),
  // a conversation.assigned_to pode ter mudado em background. Sincroniza header +
  // painel direito da conversa selecionada e seu lugar na lista.
  useEffect(() => {
    const id = selectedConversation?.id;
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('conversations')
        .select('assigned_to')
        .eq('id', id)
        .maybeSingle();
      if (cancelled || !data) return;
      const newAssignee = (data.assigned_to as string | null) ?? null;
      const currentAssignee = selectedConversation?.assigned_to ?? null;
      if (newAssignee === currentAssignee) return;
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, assigned_to: newAssignee } as typeof c : c),
      );
      setSelectedConversation(prev =>
        prev?.id === id ? { ...prev, assigned_to: newAssignee } as typeof prev : prev,
      );
    })();
    return () => { cancelled = true; };
  }, [queueEvents, selectedConversation?.id, selectedConversation?.assigned_to, setConversations, setSelectedConversation]);

  const queueBadgesMap = useMemo(() => {
    const map = new Map<string, { assignee_name: string | null; seconds_remaining: number | null; paused: boolean }>();
    for (const ev of queueEvents.values()) {
      // Não mostra badge para o próprio assignee — ele não precisa saber que está "em fila" pra si mesmo
      if (ev.assigned_user_id && ev.assigned_user_id === user?.id) continue;
      map.set(ev.conversation_id, {
        assignee_name: ev.assignee_name,
        seconds_remaining: queueSecondsRemaining(ev.conversation_id),
        paused: !!ev.paused_at,
      });
    }
    return map;
  }, [queueEvents, queueSecondsRemaining, user?.id]);

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
    draftSet,
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
    userPermissions: isSuperAdmin ? undefined : userPermissions,
    defaultAssignmentFilter,
    statusFilter,
    onStatusFilterChange: (v: string) => { setStatusFilter(v); clearSelection(); },
    statusOptions,
    queueBadgesMap,
  }), [sortedConversations, selectedId, searchQuery, loading, inboxLabels,
    conversationLabelsMap, labelFilter, selectedInboxId, agentNamesMap,
    conversationNotesSet, draftSet, assignmentFilter, priorityFilter, inboxDepartments,
    departmentFilter, hasMoreConversations, loadingMore, sortBy, messageSearchCount,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection, handleBulkAction,
    handleSelectConversation, handleLabelsChanged, loadMoreConversations, fetchConversationLabels,
    isSuperAdmin, userPermissions, defaultAssignmentFilter, statusFilter, queueBadgesMap]);

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

  if (noInboxAccess) {
    if (isMobile) {
      return (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] -m-4 overflow-hidden">
          <div className="flex-1 flex items-center justify-center px-6">
            {emptyAccessState}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex-1 flex items-center justify-center rounded-xl border border-border/50 bg-card/30">
          {emptyAccessState}
        </div>
      </div>
    );
  }

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
