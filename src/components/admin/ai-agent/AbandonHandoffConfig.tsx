import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserX, Clock } from 'lucide-react';

/**
 * Handoff automático por inatividade — DUAS regras independentes:
 *
 *  1. Transbordo por ABANDONO (Sprint E.2): quando a IA faz a pergunta da marca
 *     (fluxo offline/sem-resultado) e o lead SOME, em 2 estágios — cutucada após
 *     N min e transbordo após M min da cutucada.
 *  2. Transbordo por INATIVIDADE (v7.65.0): QUALQUER lead que parar de responder
 *     por X min (default 3) vai DIRETO pra fila do vendedor (sem cutucada). Só
 *     vale pra quem já interagiu e não encerrou a conversa.
 *
 * Backend: cron `handoff-abandoned-leads` (1min) lê estes campos. Default OFF.
 */

interface AbandonHandoffConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function AbandonHandoffConfig({ config, onChange }: AbandonHandoffConfigProps) {
  const enabled = config.abandon_handoff_enabled ?? false;
  const nudgeAfter = config.abandon_nudge_after_min ?? 5;
  const handoffAfter = config.abandon_handoff_after_min ?? 10;
  const inactivityEnabled = config.inactivity_handoff_enabled ?? false;
  const inactivityAfter = config.inactivity_handoff_after_min ?? 3;

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="w-4 h-4 text-primary" />
          Transbordo por Abandono
          {enabled && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border-emerald-300">
              Ativo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Quando a IA está esperando uma resposta (ex: a marca do produto) e o lead some, em vez de
          deixar a venda morrer a IA cutuca o lead e, persistindo o silêncio, entrega o atendimento
          para um vendedor com o resumo do pedido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Ativar transbordo por abandono</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recomendado para nichos com catálogo parcial (muito produto fica só no estoque físico).
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onChange({ abandon_handoff_enabled: v })}
          />
        </div>

        {enabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cutucar o lead após (minutos)</Label>
                <Input
                  type="number" min={1} max={120}
                  value={nudgeAfter}
                  onChange={(e) => onChange({ abandon_nudge_after_min: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Tempo sem resposta antes da 1ª mensagem leve ("Ainda tá por aí?"). Recomendado: 5.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transbordar após a cutucada (minutos)</Label>
                <Input
                  type="number" min={1} max={120}
                  value={handoffAfter}
                  onChange={(e) => onChange({ abandon_handoff_after_min: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Tempo extra após a cutucada antes de entregar pro vendedor. Recomendado: 10.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem da cutucada</Label>
              <Textarea
                value={config.abandon_nudge_message || ''}
                onChange={(e) => onChange({ abandon_nudge_message: e.target.value })}
                placeholder="Ainda tá por aí? 😊 Se quiser, já te conecto com um vendedor pra agilizar seu atendimento."
                className="min-h-[60px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe vazio para usar o texto padrão. O primeiro nome do lead é incluído automaticamente quando conhecido.
              </p>
            </div>

            <div className="rounded-md bg-muted/40 border border-muted p-3 text-[11px] text-muted-foreground">
              Total até o transbordo: <strong>{(Number(nudgeAfter) || 0) + (Number(handoffAfter) || 0)} min</strong> de
              silêncio. Se o lead responder antes, o atendimento segue normalmente e o transbordo é cancelado.
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Transbordo por Inatividade
          {inactivityEnabled && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border-emerald-300">
              Ativo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Qualquer lead que parar de responder à IA por alguns minutos é entregue
          <strong> direto</strong> para um vendedor na fila (sem cutucada). Vale só para quem já
          interagiu ao menos uma vez e não encerrou a conversa (despedidas como "obrigado/tchau" são ignoradas).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Ativar transbordo por inatividade</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Garante que nenhum lead engajado fique sem resposta quando some no meio da conversa.
            </p>
          </div>
          <Switch
            checked={inactivityEnabled}
            onCheckedChange={(v) => onChange({ inactivity_handoff_enabled: v })}
          />
        </div>

        {inactivityEnabled && (
          <>
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Transbordar após (minutos sem resposta)</Label>
              <Input
                type="number" min={1} max={120}
                value={inactivityAfter}
                onChange={(e) => onChange({ inactivity_handoff_after_min: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-muted-foreground">
                Tempo de silêncio antes de entregar pro vendedor. Recomendado: 3.
              </p>
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
              ⚠️ Janelas curtas (ex.: 3 min) podem transbordar leads que só estavam lendo o catálogo
              ou pensando. Quanto menor o tempo, mais conversas chegam ao vendedor — inclusive algumas
              que o lead ainda responderia sozinho.
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
