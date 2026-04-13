// M19 S4: Grid de KPI Cards da ficha do vendedor
import { memo } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import { MessageSquare, CheckCircle2, Percent, Clock, Star, DollarSign } from 'lucide-react';
import type { VendorKPIs } from '@/hooks/useVendorDetail';

interface VendorKPICardsProps {
  kpis: VendorKPIs;
  periodDays: number;
}

const VendorKPICards = ({ kpis, periodDays }: VendorKPICardsProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    <StatsCard
      title="Conversas"
      value={kpis.conversations.toLocaleString('pt-BR')}
      icon={MessageSquare}
      description={`últimos ${periodDays} dias`}
    />
    <StatsCard
      title="Resolvidas"
      value={kpis.resolved.toLocaleString('pt-BR')}
      icon={CheckCircle2}
      description="total no período"
    />
    <StatsCard
      title="Taxa Resolução"
      value={`${kpis.resolutionRate}%`}
      icon={Percent}
      description="conv. resolvidas"
    />
    <StatsCard
      title="Tempo Médio"
      value={kpis.avgResolutionMin > 0 ? `${kpis.avgResolutionMin}min` : '—'}
      icon={Clock}
      description="resolução (minutos)"
    />
    <StatsCard
      title="NPS Médio"
      value={kpis.npsAvg > 0 ? kpis.npsAvg.toFixed(1) : '—'}
      icon={Star}
      description="satisfação (1–5)"
    />
    <StatsCard
      title="Ticket Médio"
      value={kpis.avgTicket > 0 ? `R$ ${kpis.avgTicket.toLocaleString('pt-BR')}` : '—'}
      icon={DollarSign}
      description="valor médio por lead"
    />
  </div>
);

export default memo(VendorKPICards);
