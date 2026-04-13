// M19 S3: Funil de conversão baseado em shadow (conversion_funnel_events via v_conversion_funnel)
// Nome: ManagerConversionFunnel — distinto de FunnelConversionChart (M16, dados de campanhas/bio)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import type { FunnelStageData } from '@/hooks/useManagerMetrics';

const STAGE_LABELS: Record<string, string> = {
  contact: 'Contato',
  qualification: 'Qualificação',
  intention: 'Intenção',
  conversion: 'Conversão',
};

const STAGE_COLORS: Record<string, string> = {
  contact: 'hsl(217 91% 60%)',
  qualification: 'hsl(262 83% 58%)',
  intention: 'hsl(43 96% 56%)',
  conversion: 'hsl(142 70% 45%)',
};

interface Props {
  data: FunnelStageData[];
}

export default function ManagerConversionFunnel({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Funil de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">
            Nenhum dado — aguardando cron de agregação (hourly)
          </p>
        </CardContent>
      </Card>
    );
  }

  const topValue = data[0]?.uniqueLeads || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Funil de Conversão (Shadow)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {data.map((stage, idx) => {
          const prevValue = idx > 0 ? data[idx - 1].uniqueLeads : null;
          const dropRate =
            prevValue && prevValue > 0
              ? Math.round(((prevValue - stage.uniqueLeads) / prevValue) * 100)
              : null;

          return (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {STAGE_LABELS[stage.stage] || stage.stage}
                </span>
                <div className="flex items-center gap-2">
                  {dropRate !== null && dropRate > 0 && (
                    <span className="text-destructive text-[10px]">−{dropRate}%</span>
                  )}
                  <span className="font-bold">{stage.uniqueLeads.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <div className="h-7 bg-muted rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500 flex items-center pl-2"
                  style={{
                    width: `${Math.max(stage.pct, 4)}%`,
                    backgroundColor: STAGE_COLORS[stage.stage] || 'hsl(var(--primary))',
                  }}
                >
                  {stage.pct > 12 && (
                    <span className="text-white text-[10px] font-medium">
                      {Math.round((stage.uniqueLeads / topValue) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
