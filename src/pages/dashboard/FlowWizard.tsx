import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useInstances } from '@/hooks/useInstances'
import { useInboxes } from '@/hooks/useInboxes'
import { useCreateFlow, generateSlug } from '@/hooks/useFlows'
import { useCreateFlowTrigger } from '@/hooks/useFlowTriggers'
import { TriggerFormSheet } from '@/components/flows/TriggerFormSheet'
import { TRIGGER_TYPE_LABELS, FLOW_MODE_LABELS } from '@/types/flows'
import type { FlowMode, TriggerType } from '@/types/flows'
import type { TriggerFormData } from '@/components/flows/TriggerFormSheet'
import { FLOW_TEMPLATES } from '@/data/flowTemplates'

const STEPS = ['Identidade', 'Configuração', 'Gatilhos', 'Publicar']

interface LocalTrigger extends TriggerFormData {
  _id: string
}

export default function FlowWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')
  const { isSuperAdmin } = useAuth()
  const { instances } = useInstances()
  const { inboxes } = useInboxes()

  const [step, setStep] = useState(0)

  // Etapa 1 — Identidade
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [inboxId, setInboxId] = useState('')

  // Etapa 2 — Config
  const [mode, setMode] = useState<FlowMode>('active')
  const [isDefault, setIsDefault] = useState(false)
  const [funnelId, setFunnelId] = useState('')

  // Etapa 3 — Gatilhos
  const [triggers, setTriggers] = useState<LocalTrigger[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<LocalTrigger | null>(null)

  // Etapa 4 — Publicar
  const [publishNow, setPublishNow] = useState(true)

  const createFlow = useCreateFlow()
  const createTrigger = useCreateFlowTrigger()

  // Preenche instância padrão
  useEffect(() => {
    if (instances?.length && !instanceId) {
      setInstanceId(instances[0].id)
    }
  }, [instances])

  // Inboxes filtradas pela instância selecionada
  const filteredInboxes = inboxes?.filter((inbox) => inbox.instance_id === instanceId) ?? []

  // Limpa inbox quando instância muda
  const handleInstanceChange = (value: string) => {
    setInstanceId(value)
    setInboxId('')
  }

  // Pré-popula do template
  useEffect(() => {
    if (templateId) {
      const tpl = FLOW_TEMPLATES.find((t) => t.id === templateId)
      if (tpl) {
        setName(tpl.name)
        setSlug(generateSlug(tpl.name))
        setDescription(tpl.description)
        // Pré-popula triggers do template
        const preloaded: LocalTrigger[] = tpl.triggers_preview.map((t, i) => ({
          _id: `tpl-${i}`,
          trigger_type: t.type,
          trigger_config: {},
          priority: 50 - i * 10,
          cooldown_minutes: 0,
          activation: 'always',
        }))
        setTriggers(preloaded)
      }
    }
  }, [templateId])

  // Slug auto-gerado ao digitar nome
  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(generateSlug(value))
  }

  // Canproceed por etapa
  const canProceed = () => {
    if (step === 0) return name.trim().length >= 2 && slug.trim().length >= 2 && !!instanceId
    if (step === 1) return !!mode
    return true
  }

  // Adicionar / editar trigger na lista local
  const handleSaveTrigger = (data: TriggerFormData) => {
    if (editingTrigger) {
      setTriggers((prev) =>
        prev.map((t) => (t._id === editingTrigger._id ? { ...data, _id: t._id } : t)),
      )
    } else {
      setTriggers((prev) => [...prev, { ...data, _id: `local-${Date.now()}` }])
    }
    setEditingTrigger(null)
    setSheetOpen(false)
  }

  const handleRemoveTrigger = (id: string) => {
    setTriggers((prev) => prev.filter((t) => t._id !== id))
  }

  // Criar fluxo
  const handleCreate = async () => {
    const flow = await createFlow.mutateAsync({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      instance_id: instanceId,
      inbox_id: inboxId && inboxId !== 'all' ? inboxId : null,
      mode,
      is_default: isDefault,
      funnel_id: funnelId || null,
      status: 'active',
      published_at: publishNow ? new Date().toISOString() : null,
      config: {},
    })

    // Cria triggers
    for (const t of triggers) {
      await createTrigger.mutateAsync({
        flow_id: flow.id,
        instance_id: instanceId,
        trigger_type: t.trigger_type,
        trigger_config: t.trigger_config,
        priority: t.priority,
        cooldown_minutes: t.cooldown_minutes,
        activation: t.activation,
      })
    }

    navigate(`/dashboard/flows/${flow.id}`)
  }

  const isCreating = createFlow.isPending || createTrigger.isPending

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-1 text-muted-foreground"
          onClick={() => (step === 0 ? navigate('/dashboard/flows/new') : setStep((s) => s - 1))}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 0 ? 'Voltar' : STEPS[step - 1]}
        </Button>

        {/* Progress */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    i < step
                      ? 'bg-primary text-primary-foreground'
                      : i === step
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 mt-[-12px] ${i < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Etapa 1: Identidade ── */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Identidade do fluxo</h2>

            <div className="space-y-1.5">
              <Label>Nome do fluxo <span className="text-destructive">*</span></Label>
              <Input
                placeholder="SDR Comercial"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Slug (URL) <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="sdr-comercial"
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Identificador único. Gerado automaticamente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Qualifica leads e agenda demonstrações do produto"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Instância <span className="text-destructive">*</span></Label>
              <Select value={instanceId} onValueChange={handleInstanceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances?.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Caixa de entrada</Label>
              <Select
                value={inboxId}
                onValueChange={setInboxId}
                disabled={!instanceId || filteredInboxes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !instanceId
                        ? 'Selecione a instância primeiro'
                        : filteredInboxes.length === 0
                        ? 'Nenhuma caixa nesta instância'
                        : 'Todas as caixas (opcional)'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as caixas</SelectItem>
                  {filteredInboxes.map((inbox) => (
                    <SelectItem key={inbox.id} value={inbox.id}>
                      {inbox.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. Restringe o fluxo a uma caixa específica da instância.
              </p>
            </div>
          </div>
        )}

        {/* ── Etapa 2: Configuração ── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Configuração</h2>

            <div className="space-y-2">
              <Label>Modo de operação <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FLOW_MODE_LABELS) as FlowMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${
                      mode === m
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{FLOW_MODE_LABELS[m]}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {m === 'active' && 'Responde automaticamente'}
                      {m === 'assistant' && 'Sugere respostas ao atendente'}
                      {m === 'shadow' && 'Observa sem responder'}
                      {m === 'off' && 'Desativado'}
                    </div>
                    {m === 'shadow' && mode === 'shadow' && (
                      <div className="text-xs text-yellow-700 mt-1 font-medium">
                        ⚠ A IA não responderá ao lead
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Fluxo padrão da instância</p>
                <p className="text-xs text-muted-foreground">
                  Leads sem fluxo específico usarão este
                </p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>
        )}

        {/* ── Etapa 3: Gatilhos ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Gatilhos</h2>
              <Button size="sm" variant="outline" onClick={() => { setEditingTrigger(null); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {triggers.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhum gatilho. O fluxo não será ativado automaticamente.
                </p>
                <Button size="sm" onClick={() => { setEditingTrigger(null); setSheetOpen(true) }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar gatilho
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {triggers.map((t) => (
                  <div
                    key={t._id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {TRIGGER_TYPE_LABELS[t.trigger_type as TriggerType] ?? t.trigger_type}
                      </Badge>
                      {t.trigger_type === 'keyword' && Array.isArray(t.trigger_config.keywords) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {(t.trigger_config.keywords as string[]).join(', ')}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">P:{t.priority}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setEditingTrigger(t); setSheetOpen(true) }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleRemoveTrigger(t._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <TriggerFormSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              trigger={editingTrigger}
              onSave={handleSaveTrigger}
            />
          </div>
        )}

        {/* ── Etapa 4: Publicar ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Publicar</h2>

            {/* Resumo */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modo</span>
                <span className="font-medium">{FLOW_MODE_LABELS[mode]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instância</span>
                <span className="font-medium">
                  {instances?.find((i) => i.id === instanceId)?.name ?? instanceId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixa de entrada</span>
                <span className="font-medium">
                  {inboxId && inboxId !== 'all'
                    ? (inboxes?.find((b) => b.id === inboxId)?.name ?? inboxId)
                    : 'Todas'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gatilhos</span>
                <span className="font-medium">{triggers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fluxo padrão</span>
                <span className="font-medium">{isDefault ? 'Sim' : 'Não'}</span>
              </div>
            </div>

            {/* Publicar agora ou rascunho */}
            <div className="space-y-2">
              {[
                { value: true, label: 'Publicar agora', desc: 'O fluxo entra em operação imediatamente' },
                { value: false, label: 'Salvar como rascunho', desc: 'Você publica manualmente depois' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setPublishNow(opt.value)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                    publishNow === opt.value ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate('/dashboard/flows/new') : setStep((s) => s - 1))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              {STEPS[step + 1]}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isCreating || triggers.length === 0} title={triggers.length === 0 ? 'Adicione ao menos um gatilho para publicar' : undefined}>
              {isCreating ? 'Criando...' : 'Criar Fluxo'}
              <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
