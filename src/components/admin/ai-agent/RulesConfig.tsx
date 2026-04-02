import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Clock, Frown, Timer, MessageSquare, SearchX } from 'lucide-react';

interface RulesConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>;
}

export function RulesConfig({ config, onChange, fieldErrors }: RulesConfigProps) {
  return (
    <div className="space-y-6">
      {/* Mensagem de transbordo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Mensagem de Transbordo
          </CardTitle>
          <CardDescription>Mensagem enviada ao lead quando a IA transfere para atendente humano</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.handoff_message || ''}
            onChange={(e) => onChange({ handoff_message: e.target.value })}
            placeholder="Só um instante que vou te encaminhar para nosso consultor de vendas."
            className="min-h-[60px] resize-none"
          />
          <p className="text-[11px] text-muted-foreground mt-2">Enviada dentro do horario comercial. Deixe vazio para usar a mensagem padrao.</p>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Mensagem fora do horario comercial</Label>
            <Textarea
              value={config.handoff_message_outside_hours || ''}
              onChange={(e) => onChange({ handoff_message_outside_hours: e.target.value })}
              placeholder="Sua mensagem foi recebida e retornaremos assim que possivel!"
              className="min-h-[60px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground">Enviada fora do horario ou em dias fechados.</p>
          </div>
        </CardContent>
      </Card>

      {/* Gatilhos de transbordo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Gatilhos de Transbordo (por texto)
          </CardTitle>
          <CardDescription>Palavras-chave que acionam transferência imediata para atendente humano</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={(config.handoff_triggers || []).join('\n')}
            onChange={(e) => onChange({ handoff_triggers: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })}
            placeholder={"atendente\nhumano\ngerente\nfalar com pessoa\nreclamação"}
            className="min-h-[100px] resize-none font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Uma palavra/frase por linha. Se o lead usar qualquer uma, a IA transfere imediatamente.</p>
        </CardContent>
      </Card>

      {/* Limites automáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Limites Automáticos
          </CardTitle>
          <CardDescription>Forçam transbordo mesmo sem gatilho de texto. Defina 0 para desativar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Máx. minutos de conversa com IA</Label>
              <Input
                type="number" min={0} max={120}
                value={config.handoff_max_conversation_minutes || 15}
                onChange={(e) => onChange({ handoff_max_conversation_minutes: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-muted-foreground">Recomendado: 15-30 min. 0 = sem limite.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cooldown após handoff (minutos)</Label>
              <Input
                type="number" min={5} max={1440}
                value={config.handoff_cooldown_minutes || 30}
                onChange={(e) => onChange({ handoff_cooldown_minutes: parseInt(e.target.value) || 30 })}
              />
              {fieldErrors?.handoff_cooldown_minutes && <p className="text-destructive text-xs mt-1">{fieldErrors.handoff_cooldown_minutes}</p>}
              <p className="text-[11px] text-muted-foreground">IA fica "dormindo" por este período. Max: 1440 (24h).</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Max. mensagens do lead antes do handoff</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={config.max_lead_messages ?? 8}
              onChange={(e) => onChange({ max_lead_messages: parseInt(e.target.value) || 8 })}
            />
            {fieldErrors?.max_lead_messages && <p className="text-destructive text-xs mt-1">{fieldErrors.max_lead_messages}</p>}
            <p className="text-xs text-muted-foreground">Após esse número de mensagens, transfere automaticamente para humano (1-50)</p>
          </div>
        </CardContent>
      </Card>

      {/* Qualificação antes do transbordo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SearchX className="w-4 h-4 text-primary" />
            Qualificacao de Produtos
          </CardTitle>
          <CardDescription>Controle quantas perguntas o agente faz antes e depois de buscar produtos no catalogo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Perguntas antes de buscar (termos genericos)</Label>
            <Input
              type="number" min={0} max={5}
              value={config.max_pre_search_questions ?? 3}
              onChange={(e) => onChange({ max_pre_search_questions: parseInt(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground">
              Quando o lead pede algo generico ("tinta", "piso"), o agente qualifica na ordem: ambiente → marca → cor/especificacao. 0 = busca imediata sem qualificar. Recomendado: 3.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tentativas quando produto nao encontrado</Label>
            <Input
              type="number" min={0} max={5}
              value={config.max_qualification_retries ?? 2}
              onChange={(e) => onChange({ max_qualification_retries: parseInt(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground">
              Quando a busca retorna 0 resultados, o agente faz perguntas adicionais antes de transferir. 0 = transfere imediatamente. Recomendado: 2.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Perguntas de enriquecimento (apos busca sem resultado)</Label>
            <Input
              type="number" min={0} max={5}
              value={config.max_enrichment_questions ?? 2}
              onChange={(e) => onChange({ max_enrichment_questions: parseInt(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground">
              Quando o lead ja qualificou (ex: tinta + interno + rosa) mas o produto nao foi encontrado, o agente faz perguntas extras (acabamento, marca) para enriquecer dados antes de transferir. O vendedor recebe a cadeia completa. 0 = transfere imediatamente. Recomendado: 2.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sentimento negativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Frown className="w-4 h-4 text-warning" />
            Detecção de Sentimento Negativo
          </CardTitle>
          <CardDescription>Transfere automaticamente quando detectar frustração, irritação ou insatisfação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Ativar detecção automática</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Palavras como "absurdo", "demora", "péssimo" acionam transbordo</p>
            </div>
            <Switch
              checked={config.handoff_negative_sentiment ?? true}
              onCheckedChange={(v) => onChange({ handoff_negative_sentiment: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horário comercial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            Horário Comercial
          </CardTitle>
          <CardDescription>Defina o horário de funcionamento e a mensagem fora do expediente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Abertura</Label>
              <Input
                type="time"
                value={config.business_hours?.start || '08:00'}
                onChange={(e) => onChange({ business_hours: { ...config.business_hours, start: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fechamento</Label>
              <Input
                type="time"
                value={config.business_hours?.end || '18:00'}
                onChange={(e) => onChange({ business_hours: { ...config.business_hours, end: e.target.value } })}
              />
            </div>
          </div>
          {config.business_hours?.start && config.business_hours?.end && config.business_hours.end <= config.business_hours.start && (
            <p className="text-[11px] text-destructive font-medium">Horário de fechamento deve ser após a abertura.</p>
          )}
          <p className="text-[11px] text-muted-foreground">Fora deste horário, a IA envia a mensagem abaixo em vez de atender.</p>
          <Textarea
            value={config.out_of_hours_message || ''}
            onChange={(e) => onChange({ out_of_hours_message: e.target.value })}
            placeholder="Estamos fora do horário de atendimento. Retornaremos em breve!"
            className="min-h-[60px] resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
