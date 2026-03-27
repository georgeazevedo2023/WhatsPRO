import { useState, useCallback, useRef, useEffect, useMemo, CSSProperties } from 'react';
import { List, useListRef } from 'react-window';
import { Search, Inbox, UserCheck, AlertCircle, Building2, SlidersHorizontal, Tag, X, ArrowUpDown, ChevronDown, Eye, CheckCircle2, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ConversationItem } from './ConversationItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ManageLabelsDialog } from './ManageLabelsDialog';
import type { Conversation, Label } from '@/types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (c: Conversation) => void;
  loading: boolean;
  inboxLabels?: Label[];
  conversationLabelsMap?: Record<string, string[]>;
  labelFilter?: string | null;
  onLabelFilterChange?: (labelId: string | null) => void;
  inboxId?: string;
  onLabelsChanged?: () => void;
  agentNamesMap?: Record<string, string>;
  conversationNotesSet?: Set<string>;
  assignmentFilter?: 'todas' | 'minhas' | 'nao-atribuidas';
  onAssignmentFilterChange?: (v: 'todas' | 'minhas' | 'nao-atribuidas') => void;
  priorityFilter?: 'todas' | 'alta' | 'media' | 'baixa';
  onPriorityFilterChange?: (v: 'todas' | 'alta' | 'media' | 'baixa') => void;
  inboxDepartments?: { id: string; name: string }[];
  departmentFilter?: string | null;
  onDepartmentFilterChange?: (v: string | null) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  sortBy?: 'recentes' | 'antigas' | 'prioridade' | 'nao-lidas';
  onSortChange?: (v: 'recentes' | 'antigas' | 'prioridade' | 'nao-lidas') => void;
  messageSearchCount?: number;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  onBulkAction?: (action: 'read' | 'resolve' | 'archive' | 'assign', value?: string) => void;
}

const assignmentOptions: { value: 'todas' | 'minhas' | 'nao-atribuidas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'minhas', label: 'Minhas' },
  { value: 'nao-atribuidas', label: 'Não atribuídas' },
];

const priorityOptions: { value: 'todas' | 'alta' | 'media' | 'baixa'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'alta', label: '🔴 Alta' },
  { value: 'media', label: '🟡 Média' },
  { value: 'baixa', label: '🔵 Baixa' },
];

const BASE_ROW_HEIGHT = 64;
const RICH_ROW_HEIGHT = 90;

interface ConversationRowProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  inboxLabels: Label[];
  conversationLabelsMap: Record<string, string[]>;
  agentNamesMap: Record<string, string>;
  conversationNotesSet: Set<string>;
  bulkMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function ConversationRow({
  index,
  style,
  conversations,
  selectedId,
  onSelect,
  inboxLabels,
  conversationLabelsMap,
  agentNamesMap,
  conversationNotesSet,
  bulkMode,
  selectedIds,
  onToggleSelect,
}: { index: number; style: CSSProperties; ariaAttributes: Record<string, unknown> } & ConversationRowProps) {
  const c = conversations[index];
  if (!c) return null;
  return (
    <div style={style} className="border-b border-border/30 flex items-stretch" role="listitem" aria-label={`Conversa com ${c.contact?.name || c.contact?.phone || 'Desconhecido'}`}>
      {bulkMode && (
        <div className="flex items-center pl-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(c.id)}
            onCheckedChange={() => onToggleSelect?.(c.id)}
            aria-label={`Selecionar conversa com ${c.contact?.name || 'Desconhecido'}`}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <ConversationItem
          conversation={c}
          isSelected={c.id === selectedId}
          onClick={() => bulkMode ? onToggleSelect?.(c.id) : onSelect(c)}
          labels={inboxLabels.filter(l => (conversationLabelsMap[c.id] || []).includes(l.id))}
          agentName={c.assigned_to ? agentNamesMap[c.assigned_to] || null : null}
          hasNotes={conversationNotesSet.has(c.id)}
        />
      </div>
    </div>
  );
}

export const ConversationList = ({
  conversations,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
  loading,
  inboxLabels = [],
  conversationLabelsMap = {},
  labelFilter,
  onLabelFilterChange,
  inboxId,
  onLabelsChanged,
  agentNamesMap = {},
  conversationNotesSet = new Set(),
  assignmentFilter = 'todas',
  onAssignmentFilterChange,
  priorityFilter = 'todas',
  onPriorityFilterChange,
  inboxDepartments = [],
  departmentFilter,
  onDepartmentFilterChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  sortBy = 'recentes',
  onSortChange,
  messageSearchCount = 0,
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onBulkAction,
}: ConversationListProps) => {
  const [manageOpen, setManageOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const listRef = useListRef();
  const bulkMode = selectedIds.size > 0;

  const hasActiveFilters =
    assignmentFilter !== 'todas' ||
    priorityFilter !== 'todas' ||
    !!labelFilter ||
    !!departmentFilter;

  const activeFilterCount = [
    assignmentFilter !== 'todas',
    priorityFilter !== 'todas',
    !!labelFilter,
    !!departmentFilter,
  ].filter(Boolean).length;

  // Reset scroll when filters change
  useEffect(() => {
    listRef.current?.scrollToRow({ index: 0 });
  }, [conversations.length, searchQuery, assignmentFilter, priorityFilter, labelFilter, departmentFilter]);

  const getRowHeight = useCallback((index: number) => {
    const c = conversations[index];
    if (!c) return BASE_ROW_HEIGHT;
    const hasLabels = (conversationLabelsMap[c.id] || []).length > 0;
    const hasAgent = !!c.assigned_to;
    const hasNotes = conversationNotesSet.has(c.id);
    const hasDept = !!c.department_id;
    return (hasLabels || hasAgent || hasNotes || hasDept) ? RICH_ROW_HEIGHT : BASE_ROW_HEIGHT;
  }, [conversations, conversationLabelsMap, conversationNotesSet]);

  const rowProps = useMemo<ConversationRowProps>(() => ({
    conversations,
    selectedId,
    onSelect,
    inboxLabels,
    conversationLabelsMap,
    agentNamesMap,
    conversationNotesSet,
    bulkMode,
    selectedIds,
    onToggleSelect,
  }), [conversations, selectedId, onSelect, inboxLabels, conversationLabelsMap, agentNamesMap, conversationNotesSet, bulkMode, selectedIds, onToggleSelect]);

  return (
    <>
      {/* Search + Filter Toggle */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar por nome, telefone ou mensagem..."
              aria-label="Buscar conversas"
              className="pl-9 h-9 text-sm bg-muted/40 border-transparent rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-background transition-colors"
            />
          </div>
          {onSortChange && (
            <Select
              value={sortBy}
              onValueChange={(v) => onSortChange(v as 'recentes' | 'antigas' | 'prioridade' | 'nao-lidas')}
            >
              <SelectTrigger
                className={cn(
                  'w-9 h-9 rounded-xl border p-0 justify-center shrink-0 [&>svg:last-child]:hidden',
                  sortBy !== 'recentes'
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-secondary/30 border-border/20 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
                title="Ordenar"
                aria-label="Ordenar conversas"
              >
                <ArrowUpDown className="w-4 h-4" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes" className="text-xs">Recentes</SelectItem>
                <SelectItem value="antigas" className="text-xs">Mais antigas</SelectItem>
                <SelectItem value="prioridade" className="text-xs">Prioridade</SelectItem>
                <SelectItem value="nao-lidas" className="text-xs">Nao lidas</SelectItem>
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            aria-label={filtersExpanded ? 'Fechar filtros' : 'Abrir filtros'}
            aria-expanded={filtersExpanded}
            className={cn(
              'relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 shrink-0',
              filtersExpanded || hasActiveFilters
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-secondary/30 border-border/20 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expandable filter pills */}
        <div
          className={cn(
            'grid transition-all duration-200 ease-in-out',
            filtersExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 pb-1">
              {/* Assignment */}
              <Select
                value={assignmentFilter}
                onValueChange={(v) => onAssignmentFilterChange?.(v as 'todas' | 'minhas' | 'nao-atribuidas')}
              >
                <SelectTrigger
                  aria-label="Filtrar por atribuição"
                  className={cn(
                    'h-7 text-[11px] rounded-lg border gap-1 px-2.5 w-auto',
                    assignmentFilter !== 'todas'
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'bg-secondary/40 border-border/20 text-muted-foreground'
                  )}
                >
                  <UserCheck className="w-3 h-3 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignmentOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority */}
              <Select
                value={priorityFilter}
                onValueChange={(v) => onPriorityFilterChange?.(v as 'todas' | 'alta' | 'media' | 'baixa')}
              >
                <SelectTrigger
                  aria-label="Filtrar por prioridade"
                  className={cn(
                    'h-7 text-[11px] rounded-lg border gap-1 px-2.5 w-auto',
                    priorityFilter !== 'todas'
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'bg-secondary/40 border-border/20 text-muted-foreground'
                  )}
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Labels */}
              {inboxLabels.length > 0 && onLabelFilterChange && (
                <Select
                  value={labelFilter || '_all'}
                  onValueChange={v => onLabelFilterChange(v === '_all' ? null : v)}
                >
                  <SelectTrigger
                    aria-label="Filtrar por etiqueta"
                    className={cn(
                      'h-7 text-[11px] rounded-lg border gap-1 px-2.5 w-auto',
                      labelFilter
                        ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                        : 'bg-secondary/40 border-border/20 text-muted-foreground'
                    )}
                  >
                    <Tag className="w-3 h-3 shrink-0" />
                    <SelectValue placeholder="Etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all" className="text-xs">Todas</SelectItem>
                    {inboxLabels.map(l => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Department */}
              {inboxDepartments.length > 0 && onDepartmentFilterChange && (
                <Select
                  value={departmentFilter || '_all'}
                  onValueChange={v => onDepartmentFilterChange(v === '_all' ? null : v)}
                >
                  <SelectTrigger
                    aria-label="Filtrar por departamento"
                    className={cn(
                      'h-7 text-[11px] rounded-lg border gap-1 px-2.5 w-auto',
                      departmentFilter
                        ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                        : 'bg-secondary/40 border-border/20 text-muted-foreground'
                    )}
                  >
                    <Building2 className="w-3 h-3 shrink-0" />
                    <SelectValue placeholder="Depto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all" className="text-xs">Todos</SelectItem>
                    {inboxDepartments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear all */}
              {hasActiveFilters && (
                <Badge
                  variant="destructive"
                  className="h-7 px-2.5 rounded-lg text-[11px] cursor-pointer gap-1 flex items-center hover:bg-destructive/90 transition-colors"
                  onClick={() => {
                    onAssignmentFilterChange?.('todas');
                    onPriorityFilterChange?.('todas');
                    onLabelFilterChange?.(null);
                    onDepartmentFilterChange?.(null);
                  }}
                  role="button"
                  aria-label="Limpar todos os filtros"
                >
                  <X className="w-3 h-3" />
                  Limpar filtros
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/30 mx-3" />

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2 flex-wrap">
          <Checkbox
            checked={selectedIds.size === conversations.length && conversations.length > 0}
            onCheckedChange={() => onToggleSelectAll?.(conversations.map(c => c.id))}
            aria-label="Selecionar todas"
          />
          <span className="text-xs font-medium text-primary">{selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onBulkAction?.('read')}>
              <Eye className="w-3 h-3" />Lidas
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onBulkAction?.('resolve')}>
              <CheckCircle2 className="w-3 h-3" />Resolver
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onBulkAction?.('archive')}>
              <Archive className="w-3 h-3" />Arquivar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Conversation count */}
      <div className="px-3 py-1.5 flex items-center gap-2" aria-live="polite">
        {!bulkMode && conversations.length > 0 && (
          <Checkbox
            checked={false}
            onCheckedChange={() => onToggleSelect?.(conversations[0]?.id)}
            className="mr-1 opacity-40 hover:opacity-100"
            aria-label="Iniciar seleção"
          />
        )}
        <span className="text-[11px] text-muted-foreground font-medium">
          {conversations.length}{hasMore ? '+' : ''} {conversations.length === 1 ? 'conversa' : 'conversas'}
          {hasActiveFilters && ' (filtradas)'}
        </span>
        {messageSearchCount > 0 && (
          <span className="text-[10px] text-primary font-medium">
            {messageSearchCount} com mensagens correspondentes
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="w-10 h-10 mb-2 opacity-40" />
            {hasActiveFilters ? (
              <>
                <p className="text-sm">Nenhuma conversa com estes filtros</p>
                <p className="text-xs mt-1 opacity-70">Tente limpar os filtros ou alterar a busca</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Nenhuma conversa nesta caixa</p>
                <p className="text-xs mt-1 opacity-70">Novas conversas do WhatsApp aparecem aqui automaticamente</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <List
                listRef={listRef}
                rowCount={conversations.length}
                rowHeight={getRowHeight}
                rowComponent={ConversationRow}
                rowProps={rowProps as any}
                overscanCount={5}
                style={{ height: '100%' }}
              />
            </div>
            {hasMore && (
              <div className="shrink-0 px-3 py-2 border-t border-border/30">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  aria-label="Carregar mais conversas"
                  className="w-full py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Carregando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <ChevronDown className="w-3.5 h-3.5" />
                      Carregar mais conversas
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manage Labels Dialog */}
      {inboxId && onLabelsChanged && (
        <ManageLabelsDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          inboxId={inboxId}
          labels={inboxLabels}
          onChanged={onLabelsChanged}
        />
      )}
    </>
  );
};
