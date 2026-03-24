import { useState, useEffect } from 'react';
import type { Instance } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, WifiOff, QrCode, Clock, AlertCircle } from 'lucide-react';
import { formatBR } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';


interface InstanceHistoryProps {
  instance: Instance;
}

interface ConnectionLog {
  id: string;
  instance_id: string;
  event_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

const eventConfig: Record<string, { icon: typeof Wifi; color: string; bgColor: string }> = {
  connected: { icon: Wifi, color: 'text-success', bgColor: 'bg-success/10' },
  disconnected: { icon: WifiOff, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  created: { icon: QrCode, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
};

const defaultConfig = { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted' };

const InstanceHistory = ({ instance }: InstanceHistoryProps) => {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [instance.id]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('instance_connection_logs')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setLogs((data as ConnectionLog[]) || []);
    } catch (err) {
      handleError(err, 'Erro ao carregar histórico', 'Fetch connection logs');
      setError('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Histórico de Conexões
            </CardTitle>
          </CardHeader>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 pl-2">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <Skeleton className="h-20 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Histórico de Conexões
          </CardTitle>
          <CardDescription>
            Registro de eventos e alterações de status da instância
          </CardDescription>
        </CardHeader>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {logs.map((log) => {
              const config = eventConfig[log.event_type] || defaultConfig;
              const Icon = config.icon;

              return (
                <div key={log.id} className="relative flex gap-4 pl-2">
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 border-background ${config.bgColor}`}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <Card className="flex-1">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium">
                            {log.description || log.event_type}
                          </h4>
                          {log.metadata?.owner_jid && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Número: +{String(log.metadata.owner_jid).split('@')[0]}
                            </p>
                          )}
                          {log.metadata?.old_status && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {String(log.metadata.old_status)} → {String(log.metadata.new_status)}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {formatBR(log.created_at, "dd/MM/yyyy 'às' HH:mm")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstanceHistory;
