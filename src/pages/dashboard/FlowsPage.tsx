import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wand2, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useInstances } from '@/hooks/useInstances'
import {
  useFlowsList,
  usePublishFlow,
  usePauseFlow,
  useDuplicateFlow,
  useArchiveFlow,
} from '@/hooks/useFlows'
import { FlowCard } from '@/components/flows/FlowCard'
import type { FlowWithCounts } from '@/types/flows'

export default function FlowsPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const { instances } = useInstances()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('todos')

  // Usa primeira instância disponível ou undefined para mostrar todos
  const instanceId = instances?.[0]?.id

  const { data: flows = [], isLoading } = useFlowsList(isSuperAdmin ? undefined : instanceId)
  const publishFlow = usePublishFlow()
  const pauseFlow = usePauseFlow()
  const duplicateFlow = useDuplicateFlow()
  const archiveFlow = useArchiveFlow()

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Acesso restrito a administradores
      </div>
    )
  }

  // Shadow banner: algum fluxo em modo shadow?
  const hasShadow = flows.some((f) => f.mode === 'shadow' && f.status === 'active')

  // Filtro por busca
  const searched = flows.filter(
    (f) =>
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase()),
  )

  // Filtro por tab
  const filterByTab = (list: FlowWithCounts[]) => {
    switch (activeTab) {
      case 'ativos':    return list.filter((f) => f.status === 'active' && !!f.published_at)
      case 'rascunho':  return list.filter((f) => !f.published_at || f.status === 'paused')
      case 'shadow':    return list.filter((f) => f.mode === 'shadow')
      case 'arquivados': return list.filter((f) => f.status === 'archived')
      default:          return list.filter((f) => f.status !== 'archived')
    }
  }

  const visible = filterByTab(searched)

  const tabCount = (tab: string) => filterByTab(searched.length ? searched : flows).filter((f) => {
    if (tab === 'ativos') return f.status === 'active' && !!f.published_at
    if (tab === 'rascunho') return !f.published_at || f.status === 'paused'
    if (tab === 'shadow') return f.mode === 'shadow'
    if (tab === 'arquivados') return f.status === 'archived'
    return f.status !== 'archived'
  }).length

  return (
    <div className="space-y-6 p-6">
      {/* Shadow Banner */}
      {hasShadow && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>MODO SHADOW ATIVO</strong> — A IA está observando mas{' '}
            <strong>NÃO está respondendo</strong> aos leads
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6" /> Fluxos
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie seus fluxos de atendimento inteligente
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/flows/new')}>
          <Plus className="h-4 w-4 mr-1" />
          Criar Fluxo
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fluxo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({tabCount('todos')})</TabsTrigger>
          <TabsTrigger value="ativos">Ativos ({tabCount('ativos')})</TabsTrigger>
          <TabsTrigger value="rascunho">Rascunho ({tabCount('rascunho')})</TabsTrigger>
          <TabsTrigger value="shadow">Shadow ({tabCount('shadow')})</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados ({tabCount('arquivados')})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wand2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-1">
                {search ? 'Nenhum fluxo encontrado' : 'Nenhum fluxo criado ainda'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search
                  ? 'Tente buscar por outro nome'
                  : 'Crie seu primeiro fluxo de atendimento inteligente'}
              </p>
              {!search && (
                <Button onClick={() => navigate('/dashboard/flows/new')}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar primeiro fluxo
                </Button>
              )}
            </div>
          )}

          {/* Grid */}
          {!isLoading && visible.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onPublish={(id) => publishFlow.mutate(id)}
                  onPause={(id) => pauseFlow.mutate(id)}
                  onDuplicate={(id) => duplicateFlow.mutate(id)}
                  onArchive={(id) => archiveFlow.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
