// M19 S4-P4: Grid de KPI Cards do painel de transbordo
import { memo } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import { ArrowRightLeft, AlertTriangle, Shield, TrendingUp, Clock } from 'lucide-react';
import type { HandoffKPIs } from '@/hooks/useHandoffMetrics';

interface HandoffKPICardsProps {
  kpis: HandoffKPIs;
  periodDays: number;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const HandoffKPICards = ({ kpis, periodDays }: HandoffKPICardsProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
    <StatsCard
      title="Total Handoffs"
      value={kpis.totalHandoffs.toLocaleString('pt-BR')}
      icon={ArrowRightLeft}
      description={`últimos ${periodDays} dias`}
    />
    <StatsCard
      title="Evitáveis"
      value={`${kpis.evitavelCount} (${kpis.evitavelPct}%)`}
      icon={AlertTriangle}
      description="poderiam ser resolvidos pela IA"
    />
    <StatsCard
      title="Necessários"
      value={kpis.necessarioCount.toLocaleString('pt-BR')}
      icon={Shield}
      description="corretamente escalados"
    />
    <StatsCard
      title="Conversão Pós-Transbordo"
      value={`${kpis.converteuPct}%`}
      icon={TrendingUp}
      description={`${kpis.converteuCount} converteram`}
    />
    <StatsCard
      title="Tempo Médio até Transbordo"
      value={formatMinutes(kpis.avgMinutesBeforeHandoff)}
      icon={Clock}
      description="da abertura ao transbordo"
    />
  </div>
);

export default memo(HandoffKPICards);
