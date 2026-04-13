// M19 S4 P5: Tabela de UTM breakdown por campanha
import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2 } from 'lucide-react';
import type { UTMBreakdownRow } from '@/hooks/useOriginMetrics';

interface OriginUTMBreakdownProps {
  data: UTMBreakdownRow[];
}

function conversionBadge(pct: number): string {
  if (pct > 10) return 'bg-green-100 text-green-700';
  if (pct >= 5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

const OriginUTMBreakdown = ({ data }: OriginUTMBreakdownProps) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" />
        UTM Breakdown
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">
          Nenhuma campanha com UTM no período
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Campanha</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Medium</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Visitas</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Leads Capturados</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">% Conversão</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium" title={row.campaignName}>
                    {truncate(row.campaignName, 25)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {row.utmSource || '--'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {row.utmMedium || '--'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.visits.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.matchedLeads.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conversionBadge(row.conversionPct)}`}
                    >
                      {row.conversionPct}%
                    </span>
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

export default memo(OriginUTMBreakdown);
