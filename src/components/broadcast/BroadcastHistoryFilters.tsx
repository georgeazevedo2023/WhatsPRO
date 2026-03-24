import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  Filter,
  X,
  Calendar,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  StatusFilter,
  MessageTypeFilter,
  TargetFilter,
  UniqueInstance,
} from './BroadcastHistoryTypes';

interface FilterState {
  statusFilter: StatusFilter;
  typeFilter: MessageTypeFilter;
  targetFilter: TargetFilter;
  instanceFilter: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
}

interface FilterHandlers {
  setStatusFilter: (v: StatusFilter) => void;
  setTypeFilter: (v: MessageTypeFilter) => void;
  setTargetFilter: (v: TargetFilter) => void;
  setInstanceFilter: (v: string) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setSearchQuery: (v: string) => void;
  clearFilters: () => void;
}

interface BroadcastHistoryFiltersProps {
  isMobile: boolean;
  filters: FilterState;
  handlers: FilterHandlers;
  uniqueInstances: UniqueInstance[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filtersExpanded: boolean;
  setFiltersExpanded: (v: boolean) => void;
}

const MobileFilters = ({
  filters,
  handlers,
  uniqueInstances,
  hasActiveFilters,
  activeFilterCount,
  filtersExpanded,
  setFiltersExpanded,
}: Omit<BroadcastHistoryFiltersProps, 'isMobile'>) => (
  <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
    <CollapsibleTrigger asChild>
      <Button
        variant="outline"
        className="w-full justify-between h-10"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          filtersExpanded && "rotate-180"
        )} />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-3 space-y-3">
      {/* 2-column grid for select filters */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={filters.statusFilter} onValueChange={(v) => handlers.setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.typeFilter} onValueChange={(v) => handlers.setTypeFilter(v as MessageTypeFilter)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="document">Documento</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.targetFilter} onValueChange={(v) => handlers.setTargetFilter(v as TargetFilter)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Destino" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos destinos</SelectItem>
            <SelectItem value="groups">Grupos</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.instanceFilter} onValueChange={(v) => handlers.setInstanceFilter(v)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Instância" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas instâncias</SelectItem>
            {uniqueInstances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date inputs in row */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handlers.setDateFrom(e.target.value)}
          className="flex-1 h-9 text-xs"
        />
        <span className="text-muted-foreground text-xs shrink-0">até</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handlers.setDateTo(e.target.value)}
          className="flex-1 h-9 text-xs"
        />
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => handlers.setSearchQuery(e.target.value)}
          placeholder="Buscar..."
          className="w-full h-9 text-xs pl-8"
        />
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlers.clearFilters}
          className="w-full h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </CollapsibleContent>
  </Collapsible>
);

const DesktopFilters = ({
  filters,
  handlers,
  uniqueInstances,
  hasActiveFilters,
}: Omit<BroadcastHistoryFiltersProps, 'isMobile' | 'activeFilterCount' | 'filtersExpanded' | 'setFiltersExpanded'>) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span>Filtros:</span>
      </div>

      <Select value={filters.statusFilter} onValueChange={(v) => handlers.setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="completed">Concluído</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
          <SelectItem value="error">Erro</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.typeFilter} onValueChange={(v) => handlers.setTypeFilter(v as MessageTypeFilter)}>
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          <SelectItem value="text">Texto</SelectItem>
          <SelectItem value="image">Imagem</SelectItem>
          <SelectItem value="video">Vídeo</SelectItem>
          <SelectItem value="audio">Áudio</SelectItem>
          <SelectItem value="document">Documento</SelectItem>
          <SelectItem value="carousel">Carrossel</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.targetFilter} onValueChange={(v) => handlers.setTargetFilter(v as TargetFilter)}>
        <SelectTrigger className="w-[130px] h-8 text-sm">
          <SelectValue placeholder="Destino" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos destinos</SelectItem>
          <SelectItem value="groups">Grupos</SelectItem>
          <SelectItem value="leads">Leads</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.instanceFilter} onValueChange={(v) => handlers.setInstanceFilter(v)}>
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue placeholder="Instância" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas instâncias</SelectItem>
          {uniqueInstances.map((instance) => (
            <SelectItem key={instance.id} value={instance.id}>
              {instance.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlers.clearFilters}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handlers.setDateFrom(e.target.value)}
          className="w-[140px] h-8 text-sm"
          placeholder="Data início"
        />
        <span className="text-muted-foreground text-sm">até</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handlers.setDateTo(e.target.value)}
          className="w-[140px] h-8 text-sm"
          placeholder="Data fim"
        />
      </div>

      <Input
        type="text"
        value={filters.searchQuery}
        onChange={(e) => handlers.setSearchQuery(e.target.value)}
        placeholder="Buscar por conteúdo, instância ou grupo..."
        className="flex-1 min-w-[200px] h-8 text-sm"
      />
    </div>
  </div>
);

const BroadcastHistoryFilters = (props: BroadcastHistoryFiltersProps) => {
  if (props.isMobile) {
    return <MobileFilters {...props} />;
  }
  return <DesktopFilters {...props} />;
};

export default BroadcastHistoryFilters;
