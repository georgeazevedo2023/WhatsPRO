// M19 S4: Grid de KPI Cards da ficha do agente IA
import { memo } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import { Bot, ArrowRightLeft, Shield, Zap, DollarSign, Calculator } from 'lucide-react';
import type { AgentKPIs } from '@/hooks/useAgentDetail';

interface AgentKPICardsProps {
  kpis: AgentKPIs;
  periodDays: number;
}

const AgentKPICards = ({ kpis, periodDays }: AgentKPICardsProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    <StatsCard
      title="Respostas IA"
      value={kpis.totalResponses.toLocaleString('pt-BR')}
      icon={Bot}
      description={`últimos ${periodDays} dias`}
    />
    <StatsCard
      title="Handoffs"
      value={kpis.totalHandoffs.toLocaleString('pt-BR')}
      icon={ArrowRightLeft}
      description="passagens para humano"
    />
    <StatsCard
      title="Cobertura IA"
      value={`${kpis.coveragePct}%`}
      icon={Shield}
      description="respostas / total interações"
    />
    <StatsCard
      title="Latência Média"
      value={kpis.avgLatencyMs > 0 ? `${kpis.avgLatencyMs}ms` : '—'}
      icon={Zap}
      description="tempo médio de resposta"
    />
    <StatsCard
      title="Custo Total"
      value={kpis.totalCostUsd > 0 ? `$${kpis.totalCostUsd.toFixed(3)}` : '$0.000'}
      icon={DollarSign}
      description="custo IA no período (USD)"
    />
    <StatsCard
      title="Custo/Conversa"
      value={kpis.costPerConversation > 0 ? `$${kpis.costPerConversation.toFixed(4)}` : '$0.0000'}
      icon={Calculator}
      description="custo por interação (USD)"
    />
  </div>
);

export default memo(AgentKPICards);
