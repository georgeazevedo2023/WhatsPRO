import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Search,
  User,
  Trash2,
  Plus,
  Loader2,
  UserPlus,
  Users,
  Pencil,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';

interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
  instance_id?: string | null;
}

interface LeadEntry {
  id: string;
  phone: string;
  name: string | null;
  jid: string;
  source: string | null;
  group_name: string | null;
  is_verified: boolean | null;
  verified_name: string | null;
  verification_status: string | null;
}

interface ManageLeadDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: LeadDatabase | null;
  onDatabaseUpdated: (updated: LeadDatabase) => void;
}

const ITEMS_PER_PAGE = 30;

// formatPhoneForDisplay imported from shared utils

const ManageLeadDatabaseDialog = ({
  open,
  onOpenChange,
  database,
  onDatabaseUpdated,
}: ManageLeadDatabaseDialogProps) => {
  const [entries, setEntries] = useState<LeadEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit metadata
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Add contact
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<LeadEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!database) return;
    setIsLoading(true);
    try {
      // Paginated fetch to get all entries
      const allEntries: LeadEntry[] = [];
      const BATCH = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from('lead_database_entries')
          .select('*')
          .eq('database_id', database.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH - 1);
        if (batchError) throw batchError;
        allEntries.push(...(batch || []) as LeadEntry[]);
        hasMore = (batch || []).length === BATCH;
        offset += BATCH;
      }
      const data = allEntries;
      const error = null;

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  useEffect(() => {
    if (open && database) {
      fetchEntries();
      setSearch('');
      setCurrentPage(1);
      setShowAddForm(false);
      setIsEditingMeta(false);
      setEditName(database.name);
      setEditDescription(database.description || '');
    }
  }, [open, database, fetchEntries]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const s = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.phone.includes(search) ||
        e.name?.toLowerCase().includes(s) ||
        e.verified_name?.toLowerCase().includes(s) ||
        e.group_name?.toLowerCase().includes(s)
    );
  }, [entries, search]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEntries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEntries, currentPage]);

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const updateLeadsCount = async (newCount: number) => {
    if (!database) return;
    await supabase
      .from('lead_databases')
      .update({ leads_count: newCount })
      .eq('id', database.id);
    onDatabaseUpdated({ ...database, leads_count: newCount });
  };

  const handleSaveMeta = async () => {
    if (!database || !editName.trim()) return;
    setIsSavingMeta(true);
    try {
      const { error } = await supabase
        .from('lead_databases')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
        })
        .eq('id', database.id);

      if (error) throw error;
      onDatabaseUpdated({
        ...database,
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setIsEditingMeta(false);
      toast.success('Base atualizada');
    } catch (error) {
      console.error('Error updating database:', error);
      toast.error('Erro ao atualizar base');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleAddContact = async () => {
    if (!database || !newPhone.trim()) return;

    const cleanPhone = newPhone.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    // Check duplicates
    const exists = entries.some((e) => e.phone === cleanPhone);
    if (exists) {
      toast.error('Este número já existe na base');
      return;
    }

    const jid = cleanPhone.startsWith('55')
      ? `${cleanPhone}@s.whatsapp.net`
      : `55${cleanPhone}@s.whatsapp.net`;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('lead_database_entries')
        .insert({
          database_id: database.id,
          phone: cleanPhone,
          name: newName.trim() || null,
          jid,
          source: 'manual',
          is_verified: false,
        })
        .select()
        .single();

      if (error) throw error;

      setEntries((prev) => [data, ...prev]);
      await updateLeadsCount(entries.length + 1);
      setNewPhone('');
      setNewName('');
      toast.success('Contato adicionado');
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error('Erro ao adicionar contato');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteTarget || !database) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('lead_database_entries')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      const newEntries = entries.filter((e) => e.id !== deleteTarget.id);
      setEntries(newEntries);
      await updateLeadsCount(newEntries.length);
      toast.success('Contato removido');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Erro ao remover contato');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!database) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gerenciar Base de Leads
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Database metadata */}
            {isEditingMeta ? (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome da base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Descrição..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingMeta(false)}
                    disabled={isSavingMeta}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveMeta}
                    disabled={!editName.trim() || isSavingMeta}
                  >
                    {isSavingMeta ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{database.name}</h3>
                  {database.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {database.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {entries.length} contato{entries.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setEditName(database.name);
                    setEditDescription(database.description || '');
                    setIsEditingMeta(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Add contact toggle */}
            {showAddForm ? (
              <div className="space-y-3 p-3 border rounded-lg border-dashed">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Adicionar Contato</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowAddForm(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Telefone (ex: 5581999999999)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Nome (opcional)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddContact}
                    disabled={!newPhone.trim() || isAdding}
                    className="shrink-0"
                  >
                    {isAdding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar contato manualmente
              </Button>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Counter */}
            <div className="text-xs text-muted-foreground">
              {search && filteredEntries.length !== entries.length
                ? `${filteredEntries.length} de ${entries.length} contatos`
                : `${entries.length} contato${entries.length !== 1 ? 's' : ''}`}
            </div>

            {/* Contact list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 border rounded-lg">
                <div className="p-2 space-y-1">
                  {paginatedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {entry.verified_name ||
                            entry.name ||
                            formatPhoneForDisplay(entry.phone)}
                        </p>
                        {(entry.verified_name || entry.name) && (
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneForDisplay(entry.phone)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {entry.source && entry.source !== 'manual' && entry.source !== 'paste' && (
                          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                            {entry.source === 'group'
                              ? entry.group_name || 'Grupo'
                              : entry.source === 'helpdesk'
                              ? 'Helpdesk'
                              : entry.source}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {filteredEntries.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {search
                          ? 'Nenhum contato encontrado'
                          : 'Base vazia. Adicione contatos acima.'}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length)}{' '}
                  de {filteredEntries.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs px-2 text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover{' '}
              <strong>
                {deleteTarget?.name ||
                  formatPhoneForDisplay(deleteTarget?.phone || '')}
              </strong>{' '}
              desta base de leads. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageLeadDatabaseDialog;
