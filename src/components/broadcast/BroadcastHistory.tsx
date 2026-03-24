import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  History,
  RefreshCw,
  Filter,
  Trash2,
} from 'lucide-react';
import { isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

import type { BroadcastLog, StatusFilter, MessageTypeFilter, TargetFilter } from './BroadcastHistoryTypes';
import BroadcastHistoryFilters from './BroadcastHistoryFilters';
import BroadcastLogCard from './BroadcastLogCard';
import BroadcastDeleteDialogs from './BroadcastDeleteDialogs';

interface BroadcastHistoryProps {
  onResend?: (log: BroadcastLog) => void;
}

const BroadcastHistory = ({ onResend }: BroadcastHistoryProps) => {
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<MessageTypeFilter>('all');
  const [instanceFilter, setInstanceFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<BroadcastLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const queryClient = useQueryClient();

  const LOGS_PAGE_SIZE = 100;
  const [logsPage, setLogsPage] = useState(0);

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['broadcast-logs', logsPage],
    queryFn: async () => {
      const from = 0;
      const to = (logsPage + 1) * LOGS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('broadcast_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data as BroadcastLog[];
    },
  });

  const hasMoreLogs = (logs?.length || 0) === (logsPage + 1) * LOGS_PAGE_SIZE;

  const handleLoadMoreLogs = () => setLogsPage(prev => prev + 1);

  const deleteMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('broadcast_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-logs'] });
      toast.success('Registro excluído com sucesso');
      setDeleteDialogOpen(false);
      setLogToDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao excluir registro: ' + (error as Error).message);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (logIds: string[]) => {
      const { error } = await supabase
        .from('broadcast_logs')
        .delete()
        .in('id', logIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-logs'] });
      toast.success(`${selectedIds.size} registros excluídos com sucesso`);
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
    },
    onError: (error) => {
      toast.error('Erro ao excluir registros: ' + (error as Error).message);
    },
  });

  const handleDeleteClick = (log: BroadcastLog, e: React.MouseEvent) => {
    e.stopPropagation();
    setLogToDelete(log);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (logToDelete) {
      deleteMutation.mutate(logToDelete.id);
    }
  };

  const confirmBatchDelete = () => {
    if (selectedIds.size > 0) {
      batchDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const toggleSelection = (logId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map(log => log.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Get unique instances for the filter dropdown
  const uniqueInstances = useMemo(() => {
    if (!logs) return [];
    const instanceMap = new Map<string, string>();
    logs.forEach(log => {
      if (log.instance_id && !instanceMap.has(log.instance_id)) {
        instanceMap.set(log.instance_id, log.instance_name || log.instance_id);
      }
    });
    return Array.from(instanceMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];

    return logs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (typeFilter !== 'all' && log.message_type !== typeFilter) return false;

      if (targetFilter !== 'all') {
        const isLeadBroadcast = log.groups_targeted === 0;
        if (targetFilter === 'leads' && !isLeadBroadcast) return false;
        if (targetFilter === 'groups' && isLeadBroadcast) return false;
      }

      if (instanceFilter !== 'all' && log.instance_id !== instanceFilter) return false;

      if (dateFrom) {
        const logDate = parseISO(log.created_at);
        const filterDate = startOfDay(parseISO(dateFrom));
        if (isBefore(logDate, filterDate)) return false;
      }

      if (dateTo) {
        const logDate = parseISO(log.created_at);
        const filterDate = endOfDay(parseISO(dateTo));
        if (isAfter(logDate, filterDate)) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContent = log.content?.toLowerCase().includes(query);
        const matchesInstance = log.instance_name?.toLowerCase().includes(query);
        const matchesGroups = log.group_names?.some(name =>
          name.toLowerCase().includes(query)
        );
        if (!matchesContent && !matchesInstance && !matchesGroups) return false;
      }

      return true;
    });
  }, [logs, statusFilter, typeFilter, targetFilter, instanceFilter, dateFrom, dateTo, searchQuery]);

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || targetFilter !== 'all' || instanceFilter !== 'all' || dateFrom || dateTo || searchQuery;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    if (targetFilter !== 'all') count++;
    if (instanceFilter !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (searchQuery) count++;
    return count;
  }, [statusFilter, typeFilter, targetFilter, instanceFilter, dateFrom, dateTo, searchQuery]);

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setTargetFilter('all');
    setInstanceFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            <span className="hidden sm:inline">Histórico de Envios</span>
            <span className="sm:hidden">Histórico</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filters Section - Responsive */}
        <div className="mt-4 space-y-3">
          <BroadcastHistoryFilters
            isMobile={isMobile}
            filters={{
              statusFilter,
              typeFilter,
              targetFilter,
              instanceFilter,
              dateFrom,
              dateTo,
              searchQuery,
            }}
            handlers={{
              setStatusFilter,
              setTypeFilter,
              setTargetFilter,
              setInstanceFilter,
              setDateFrom,
              setDateTo,
              setSearchQuery,
              clearFilters,
            }}
            uniqueInstances={uniqueInstances}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            filtersExpanded={filtersExpanded}
            setFiltersExpanded={setFiltersExpanded}
          />

          {hasActiveFilters && (
            <div className="text-xs text-muted-foreground">
              Mostrando {filteredLogs.length} de {logs?.length || 0} registros
            </div>
          )}

          {/* Batch Selection Controls */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredLogs.length && filteredLogs.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    {selectedIds.size === filteredLogs.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {selectedIds.size} selecionado(s)
                  </span>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                  >
                    Limpar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchDeleteDialogOpen(true)}
                    className="flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Excluir {selectedIds.size}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!logs || logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum envio realizado ainda</p>
            <p className="text-sm">Os envios aparecerão aqui</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum registro encontrado</p>
            <p className="text-sm">Tente ajustar os filtros</p>
            <Button
              variant="link"
              size="sm"
              onClick={clearFilters}
              className="mt-2"
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <BroadcastLogCard
                key={log.id}
                log={log}
                isExpanded={expandedId === log.id}
                isSelected={selectedIds.has(log.id)}
                onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                onToggleSelection={toggleSelection}
                onDelete={handleDeleteClick}
                onResend={onResend}
              />
            ))}
          </div>
        )}
        {hasMoreLogs && (
          <div className="pt-4 flex justify-center">
            <button
              onClick={handleLoadMoreLogs}
              className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
            >
              Carregar mais registros
            </button>
          </div>
        )}
      </CardContent>

      <BroadcastDeleteDialogs
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        logToDelete={logToDelete}
        confirmDelete={confirmDelete}
        deleteIsPending={deleteMutation.isPending}
        batchDeleteDialogOpen={batchDeleteDialogOpen}
        setBatchDeleteDialogOpen={setBatchDeleteDialogOpen}
        selectedCount={selectedIds.size}
        confirmBatchDelete={confirmBatchDelete}
        batchDeleteIsPending={batchDeleteMutation.isPending}
      />
    </Card>
  );
};

export default BroadcastHistory;
