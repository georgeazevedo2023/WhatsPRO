import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, User2 } from 'lucide-react';
import type { IAvsVendorData } from '@/hooks/useManagerMetrics';

interface Props {
  data: IAvsVendorData;
}

const formatMinutes = (minutes: number) => {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

function CompareRow({
  label,
  iaValue,
  vendorValue,
}: {
  label: string;
  iaValue: string;
  vendorValue: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-2 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-center text-[11px]">{label}</span>
      <span className="font-medium text-center text-primary">{iaValue}</span>
      <span className="font-medium text-center text-blue-400">{vendorValue}</span>
    </div>
  );
}

export default function IAvsVendorComparison({ data }: Props) {
  const iaTotal = data.iaResponses + data.iaHandoffs;
  const vendorResolutionRate =
    data.vendorConversations > 0
      ? `${Math.round((data.vendorResolved / data.vendorConversations) * 100)}% resolv.`
      : '—';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          IA vs Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 pb-2 border-b border-border/40">
          <span className="text-center">Métrica</span>
          <div className="flex items-center justify-center gap-1 text-primary">
            <Bot className="w-3 h-3" /> IA
          </div>
          <div className="flex items-center justify-center gap-1 text-blue-400">
            <User2 className="w-3 h-3" /> Vendedor
          </div>
        </div>

        <CompareRow
          label="Interações"
          iaValue={iaTotal.toLocaleString('pt-BR')}
          vendorValue={data.vendorConversations.toLocaleString('pt-BR')}
        />
        <CompareRow
          label="Cobertura"
          iaValue={data.iaCoveragePct > 0 ? `${data.iaCoveragePct}%` : '—'}
          vendorValue={vendorResolutionRate}
        />
        <CompareRow
          label="Tempo resp."
          iaValue={
            data.iaAvgLatencyMs > 0
              ? `${(data.iaAvgLatencyMs / 1000).toFixed(1)}s`
              : '—'
          }
          vendorValue={formatMinutes(data.vendorAvgResolutionMin)}
        />
        <CompareRow
          label="Custo/conv."
          iaValue={
            iaTotal > 0 ? `$${(data.iaCostUsd / iaTotal).toFixed(5)}` : '$0'
          }
          vendorValue="—"
        />
        <CompareRow
          label="Handoffs"
          iaValue={data.iaHandoffs.toLocaleString('pt-BR')}
          vendorValue={
            data.vendorActiveSellers > 0
              ? `${data.vendorActiveSellers} vendedores`
              : '—'
          }
        />
      </CardContent>
    </Card>
  );
}
