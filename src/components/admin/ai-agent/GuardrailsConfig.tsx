import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldOff, Ban, Percent, ShieldCheck, LayoutGrid } from 'lucide-react';

interface GuardrailsConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>;
}

export function GuardrailsConfig({ config, onChange, fieldErrors }: GuardrailsConfigProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" />
            Tópicos Bloqueados
          </CardTitle>
          <CardDescription>A IA nunca falará sobre estes assuntos. Se perguntada, responderá com uma mensagem genérica.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={(config.blocked_topics || []).join('\n')}
            onChange={(e) => onChange({ blocked_topics: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
            placeholder={"concorrentes\npolítica\nreligião\noutras marcas"}
            className="min-h-[80px] resize-none font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Um tópico por linha.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldOff className="w-4 h-4 text-destructive" />
            Frases Proibidas
          </CardTitle>
          <CardDescription>A IA nunca usará estas frases exatas nas respostas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={(config.blocked_phrases || []).join('\n')}
            onChange={(e) => onChange({ blocked_phrases: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
            placeholder={"garantia vitalícia\nmelhor do mercado\nnão aceitamos reclamação"}
            className="min-h-[80px] resize-none font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            Limite de Desconto
          </CardTitle>
          <CardDescription>Desconto máximo que o agente pode oferecer. Deixe vazio para não permitir descontos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              type="number" min={0} max={100} step={1}
              value={config.max_discount_percent ?? ''}
              onChange={(e) => onChange({ max_discount_percent: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground shrink-0">%</span>
          </div>
          {fieldErrors?.max_discount_percent && <p className="text-destructive text-xs mt-1">{fieldErrors.max_discount_percent}</p>}
        </CardContent>
      </Card>
      {/* Validator Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Agente Validador (Guardrail)
          </CardTitle>
          <CardDescription>
            Um segundo agente IA revisa cada resposta antes de enviar ao lead. Verifica frases proibidas, topicos bloqueados, desconto acima do limite e multiplas perguntas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ativar validacao automatica</Label>
            <Switch
              checked={config.validator_enabled !== false}
              onCheckedChange={(v) => onChange({ validator_enabled: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo do validador</Label>
              <Select value={config.validator_model || 'gpt-4.1-nano'} onValueChange={(v) => onChange({ validator_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (rapido)</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nivel de rigor</Label>
              <Select value={config.validator_rigor || 'moderado'} onValueChange={(v) => onChange({ validator_rigor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderado">Moderado (corrige claras)</SelectItem>
                  <SelectItem value="rigoroso">Rigoroso (qualquer duvida)</SelectItem>
                  <SelectItem value="maximo">Maximo (so nota 10 passa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Adiciona ~300ms de latencia por mensagem. Custo: ~$0.05/1000 msgs.</p>
        </CardContent>
      </Card>

      {/* Carousel Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            Configuracao do Carrossel
          </CardTitle>
          <CardDescription>Personalize o texto e botoes do carrossel enviado pelo agente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto antes dos cards</Label>
            <Input
              value={config.carousel_text || ''}
              onChange={(e) => onChange({ carousel_text: e.target.value })}
              placeholder="Confira nossas opcoes:"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Botao principal</Label>
              <Input
                value={config.carousel_button_1 || ''}
                onChange={(e) => onChange({ carousel_button_1: e.target.value })}
                placeholder="Eu quero!"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Botao secundario (vazio = sem 2o botao)</Label>
              <Input
                value={config.carousel_button_2 || ''}
                onChange={(e) => onChange({ carousel_button_2: e.target.value })}
                placeholder="Mais informacoes"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
