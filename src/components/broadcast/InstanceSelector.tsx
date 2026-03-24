import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Server, CheckCircle2, XCircle } from 'lucide-react';
import type { Instance } from '@/types';
import { useInstances } from '@/hooks/useInstances';



interface InstanceSelectorProps {
  selectedInstance: Instance | null;
  onSelect: (instance: Instance) => void;
}

const InstanceSelector = ({ selectedInstance, onSelect }: InstanceSelectorProps) => {
  const { instances, loading } = useInstances({ excludeDisabled: false });

  const isConnected = (status: string) => 
    status === 'connected' || status === 'online';

  // Auto-select if only one online instance
  useEffect(() => {
    if (loading || selectedInstance) return;
    
    const onlineInstances = instances.filter(i => isConnected(i.status));
    if (onlineInstances.length === 1) {
      onSelect(onlineInstances[0]);
    }
  }, [instances, loading, selectedInstance, onSelect]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhuma instância encontrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {instances.map((instance) => {
        const connected = isConnected(instance.status);
        const isSelected = selectedInstance?.id === instance.id;

        return (
          <Card
            key={instance.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              isSelected && 'ring-2 ring-primary bg-primary/5',
              !connected && 'opacity-60'
            )}
            onClick={() => connected && onSelect(instance)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                {instance.profile_pic_url ? (
                  <img
                    src={instance.profile_pic_url}
                    alt={instance.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <Server className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{instance.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {connected ? (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Online
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30 gap-1">
                      <XCircle className="w-3 h-3" />
                      Offline
                    </Badge>
                  )}
                </div>
              </div>

              {isSelected && (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default InstanceSelector;
