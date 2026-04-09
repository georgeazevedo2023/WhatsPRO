// M17 F5: NPS Configuration Section
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Bell } from 'lucide-react';

interface PollConfigSectionProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

const DEFAULT_OPTIONS = ['Excelente', 'Bom', 'Regular', 'Ruim', 'Pessimo'];

export function PollConfigSection({ config, onChange }: PollConfigSectionProps) {
  const npsEnabled = config.poll_nps_enabled ?? false;
  const delay = config.poll_nps_delay_minutes ?? 5;
  const question = config.poll_nps_question ?? 'Como voce avalia nosso atendimento?';
  const options: string[] = config.poll_nps_options ?? DEFAULT_OPTIONS;
  const notifyBad = config.poll_nps_notify_on_bad ?? true;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">NPS Automatico</span>
        <span className="text-xs text-muted-foreground">— Enquete de satisfacao apos atendimento</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Enquete NPS
            </CardTitle>
            <Switch
              checked={npsEnabled}
              onCheckedChange={(v) => onChange({ poll_nps_enabled: v })}
            />
          </div>
          <CardDescription className="text-xs">
            Envia enquete de satisfacao automaticamente apos resolver conversa
          </CardDescription>
        </CardHeader>
        {npsEnabled && (
          <CardContent className="space-y-4">
            {/* Delay */}
            <div className="space-y-1">
              <Label className="text-xs">Delay (minutos apos resolver)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={delay}
                onChange={(e) => onChange({ poll_nps_delay_minutes: Number(e.target.value) || 5 })}
                className="w-24 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                D6: NAO envia se conversa teve transbordo por frustracao (tag sentimento:negativo)
              </p>
            </div>

            {/* Pergunta */}
            <div className="space-y-1">
              <Label className="text-xs">Pergunta</Label>
              <Textarea
                value={question}
                onChange={(e) => onChange({ poll_nps_question: e.target.value })}
                rows={2}
                maxLength={255}
                className="text-sm resize-none"
              />
            </div>

            {/* Opcoes */}
            <div className="space-y-1">
              <Label className="text-xs">Opcoes (escala de satisfacao)</Label>
              <div className="space-y-1">
                {options.map((opt: string, idx: number) => (
                  <Input
                    key={idx}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[idx] = e.target.value;
                      onChange({ poll_nps_options: newOpts });
                    }}
                    placeholder={DEFAULT_OPTIONS[idx] || `Opcao ${idx + 1}`}
                    className="text-sm"
                    maxLength={100}
                  />
                ))}
              </div>
            </div>

            {/* Notificacao */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch
                checked={notifyBad}
                onCheckedChange={(v) => onChange({ poll_nps_notify_on_bad: v })}
                id="nps-notify"
              />
              <Label htmlFor="nps-notify" className="text-xs flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Notificar gerente quando nota for Ruim ou Pessimo
              </Label>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
