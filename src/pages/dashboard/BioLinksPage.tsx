import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, Eye, Link2, Loader2, MousePointerClick, Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useInstances } from '@/hooks/useInstances'
import { useAuth } from '@/contexts/AuthContext'
import { useBioPagesList, useDeleteBioPage, useUpdateBioPage, useBioAnalytics } from '@/hooks/useBioPages'
import { BioLinkCard } from '@/components/bio/BioLinkCard'
import { BioLinkEditor } from '@/components/bio/BioLinkEditor'
import type { BioPage } from '@/types/bio'

export default function BioLinksPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth()

  if (!authLoading && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const { toast } = useToast()
  const { instances, loading: instancesLoading } = useInstances()

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editPageId, setEditPageId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BioPage | null>(null)

  // Auto-select first instance
  useEffect(() => {
    if (instances && instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id)
    }
  }, [instances, selectedInstanceId])

  const { data: pages = [], isLoading } = useBioPagesList(selectedInstanceId)
  const deletePage = useDeleteBioPage()
  const updatePage = useUpdateBioPage()
  const { data: analytics, isLoading: analyticsLoading } = useBioAnalytics(selectedInstanceId)

  function handleEdit(id: string) {
    setEditPageId(id)
    setEditorOpen(true)
  }

  function handleNew() {
    setEditPageId(null)
    setEditorOpen(true)
  }

  async function handleDelete(page: BioPage) {
    setDeleteTarget(null)
    try {
      await deletePage.mutateAsync({ id: page.id, instanceId: page.instance_id })
      toast({ description: 'Página excluída.' })
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  async function handleToggleStatus(page: BioPage) {
    const newStatus = page.status === 'archived' ? 'active' : 'archived'
    try {
      await updatePage.mutateAsync({ id: page.id, status: newStatus })
      toast({
        description: newStatus === 'active' ? 'Página reativada.' : 'Página arquivada.',
      })
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  const filtered = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (authLoading) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Bio Link
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Páginas públicas tipo Linktree com botões rastreáveis
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Nova página Bio
        </Button>
      </div>

      {/* Instance selector */}
      {instances && instances.length > 1 && (
        <Select
          value={selectedInstanceId ?? ''}
          onValueChange={setSelectedInstanceId}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Instância" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                {inst.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue="paginas">
        <TabsList className="rounded-full bg-muted/60 h-9">
          <TabsTrigger value="paginas" className="rounded-full text-xs px-4">Páginas</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full text-xs px-4 gap-1.5">
            <BarChart3 size={13} /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Páginas ── */}
        <TabsContent value="paginas" className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar páginas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading || instancesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Link2 size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">
                  {search ? 'Nenhuma página encontrada' : 'Nenhuma página Bio criada'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search
                    ? 'Tente outro termo de busca.'
                    : 'Crie sua primeira página para compartilhar no Instagram, TikTok e mais.'}
                </p>
              </div>
              {!search && (
                <Button onClick={handleNew} variant="outline">
                  <Plus size={14} className="mr-1" /> Criar primeira página
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((page) => (
                <BioLinkCard
                  key={page.id}
                  page={page}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Analytics ── */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !analytics ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Nenhum dado disponível.</p>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total de Visualizações
                    </CardTitle>
                    <Eye size={16} className="text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{analytics.totalViews.toLocaleString('pt-BR')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total de Cliques
                    </CardTitle>
                    <MousePointerClick size={16} className="text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{analytics.totalClicks.toLocaleString('pt-BR')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Leads Capturados
                    </CardTitle>
                    <Users size={16} className="text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{analytics.totalLeads.toLocaleString('pt-BR')}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela por página */}
              {analytics.rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Por página</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Página</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Views</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cliques</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Leads</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.rows.map((row) => (
                            <tr key={row.page.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium truncate max-w-[200px]">{row.page.title}</p>
                                  <p className="text-xs text-muted-foreground">/bio/{row.page.slug}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">{row.views.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-3 text-right">{row.clicks.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-3 text-right">{row.leads.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-medium ${row.ctr >= 20 ? 'text-green-600' : row.ctr >= 10 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                  {row.ctr}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor sheet */}
      {selectedInstanceId && (
        <BioLinkEditor
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false)
            setEditPageId(null)
          }}
          editPageId={editPageId}
          instanceId={selectedInstanceId}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir página Bio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
