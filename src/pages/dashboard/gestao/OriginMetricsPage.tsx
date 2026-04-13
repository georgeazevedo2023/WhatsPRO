// M19 S4 P5: Página de Métricas de Origem
// Rota: /dashboard/gestao/origem
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowLeft, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ManagerFilters, { type ManagerFiltersState } from '@/components/manager/ManagerFilters';
import LazySection from '@/components/dashboard/LazySection';
import LeadsByOriginChart from '@/components/manager/LeadsByOriginChart';
import OriginChannelTable from '@/components/gestao/OriginChannelTable';
import OriginUTMBreakdown from '@/components/gestao/OriginUTMBreakdown';
import GoalProgressBar from '@/components/gestao/GoalProgressBar';
import GoalsConfigModal from '@/components/gestao/GoalsConfigModal';
import { useManagerInstances } from '@/hooks/useManagerInstances';
import { useOriginMetrics } from '@/hooks/useOriginMetrics';
import { useInstanceGoals } from '@/hooks/useInstanceGoals';
import type { LeadsByOrigin } from '@/hooks/useManagerMetrics';

export default function OriginMetricsPage() {
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

  const { data: metrics, isLoading, refetch } = useOriginMetrics(
    effectiveInstanceId,
    filters.periodDays,
  );

  const { data: goals = [] } = useInstanceGoals(effectiveInstanceId);
  const [goalsOpen, setGoalsOpen] = useState(false);

  // Converter channels para o formato que LeadsByOriginChart aceita: { origin, count }[]
  const pieData: LeadsByOrigin[] = (metrics?.channels ?? []).map((ch) => ({
    origin: ch.origin,
    count: ch.totalLeads,
  }));

  // Calcular métricas agregadas para as barras de meta
  const channels = metrics?.channels ?? [];
  const avgConversionRate = channels.length > 0
    ? Math.round(channels.reduce((s, ch) => s + ch.conversionRate, 0) / channels.length)
    : 0;
  const channelsWithTicket = channels.filter((ch) => ch.avgTicket != null);
  const avgTicket = channelsWithTicket.length > 0
    ? Math.round(
        channelsWithTicket.reduce((s, ch) => s + (ch.avgTicket ?? 0), 0) / channelsWithTicket.length
      )
    : 0;

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
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Métricas de Origem</h1>
            <p className="text-xs text-muted-foreground">
              Canais de captação de leads e performance por UTM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGoalsOpen(true)}
            disabled={!effectiveInstanceId}
            className="gap-2"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Metas</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Modal de metas */}
      {effectiveInstanceId && (
        <GoalsConfigModal
          instanceId={effectiveInstanceId}
          open={goalsOpen}
          onOpenChange={setGoalsOpen}
        />
      )}

      {/* Filtros */}
      <ManagerFilters
        instances={instances}
        filters={filtersDisplay}
        onFiltersChange={setFilters}
      />

      {/* Estado: sem instância */}
      {!effectiveInstanceId && (
        <div className="text-center py-20 text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma instância para ver as métricas</p>
          <p className="text-xs mt-1 opacity-60">As métricas são calculadas por instância</p>
        </div>
      )}

      {effectiveInstanceId && (
        <>
          {/* Metas — exibidas apenas quando há meta definida */}
          {goals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border bg-card">
              <GoalProgressBar
                label="Taxa de Conversão Média"
                current={avgConversionRate}
                target={goals.find((g) => g.metricKey === 'conversion_rate')?.targetValue ?? 0}
                unit="%"
              />
              <GoalProgressBar
                label="Ticket Médio"
                current={avgTicket}
                target={goals.find((g) => g.metricKey === 'avg_ticket')?.targetValue ?? 0}
                unit=" R$"
              />
            </div>
          )}

          {/* Pie Chart — distribuição por canal */}
          <LazySection height="260px">
            {isLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <LeadsByOriginChart data={pieData} />
            )}
          </LazySection>

          {/* Tabela de canais */}
          <LazySection height="260px">
            {isLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <OriginChannelTable channels={metrics?.channels ?? []} />
            )}
          </LazySection>

          {/* UTM Breakdown */}
          <LazySection height="260px">
            {isLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <OriginUTMBreakdown data={metrics?.utmBreakdown ?? []} />
            )}
          </LazySection>
        </>
      )}
    </div>
  );
}
