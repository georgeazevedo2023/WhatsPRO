import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InstanceOption {
  id: string;
  name: string;
  status: string;
}

interface InstanceFilterSelectProps {
  instances: InstanceOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const InstanceFilterSelect = ({ instances, selectedId, onSelect }: InstanceFilterSelectProps) => {
  const isConnected = (status: string) => status === 'connected' || status === 'online';

  return (
    <Select
      value={selectedId ?? '__all__'}
      onValueChange={(val) => onSelect(val === '__all__' ? null : val)}
    >
      <SelectTrigger className="w-[220px] h-9 text-sm">
        <SelectValue placeholder="Todas as Instâncias" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Todas as Instâncias</span>
          </div>
        </SelectItem>
        {instances.map((inst) => (
          <SelectItem key={inst.id} value={inst.id}>
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[140px]">{inst.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 leading-4 ${
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
  );
};

export default InstanceFilterSelect;
