import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import type { Instance } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useInboxes } from '@/hooks/useInboxes';
import StatsCard from '@/components/dashboard/StatsCard';
import InstanceCard from '@/components/dashboard/InstanceCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import DashboardFilters, { type DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import LazySection from '@/components/dashboard/LazySection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Users, Wifi, WifiOff, MessageSquare, UsersRound, RefreshCw, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import HelpdeskMetricsCharts from '@/components/dashboard/HelpdeskMetricsCharts';
import AgentPerformanceCard from '@/components/dashboard/AgentPerformanceCard';
import E2eStatusCard from '@/components/dashboard/E2eStatusCard';
import BusinessHoursChart from '@/components/dashboard/BusinessHoursChart';
import TopContactReasons from '@/components/dashboard/TopContactReasons';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { startOfDay, subDays } from 'date-fns';
import { formatBR } from '@/lib/dateUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';


interface InstanceStats {
  instanceId: string;
  instanceName: string;
  groupsCount: number;
  participantsCount: number;
  status: string;
}

interface HelpdeskLeadsStats {
  today: number;
  yesterday: number;
  total: number;
  dailyData: { day: string; label: string; leads: number }[];
}

const DASHBOARD_KEYS = {
  main: (isAdmin: boolean) => ['dashboard-main', isAdmin] as const,
  helpdeskLeads: (instanceId: string | null) => ['helpdesk-leads', instanceId] as const,
  groupsStats: (instanceIds: string) => ['groups-stats', instanceIds] as const,
} as const;

const DashboardHome = () => {
  const { profile, isSuperAdmin } = useAuth();
  const { inboxes } = useInboxes();
  const [filters, setFilters] = useState<DashboardFiltersState>({ instanceId: null, inboxId: null, period: 30 });
  const [showInstanceDetails, setShowInstanceDetails] = useState(false);

  const queryClient = useQueryClient();

  // Query 1 — Main data (instances + user count)
  const { data: mainData, isLoading: loading } = useQuery({
    queryKey: DASHBOARD_KEYS.main(isSuperAdmin),
    queryFn: async () => {
      const [instancesRes, usersRes] = await Promise.all([
        supabase.from('instances').select('*').eq('disabled', false).order('created_at', { ascending: false }),
        isSuperAdmin
          ? supabase.from('user_profiles').select('*', { count: 'exact', head: true })
          : Promise.resolve({ count: 0 }),
      ]);
      if (instancesRes.error) throw instancesRes.error;
      return {
        instances: (instancesRes.data || []) as Instance[],
        totalUsers: isSuperAdmin ? ((usersRes as { count: number }).count || 0) : 0,
      };
    },
  });

  const rawInstances = mainData?.instances ?? [];
  const totalUsers = mainData?.totalUsers ?? 0;

  const ownerIds = useMemo(() => [...new Set(rawInstances.map(i => i.user_id).filter(Boolean) as string[])], [rawInstances]);
  const { profilesMap: ownerProfilesMap } = useUserProfiles({ userIds: ownerIds, enabled: ownerIds.length > 0 });
  const instances = useMemo<Instance[]>(() =>
    rawInstances.map(inst => ({
      ...inst,
      user_profiles: inst.user_id && ownerProfilesMap[inst.user_id]
        ? { full_name: ownerProfilesMap[inst.user_id].full_name, email: ownerProfilesMap[inst.user_id].email }
        : undefined,
    })),
    [rawInstances, ownerProfilesMap]
  );

  // Query 2 — Helpdesk leads stats
  const { data: helpdeskLeads = { today: 0, yesterday: 0, total: 0, dailyData: [] } } = useQuery({
    queryKey: DASHBOARD_KEYS.helpdeskLeads(filters.instanceId),
    queryFn: async (): Promise<HelpdeskLeadsStats> => {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
      const sevenDaysAgo = startOfDay(subDays(now, 6)).toISOString();

      let databaseIds: string[] | null = null;
      if (filters.instanceId) {
        const { data: dbs } = await supabase
          .from('lead_databases')
          .select('id')
          .eq('instance_id', filters.instanceId);
        databaseIds = dbs?.map(d => d.id) || [];
        if (databaseIds.length === 0) {
          return { today: 0, yesterday: 0, total: 0, dailyData: [] };
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const applyDbFilter = (q: any) =>
        databaseIds ? q.in('database_id', databaseIds) : q;

      const [todayRes, yesterdayRes, totalRes, weekRes] = await Promise.all([
        applyDbFilter(supabase.from('lead_database_entries').select('id', { count: 'exact', head: true }).eq('source', 'helpdesk').gte('created_at', todayStart)),
        applyDbFilter(supabase.from('lead_database_entries').select('id', { count: 'exact', head: true }).eq('source', 'helpdesk').gte('created_at', yesterdayStart).lt('created_at', todayStart)),
        applyDbFilter(supabase.from('lead_database_entries').select('id', { count: 'exact', head: true }).eq('source', 'helpdesk')),
        applyDbFilter(supabase.from('lead_database_entries').select('created_at').eq('source', 'helpdesk').gte('created_at', sevenDaysAgo).order('created_at', { ascending: true })),
      ]);

      const dayMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        dayMap.set(formatBR(d, 'yyyy-MM-dd'), 0);
      }
      (weekRes.data as { created_at: string | null }[] | null)?.forEach((entry) => {
        const dayKey = formatBR(entry.created_at!, 'yyyy-MM-dd');
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
      });

      const dailyData = Array.from(dayMap.entries()).map(([day, count]) => ({
        day,
        label: formatBR(day, 'EEE'),
        leads: count,
      }));

      return {
        today: todayRes.count || 0,
        yesterday: yesterdayRes.count || 0,
        total: totalRes.count || 0,
        dailyData,
      };
    },
  });

  // Query 3 — Groups stats (depends on rawInstances being loaded)
  // Use a stable key derived from instance IDs to avoid unnecessary refetches
  const instanceIdsKey = rawInstances.map(i => i.id).sort().join(',');

  const { data: instanceStats = [], isLoading: loadingStats, refetch: refetchGroupsStats } = useQuery({
    queryKey: DASHBOARD_KEYS.groupsStats(instanceIdsKey),
    queryFn: async (): Promise<InstanceStats[]> => {
      const stats: InstanceStats[] = [];
      const connectedList = rawInstances.filter(i => i.status === 'connected' || i.status === 'online');

      await Promise.all(
        connectedList.map(async (instance) => {
          try {
            const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
              body: { action: 'groups', instance_id: instance.id },
            });
            if (error) throw error;
            const groups = Array.isArray(data) ? data : [];
            let totalParticipants = 0;
            groups.forEach((group: Record<string, unknown>) => {
              totalParticipants +=
                (group.ParticipantCount as number) ||
                (group.Size as number) ||
                (group.size as number) ||
                (Array.isArray(group.Participants) ? group.Participants.length : 0) ||
                (Array.isArray(group.participants) ? group.participants.length : 0) ||
                0;
            });
            stats.push({ instanceId: instance.id, instanceName: instance.name, groupsCount: groups.length, participantsCount: totalParticipants, status: instance.status });
          } catch {
            stats.push({ instanceId: instance.id, instanceName: instance.name, groupsCount: 0, participantsCount: 0, status: instance.status });
          }
        })
      );

      // Add disconnected instances with zero counts
      rawInstances
        .filter(i => i.status !== 'connected' && i.status !== 'online')
        .forEach((instance) => {
          stats.push({ instanceId: instance.id, instanceName: instance.name, groupsCount: 0, participantsCount: 0, status: instance.status });
        });

      return stats;
    },
    enabled: rawInstances.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min — groups stats don't change without user action
  });

  // Realtime for helpdesk leads — invalidates React Query cache per D-01
  useEffect(() => {
    const channel = supabase
      .channel('helpdesk-leads-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lead_database_entries',
        filter: 'source=eq.helpdesk',
      }, () => {
        queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.helpdeskLeads(filters.instanceId) });
      })
      .subscribe();

    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [filters.instanceId, queryClient]);

  const handleRefreshStats = useCallback(async () => {
    if (rawInstances.length === 0) return;
    toast.info('Atualizando estatísticas...');
    await refetchGroupsStats();
    toast.success('Estatísticas atualizadas!');
  }, [rawInstances.length, refetchGroupsStats]);

  const connectedInstances = useMemo(() => instances.filter((i) => i.status === 'connected' || i.status === 'online'), [instances]);
  const disconnectedInstances = useMemo(() => instances.filter((i) => i.status !== 'connected' && i.status !== 'online'), [instances]);
  const totalGroups = useMemo(() => instanceStats.reduce((acc, s) => acc + s.groupsCount, 0), [instanceStats]);
  const totalParticipants = useMemo(() => instanceStats.reduce((acc, s) => acc + s.participantsCount, 0), [instanceStats]);

  // Filter inboxes by selected instance
  const filteredInboxes = useMemo(() => {
    // We don't have instance_id on inboxes loaded here, so show all
    return inboxes;
  }, [inboxes]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto px-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-lg md:text-2xl font-display font-bold">
          Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}! 👋
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          {isSuperAdmin ? 'Visão geral de todas as instâncias' : 'Gerencie suas instâncias do WhatsApp'}
        </p>
      </div>

      {/* Unified Filters */}
      <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
        <DashboardFilters
          instances={instances.map(i => ({ id: i.id, name: i.name, status: i.status }))}
          inboxes={filteredInboxes}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      <ErrorBoundary section="Estatisticas">
        {/* KPI Cards - Compact mobile grid */}
        <div className="grid gap-2 md:gap-3 grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <StatsCard title="Instâncias" value={instances.length} icon={Server} className="min-h-0" />
          <StatsCard title="Online" value={connectedInstances.length} icon={Wifi} className="min-h-0" />
          <StatsCard title="Grupos" value={loadingStats ? '...' : totalGroups} icon={MessageSquare} className="min-h-0" />
          <StatsCard
            title="Leads Hoje"
            value={helpdeskLeads.today}
            icon={UserPlus}
            description={`${helpdeskLeads.total} total`}
            trend={helpdeskLeads.yesterday > 0 ? {
              value: Math.round(((helpdeskLeads.today - helpdeskLeads.yesterday) / helpdeskLeads.yesterday) * 100),
              positive: helpdeskLeads.today >= helpdeskLeads.yesterday,
            } : undefined}
            className="min-h-0"
          />
        </div>

        {/* Secondary KPIs - Progressive Disclosure */}
        <Collapsible open={showInstanceDetails} onOpenChange={setShowInstanceDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5 h-7 px-2">
              {showInstanceDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showInstanceDetails ? 'Menos detalhes' : 'Mais detalhes'}
              <Badge variant="outline" className="text-[10px] ml-1">
                {disconnectedInstances.length} off · {totalParticipants.toLocaleString('pt-BR')} participantes
                {isSuperAdmin ? ` · ${totalUsers} usuários` : ''}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid gap-2 md:gap-3 grid-cols-2 lg:grid-cols-4 animate-fade-in">
              <StatsCard title="Offline" value={disconnectedInstances.length} icon={WifiOff} className="min-h-0" />
              <StatsCard title="Participantes" value={loadingStats ? '...' : totalParticipants.toLocaleString('pt-BR')} icon={UsersRound} className="min-h-0" />
              {isSuperAdmin && <StatsCard title="Usuários" value={totalUsers} icon={Users} className="min-h-0" />}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </ErrorBoundary>

      {/* Charts - Instance & Groups */}
      <ErrorBoundary section="Graficos">
      <LazySection height="300px">
        <DashboardCharts
          instanceStats={instanceStats}
          connectedCount={connectedInstances.length}
          disconnectedCount={disconnectedInstances.length}
          loading={loadingStats}
          helpdeskLeadsDailyData={helpdeskLeads.dailyData}
          helpdeskChartTitle={filters.instanceId
            ? `Leads — ${instances.find(i => i.id === filters.instanceId)?.name || ''} — 7 dias`
            : undefined
          }
        />
      </LazySection>

      {/* Business Hours Chart - Lazy */}
      <LazySection height="340px">
        <BusinessHoursChart inboxId={filters.inboxId} periodDays={filters.period} />
      </LazySection>

      {/* Top Contact Reasons - Lazy */}
      <LazySection height="260px">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Principais Motivos de Contato</h2>
          <TopContactReasons instanceId={filters.instanceId} inboxId={filters.inboxId} periodDays={filters.period} />
        </div>
      </LazySection>
      </ErrorBoundary>

      <ErrorBoundary section="Helpdesk e Grupos">
      {/* Instance Groups Breakdown - Collapsible */}
      <Collapsible>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm font-semibold gap-1.5 px-1">
              <ChevronDown className="w-4 h-4" />
              Grupos por Instância
              <Badge variant="outline" className="text-[10px] ml-1">{instanceStats.length}</Badge>
            </Button>
          </CollapsibleTrigger>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefreshStats} disabled={loadingStats}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CollapsibleContent className="pt-2">
          {loadingStats ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : instanceStats.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-6 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma estatística disponível</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {instanceStats.map((stat) => (
                <Card key={stat.instanceId} className="glass-card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium truncate max-w-[70%]">{stat.instanceName}</span>
                      <Badge
                        variant={stat.status === 'connected' || stat.status === 'online' ? 'default' : 'secondary'}
                        className={`text-[9px] px-1.5 py-0 ${
                          stat.status === 'connected' || stat.status === 'online'
                            ? 'bg-green-500/10 text-green-600 border-green-500/20'
                            : ''
                        }`}
                      >
                        {stat.status === 'connected' || stat.status === 'online' ? 'On' : 'Off'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {stat.groupsCount} grupos</span>
                      <span className="flex items-center gap-1"><UsersRound className="w-3 h-3" /> {stat.participantsCount.toLocaleString('pt-BR')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Helpdesk Metrics - Lazy */}
      <LazySection height="300px">
        <HelpdeskMetricsCharts periodDays={filters.period} />
      </LazySection>

      {/* Agent Performance - Lazy */}
      <LazySection height="300px">
        <AgentPerformanceCard periodDays={filters.period} />
      </LazySection>

      {/* E2E Test Status */}
      {isSuperAdmin && (
        <LazySection height="100px">
          <E2eStatusCard />
        </LazySection>
      )}

      {/* Recent Instances - Lazy */}
      <LazySection height="200px">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Instâncias Recentes</h2>
          {instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma instância encontrada</p>
            </div>
          ) : (
            <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {instances.slice(0, 6).map((instance) => (
                <InstanceCard key={instance.id} instance={instance} showOwner={isSuperAdmin} />
              ))}
            </div>
          )}
        </div>
      </LazySection>
      </ErrorBoundary>
    </div>
  );
};

export default DashboardHome;
