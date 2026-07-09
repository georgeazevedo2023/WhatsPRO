import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Database,
  Plus,
  GitMerge,
  Search,
  Settings2,
  Pencil,
  Trash2,
  Users,
  Calendar,
  FolderOpen,
  MessageCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBR } from '@/lib/dateUtils';
import EditDatabaseDialog from '@/components/broadcast/EditDatabaseDialog';
import ManageLeadDatabaseDialog from '@/components/broadcast/ManageLeadDatabaseDialog';
import MergeDatabasesDialog from '@/components/broadcast/MergeDatabasesDialog';
import type { LeadDatabase } from '@/components/broadcast/leadDatabaseTypes';

const LeadDatabases = () => {
  const [databases, setDatabases] = useState<LeadDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [manageTarget, setManageTarget] = useState<LeadDatabase | null>(null);
  const [editTarget, setEditTarget] = useState<LeadDatabase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadDatabase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  // Create empty database
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchDatabases = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('lead_databases')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDatabases((data || []) as LeadDatabase[]);
    } catch (error) {
      console.error('Error fetching databases:', error);
      toast.error('Erro ao carregar bases de leads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const filtered = useMemo(() => {
    if (!search.trim()) return databases;
    const s = search.toLowerCase();
    return databases.filter(
      (d) => d.name.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s)
    );
  }, [databases, search]);

  const totalContacts = useMemo(
    () => databases.reduce((sum, d) => sum + (d.leads_count || 0), 0),
    [databases]
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('lead_databases')
        .insert({
          user_id: userId,
          name: newName.trim(),
          description: newDescription.trim() || null,
          leads_count: 0,
        })
        .select()
        .single();
      if (error) throw error;

      setDatabases((prev) => [data as LeadDatabase, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      toast.success('Base criada');
    } catch (error) {
      console.error('Error creating database:', error);
      toast.error('Erro ao criar base');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDatabaseUpdated = (updated: LeadDatabase) => {
    setDatabases((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('lead_databases').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDatabases((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success('Base removida');
    } catch (error) {
      console.error('Error deleting database:', error);
      toast.error('Erro ao remover base');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            Bases de Leads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas listas de contatos do Disparador — edite, organize e una bases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowMerge(true)}
            disabled={databases.length < 2}
          >
            <GitMerge className="w-4 h-4 mr-2" />
            Unir bases
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova base
          </Button>
        </div>
      </div>

      {/* Summary + search */}
      {!isLoading && databases.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar base por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <Badge variant="secondary">{databases.length} base{databases.length !== 1 ? 's' : ''}</Badge>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {totalContacts} contato{totalContacts !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : databases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium text-muted-foreground">Nenhuma base de leads</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma base para organizar seus contatos.
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova base
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma base encontrada para "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((db) => (
            <Card key={db.id} className="glass-card-hover">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{db.name}</h3>
                      {db.instance_id && (
                        <Badge variant="outline" className="flex items-center gap-1 shrink-0 text-xs">
                          <MessageCircle className="w-3 h-3" />
                          Helpdesk
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {db.leads_count} contato{db.leads_count !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatBR(db.updated_at, "dd 'de' MMM, yyyy")}
                      </span>
                    </div>
                    {db.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{db.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setManageTarget(db)}
                  >
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Gerenciar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Renomear"
                    onClick={() => setEditTarget(db)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Excluir"
                    onClick={() => setDeleteTarget(db)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create empty database */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova base de leads</DialogTitle>
            <DialogDescription className="sr-only">Formulario para criar uma nova base de leads do Disparador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-db-name">Nome</Label>
              <Input
                id="new-db-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Clientes Caruaru"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-db-desc">Descrição (opcional)</Label>
              <Textarea
                id="new-db-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Descrição..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={isCreating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newName.trim()}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditDatabaseDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        database={editTarget}
        onSave={handleDatabaseUpdated}
      />

      <ManageLeadDatabaseDialog
        open={!!manageTarget}
        onOpenChange={(o) => !o && setManageTarget(null)}
        database={manageTarget}
        onDatabaseUpdated={(updated) => {
          handleDatabaseUpdated(updated);
          setManageTarget(updated);
        }}
      />

      <MergeDatabasesDialog open={showMerge} onOpenChange={setShowMerge} onDone={fetchDatabases} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remover base de leads?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente a base "{deleteTarget?.name}" e todos os{' '}
              {deleteTarget?.leads_count} contatos. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadDatabases;
