// M19 S4 P5: Tabela de canais de origem
import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import type { OriginChannel } from '@/hooks/useOriginMetrics';

interface OriginChannelTableProps {
  channels: OriginChannel[];
}

const ORIGIN_BADGE: Record<string, string> = {
  bio: 'bg-blue-100 text-blue-700',
  campanha: 'bg-purple-100 text-purple-700',
  formulario: 'bg-green-100 text-green-700',
  direto: 'bg-gray-100 text-gray-700',
};

const ORIGIN_LABELS: Record<string, string> = {
  bio: 'Bio Link',
  campanha: 'Campanha',
  formulario: 'Formulário',
  direto: 'Direto',
  funil: 'Funil',
};

function OriginBadge({ origin }: { origin: string }) {
  const cls = ORIGIN_BADGE[origin] ?? 'bg-gray-100 text-gray-700';
  const label = ORIGIN_LABELS[origin] ?? origin;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-7 text-right shrink-0">{score}</span>
    </div>
  );
}

const OriginChannelTable = ({ channels }: OriginChannelTableProps) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        Canais de Origem
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {channels.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">Nenhum lead no período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Canal</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Leads</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Qualificados</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">% Conversão</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Ticket Médio</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground min-w-[120px]">Score Médio</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.origin} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <OriginBadge origin={ch.origin} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {ch.totalLeads.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {ch.qualifiedLeads.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {ch.conversionRate}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {ch.avgTicket !== null ? `R$ ${ch.avgTicket.toLocaleString('pt-BR')}` : '--'}
                  </td>
                  <td className="px-4 py-2.5">
                    <ScoreBar score={ch.avgScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
);

export default memo(OriginChannelTable);
