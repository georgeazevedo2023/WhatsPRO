// M19 S4-P4: Painel de Transbordo
// Rota: /dashboard/gestao/transbordo
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ManagerFilters, { type ManagerFiltersState } from '@/components/manager/ManagerFilters';
import LazySection from '@/components/dashboard/LazySection';
import HandoffKPICards from '@/components/gestao/HandoffKPICards';
import HandoffMotivosChart from '@/components/gestao/HandoffMotivosChart';
import HandoffEvitavelChart from '@/components/gestao/HandoffEvitavelChart';
import HandoffRecentTable from '@/components/gestao/HandoffRecentTable';
import { useHandoffMetrics } from '@/hooks/useHandoffMetrics';
import { useManagerInstances } from '@/hooks/useManagerInstances';

export default function HandoffDetailPage() {
  const navigate = useNavigate();

  const { data: instances = [] } = useManagerInstances();

  const [filters, setFilters] = useState<ManagerFiltersState>({
    instanceId: null,
    periodDays: 30,
  });

  // Auto-seleciona primeira instância se nenhuma foi escolhida
  const effectiveInstanceId = filters.instanceId ?? (instances[0]?.id ?? null);

  const filtersDisplay: ManagerFiltersState = {
    ...filters,
    instanceId: effectiveInstanceId,
  };

  const { data: metrics, isLoading, refetch } = useHandoffMetrics(
    effectiveInstanceId,
    filters.periodDays
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/gestao')}
            className="shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Painel de Transbordo</h1>
            <p className="text-xs text-muted-foreground">
              Análise de handoffs IA → vendedor por instância e período
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
          <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma instância para ver as métricas</p>
          <p className="text-xs mt-1 opacity-60">As métricas são calculadas por instância</p>
        </div>
      )}

      {effectiveInstanceId && (
        <>
          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : metrics ? (
            <HandoffKPICards kpis={metrics.kpis} periodDays={filters.periodDays} />
          ) : null}

          {/* Linha 1: Motivos + Evitável vs Necessário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LazySection height="280px">
              {metrics ? (
                <HandoffMotivosChart data={metrics.byMotivo} />
              ) : (
                <Skeleton className="h-64 rounded-xl" />
              )}
            </LazySection>
            <LazySection height="280px">
              {metrics ? (
                <HandoffEvitavelChart
                  evitavelCount={metrics.kpis.evitavelCount}
                  necessarioCount={metrics.kpis.necessarioCount}
                />
              ) : (
                <Skeleton className="h-64 rounded-xl" />
              )}
            </LazySection>
          </div>

          {/* Tabela de handoffs recentes */}
          <LazySection height="320px">
            {metrics ? (
              <HandoffRecentTable rows={metrics.recentRows} />
            ) : (
              <Skeleton className="h-72 rounded-xl" />
            )}
          </LazySection>
        </>
      )}
    </div>
  );
}
