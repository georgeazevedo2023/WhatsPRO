import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, MessageSquare } from 'lucide-react';

interface Instance { id: string; name: string; status: string }

interface GeneralConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  instances: Instance[];
}

export function GeneralConfig({ config, onChange, instances }: GeneralConfigProps) {
  return (
    <div className="space-y-6">
      {/* Ativar / Vincular instância */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Configuração do Agente
          </CardTitle>
          <CardDescription>Defina o nome, ative e vincule a uma instância WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Agente ativo</Label>
              <p className="text-xs text-muted-foreground">O agente responderá automaticamente as conversas</p>
            </div>
            <Switch
              checked={config.enabled || false}
              onCheckedChange={(enabled) => onChange({ enabled })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Agente</Label>
              <Input
                value={config.name || ''}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Assistente Vendas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instância WhatsApp</Label>
              <Select value={config.instance_id || ''} onValueChange={(v) => onChange({ instance_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name} {inst.status === 'connected' ? '🟢' : '🔴'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saudação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Mensagem de Saudação
          </CardTitle>
          <CardDescription>Mensagem obrigatória enviada na primeira interação com o lead</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Saudação *</Label>
            <Textarea
              value={config.greeting_message || ''}
              onChange={(e) => onChange({ greeting_message: e.target.value })}
              placeholder="Olá! 👋 Sou o assistente virtual da [Empresa]. Como posso ajudá-lo?"
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Personalidade / Tom de Voz</Label>
            <Input
              value={config.personality || ''}
              onChange={(e) => onChange({ personality: e.target.value })}
              placeholder="Profissional, simpático e objetivo"
            />
            <p className="text-[11px] text-muted-foreground">Ex: "Informal e descontraído", "Formal e corporativo", "Técnico e detalhista"</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {config.greeting_message && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-primary mb-2">Preview da saudação:</p>
            <div className="bg-card rounded-lg px-3 py-2 text-sm max-w-[70%] border border-border">
              {config.greeting_message}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
