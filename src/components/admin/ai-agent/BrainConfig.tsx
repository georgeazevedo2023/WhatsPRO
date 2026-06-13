import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BrainCircuit, Settings2, Brain } from 'lucide-react';

interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>;
}

export function BrainConfig({ config, onChange, fieldErrors }: BrainConfigProps) {
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
              <Select value={config.model || 'gpt-5-mini'} onValueChange={(v) => onChange({ model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5-mini">GPT-5 Mini (recomendado — rápido, instruction-following melhor)</SelectItem>
                  <SelectItem value="gpt-5-nano">GPT-5 Nano (ultra-rápido, ideal pra router/classify)</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (legado)</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (legado)</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1 (legado, mais caro)</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (fallback)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (avançado)</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.model && <p className="text-destructive text-xs mt-1">{fieldErrors.model}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Tokens</Label>
              <Input
                type="number"
                value={config.max_tokens || 1024}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onChange({ max_tokens: v });
                }}
                min={100}
                max={8192}
              />
              {fieldErrors?.max_tokens && <p className="text-destructive text-xs mt-1">{fieldErrors.max_tokens}</p>}
              <p className="text-[11px] text-muted-foreground">Tamanho máximo da resposta (100-8192)</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Modelo dos Specialists (router)</Label>
            <Select value={config.specialist_model || 'gpt-4.1'} onValueChange={(v) => onChange({ specialist_model: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4.1">GPT-4.1 (recomendado — não vaza tool call como texto)</SelectItem>
                <SelectItem value="gpt-5-mini">GPT-5 Mini (rápido)</SelectItem>
                <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (mais barato — pode vazar tool call)</SelectItem>
                <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (legado)</SelectItem>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors?.specialist_model && <p className="text-destructive text-xs mt-1">{fieldErrors.specialist_model}</p>}
            <p className="text-[11px] text-muted-foreground">
              Modelo usado pelos specialists (produto, qualificação, objeção, handoff) quando o agente está em <span className="font-medium">Modo de roteamento = router</span>. Sem efeito no modo monolito.
            </p>
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
            {fieldErrors?.temperature && <p className="text-destructive text-xs mt-1">{fieldErrors.temperature}</p>}
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
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onChange({ debounce_seconds: Math.min(30, Math.max(3, v)) });
                }}
                min={3}
                max={30}
              />
              <p className="text-[11px] text-muted-foreground">Tempo de espera para agrupar mensagens (3-30s)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Historico da Conversa Atual</Label>
              <Input
                type="number"
                value={config.context_short_messages || 10}
                onChange={(e) => onChange({ context_short_messages: parseInt(e.target.value) || 10 })}
                min={3}
                max={50}
              />
              <p className="text-[11px] text-muted-foreground">Quantas mensagens recentes o agente consegue "ver" da conversa atual</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Memoria do Lead */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Memoria do Lead
          </CardTitle>
          <CardDescription>Quando ativo, o agente lembra nome, cidade, interesses, historico de compras e objecoes de conversas anteriores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Lembrar informacoes de conversas anteriores</Label>
              <p className="text-[11px] text-muted-foreground">Quando desativado, cada conversa comeca do zero.</p>
            </div>
            <Switch
              checked={config.context_long_enabled !== false}
              onCheckedChange={(v) => onChange({ context_long_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
