import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TRIGGER_GROUPS, TRIGGER_TYPE_LABELS } from '@/types/flows'
import type { FlowTrigger, TriggerType, TriggerActivation } from '@/types/flows'

interface TriggerFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: FlowTrigger | null        // se preenchido, modo edição
  onSave: (data: TriggerFormData) => void
  loading?: boolean
}

export interface TriggerFormData {
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  priority: number
  cooldown_minutes: number
  activation: TriggerActivation
}

const DEFAULT_FORM: TriggerFormData = {
  trigger_type: 'keyword',
  trigger_config: {},
  priority: 50,
  cooldown_minutes: 0,
  activation: 'always',
}

export function TriggerFormSheet({ open, onOpenChange, trigger, onSave, loading }: TriggerFormSheetProps) {
  const [form, setForm] = useState<TriggerFormData>(DEFAULT_FORM)
  const [keywords, setKeywords] = useState('')

  // Preenche o form ao editar
  useEffect(() => {
    if (trigger) {
      const cfg = (trigger.trigger_config as Record<string, unknown>) ?? {}
      setForm({
        trigger_type: trigger.trigger_type as TriggerType,
        trigger_config: cfg,
        priority: trigger.priority,
        cooldown_minutes: trigger.cooldown_minutes,
        activation: trigger.activation as TriggerActivation,
      })
      if (trigger.trigger_type === 'keyword' && Array.isArray(cfg.keywords)) {
        setKeywords((cfg.keywords as string[]).join(', '))
      }
    } else {
      setForm(DEFAULT_FORM)
      setKeywords('')
    }
  }, [trigger, open])

  const handleSave = () => {
    let config = { ...form.trigger_config }

    // Processa keywords → array
    if (form.trigger_type === 'keyword') {
      config = {
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        match: 'any',
      }
    }

    onSave({ ...form, trigger_config: config })
  }

  const canSave =
    form.trigger_type === 'keyword'
      ? keywords.trim().length > 0
      : true

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{trigger ? 'Editar gatilho' : 'Adicionar gatilho'}</SheetTitle>
          <SheetDescription>
            Configure quando este fluxo deve ser ativado
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de gatilho</Label>
            <Select
              value={form.trigger_type}
              onValueChange={(v) => setForm((f) => ({ ...f, trigger_type: v as TriggerType, trigger_config: {} }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TRIGGER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config dinâmica por tipo */}
          {form.trigger_type === 'keyword' && (
            <div className="space-y-1.5">
              <Label>Palavras-chave <span className="text-muted-foreground">(separadas por vírgula)</span></Label>
              <Textarea
                placeholder='oi, olá, bom dia, "quero saber mais"'
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                A mensagem precisa conter pelo menos uma das palavras
              </p>
            </div>
          )}

          {form.trigger_type === 'intent' && (
            <div className="space-y-1.5">
              <Label>Intenção</Label>
              <Select
                value={(form.trigger_config.intent as string) ?? ''}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, trigger_config: { ...f.trigger_config, intent: v, confidence_min: 0.7 } }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a intenção" />
                </SelectTrigger>
                <SelectContent>
                  {['produto', 'orcamento', 'suporte', 'agendamento', 'cancelamento', 'faq', 'promocao'].map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.trigger_type === 'tag_added' && (
            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Input
                placeholder="ex: cliente-vip"
                value={(form.trigger_config.tag as string) ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trigger_config: { ...f.trigger_config, tag: e.target.value } }))
                }
              />
            </div>
          )}

          {(form.trigger_type === 'message_received' ||
            form.trigger_type === 'lead_created' ||
            form.trigger_type === 'conversation_started') && (
            <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
              Este gatilho não requer configuração adicional. Será ativado automaticamente quando o evento ocorrer.
            </p>
          )}

          {/* Prioridade */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Prioridade</Label>
              <span className="text-sm font-medium">{form.priority}</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[form.priority]}
              onValueChange={([v]) => setForm((f) => ({ ...f, priority: v }))}
            />
            <p className="text-xs text-muted-foreground">
              Maior valor = verificado primeiro quando múltiplos gatilhos estão ativos
            </p>
          </div>

          {/* Cooldown */}
          <div className="space-y-1.5">
            <Label>Cooldown (minutos)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-24"
                value={form.cooldown_minutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cooldown_minutes: Math.max(0, Number(e.target.value)) }))
                }
              />
              <span className="text-sm text-muted-foreground">
                {form.cooldown_minutes === 0 ? 'Sem cooldown' : `Reativa após ${form.cooldown_minutes}min`}
              </span>
            </div>
          </div>

          {/* Ativação */}
          <div className="space-y-1.5">
            <Label>Janela de ativação</Label>
            <Select
              value={form.activation}
              onValueChange={(v) => setForm((f) => ({ ...f, activation: v as TriggerActivation }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Sempre</SelectItem>
                <SelectItem value="business_hours">Horário comercial</SelectItem>
                <SelectItem value="outside_hours">Fora do horário comercial</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || loading}>
            <Plus className="h-4 w-4 mr-1" />
            {trigger ? 'Salvar alterações' : 'Adicionar gatilho'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
