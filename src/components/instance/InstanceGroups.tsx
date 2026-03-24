import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { Instance } from '@/types';
import { toast } from 'sonner';
import { Users, Search, RefreshCw, MessageSquare, WifiOff, ChevronRight } from 'lucide-react';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';

interface InstanceGroupsProps {
  instance: Instance;
}

const InstanceGroups = ({ instance }: InstanceGroupsProps) => {
  const navigate = useNavigate();
  const isConnected = instance.status === 'connected' || instance.status === 'online';

  const { groups, loading, refetch } = useInstanceGroups({
    instanceId: instance.id,
    enabled: isConnected,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Set lastUpdate on first successful load
  if (!lastUpdate && !loading && groups.length > 0) {
    setLastUpdate(new Date());
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    const previousCount = groups.length;
    let attempts = 0;
    const maxAttempts = 3;
    let currentGroups = groups;

    while (attempts < maxAttempts) {
      attempts++;
      setSyncAttempt(attempts);

      currentGroups = await refetch();

      if (currentGroups.length > previousCount) break;

      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setSyncAttempt(0);
    setRefreshing(false);
    setLastUpdate(new Date());

    if (currentGroups.length > previousCount) {
      const newGroups = currentGroups.length - previousCount;
      toast.success(`${newGroups} novo(s) grupo(s) encontrado(s)!`);
    } else {
      toast.info('Lista atualizada. Novos grupos podem levar alguns segundos para sincronizar com a API do WhatsApp.');
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <WifiOff className="w-16 h-16 text-muted-foreground" />
          <h3 className="text-lg font-medium">Instância Desconectada</h3>
          <p className="text-muted-foreground text-center">
            Conecte a instância para visualizar os grupos do WhatsApp
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing && syncAttempt > 0
            ? `Sincronizando... (${syncAttempt}/3)`
            : 'Atualizar'}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="gap-1">
          <MessageSquare className="w-3 h-3" />
          {filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''}
        </Badge>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Users className="w-16 h-16 text-muted-foreground" />
            <h3 className="text-lg font-medium">Nenhum grupo encontrado</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm
                ? 'Tente ajustar sua busca'
                : 'Esta instância não participa de nenhum grupo'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/dashboard/instances/${instance.id}/groups/${encodeURIComponent(group.id)}`)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="w-12 h-12 border">
                  <AvatarImage src={group.pictureUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Users className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-medium">{group.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {group.size} participante{group.size !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstanceGroups;
