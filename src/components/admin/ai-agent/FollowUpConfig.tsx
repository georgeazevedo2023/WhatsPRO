import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Trash2, Clock, ArrowRight } from 'lucide-react';

interface FollowUpRule {
  days: number;
  message: string;
}

interface FollowUpConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

const DEFAULT_RULES: FollowUpRule[] = [
  { days: 3, message: 'Olá {nome}! Ainda tem interesse em {produto}? Temos condições especiais esta semana!' },
  { days: 7, message: '{nome}, passando para saber se posso ajudar com algo. Estamos à disposição!' },
  { days: 14, message: '{nome}, esta é minha última mensagem. Se precisar de algo, estamos aqui!' },
];

const VARIABLES = [
  { key: '{nome}', desc: 'Nome do lead' },
  { key: '{produto}', desc: 'Produto de interesse' },
  { key: '{dias_sem_contato}', desc: 'Dias sem contato' },
  { key: '{loja}', desc: 'Nome do agente/loja' },
];

export function FollowUpConfig({ config, onChange }: FollowUpConfigProps) {
  const rules: FollowUpRule[] = config.follow_up_rules || [];
  const enabled = config.follow_up_enabled ?? false;

  const updateRules = (newRules: FollowUpRule[]) => {
    // Don't sort on every change — preserve user's ordering intent.
    // Sort only when adding new rules to place them logically.
    onChange({ follow_up_rules: newRules });
  };

  const addRule = () => {
    const lastDay = rules.length > 0 ? Math.max(...rules.map(r => r.days)) : 0;
    const newRules = [...rules, { days: lastDay + 7, message: 'Olá {nome}! Ainda posso te ajudar com algo?' }];
    onChange({ follow_up_rules: newRules.sort((a, b) => a.days - b.days) });
  };

  const removeRule = (index: number) => {
    updateRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof FollowUpRule, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    updateRules(updated);
  };

  const loadDefaults = () => {
    updateRules([...DEFAULT_RULES]);
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Follow-up Automático
          </CardTitle>
          <CardDescription>
            Envia mensagens automaticamente para leads que não responderam após o transbordo.
            A IA é reativada ao enviar o follow-up — se o lead responder, o agente assume normalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Ativar cadência de follow-up</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Executa a cada hora para conversas em modo shadow (pós-handoff)
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => onChange({ follow_up_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Regras de Cadência
            <Badge variant="secondary" className="text-xs">{rules.length} etapa{rules.length !== 1 ? 's' : ''}</Badge>
          </CardTitle>
          <CardDescription>
            Cada regra define após quantos dias sem resposta enviar a mensagem.
            Use variáveis para personalizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma regra configurada</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={loadDefaults}>
                Carregar template padrão (3, 7, 14 dias)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule, i) => (
                <div key={i} className="relative p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">Etapa {i + 1}</Badge>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number" min={1} max={365}
                          value={rule.days}
                          onChange={(e) => updateRule(i, 'days', parseInt(e.target.value) || 1)}
                          className="w-16 h-7 text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground">dias sem resposta</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRule(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={rule.message}
                    onChange={(e) => updateRule(i, 'message', e.target.value)}
                    placeholder="Olá {nome}! Ainda tem interesse em {produto}?"
                    className="min-h-[60px] resize-none text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addRule}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar etapa
          </Button>
        </CardContent>
      </Card>

      {/* Variables reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Variáveis disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {VARIABLES.map(v => (
              <div key={v.key} className="flex items-center gap-2 text-xs">
                <code className="px-1.5 py-0.5 bg-muted rounded font-mono">{v.key}</code>
                <span className="text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline preview */}
      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview da Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <Badge className="bg-emerald-500/15 text-emerald-500 min-w-[70px] justify-center">Dia 0</Badge>
                <span className="text-muted-foreground">Handoff → Vendedor assume → IA em shadow</span>
              </div>
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <Badge variant="outline" className="min-w-[70px] justify-center">Dia {rule.days}</Badge>
                  <span className="truncate">{rule.message.substring(0, 60)}...</span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-xs">
                <Badge className="bg-orange-500/15 text-orange-500 min-w-[70px] justify-center">Dia {rules[rules.length - 1].days}+</Badge>
                <span className="text-muted-foreground">Cadência encerrada — sem mais follow-ups</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
