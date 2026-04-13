import { memo } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import { Users, TrendingUp, ArrowRightLeft, Star, DollarSign, Activity } from 'lucide-react';
import type { ManagerKPIs } from '@/hooks/useManagerMetrics';

interface ManagerKPICardsProps {
  kpis: ManagerKPIs;
  periodDays: number;
}

const ManagerKPICards = ({ kpis, periodDays }: ManagerKPICardsProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    <StatsCard
      title="Leads Novos"
      value={kpis.newLeads.toLocaleString('pt-BR')}
      icon={Users}
      description={`últimos ${periodDays} dias`}
    />
    <StatsCard
      title="Taxa Conversão"
      value={`${kpis.conversionRate}%`}
      icon={TrendingUp}
      description="leads → conversão"
    />
    <StatsCard
      title="Taxa Transbordo"
      value={`${kpis.handoffRate}%`}
      icon={ArrowRightLeft}
      description="IA → vendedor"
    />
    <StatsCard
      title="NPS Médio"
      value={kpis.npsAvg > 0 ? kpis.npsAvg.toFixed(1) : '—'}
      icon={Star}
      description="satisfação (1–5)"
    />
    <StatsCard
      title="Custo IA"
      value={kpis.iaCostUsd > 0 ? `$${kpis.iaCostUsd.toFixed(4)}` : '$0'}
      icon={DollarSign}
      description="estimado gpt-4.1-mini"
    />
    <StatsCard
      title="Score Médio"
      value={kpis.avgLeadScore}
      icon={Activity}
      description="leads (0–100)"
    />
  </div>
);

export default memo(ManagerKPICards);
