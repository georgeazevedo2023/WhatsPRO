import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { SubagentType } from '@/types/flows'

interface StepConfigFormProps {
  subagentType: SubagentType
  config: Record<string, unknown>
  onChange: (newConfig: Record<string, unknown>) => void
}

export function StepConfigForm({ subagentType, config, onChange }: StepConfigFormProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  switch (subagentType) {
    case 'greeting':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mensagem de saudação (novo lead)</Label>
            <Textarea
              value={(config.greeting_message as string) ?? ''}
              onChange={(e) => set('greeting_message', e.target.value)}
              placeholder="Olá! Bem-vindo. Como posso ajudar?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem para lead retornante</Label>
            <Textarea
              value={(config.known_lead_message as string) ?? ''}
              onChange={(e) => set('known_lead_message', e.target.value)}
              placeholder="Olá {nome}! Que bom te ver de volta."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem para pedir o nome</Label>
            <Input
              value={(config.ask_name_message as string) ?? ''}
              onChange={(e) => set('ask_name_message', e.target.value)}
              placeholder="Para te atender melhor, qual é o seu nome?"
            />
          </div>
        </div>
      )

    case 'qualification': {
      const fields =
        (config.fields as Array<{
          field_name: string
          field_type: string
          required: boolean
        }>) ?? []
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Modo</Label>
            <Select
              value={(config.mode as string) ?? 'fixed'}
              onValueChange={(v) => set('mode', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Sequencial (fixed)</SelectItem>
                <SelectItem value="adaptive">Adaptativo (IA escolhe ordem)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Campos</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() =>
                  set('fields', [...fields, { field_name: '', field_type: 'text', required: true }])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            </div>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="nome_campo"
                  value={f.field_name}
                  onChange={(e) => {
                    const updated = [...fields]
                    updated[i] = { ...f, field_name: e.target.value }
                    set('fields', updated)
                  }}
                  className="text-sm"
                />
                <Select
                  value={f.field_type}
                  onValueChange={(v) => {
                    const updated = [...fields]
                    updated[i] = { ...f, field_type: v }
                    set('fields', updated)
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'text',
                      'email',
                      'phone',
                      'select',
                      'boolean',
                      'scale_1_5',
                      'scale_1_10',
                      'nps',
                      'currency_brl',
                    ].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive shrink-0"
                  onClick={() => set('fields', fields.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Ação pós-qualificação</Label>
            <Select
              value={(config.post_action as string) ?? 'next_step'}
              onValueChange={(v) => set('post_action', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_step">Avançar para próximo step</SelectItem>
                <SelectItem value="handoff">Transferir para atendente</SelectItem>
                <SelectItem value="tag_and_close">Marcar tag e encerrar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }

    case 'sales':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Máximo de produtos por resposta</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={(config.max_products as number) ?? 5}
              onChange={(e) => set('max_products', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Falhas de busca antes de handoff</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={(config.search_fail_threshold as number) ?? 3}
              onChange={(e) => set('search_fail_threshold', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ação pós-vendas</Label>
            <Select
              value={(config.post_action as string) ?? 'handoff'}
              onValueChange={(v) => set('post_action', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="handoff">Transferir para atendente</SelectItem>
                <SelectItem value="next_step">Avançar para próximo step</SelectItem>
                <SelectItem value="tag_and_close">Encerrar com tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'support':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Confiança mínima para responder (0–1)</Label>
            <Input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={(config.confidence_threshold as number) ?? 0.5}
              onChange={(e) => set('confidence_threshold', parseFloat(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Perguntas sem resposta antes de handoff</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={(config.unanswered_limit as number) ?? 2}
              onChange={(e) => set('unanswered_limit', parseInt(e.target.value))}
            />
          </div>
        </div>
      )

    case 'survey': {
      const options = (config.options as string[]) ?? []
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título da enquete</Label>
            <Input
              value={(config.title as string) ?? ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Como foi sua experiência?"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Opções ({options.length}/12)</Label>
              {options.length < 12 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => set('options', [...options, ''])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const updated = [...options]
                    updated[i] = e.target.value
                    set('options', updated)
                  }}
                  placeholder={`Opção ${i + 1}`}
                  className="text-sm"
                />
                {options.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 text-destructive shrink-0"
                    onClick={() => set('options', options.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 2 && (
              <p className="text-xs text-destructive">Mínimo 2 opções</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Prefixo de tag (ex: nps → nps:Ótimo!)</Label>
            <Input
              value={(config.tag_prefix as string) ?? ''}
              onChange={(e) => set('tag_prefix', e.target.value)}
              placeholder="nps"
            />
          </div>
        </div>
      )
    }

    case 'followup':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Delay em horas</Label>
            <Input
              type="number"
              min={1}
              max={720}
              value={(config.delay_hours as number) ?? 24}
              onChange={(e) => set('delay_hours', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem (suporta {'{nome}'} e {'{produto}'})</Label>
            <Textarea
              value={(config.message as string) ?? ''}
              onChange={(e) => set('message', e.target.value)}
              placeholder="Oi {nome}! Voltando sobre o produto que você viu..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ação após envio</Label>
            <Select
              value={(config.post_action as string) ?? 'next_step'}
              onValueChange={(v) => set('post_action', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_step">Avançar step</SelectItem>
                <SelectItem value="complete">Concluir fluxo</SelectItem>
                <SelectItem value="handoff">Transferir para atendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'handoff':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mensagem ao lead</Label>
            <Textarea
              value={(config.message as string) ?? ''}
              onChange={(e) => set('message', e.target.value)}
              placeholder="Conectando com um atendente... Aguarde um momento!"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Departamento</Label>
            <Input
              value={(config.department as string) ?? ''}
              onChange={(e) => set('department', e.target.value)}
              placeholder="Vendas, Suporte, Financeiro..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tag adicional (ex: handoff:vendas)</Label>
            <Input
              value={(config.tag as string) ?? ''}
              onChange={(e) => set('tag', e.target.value)}
              placeholder="handoff:vendas"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Incluir contexto completo</p>
              <p className="text-xs text-muted-foreground">Qualificação, produtos vistos, histórico</p>
            </div>
            <Switch
              checked={(config.include_context as boolean) ?? true}
              onCheckedChange={(v) => set('include_context', v)}
            />
          </div>
        </div>
      )

    case 'custom':
    default:
      return (
        <div className="space-y-1.5">
          <Label>Configuração JSON</Label>
          <Textarea
            value={JSON.stringify(config, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value))
              } catch {
                // ignore invalid JSON while typing
              }
            }}
            rows={10}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            JSON do step_config enviado diretamente ao subagente
          </p>
        </div>
      )
  }
}
