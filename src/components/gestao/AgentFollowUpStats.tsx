// M19 S4: Estatísticas de follow-up do agente IA
import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareDot } from 'lucide-react';

interface Props {
  sent: number;
  repliedPct: number;
}

const AgentFollowUpStats = ({ sent, repliedPct }: Props) => {
  if (sent === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquareDot className="w-4 h-4 text-primary" />
            Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">
            Nenhum follow-up enviado no período
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquareDot className="w-4 h-4 text-primary" />
          Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas inline */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Enviados</p>
            <p className="text-2xl font-display font-bold leading-tight">
              {sent.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-[11px] text-muted-foreground">Taxa de Resposta</p>
            <p className="text-2xl font-display font-bold leading-tight">
              {repliedPct}%
            </p>
          </div>
        </div>

        {/* Barra de progresso visual */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem resposta</span>
            <span>Respondidos</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(repliedPct, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {repliedPct}% dos follow-ups receberam resposta
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(AgentFollowUpStats);
