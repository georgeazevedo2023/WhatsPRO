// M19 S3: Dashboard do Gestor
// Rota: /dashboard/gestao (CrmRoute — super_admin + gerente)
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { LineChart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ManagerFilters, { type ManagerFiltersState } from '@/components/manager/ManagerFilters';
import ManagerKPICards from '@/components/manager/ManagerKPICards';
import LeadsByOriginChart from '@/components/manager/LeadsByOriginChart';
import LeadsTrendChart from '@/components/manager/LeadsTrendChart';
import SellerRankingChart from '@/components/manager/SellerRankingChart';
import ManagerConversionFunnel from '@/components/manager/ManagerConversionFunnel';
import IAvsVendorComparison from '@/components/manager/IAvsVendorComparison';
import LazySection from '@/components/dashboard/LazySection';
import { useManagerMetrics } from '@/hooks/useManagerMetrics';

function useManagerInstances() {
  return useQuery({
    queryKey: ['manager-instances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instances')
        .select('id, name, status')
        .eq('disabled', false)
        .order('name');
      return (data || []) as { id: string; name: string; status: string }[];
    },
    staleTime: 300_000,
  });
}

export default function ManagerDashboard() {
  const { data: instances = [] } = useManagerInstances();

  const [filters, setFilters] = useState<ManagerFiltersState>({
    instanceId: null,
    periodDays: 30,
  });

  // Auto-seleciona primeira instância se nenhuma foi escolhida
  const effectiveInstanceId = filters.instanceId ?? (instances[0]?.id ?? null);

  const { data: metrics, isLoading, refetch } = useManagerMetrics(
    effectiveInstanceId,
    filters.periodDays
  );

  const filtersDisplay: ManagerFiltersState = {
    ...filters,
    instanceId: effectiveInstanceId,
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <LineChart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Dashboard do Gestor</h1>
            <p className="text-xs text-muted-foreground">
              Métricas agregadas — alimentadas pelo shadow bilateral (cron hourly)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Filtros */}
      <ManagerFilters
        instances={instances}
        filters={filtersDisplay}
        onFiltersChange={setFilters}
      />

      {/* Estado: sem instância */}
      {!effectiveInstanceId && (
        <div className="text-center py-20 text-muted-foreground">
          <LineChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma instância para ver as métricas</p>
          <p className="text-xs mt-1 opacity-60">As métricas são calculadas por instância</p>
        </div>
      )}

      {effectiveInstanceId && (
        <>
          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : metrics ? (
            <ManagerKPICards kpis={metrics.kpis} periodDays={filters.periodDays} />
          ) : null}

          {/* Linha 1: Tendência + Origem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LazySection height="260px">
              {metrics ? <LeadsTrendChart data={metrics.trend} /> : <Skeleton className="h-64 rounded-xl" />}
            </LazySection>
            <LazySection height="260px">
              {metrics ? <LeadsByOriginChart data={metrics.leadsByOrigin} /> : <Skeleton className="h-64 rounded-xl" />}
            </LazySection>
          </div>

          {/* Linha 2: Funil + IA vs Vendedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LazySection height="260px">
              {metrics ? <ManagerConversionFunnel data={metrics.funnel} /> : <Skeleton className="h-64 rounded-xl" />}
            </LazySection>
            <LazySection height="260px">
              {metrics ? <IAvsVendorComparison data={metrics.iaVsVendor} /> : <Skeleton className="h-64 rounded-xl" />}
            </LazySection>
          </div>

          {/* Linha 3: Ranking Vendedores */}
          <LazySection height="340px">
            {metrics ? <SellerRankingChart sellers={metrics.sellers} /> : <Skeleton className="h-80 rounded-xl" />}
          </LazySection>
        </>
      )}
    </div>
  );
}
