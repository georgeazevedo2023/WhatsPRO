import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Type,
  AlignLeft,
  Hash,
  SlidersHorizontal,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  CheckSquare,
  ToggleLeft,
  Paperclip,
  Navigation,
  PenTool,
  Plus,
  X,
} from 'lucide-react'
import type { FormField, FieldType, FieldValidationRules } from '@/types/forms'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
}

// ─── Field type metadata ──────────────────────────────────────────────────────

interface FieldMeta {
  label: string
  icon: React.ReactNode
  group: string
}

const FIELD_GROUPS = ['Texto', 'Numérico', 'Contato', 'Data/Hora', 'Escolha', 'Especial'] as const

const FIELD_META: Record<FieldType, FieldMeta> = {
  short_text:   { label: 'Texto curto',       icon: <Type size={14} />,          group: 'Texto' },
  long_text:    { label: 'Texto longo',        icon: <AlignLeft size={14} />,     group: 'Texto' },
  number:       { label: 'Número',             icon: <Hash size={14} />,          group: 'Numérico' },
  scale:        { label: 'Escala 1-10',        icon: <SlidersHorizontal size={14} />, group: 'Numérico' },
  email:        { label: 'E-mail',             icon: <Mail size={14} />,          group: 'Contato' },
  phone:        { label: 'Telefone',           icon: <Phone size={14} />,         group: 'Contato' },
  cpf:          { label: 'CPF',                icon: <CreditCard size={14} />,    group: 'Contato' },
  cep:          { label: 'CEP',                icon: <MapPin size={14} />,        group: 'Contato' },
  date:         { label: 'Data',               icon: <Calendar size={14} />,      group: 'Data/Hora' },
  time:         { label: 'Horário',            icon: <Clock size={14} />,         group: 'Data/Hora' },
  select:       { label: 'Seleção única',      icon: <ChevronDown size={14} />,   group: 'Escolha' },
  multi_select: { label: 'Múltipla escolha',   icon: <CheckSquare size={14} />,   group: 'Escolha' },
  yes_no:       { label: 'Sim/Não',            icon: <ToggleLeft size={14} />,    group: 'Escolha' },
  file:         { label: 'Arquivo',            icon: <Paperclip size={14} />,     group: 'Especial' },
  location:     { label: 'Localização',        icon: <Navigation size={14} />,    group: 'Especial' },
  signature:    { label: 'Assinatura',         icon: <PenTool size={14} />,       group: 'Especial' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftField = Omit<FormField, 'id' | 'form_id' | 'created_at'>

interface FieldEditorProps {
  field: DraftField
  onChange: (updates: Partial<DraftField>) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FieldEditor({ field, onChange }: FieldEditorProps) {
  // Track the last auto-generated key so we only auto-update when user hasn't
  // manually diverged from the auto value.
  const lastAutoKey = useRef<string>(slugify(field.label))

  function handleLabelChange(newLabel: string) {
    const autoKey = slugify(newLabel)
    const updates: Partial<DraftField> = { label: newLabel }
    // Auto-sync field_key only while it still matches the last auto value
    if (field.field_key === lastAutoKey.current) {
      updates.field_key = autoKey
      lastAutoKey.current = autoKey
    }
    onChange(updates)
  }

  function handleFieldKeyChange(newKey: string) {
    lastAutoKey.current = '' // User manually edited — stop auto-sync
    onChange({ field_key: newKey })
  }

  // Reset auto-key tracker when a different field is loaded
  useEffect(() => {
    lastAutoKey.current = slugify(field.label)
  }, [field.field_key]) // eslint-disable-line react-hooks/exhaustive-deps

  function setValidation(patch: Partial<FieldValidationRules>) {
    onChange({ validation_rules: { ...(field.validation_rules ?? {}), ...patch } })
  }

  function getOptions(): string[] {
    return field.validation_rules?.options ?? []
  }

  function handleAddOption() {
    setValidation({ options: [...getOptions(), ''] })
  }

  function handleUpdateOption(idx: number, value: string) {
    const updated = getOptions().map((o, i) => (i === idx ? value : o))
    setValidation({ options: updated })
  }

  function handleRemoveOption(idx: number) {
    setValidation({ options: getOptions().filter((_, i) => i !== idx) })
  }

  const rules = field.validation_rules ?? {}

  return (
    <div className="space-y-5 p-4">
      {/* Field type */}
      <div className="space-y-1.5">
        <Label>Tipo de campo</Label>
        <Select
          value={field.field_type}
          onValueChange={(val) => onChange({ field_type: val as FieldType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_GROUPS.map((group) => (
              <div key={group}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group}
                </div>
                {(Object.entries(FIELD_META) as [FieldType, FieldMeta][])
                  .filter(([, meta]) => meta.group === group)
                  .map(([type, meta]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{meta.icon}</span>
                        {meta.label}
                      </div>
                    </SelectItem>
                  ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label htmlFor="field-label">Pergunta</Label>
        <Input
          id="field-label"
          placeholder="Ex: Qual é o seu nome completo?"
          value={field.label}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </div>

      {/* Required + skip_if_known */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="field-required" className="cursor-pointer">
            Campo obrigatório
          </Label>
          <Switch
            id="field-required"
            checked={field.required}
            onCheckedChange={(checked) => onChange({ required: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="field-skip" className="cursor-pointer text-sm">
            Pular se já cadastrado
          </Label>
          <Switch
            id="field-skip"
            checked={field.skip_if_known}
            onCheckedChange={(checked) => onChange({ skip_if_known: checked })}
          />
        </div>
      </div>

      <Separator />

      {/* Dynamic validation section */}
      <ValidationSection
        fieldType={field.field_type}
        rules={rules}
        setValidation={setValidation}
        options={getOptions()}
        onAddOption={handleAddOption}
        onUpdateOption={handleUpdateOption}
        onRemoveOption={handleRemoveOption}
      />

      <Separator />

      {/* Field key */}
      <div className="space-y-1.5">
        <Label htmlFor="field-key">
          Chave do campo{' '}
          <span className="text-xs text-muted-foreground">(identificador único)</span>
        </Label>
        <Input
          id="field-key"
          className="font-mono text-sm"
          placeholder="nome_completo"
          value={field.field_key}
          onChange={(e) => handleFieldKeyChange(e.target.value)}
        />
      </div>

      {/* Error message */}
      <div className="space-y-1.5">
        <Label htmlFor="field-error">
          Mensagem de erro{' '}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="field-error"
          rows={2}
          placeholder="Ex: Por favor, informe um e-mail válido."
          value={field.error_message ?? ''}
          onChange={(e) =>
            onChange({ error_message: e.target.value || null })
          }
        />
      </div>
    </div>
  )
}

// ─── ValidationSection ────────────────────────────────────────────────────────

interface ValidationSectionProps {
  fieldType: FieldType
  rules: FieldValidationRules
  setValidation: (patch: Partial<FieldValidationRules>) => void
  options: string[]
  onAddOption: () => void
  onUpdateOption: (idx: number, value: string) => void
  onRemoveOption: (idx: number) => void
}

function ValidationSection({
  fieldType,
  rules,
  setValidation,
  options,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: ValidationSectionProps) {
  // Scale: min/max
  if (fieldType === 'scale') {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Configuração da escala</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mínimo</Label>
            <Input
              type="number"
              placeholder="0"
              value={rules.scale_min ?? ''}
              onChange={(e) =>
                setValidation({ scale_min: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Máximo</Label>
            <Input
              type="number"
              placeholder="10"
              value={rules.scale_max ?? ''}
              onChange={(e) =>
                setValidation({ scale_max: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  // Select / multi_select: list of options
  if (fieldType === 'select' || fieldType === 'multi_select') {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Opções de resposta</Label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder={`Opção ${idx + 1}`}
                value={opt}
                onChange={(e) => onUpdateOption(idx, e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveOption(idx)}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddOption}
        >
          <Plus size={14} className="mr-1.5" />
          Adicionar opção
        </Button>
      </div>
    )
  }

  // Number: min / max
  if (fieldType === 'number') {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Intervalo permitido</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mínimo</Label>
            <Input
              type="number"
              placeholder="0"
              value={rules.min ?? ''}
              onChange={(e) =>
                setValidation({ min: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Máximo</Label>
            <Input
              type="number"
              placeholder="999"
              value={rules.max ?? ''}
              onChange={(e) =>
                setValidation({ max: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  // short_text / long_text: max chars
  if (fieldType === 'short_text' || fieldType === 'long_text') {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Máximo de caracteres</Label>
        <Input
          type="number"
          placeholder={fieldType === 'short_text' ? '255' : '2000'}
          value={rules.max ?? ''}
          onChange={(e) =>
            setValidation({ max: e.target.value === '' ? undefined : Number(e.target.value) })
          }
        />
      </div>
    )
  }

  // Signature: expected_value
  if (fieldType === 'signature') {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Texto esperado (confirmação)</Label>
        <Input
          placeholder="Ex: Li e aceito os termos"
          value={rules.expected_value ?? ''}
          onChange={(e) =>
            setValidation({ expected_value: e.target.value || undefined })
          }
        />
      </div>
    )
  }

  // File: allowed types + max size
  if (fieldType === 'file') {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Configuração de arquivo</Label>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Tipos permitidos (separados por vírgula)
          </Label>
          <Input
            placeholder="pdf,jpg,png"
            value={(rules.file_types ?? []).join(',')}
            onChange={(e) =>
              setValidation({
                file_types: e.target.value
                  ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                  : undefined,
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tamanho máximo (MB)</Label>
          <Input
            type="number"
            placeholder="10"
            value={rules.max_size_mb ?? ''}
            onChange={(e) =>
              setValidation({
                max_size_mb: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </div>
      </div>
    )
  }

  // No validation config for: email, phone, cpf, cep, date, time, yes_no, location
  return (
    <p className="text-xs text-muted-foreground">
      Nenhuma configuração adicional para este tipo de campo.
    </p>
  )
}
