import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFunnelsList, useFunnelKPIs, useDeleteFunnel, useUpdateFunnel } from '@/hooks/useFunnels';
import { ImportExistingDialog } from '@/components/funnels/ImportExistingDialog';
import { FUNNEL_TYPE_CONFIGS, FUNNEL_STATUS_CONFIG } from '@/types/funnels';
import type { FunnelWithMetrics, FunnelStatus } from '@/types/funnels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Target,
  Plus,
  Search,
  MoreVertical,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Megaphone,
  Link2,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export default function FunnelsPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { data: funnels, isLoading } = useFunnelsList();
  const { data: kpis } = useFunnelKPIs();
  const deleteFunnel = useDeleteFunnel();
  const updateFunnel = useUpdateFunnel();

  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const filteredFunnels = (funnels || []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.type.toLowerCase().includes(search.toLowerCase())
  );

  const totalLeads = filteredFunnels.reduce((sum, f) => sum + f.lead_count, 0);

  const handleToggleStatus = (funnel: FunnelWithMetrics) => {
    const newStatus: FunnelStatus = funnel.status === 'active' ? 'paused' : 'active';
    updateFunnel.mutate({ id: funnel.id, status: newStatus });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteFunnel.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Funis
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie funis de captacao integrados com Campanhas, Bio Link e Formularios.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Importar existente
          </Button>
          <Button onClick={() => navigate('/dashboard/funnels/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Funil
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Funis Ativos</p>
              <p className="text-2xl font-bold">{kpis?.activeFunnels ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Leads</p>
              <p className="text-2xl font-bold">{totalLeads}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Funis</p>
              <p className="text-2xl font-bold">{kpis?.totalFunnels ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Funnel Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-48" />
            </Card>
          ))}
        </div>
      ) : filteredFunnels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum funil criado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Crie seu primeiro funil para unificar Campanhas, Bio Link e Formularios em uma jornada guiada.
            </p>
            <Button onClick={() => navigate('/dashboard/funnels/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Funil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFunnels.map((funnel) => {
            const typeConfig = FUNNEL_TYPE_CONFIGS[funnel.type];
            const statusConfig = FUNNEL_STATUS_CONFIG[funnel.status];

            return (
              <Card
                key={funnel.id}
                className="hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/dashboard/funnels/${funnel.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeConfig?.icon || '🎯'}</span>
                      <div>
                        <CardTitle className="text-base">{funnel.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {typeConfig?.label || funnel.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusConfig?.color}>
                        {statusConfig?.label || funnel.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/funnels/${funnel.id}`); }}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleStatus(funnel); }}>
                            {funnel.status === 'active' ? (
                              <><Pause className="w-4 h-4 mr-2" />Pausar</>
                            ) : (
                              <><Play className="w-4 h-4 mr-2" />Retomar</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(funnel.id); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Lead count */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{funnel.lead_count}</span>
                      <span className="text-muted-foreground">leads</span>
                    </div>
                  </div>

                  {/* Resource badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {funnel.campaign_id && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Megaphone className="w-3 h-3" />
                        {funnel.campaign_name || 'Campanha'}
                      </Badge>
                    )}
                    {funnel.bio_page_id && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Link2 className="w-3 h-3" />
                        {funnel.bio_page_title || 'Bio Link'}
                      </Badge>
                    )}
                    {funnel.form_id && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <FileText className="w-3 h-3" />
                        {funnel.form_name || 'Formulario'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import existing dialog */}
      <ImportExistingDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
            <AlertDialogDescription>
              O funil sera excluido, mas os recursos vinculados (campanha, bio link, formulario) continuarao existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
