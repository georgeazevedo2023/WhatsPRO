import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mic } from 'lucide-react';

interface VoiceConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function VoiceConfig({ config, onChange }: VoiceConfigProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Resposta por Áudio (TTS)
          </CardTitle>
          <CardDescription>
            Quando ativado, se o lead enviar áudio, o agente responde com áudio.
            Respostas acima do limite de caracteres são enviadas como texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Ativar TTS (Text-to-Speech)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Gemini gera áudio para respostas curtas</p>
            </div>
            <Switch
              checked={config.voice_enabled || false}
              onCheckedChange={(v) => onChange({ voice_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Responder áudio com áudio</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando o lead enviar áudio, o agente responde em áudio (mesmo sem TTS global ativado)
              </p>
            </div>
            <Switch
              checked={config.voice_reply_to_audio ?? true}
              onCheckedChange={(v) => onChange({ voice_reply_to_audio: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho máximo para áudio (caracteres)</Label>
            <Input
              type="number" min={50} max={500}
              value={config.voice_max_text_length || 150}
              onChange={(e) => onChange({ voice_max_text_length: parseInt(e.target.value) || 150 })}
            />
            <p className="text-[11px] text-muted-foreground">
              Respostas com até {config.voice_max_text_length || 150} caracteres são enviadas como áudio.
              Acima disso, envia como texto. Recomendado: 150.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
