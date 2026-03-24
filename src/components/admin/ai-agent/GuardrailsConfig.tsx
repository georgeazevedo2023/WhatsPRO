import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldOff, Ban, Percent } from 'lucide-react';

interface GuardrailsConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function GuardrailsConfig({ config, onChange }: GuardrailsConfigProps) {
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
        </CardContent>
      </Card>
    </div>
  );
}
