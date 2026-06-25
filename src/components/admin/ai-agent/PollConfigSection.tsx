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
  const question = config.poll_nps_question ?? 'Sua opinião é muito importante 🙏 De 0 a 10, como foi seu atendimento?';
  const options: string[] = config.poll_nps_options ?? DEFAULT_OPTIONS;
  const notifyBad = config.poll_nps_notify_on_bad ?? true;
  // NPS-on-finalize (2026-06-25)
  const scale: string = config.poll_nps_scale ?? 'categorical';
  const isNumeric = scale === 'numeric_0_10';
  const threshold = config.poll_nps_low_score_threshold ?? 5;
  const askFound = config.poll_nps_ask_found_product ?? false;
  const alertWhatsapp = config.poll_nps_manager_alert_whatsapp ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">NPS ao finalizar</span>
        <span className="text-xs text-muted-foreground">— Enquete de satisfação quando o atendente finaliza a conversa</span>
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
            Enviada na hora em que o atendente clica "Finalizar". Não envia se a conversa teve transbordo por frustração (tag sentimento:negativo).
          </CardDescription>
        </CardHeader>
        {npsEnabled && (
          <CardContent className="space-y-4">
            {/* Escala */}
            <div className="flex items-center gap-2">
              <Switch
                checked={isNumeric}
                onCheckedChange={(v) => onChange({ poll_nps_scale: v ? 'numeric_0_10' : 'categorical' })}
                id="nps-scale"
              />
              <Label htmlFor="nps-scale" className="text-xs">
                Escala 0 a 10 (numérica) {isNumeric ? '' : '— hoje: categórica (Excelente→Péssimo)'}
              </Label>
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

            {/* Opções (só no modo categórico; no 0-10 são fixas) */}
            {isNumeric ? (
              <p className="text-[11px] text-muted-foreground rounded-md bg-muted/40 p-2">
                Enquete com 11 botões (0 a 10). Nota <strong>abaixo de {threshold}</strong> dispara alerta ao gestor.
              </p>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Opções (escala de satisfação)</Label>
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
                      placeholder={DEFAULT_OPTIONS[idx] || `Opção ${idx + 1}`}
                      className="text-sm"
                      maxLength={100}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Threshold (só no modo numérico) */}
            {isNumeric && (
              <div className="space-y-1">
                <Label className="text-xs">Alertar o gestor quando a nota for abaixo de</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={threshold}
                  onChange={(e) => onChange({ poll_nps_low_score_threshold: Number(e.target.value) || 5 })}
                  className="w-24 text-sm"
                />
              </div>
            )}

            {/* 2ª pergunta: encontrou o produto? */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch
                checked={askFound}
                onCheckedChange={(v) => onChange({ poll_nps_ask_found_product: v })}
                id="nps-found"
              />
              <Label htmlFor="nps-found" className="text-xs">
                Perguntar também "Encontrou o produto que procurava?" (Sim/Não)
              </Label>
            </div>

            {/* Notificação in-app */}
            <div className="flex items-center gap-2">
              <Switch
                checked={notifyBad}
                onCheckedChange={(v) => onChange({ poll_nps_notify_on_bad: v })}
                id="nps-notify"
              />
              <Label htmlFor="nps-notify" className="text-xs flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Avisar o gestor no painel quando a nota for baixa
              </Label>
            </div>

            {/* Alerta WhatsApp ao gestor */}
            <div className="flex items-center gap-2">
              <Switch
                checked={alertWhatsapp}
                onCheckedChange={(v) => onChange({ poll_nps_manager_alert_whatsapp: v })}
                id="nps-wa"
              />
              <Label htmlFor="nps-wa" className="text-xs flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Avisar o gestor por WhatsApp (nome + número do cliente + atendente + resumo)
              </Label>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
