import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Instance } from '@/types';
import { Users, MessageSquare, Clock, Activity, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';

interface InstanceStatsProps {
  instance: Instance;
}

interface Stats {
  totalGroups: number;
  totalParticipants: number;
  uptime: string;
  lastActivity: string;
}

const InstanceStats = ({ instance }: InstanceStatsProps) => {
  const isConnected = instance.status === 'connected' || instance.status === 'online';

  const { groups, loading } = useInstanceGroups({
    instanceId: instance.id,
    enabled: isConnected,
  });

  const [stats, setStats] = useState<Stats>({
    totalGroups: 0,
    totalParticipants: 0,
    uptime: 'Calculando...',
    lastActivity: 'Desconhecido',
  });

  useEffect(() => {
    const createdAt = new Date(instance.created_at || Date.now());
    const uptime = formatDistanceToNow(createdAt, { locale: ptBR, addSuffix: false });
    const updatedAt = new Date(instance.updated_at || Date.now());
    const lastActivity = formatDistanceToNow(updatedAt, { locale: ptBR, addSuffix: true });

    const totalParticipants = groups.reduce((acc, g) => acc + g.size, 0);

    setStats({
      totalGroups: groups.length,
      totalParticipants,
      uptime,
      lastActivity,
    });
  }, [groups, instance.created_at, instance.updated_at]);

  const statCards = [
    {
      title: 'Total de Grupos',
      value: stats.totalGroups,
      description: 'Grupos que a instância participa',
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total de Participantes',
      value: stats.totalParticipants,
      description: 'Soma de todos os membros dos grupos',
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Tempo de Vida',
      value: stats.uptime,
      description: 'Desde a criação da instância',
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      isText: true,
    },
    {
      title: 'Última Atividade',
      value: stats.lastActivity,
      description: 'Última atualização registrada',
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      isText: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-destructive" />
            )}
            Status da Conexão
          </CardTitle>
          <CardDescription>
            {isConnected
              ? 'A instância está conectada e operacional'
              : 'A instância está desconectada. Conecte para ver estatísticas completas.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${stat.isText ? 'text-lg' : ''}`}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sobre as Estatísticas</CardTitle>
          <CardDescription>
            As estatísticas são calculadas em tempo real com base nos dados da API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>O total de grupos mostra quantos grupos a instância participa atualmente</li>
            <li>O total de participantes é a soma de membros de todos os grupos</li>
            <li>O tempo de vida conta desde quando a instância foi criada no sistema</li>
            <li>A última atividade mostra quando houve a última atualização dos dados</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstanceStats;
