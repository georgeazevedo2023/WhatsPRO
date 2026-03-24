import { memo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Server, Inbox, CalendarDays, Filter } from 'lucide-react';

interface InstanceOption {
  id: string;
  name: string;
  status: string;
}

interface InboxOption {
  id: string;
  name: string;
}

export interface DashboardFiltersState {
  instanceId: string | null;
  inboxId: string | null;
  period: number; // days
}

interface DashboardFiltersProps {
  instances: InstanceOption[];
  inboxes: InboxOption[];
  filters: DashboardFiltersState;
  onFiltersChange: (filters: DashboardFiltersState) => void;
}

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
];

const isConnected = (status: string) => status === 'connected' || status === 'online';

const DashboardFilters = ({ instances, inboxes, filters, onFiltersChange }: DashboardFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-medium">Filtros</span>
      </div>

      {/* Instance filter */}
      <Select
        value={filters.instanceId ?? '__all__'}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, instanceId: val === '__all__' ? null : val, inboxId: null })
        }
      >
        <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:max-w-[200px]">
          <Server className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Instância" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas as Instâncias</SelectItem>
          {instances.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{inst.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 leading-3 ${
                    isConnected(inst.status)
                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isConnected(inst.status) ? 'On' : 'Off'}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Inbox filter */}
      <Select
        value={filters.inboxId ?? '__all__'}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, inboxId: val === '__all__' ? null : val })
        }
      >
        <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:max-w-[200px]">
          <Inbox className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Caixa de entrada" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas as Caixas</SelectItem>
          {inboxes.map((inbox) => (
            <SelectItem key={inbox.id} value={inbox.id}>
              {inbox.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Period filter */}
      <Select
        value={String(filters.period)}
        onValueChange={(val) => onFiltersChange({ ...filters, period: Number(val) })}
      >
        <SelectTrigger className="h-8 text-xs w-full sm:w-[110px]">
          <CalendarDays className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default memo(DashboardFilters);
