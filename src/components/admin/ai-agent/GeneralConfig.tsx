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
              placeholder="Olá! Bem-vindo a [Empresa], com quem eu falo?"
              className="min-h-[80px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground">Dica: incluir "com quem eu falo?" ajuda o agente a coletar o nome do lead para personalizar o atendimento.</p>
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

      {/* Mensagem de Acolhimento (Lead Retornando) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            Mensagem de Acolhimento (Lead Retornando)
          </CardTitle>
          <CardDescription>
            Enviada quando um lead conhecido (que ja forneceu o nome) retorna em uma nova conversa.
            Use <code className="text-xs bg-muted px-1 rounded">{'{nome}'}</code> para personalizar com o nome do lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem de Acolhimento</Label>
            <Textarea
              value={config.returning_greeting_message || ''}
              onChange={(e) => onChange({ returning_greeting_message: e.target.value })}
              placeholder="Olá {nome}! Que bom te ver aqui de novo 😊 Em que posso te ajudar hoje?"
              className="min-h-[60px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Variavel disponivel: <code className="bg-muted px-1 rounded">{'{nome}'}</code> = nome do lead.
              Deixe vazio para usar o padrao.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-primary mb-2">Preview — Novo lead:</p>
            <div className="bg-card rounded-lg px-3 py-2 text-sm max-w-[70%] border border-border">
              {config.greeting_message || 'Olá! Como posso ajudá-lo?'}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-500 mb-2">Preview — Lead retornando:</p>
            <div className="bg-card rounded-lg px-3 py-2 text-sm max-w-[70%] border border-emerald-500/20">
              {(config.returning_greeting_message || 'Olá {nome}! Que bom te ver aqui de novo 😊 Em que posso te ajudar hoje?').replace(/\{nome\}/gi, 'Carlos')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
