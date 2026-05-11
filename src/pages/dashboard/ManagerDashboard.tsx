// Dashboard do Gestor — unificado (Fase 1: 2026-05-11)
// Rota: /dashboard/gestao (CrmRoute — super_admin + gerente)
// Consolida Métricas + Insights + horário/motivos em scroll único.
// Sandbox IA escondida via instances.is_sandbox (filtrada em useManagerInstances).
import { useState, useEffect } from 'react';
import { LineChart, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ManagerFilters, { type ManagerFiltersState } from '@/components/manager/ManagerFilters';
import ManagerKPICards from '@/components/manager/ManagerKPICards';
import LeadsByOriginChart from '@/components/manager/LeadsByOriginChart';
import LeadsTrendChart from '@/components/manager/LeadsTrendChart';
import LeadsNewVsReturningChart from '@/components/manager/LeadsNewVsReturningChart';
import SellerRankingChart from '@/components/manager/SellerRankingChart';
import ManagerConversionFunnel from '@/components/manager/ManagerConversionFunnel';
import IAvsVendorComparison from '@/components/manager/IAvsVendorComparison';
import ResponseTimeCard from '@/components/manager/ResponseTimeCard';
import PendingConversationsCard from '@/components/manager/PendingConversationsCard';
import DemandVsCoverageChart from '@/components/manager/DemandVsCoverageChart';
import ConversionByOriginCard from '@/components/manager/ConversionByOriginCard';
import BusinessHoursChart from '@/components/dashboard/BusinessHoursChart';
import TopContactReasons from '@/components/dashboard/TopContactReasons';
import TopListCard from '@/components/manager/insights/TopListCard';
import LazySection from '@/components/dashboard/LazySection';
import GoalProgressBar from '@/components/gestao/GoalProgressBar';
import GoalsConfigModal from '@/components/gestao/GoalsConfigModal';
import DbSizeCard from '@/components/manager/DbSizeCard';
import InsightsTab from '@/components/manager/insights/InsightsTab';
import { AlarmClock, MailQuestion, FileSpreadsheet, AlertOctagon } from 'lucide-react';
import { useManagerMetrics } from '@/hooks/useManagerMetrics';
import { useManagerInstances } from '@/hooks/useManagerInstances';
import { useInstanceGoals } from '@/hooks/useInstanceGoals';
import { useLeadsNewVsReturning } from '@/hooks/useLeadsNewVsReturning';
import { useManagerAdvancedMetrics } from '@/hooks/useManagerAdvancedMetrics';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';
import { useAuth } from '@/contexts/AuthContext';

const ABANDONED_THRESHOLD_HOURS = 24;

export default function ManagerDashboard() {
  const { isSuperAdmin } = useAuth();
  // Sandbox IA fica disponível só para super_admin (toggle abaixo).
  const [showSandbox, setShowSandbox] = useState(false);
  const { data: instances = [] } = useManagerInstances({
    includeSandbox: isSuperAdmin && showSandbox,
  });

  const [filters, setFilters] = useState<ManagerFiltersState>({
    instanceId: null,
    periodDays: 30,
  });

  // Auto-seleciona primeira instância se nenhuma foi escolhida
  const effectiveInstanceId = filters.instanceId ?? (instances[0]?.id ?? null);

  // Sincroniza instância selecionada para o widget assistente (useEffect — não no render)
  useEffect(() => {
    if (effectiveInstanceId) {
      localStorage.setItem('wp-gestao-instance', effectiveInstanceId);
      window.dispatchEvent(new CustomEvent('wp-instance-change', { detail: effectiveInstanceId }));
    }
  }, [effectiveInstanceId]);

  const { data: metrics, isLoading, refetch } = useManagerMetrics(
    effectiveInstanceId,
    filters.periodDays
  );

  const { data: newVsReturning, isLoading: loadingNewRet } = useLeadsNewVsReturning(
    effectiveInstanceId,
    filters.periodDays,
  );

  const { data: advanced, isLoading: loadingAdvanced } = useManagerAdvancedMetrics(
    effectiveInstanceId,
    filters.periodDays,
    ABANDONED_THRESHOLD_HOURS,
  );

  const { data: insights, isLoading: loadingInsights } = useDashboardInsights(
    effectiveInstanceId,
    filters.periodDays,
  );

  const { data: goals = [] } = useInstanceGoals(effectiveInstanceId);
  const [goalsOpen, setGoalsOpen] = useState(false);

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
              Visão consolidada do atendimento, IA e comercial
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSuperAdmin && (
            <Button
              variant={showSandbox ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowSandbox((v) => !v)}
              className="gap-2"
              title="Mostrar instâncias de sandbox (super_admin)"
            >
              <span className="text-[10px] font-mono">
                {showSandbox ? 'Sandbox: ON' : 'Sandbox: OFF'}
              </span>
            </Button>
          )}
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

      {/* DB Size Card — apenas super_admin */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DbSizeCard />
        </div>
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
          <LineChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma instância para ver as métricas</p>
          <p className="text-xs mt-1 opacity-60">As métricas são calculadas por instância</p>
        </div>
      )}

      {effectiveInstanceId && (
        <div className="flex flex-col gap-6">
          {/* ── ZONA 1: PULSO ── KPIs principais ───────────────────────── */}
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Pulso do período</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                últimos {filters.periodDays} dias
              </span>
            </header>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : metrics ? (
              <ManagerKPICards kpis={metrics.kpis} periodDays={filters.periodDays} />
            ) : null}

            {/* F2: Tempo de resposta — KPI horizontal, ocupa toda a linha */}
            <ResponseTimeCard data={advanced?.responseTime} isLoading={loadingAdvanced} />

            {/* Metas — exibidas apenas quando há meta definida */}
            {goals.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border bg-card">
                <GoalProgressBar
                  label="Taxa de Conversão"
                  current={metrics?.kpis.conversionRate ?? 0}
                  target={goals.find((g) => g.metricKey === 'conversion_rate')?.targetValue ?? 0}
                  unit="%"
                />
                <GoalProgressBar
                  label="NPS Médio"
                  current={metrics?.kpis.npsAvg ?? 0}
                  target={goals.find((g) => g.metricKey === 'nps_avg')?.targetValue ?? 0}
                />
                <GoalProgressBar
                  label="Taxa de Transbordo"
                  current={metrics?.kpis.handoffRate ?? 0}
                  target={goals.find((g) => g.metricKey === 'handoff_rate')?.targetValue ?? 0}
                  unit="%"
                />
              </div>
            )}
          </section>

          {/* ── ZONA 2: TENDÊNCIA & VOLUME ─────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Tendência & volume</h2>
              <span className="text-[10px] text-muted-foreground">novos vs recorrentes — quem está voltando</span>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LazySection height="260px">
                <LeadsNewVsReturningChart data={newVsReturning} isLoading={loadingNewRet} />
              </LazySection>
              <LazySection height="260px">
                {metrics ? <LeadsTrendChart data={metrics.trend} /> : <Skeleton className="h-64 rounded-xl" />}
              </LazySection>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LazySection height="260px">
                {metrics ? <LeadsByOriginChart data={metrics.leadsByOrigin} /> : <Skeleton className="h-64 rounded-xl" />}
              </LazySection>
              <LazySection height="260px">
                <BusinessHoursChart inboxId={null} periodDays={filters.periodDays} />
              </LazySection>
            </div>
          </section>

          {/* ── ZONA 3: ATENDIMENTO ───────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Atendimento</h2>
              <span className="text-[10px] text-muted-foreground">o que está pendente e quem está respondendo</span>
            </header>

            {/* Linha 1 — pendências críticas (3 colunas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <LazySection height="280px">
                <PendingConversationsCard
                  title="Sem 1ª resposta ao lead"
                  subtitle="lead mandou msg, ninguém respondeu nunca"
                  icon={MailQuestion}
                  iconClassName="text-rose-500"
                  data={advanced?.unanswered.map((u) => ({
                    conversationId: u.conversationId,
                    contactName: u.contactName,
                    contactPhone: u.contactPhone,
                    hoursWaiting: u.hoursWaiting,
                  }))}
                  isLoading={loadingAdvanced}
                  emptyMessage="Todo lead foi respondido. 👏"
                />
              </LazySection>
              <LazySection height="280px">
                <PendingConversationsCard
                  title={`Sem resposta há +${ABANDONED_THRESHOLD_HOURS}h`}
                  subtitle="última msg foi do lead, conversa parou"
                  icon={AlarmClock}
                  iconClassName="text-amber-500"
                  data={advanced?.abandoned.map((a) => ({
                    conversationId: a.conversationId,
                    contactName: a.contactName,
                    contactPhone: a.contactPhone,
                    hoursWaiting: a.hoursWaiting,
                  }))}
                  isLoading={loadingAdvanced}
                  emptyMessage="Equipe em dia."
                />
              </LazySection>
              <LazySection height="280px">
                <PendingConversationsCard
                  title="Cotações em andamento"
                  subtitle="motivo:orcamento sem venda fechada"
                  icon={FileSpreadsheet}
                  iconClassName="text-sky-500"
                  data={advanced?.activeQuotes.map((q) => ({
                    conversationId: q.conversationId,
                    contactName: q.contactName,
                    contactPhone: q.contactPhone,
                    hoursWaiting: q.hoursSinceLastMsg,
                  }))}
                  isLoading={loadingAdvanced}
                  emptyMessage="Nenhuma cotação aberta no momento."
                />
              </LazySection>
            </div>

            {/* Linha 2 — análise: motivos + objeções (lado a lado) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LazySection height="280px">
                <TopListCard
                  title="Top objeções"
                  description="motivos de hesitação detectados"
                  icon={AlertOctagon}
                  items={insights?.objecoes ?? []}
                  isLoading={loadingInsights}
                  formatLabel={(s) => s.replace(/_/g, ' ')}
                  topN={8}
                />
              </LazySection>
              <LazySection height="280px">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Motivos de conversa (compra, troca, status de entrega...)
                  </h3>
                  <TopContactReasons instanceId={effectiveInstanceId} inboxId={null} periodDays={filters.periodDays} />
                </div>
              </LazySection>
            </div>

            {/* Linha 3 — distribuição da equipe */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LazySection height="260px">
                <DemandVsCoverageChart data={advanced?.hours} isLoading={loadingAdvanced} />
              </LazySection>
              <LazySection height="260px">
                {metrics ? <SellerRankingChart sellers={metrics.sellers} /> : <Skeleton className="h-64 rounded-xl" />}
              </LazySection>
            </div>
          </section>

          {/* ── ZONA 4: IA & COMERCIAL ───────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">IA & comercial</h2>
              <span className="text-[10px] text-muted-foreground">conversão, custo, qualidade do funil</span>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LazySection height="260px">
                {metrics ? <ManagerConversionFunnel data={metrics.funnel} /> : <Skeleton className="h-64 rounded-xl" />}
              </LazySection>
              <LazySection height="260px">
                <ConversionByOriginCard data={advanced?.conversionByOrigin} isLoading={loadingAdvanced} />
              </LazySection>
            </div>
            <LazySection height="260px">
              {metrics ? <IAvsVendorComparison data={metrics.iaVsVendor} /> : <Skeleton className="h-64 rounded-xl" />}
            </LazySection>
            <InsightsTab instanceId={effectiveInstanceId} periodDays={filters.periodDays} />
          </section>
        </div>
      )}
    </div>
  );
}
