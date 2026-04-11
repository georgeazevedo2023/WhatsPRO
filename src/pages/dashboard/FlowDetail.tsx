import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Plus, Trash2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFlow, useUpdateFlow, usePublishFlow, usePauseFlow, generateSlug } from '@/hooks/useFlows'
import {
  useFlowTriggers,
  useCreateFlowTrigger,
  useUpdateFlowTrigger,
  useDeleteFlowTrigger,
} from '@/hooks/useFlowTriggers'
import { FlowModeBadge } from '@/components/flows/FlowModeBadge'
import { TriggerFormSheet } from '@/components/flows/TriggerFormSheet'
import { TRIGGER_TYPE_LABELS, FLOW_MODE_LABELS } from '@/types/flows'
import type { FlowMode, FlowTrigger, TriggerType } from '@/types/flows'
import type { TriggerFormData } from '@/components/flows/TriggerFormSheet'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function FlowDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('identidade')

  const { data: flow, isLoading } = useFlow(id)
  const { data: triggers = [] } = useFlowTriggers(id)
  const updateFlow = useUpdateFlow()
  const publishFlow = usePublishFlow()
  const pauseFlow = usePauseFlow()
  const createTrigger = useCreateFlowTrigger()
  const updateTrigger = useUpdateFlowTrigger()
  const deleteTrigger = useDeleteFlowTrigger()

  // Identidade — inline edit state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<FlowMode>('active')
  const [isDefault, setIsDefault] = useState(false)
  const [identityDirty, setIdentityDirty] = useState(false)

  // Preenche ao carregar — useEffect reage quando flow chega do servidor
  useEffect(() => {
    if (flow && !identityDirty) {
      setName(flow.name)
      setSlug(flow.slug)
      setDescription(flow.description ?? '')
      setMode(flow.mode as FlowMode)
      setIsDefault(flow.is_default)
    }
  }, [flow])

  // Trigger sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<FlowTrigger | null>(null)

  const handleSaveIdentity = () => {
    if (!id) return
    updateFlow.mutate({
      id,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      mode,
      is_default: isDefault,
    })
    setIdentityDirty(false)
  }

  const handleSaveTrigger = (data: TriggerFormData) => {
    if (!id || !flow) return
    if (editingTrigger) {
      updateTrigger.mutate({ id: editingTrigger.id, ...data })
    } else {
      createTrigger.mutate({
        flow_id: id,
        instance_id: flow.instance_id,
        ...data,
      })
    }
    setEditingTrigger(null)
    setSheetOpen(false)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Fluxo não encontrado.{' '}
        <Button variant="link" onClick={() => navigate('/dashboard/flows')}>
          Voltar
        </Button>
      </div>
    )
  }

  const isPublished = !!flow.published_at && flow.status === 'active'

  return (
    <div className="min-h-screen bg-background">
      {/* Shadow Banner */}
      {flow.mode === 'shadow' && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <strong>MODO SHADOW ATIVO</strong> — A IA está observando mas{' '}
          <strong>NÃO está respondendo</strong> aos leads
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-1 mt-0.5"
              onClick={() => navigate('/dashboard/flows')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{flow.name}</h1>
                <FlowModeBadge mode={flow.mode} />
                <Badge variant="outline" className="text-xs">
                  v{flow.version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isPublished
                  ? `Publicado ${formatDistanceToNow(new Date(flow.published_at!), { addSuffix: true, locale: ptBR })}`
                  : 'Rascunho — não publicado'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {isPublished ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseFlow.mutate(flow.id)}
              >
                Pausar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => publishFlow.mutate(flow.id)}
              >
                Publicar
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="identidade">Identidade</TabsTrigger>
            <TabsTrigger value="gatilhos">
              Gatilhos
              {triggers.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">
                  {triggers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="subagentes">Subagentes</TabsTrigger>
            <TabsTrigger value="publicar">Publicar</TabsTrigger>
          </TabsList>

          {/* ── Tab: Identidade ── */}
          <TabsContent value="identidade" className="mt-4 max-w-lg space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setIdentityDirty(true) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setIdentityDirty(true) }}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setIdentityDirty(true) }}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Modo de operação</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FLOW_MODE_LABELS) as FlowMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setIdentityDirty(true) }}
                    className={`rounded-lg border-2 p-2.5 text-left text-sm transition-colors ${
                      mode === m ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="font-medium text-xs">{FLOW_MODE_LABELS[m]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Fluxo padrão</p>
                <p className="text-xs text-muted-foreground">Leads sem fluxo usam este</p>
              </div>
              <Switch
                checked={isDefault}
                onCheckedChange={(v) => { setIsDefault(v); setIdentityDirty(true) }}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveIdentity}
                disabled={!identityDirty || updateFlow.isPending}
              >
                {updateFlow.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab: Gatilhos ── */}
          <TabsContent value="gatilhos" className="mt-4 max-w-lg space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingTrigger(null); setSheetOpen(true) }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar gatilho
              </Button>
            </div>

            {triggers.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">Nenhum gatilho configurado</p>
                <Button size="sm" onClick={() => { setEditingTrigger(null); setSheetOpen(true) }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar gatilho
                </Button>
              </div>
            ) : (
              triggers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${t.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {TRIGGER_TYPE_LABELS[t.trigger_type as TriggerType] ?? t.trigger_type}
                    </Badge>
                    {t.trigger_type === 'keyword' &&
                      Array.isArray((t.trigger_config as any)?.keywords) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {((t.trigger_config as any).keywords as string[]).join(', ')}
                        </span>
                      )}
                    <span className="text-xs text-muted-foreground shrink-0">P:{t.priority}</span>
                    {t.cooldown_minutes > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        cd:{t.cooldown_minutes}m
                      </span>
                    )}
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
                      onClick={() => deleteTrigger.mutate({ id: t.id, flowId: flow.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <TriggerFormSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              trigger={editingTrigger}
              onSave={handleSaveTrigger}
              loading={createTrigger.isPending || updateTrigger.isPending}
            />
          </TabsContent>

          {/* ── Tab: Subagentes (stub S5+) ── */}
          <TabsContent value="subagentes" className="mt-4">
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
              <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-1">Subagentes</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                A configuração de subagentes estará disponível em S5.
                Greeting, Qualification, Sales e Support serão configuráveis aqui.
              </p>
              <Badge variant="secondary" className="mt-3">Disponível em breve</Badge>
            </div>
          </TabsContent>

          {/* ── Tab: Publicar ── */}
          <TabsContent value="publicar" className="mt-4 max-w-lg space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{flow.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publicado em</span>
                <span className="font-medium">
                  {flow.published_at
                    ? new Date(flow.published_at).toLocaleDateString('pt-BR')
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versão</span>
                <span className="font-medium">v{flow.version}</span>
              </div>
            </div>

            <div className="flex gap-3">
              {isPublished ? (
                <Button
                  variant="outline"
                  onClick={() => pauseFlow.mutate(flow.id)}
                  disabled={pauseFlow.isPending}
                >
                  Pausar fluxo
                </Button>
              ) : (
                <Button
                  onClick={() => publishFlow.mutate(flow.id)}
                  disabled={publishFlow.isPending}
                >
                  {publishFlow.isPending ? 'Publicando...' : 'Publicar agora'}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
