import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Settings2 } from 'lucide-react';

interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function BrainConfig({ config, onChange }: BrainConfigProps) {
  return (
    <div className="space-y-6">
      {/* Prompt principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            Prompt do Orquestrador
          </CardTitle>
          <CardDescription>Instruções principais que guiam o comportamento do agente em todas as interações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt</Label>
            <Textarea
              value={config.system_prompt || ''}
              onChange={(e) => onChange({ system_prompt: e.target.value })}
              placeholder={`Você é um assistente de vendas especializado em [segmento].

Seu objetivo é:
1. Qualificar o interesse do lead
2. Apresentar produtos relevantes
3. Responder dúvidas com base no catálogo
4. Transferir para atendente quando necessário

Informações da empresa:
- Nome: [Empresa]
- Horário: Seg-Sex 8h-18h
- Endereço: [Endereço]
- WhatsApp do gerente: [Número]`}
              className="min-h-[200px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {(config.system_prompt || '').length} caracteres — Quanto mais detalhado, melhor o agente se comporta
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Parâmetros do modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Parâmetros do Modelo
          </CardTitle>
          <CardDescription>Ajuste o modelo e criatividade das respostas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Select value={config.model || 'gemini-2.5-flash'} onValueChange={(v) => onChange({ model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (rápido, econômico)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (avançado)</SelectItem>
                  <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Tokens</Label>
              <Input
                type="number"
                value={config.max_tokens || 1024}
                onChange={(e) => onChange({ max_tokens: parseInt(e.target.value) || 1024 })}
                min={100}
                max={8192}
              />
              <p className="text-[11px] text-muted-foreground">Tamanho máximo da resposta (100-8192)</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Temperatura: {(config.temperature || 0.7).toFixed(1)}</Label>
              <span className="text-[11px] text-muted-foreground">
                {(config.temperature || 0.7) <= 0.3 ? 'Preciso' : (config.temperature || 0.7) >= 0.8 ? 'Criativo' : 'Balanceado'}
              </span>
            </div>
            <Slider
              value={[config.temperature || 0.7]}
              onValueChange={([v]) => onChange({ temperature: v })}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 — Determinístico</span>
              <span>1 — Criativo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Debounce (segundos)</Label>
              <Input
                type="number"
                value={config.debounce_seconds || 10}
                onChange={(e) => onChange({ debounce_seconds: parseInt(e.target.value) || 10 })}
                min={3}
                max={30}
              />
              <p className="text-[11px] text-muted-foreground">Tempo de espera para agrupar mensagens (3-30s)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contexto (mensagens)</Label>
              <Input
                type="number"
                value={config.context_short_messages || 10}
                onChange={(e) => onChange({ context_short_messages: parseInt(e.target.value) || 10 })}
                min={3}
                max={50}
              />
              <p className="text-[11px] text-muted-foreground">Últimas N mensagens enviadas ao modelo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
