import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
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
  Trash2,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  X,
  Loader2,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { FieldEditor } from './FieldEditor'
import { FormPreview } from './FormPreview'
import { useUpdateForm, useUpsertFormFields } from '@/hooks/useForms'
import type { WhatsappForm, FormField, FieldType } from '@/types/forms'

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftField = Omit<FormField, 'id' | 'form_id' | 'created_at'>
type ActiveTab = 'fields' | 'settings' | 'preview'

interface FormBuilderProps {
  form: WhatsappForm
  onClose: () => void
}

// ─── Field type icon map (small icons for list) ───────────────────────────────

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  short_text:   <Type size={13} />,
  long_text:    <AlignLeft size={13} />,
  number:       <Hash size={13} />,
  scale:        <SlidersHorizontal size={13} />,
  email:        <Mail size={13} />,
  phone:        <Phone size={13} />,
  cpf:          <CreditCard size={13} />,
  cep:          <MapPin size={13} />,
  date:         <Calendar size={13} />,
  time:         <Clock size={13} />,
  select:       <ChevronDown size={13} />,
  multi_select: <CheckSquare size={13} />,
  yes_no:       <ToggleLeft size={13} />,
  file:         <Paperclip size={13} />,
  location:     <Navigation size={13} />,
  signature:    <PenTool size={13} />,
}

const FIELD_LABELS: Record<FieldType, string> = {
  short_text:   'Texto curto',
  long_text:    'Texto longo',
  number:       'Número',
  scale:        'Escala',
  email:        'E-mail',
  phone:        'Telefone',
  cpf:          'CPF',
  cep:          'CEP',
  date:         'Data',
  time:         'Horário',
  select:       'Seleção única',
  multi_select: 'Múltipla escolha',
  yes_no:       'Sim/Não',
  file:         'Arquivo',
  location:     'Localização',
  signature:    'Assinatura',
}

// ─── Settings type ────────────────────────────────────────────────────────────

interface FormSettings {
  welcome_message: string
  completion_message: string
  webhook_url: string
  max_submissions: string
  expires_at: string
}

// ─── Tab labels ───────────────────────────────────────────────────────────────

const TAB_LABELS: Record<ActiveTab, string> = {
  fields: 'Campos',
  settings: 'Configurações',
  preview: 'Preview',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FormBuilder({ form, onClose }: FormBuilderProps) {
  const [fields, setFields] = useState<DraftField[]>([])
  const [settings, setSettings] = useState<FormSettings>({
    welcome_message: form.welcome_message,
    completion_message: form.completion_message,
    webhook_url: form.webhook_url ?? '',
    max_submissions: form.max_submissions != null ? String(form.max_submissions) : '',
    expires_at: form.expires_at ? form.expires_at.slice(0, 16) : '',
  })
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('fields')
  const [activePanelMobile, setActivePanelMobile] = useState<'fields' | 'editor'>('fields')

  const updateForm = useUpdateForm()
  const upsertFields = useUpsertFormFields()
  const isSaving = updateForm.isPending || upsertFields.isPending

  // Initialise fields from form data
  useEffect(() => {
    if (form.form_fields && form.form_fields.length > 0) {
      const draft: DraftField[] = form.form_fields
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(({ id: _id, form_id: _fid, created_at: _cat, ...rest }) => rest)
      setFields(draft)
    } else {
      setFields([])
    }
    setSelectedFieldIndex(null)
  }, [form.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field helpers ────────────────────────────────────────────────────────

  function addField() {
    const newField: DraftField = {
      position: fields.length,
      field_type: 'short_text',
      label: 'Nova pergunta',
      required: true,
      validation_rules: null,
      error_message: null,
      skip_if_known: false,
      field_key: 'campo_' + (fields.length + 1),
    }
    setFields((prev) => [...prev, newField])
    setSelectedFieldIndex(fields.length)
    setActivePanelMobile('editor')
  }

  function moveField(index: number, direction: 'up' | 'down') {
    setFields((prev) => {
      const next = [...prev]
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
      return next.map((f, i) => ({ ...f, position: i }))
    })
    setSelectedFieldIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return direction === 'up' ? index - 1 : index + 1
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      if (prev === swapIdx) return index
      return prev
    })
  }

  function deleteField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, position: i })))
    setSelectedFieldIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
  }

  function updateField(index: number, updates: Partial<DraftField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    try {
      await updateForm.mutateAsync({
        id: form.id,
        agentId: form.agent_id,
        updates: {
          welcome_message: settings.welcome_message,
          completion_message: settings.completion_message,
          webhook_url: settings.webhook_url || null,
          max_submissions: settings.max_submissions ? Number(settings.max_submissions) : null,
          expires_at: settings.expires_at ? new Date(settings.expires_at).toISOString() : null,
        },
      })
      await upsertFields.mutateAsync({
        formId: form.id,
        fields: fields.map((f, i) => ({ ...f, position: i })),
      })
      toast.success('Formulário salvo com sucesso!')
    } catch {
      // Errors are handled inside the mutation hooks via toast
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold truncate">{form.name}</h2>
            {form.template_type && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {form.template_type}
              </Badge>
            )}
            <Badge
              variant={form.status === 'active' ? 'default' : 'outline'}
              className="text-xs shrink-0"
            >
              {form.status === 'active' ? 'Ativo' : form.status === 'draft' ? 'Rascunho' : 'Arquivado'}
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="gap-1.5 shrink-0"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Salvar
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* ── Tabs (pill style) ── */}
      <div className="flex items-center gap-1 border-b px-4 py-2 bg-background/50">
        {(['fields', 'settings', 'preview'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-150',
              activeTab === tab
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {/* FIELDS tab */}
        {activeTab === 'fields' && (
          <div className="flex h-full flex-col sm:flex-row sm:divide-x">
            {/* Mobile sub-tab switcher (pill style) — visible only on small screens */}
            <div className="flex items-center gap-1 border-b sm:hidden shrink-0 px-3 py-2 bg-muted/30">
              {(['fields', 'editor'] as const).map((panel) => (
                <button
                  key={panel}
                  onClick={() => setActivePanelMobile(panel)}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-150',
                    activePanelMobile === panel
                      ? 'bg-background text-foreground shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {panel === 'fields' ? 'Campos' : 'Editor'}
                </button>
              ))}
            </div>

            {/* Left: field list */}
            <div
              className={cn(
                'flex flex-col sm:w-1/2',
                activePanelMobile === 'fields' ? 'flex' : 'hidden sm:flex',
              )}
            >
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 p-3">
                  {fields.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Type size={28} className="opacity-40" />
                      <p className="text-sm">Nenhum campo ainda</p>
                    </div>
                  )}
                  {fields.map((field, idx) => (
                    <FieldListItem
                      key={idx}
                      field={field}
                      index={idx}
                      total={fields.length}
                      isSelected={selectedFieldIndex === idx}
                      onSelect={() => {
                        setSelectedFieldIndex(selectedFieldIndex === idx ? null : idx)
                        setActivePanelMobile('editor')
                      }}
                      onMoveUp={() => moveField(idx, 'up')}
                      onMoveDown={() => moveField(idx, 'down')}
                      onDelete={() => deleteField(idx)}
                    />
                  ))}
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-3">
                <button
                  onClick={addField}
                  className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-primary/20 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors duration-150"
                >
                  <Plus size={14} />
                  Adicionar Campo
                </button>
              </div>
            </div>

            {/* Right: field editor */}
            <div
              className={cn(
                'flex flex-col sm:w-1/2',
                activePanelMobile === 'editor' ? 'flex' : 'hidden sm:flex',
              )}
            >
              {selectedFieldIndex !== null && fields[selectedFieldIndex] ? (
                <ScrollArea className="flex-1">
                  <FieldEditor
                    field={fields[selectedFieldIndex]}
                    onChange={(updates) => updateField(selectedFieldIndex, updates)}
                  />
                </ScrollArea>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
                  <ChevronDown size={28} className="opacity-30" />
                  <p className="text-sm text-center">
                    Selecione um campo à esquerda para editar
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS tab */}
        {activeTab === 'settings' && (
          <ScrollArea className="h-full">
            <div className="space-y-5 p-5 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="welcome-msg">Mensagem de boas-vindas</Label>
                <Textarea
                  id="welcome-msg"
                  rows={3}
                  placeholder="Olá! Vou te fazer algumas perguntas rápidas. 😊"
                  value={settings.welcome_message}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, welcome_message: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="completion-msg">Mensagem de conclusão</Label>
                <Textarea
                  id="completion-msg"
                  rows={3}
                  placeholder="Obrigado pelas suas respostas! Entraremos em contato em breve. ✅"
                  value={settings.completion_message}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, completion_message: e.target.value }))
                  }
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">
                  Webhook URL{' '}
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://meuservidor.com/webhook"
                  value={settings.webhook_url}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, webhook_url: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Será chamado com um POST ao receber nova submissão.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-submissions">
                  Máximo de submissões{' '}
                  <span className="text-xs text-muted-foreground">(deixe vazio para ilimitado)</span>
                </Label>
                <Input
                  id="max-submissions"
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={settings.max_submissions}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, max_submissions: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expires-at">
                  Expira em{' '}
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={settings.expires_at}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, expires_at: e.target.value }))
                  }
                />
              </div>
            </div>
          </ScrollArea>
        )}

        {/* PREVIEW tab */}
        {activeTab === 'preview' && (
          <ScrollArea className="h-full">
            <div className="p-5 max-w-sm mx-auto">
              <FormPreview
                welcomeMessage={settings.welcome_message}
                fields={fields}
                completionMessage={settings.completion_message}
              />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

// ─── FieldListItem ────────────────────────────────────────────────────────────

interface FieldListItemProps {
  field: DraftField
  index: number
  total: number
  isSelected: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function FieldListItem({
  field,
  index,
  total,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: FieldListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer rounded-xl border transition-all duration-200 active:scale-[0.99]',
        isSelected
          ? 'border-primary/30 bg-primary/5 shadow-sm'
          : 'border-transparent bg-muted/40 hover:bg-muted/60 hover:border-border/40',
      )}
    >
      {/* Main row: badge + icon + label + delete */}
      <div className="flex items-start gap-2.5 px-3 py-3">
        {/* Position badge */}
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {index + 1}
        </span>

        {/* Type icon */}
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {FIELD_ICONS[field.field_type]}
        </span>

        {/* Label + type — wraps freely, no truncation */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{field.label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{FIELD_LABELS[field.field_type]}</p>
        </div>

        {/* Delete — always visible, right-aligned */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20"
            onClick={onDelete}
            title="Remover campo"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Action bar — up/down — only when selected */}
      {isSelected && (
        <div
          className="flex items-center justify-end gap-1 border-t border-border/30 px-2 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp size={12} />
            Subir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDownIcon size={12} />
            Descer
          </Button>
        </div>
      )}
    </div>
  )
}
