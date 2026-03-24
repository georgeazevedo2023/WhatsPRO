import { useEffect, useState } from 'react';
import type { Instance } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Inbox, Loader2, Users, Trash2, MonitorSmartphone, Link, Copy, Pencil, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigate } from 'react-router-dom';
import ManageInboxUsersDialog from '@/components/dashboard/ManageInboxUsersDialog';

interface InboxWithDetails {
  id: string;
  name: string;
  instance_id: string;
  instance_name: string;
  created_by: string;
  created_at: string;
  member_count: number;
  webhook_url: string | null;
  webhook_outgoing_url: string | null;
}


const InboxManagement = () => {
  const { isSuperAdmin, user } = useAuth();
  const [inboxes, setInboxes] = useState<InboxWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookOutgoingUrl, setWebhookOutgoingUrl] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);

  // Delete dialog
  const [inboxToDelete, setInboxToDelete] = useState<InboxWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manage users dialog
  const [selectedInbox, setSelectedInbox] = useState<InboxWithDetails | null>(null);
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);

  // Edit webhook
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editWebhookValue, setEditWebhookValue] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  // Edit webhook outgoing
  const [editingOutgoingId, setEditingOutgoingId] = useState<string | null>(null);
  const [editOutgoingValue, setEditOutgoingValue] = useState('');
  const [isSavingOutgoing, setIsSavingOutgoing] = useState(false);

  useEffect(() => {
    fetchInboxes();
    fetchInstances();
  }, []);

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchInboxes = async () => {
    try {
      const { data: inboxData, error: inboxError } = await supabase
        .from('inboxes')
        .select('*')
        .order('created_at', { ascending: false });

      if (inboxError) throw inboxError;

      if (!inboxData || inboxData.length === 0) {
        setInboxes([]);
        return;
      }

      // Fetch instance names
      const instanceIds = [...new Set(inboxData.map(i => i.instance_id))];
      const { data: instanceData } = await supabase
        .from('instances')
        .select('id, name')
        .in('id', instanceIds);

      const instanceMap = new Map((instanceData || []).map(i => [i.id, i.name]));

      // Fetch member counts
      const { data: memberData } = await supabase
        .from('inbox_users')
        .select('inbox_id');

      const memberCounts = new Map<string, number>();
      (memberData || []).forEach(m => {
        memberCounts.set(m.inbox_id, (memberCounts.get(m.inbox_id) || 0) + 1);
      });

      const enriched: InboxWithDetails[] = inboxData.map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        instance_id: inbox.instance_id,
        instance_name: instanceMap.get(inbox.instance_id) || 'Instância removida',
        created_by: inbox.created_by,
        created_at: inbox.created_at,
        member_count: memberCounts.get(inbox.id) || 0,
        webhook_url: inbox.webhook_url || null,
        webhook_outgoing_url: inbox.webhook_outgoing_url || null,
      }));

      setInboxes(enriched);
    } catch (error) {
      handleError(error, 'Erro ao carregar caixas de entrada', 'Fetch inboxes');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from('instances')
      .select('id, name, status')
      .order('name');

    if (!error && data) setInstances(data);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !selectedInstanceId) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('inboxes').insert({
        name: newName.trim(),
        instance_id: selectedInstanceId,
        created_by: user!.id,
        webhook_url: webhookUrl.trim() || null,
        webhook_outgoing_url: webhookOutgoingUrl.trim() || null,
      });

      if (error) throw error;

      toast.success('Caixa de entrada criada com sucesso!');
      setIsCreateOpen(false);
      setNewName('');
      setSelectedInstanceId('');
      setWebhookUrl('');
      setWebhookOutgoingUrl('');
      fetchInboxes();
    } catch (error: unknown) {
      handleError(error, 'Erro ao criar caixa de entrada', 'Create inbox');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!inboxToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_inbox', { _inbox_id: inboxToDelete.id });
      if (error) throw error;

      toast.success('Caixa de entrada excluída');
      setInboxToDelete(null);
      fetchInboxes();
    } catch (error: unknown) {
      handleError(error, 'Erro ao excluir caixa de entrada', 'Delete inbox');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveWebhook = async (inboxId: string) => {
    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from('inboxes')
        .update({ webhook_url: editWebhookValue.trim() || null })
        .eq('id', inboxId);
      if (error) throw error;
      toast.success('Webhook URL atualizada!');
      setEditingWebhookId(null);
      fetchInboxes();
    } catch (error: unknown) {
      handleError(error, 'Erro ao atualizar webhook', 'Save webhook');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleSaveOutgoing = async (inboxId: string) => {
    setIsSavingOutgoing(true);
    try {
      const { error } = await supabase
        .from('inboxes')
        .update({ webhook_outgoing_url: editOutgoingValue.trim() || null })
        .eq('id', inboxId);
      if (error) throw error;
      toast.success('Webhook Outgoing atualizada!');
      setEditingOutgoingId(null);
      fetchInboxes();
    } catch (error: unknown) {
      handleError(error, 'Erro ao atualizar webhook outgoing', 'Save outgoing webhook');
    } finally {
      setIsSavingOutgoing(false);
    }
  };

  const filteredInboxes = inboxes.filter(
    (inbox) =>
      inbox.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inbox.instance_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Caixas de Entrada</h1>
          <p className="text-muted-foreground">Gerencie as caixas de entrada do atendimento</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Caixa de Entrada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Caixa de Entrada</DialogTitle>
              <DialogDescription>
                Vincule uma caixa de entrada a uma instância WhatsApp
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inbox-name">Nome *</Label>
                <Input
                  id="inbox-name"
                  placeholder="Ex: Suporte, Vendas..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Instância WhatsApp *</Label>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              inst.status === 'connected' ? 'bg-success' : 'bg-muted-foreground'
                            }`}
                          />
                          {inst.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL (n8n)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL do webhook do n8n que encaminha mensagens da UAZAPI para o HelpDesk
                </p>
              </div>
              <div className="space-y-2">
                <Label>Webhook Outgoing URL (n8n)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/outgoing..."
                  value={webhookOutgoingUrl}
                  onChange={(e) => setWebhookOutgoingUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL que receberá um POST quando um agente responder pelo HelpDesk
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar caixas de entrada..."
            className="pl-9 bg-card/50 backdrop-blur-sm border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredInboxes.length} {filteredInboxes.length === 1 ? 'caixa' : 'caixas'}
        </span>
      </div>

      {/* Grid */}
      {filteredInboxes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Nenhuma caixa de entrada</h3>
          <p className="text-sm text-muted-foreground">Crie a primeira para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInboxes.map((inbox) => (
            <div key={inbox.id} className="relative p-5 rounded-xl glass-card-hover">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{inbox.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MonitorSmartphone className="w-3.5 h-3.5" />
                      <span className="truncate">{inbox.instance_name}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1 shrink-0">
                  <Users className="w-3 h-3" />
                  {inbox.member_count}
                </Badge>
              </div>

              {/* Info */}
              <p className="text-xs text-muted-foreground mb-2">
                Criada em {new Date(inbox.created_at).toLocaleDateString('pt-BR')}
              </p>

              {/* Webhook URL */}
              {editingWebhookId === inbox.id ? (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    className="h-8 text-xs"
                    placeholder="https://seu-n8n.com/webhook/..."
                    value={editWebhookValue}
                    onChange={(e) => setEditWebhookValue(e.target.value)}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-primary"
                    disabled={isSavingWebhook}
                    onClick={() => handleSaveWebhook(inbox.id)}
                  >
                    {isSavingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setEditingWebhookId(null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : inbox.webhook_url ? (
                <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-muted/30">
                  <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {inbox.webhook_url}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(inbox.webhook_url!);
                      toast.success('URL copiada!');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setEditingWebhookId(inbox.id);
                      setEditWebhookValue(inbox.webhook_url || '');
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => {
                      setEditingWebhookId(inbox.id);
                      setEditWebhookValue('');
                    }}
                  >
                    <Link className="w-3 h-3 mr-1.5" />
                    Adicionar Webhook URL
                  </Button>
                </div>
              )}

              {/* Webhook Outgoing URL */}
              {editingOutgoingId === inbox.id ? (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    className="h-8 text-xs"
                    placeholder="https://seu-n8n.com/webhook/outgoing..."
                    value={editOutgoingValue}
                    onChange={(e) => setEditOutgoingValue(e.target.value)}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-primary"
                    disabled={isSavingOutgoing}
                    onClick={() => handleSaveOutgoing(inbox.id)}
                  >
                    {isSavingOutgoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setEditingOutgoingId(null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : inbox.webhook_outgoing_url ? (
                <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-muted/30">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {inbox.webhook_outgoing_url}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(inbox.webhook_outgoing_url!);
                      toast.success('URL copiada!');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setEditingOutgoingId(inbox.id);
                      setEditOutgoingValue(inbox.webhook_outgoing_url || '');
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => {
                      setEditingOutgoingId(inbox.id);
                      setEditOutgoingValue('');
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Adicionar Webhook Outgoing
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedInbox(inbox);
                    setIsManageUsersOpen(true);
                  }}
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  Gerenciar Membros
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setInboxToDelete(inbox)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!inboxToDelete} onOpenChange={(open) => !open && setInboxToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Caixa de Entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{inboxToDelete?.name}</strong>? Todos os membros
              e etiquetas serão removidos. As conversas existentes não serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Users Dialog */}
      {selectedInbox && (
        <ManageInboxUsersDialog
          open={isManageUsersOpen}
          onOpenChange={setIsManageUsersOpen}
          inboxId={selectedInbox.id}
          inboxName={selectedInbox.name}
          onUpdate={fetchInboxes}
        />
      )}
    </div>
  );
};

export default InboxManagement;
