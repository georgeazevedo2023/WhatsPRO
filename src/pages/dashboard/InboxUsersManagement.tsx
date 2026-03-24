import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Users, Inbox, Trash2, Loader2, Pencil } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import CreateInboxUserDialog from '@/components/dashboard/CreateInboxUserDialog';
import type { Database } from '@/integrations/supabase/types';

type InboxRole = Database['public']['Enums']['inbox_role'];

const ROLE_LABELS: Record<InboxRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  agente: 'Agente',
};

const ROLE_COLORS: Record<InboxRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  gestor: 'bg-warning/10 text-warning border-warning/20',
  agente: 'bg-muted text-muted-foreground border-border/50',
};

interface InboxMembership {
  inbox_id: string;
  inbox_name: string;
  instance_name: string;
  role: InboxRole;
}

interface InboxUser {
  id: string;
  email: string;
  full_name: string | null;
  memberships: InboxMembership[];
}

const InboxUsersManagement = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<InboxUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [removeMembership, setRemoveMembership] = useState<{ userId: string; inboxId: string; userName: string; inboxName: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<InboxUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editInboxes, setEditInboxes] = useState<Record<string, InboxRole>>({});
  const [allInboxes, setAllInboxes] = useState<{ id: string; name: string; instance_name: string }[]>([]);

  useEffect(() => {
    if (isSuperAdmin) fetchData();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const fetchData = async () => {
    try {
      const [profilesRes, inboxUsersRes, inboxesRes, instancesRes] = await Promise.all([
        supabase.from('user_profiles').select('id, email, full_name'),
        supabase.from('inbox_users').select('user_id, inbox_id, role'),
        supabase.from('inboxes').select('id, name, instance_id'),
        supabase.from('instances').select('id, name'),
      ]);

      const profiles = profilesRes.data || [];
      const inboxUsers = inboxUsersRes.data || [];
      const inboxesList = inboxesRes.data || [];
      const instancesList = instancesRes.data || [];

      const inboxMap = new Map(inboxesList.map((ib) => [ib.id, ib]));
      const instanceMap = new Map(instancesList.map((i) => [i.id, i]));

      setAllInboxes(inboxesList.map(ib => ({
        id: ib.id,
        name: ib.name,
        instance_name: instanceMap.get(ib.instance_id)?.name || '',
      })));

      // Only include users that have at least one inbox membership
      const userIdsWithInbox = new Set(inboxUsers.map((iu) => iu.user_id));

      const result: InboxUser[] = profiles
        .filter((p) => userIdsWithInbox.has(p.id))
        .map((profile) => {
          const memberships: InboxMembership[] = inboxUsers
            .filter((iu) => iu.user_id === profile.id)
            .map((iu) => {
              const inbox = inboxMap.get(iu.inbox_id);
              const instance = inbox ? instanceMap.get(inbox.instance_id) : undefined;
              return {
                inbox_id: iu.inbox_id,
                inbox_name: inbox?.name || 'Desconhecida',
                instance_name: instance?.name || '',
                role: iu.role as InboxRole,
              };
            });

          return {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            memberships,
          };
        });

      setUsers(result);
    } catch (error) {
      console.error('Error fetching inbox users:', error);
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMembership = async () => {
    if (!removeMembership) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from('inbox_users')
        .delete()
        .eq('user_id', removeMembership.userId)
        .eq('inbox_id', removeMembership.inboxId);

      if (error) throw error;
      toast.success('Membro removido da caixa');
      setRemoveMembership(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover membro');
    } finally {
      setIsRemoving(false);
    }
  };

  const openEditUser = (u: InboxUser) => {
    setEditingUser(u);
    setEditName(u.full_name || '');
    setEditEmail(u.email);
    setEditPassword('');
    const inboxMap: Record<string, InboxRole> = {};
    u.memberships.forEach(m => { inboxMap[m.inbox_id] = m.role; });
    setEditInboxes(inboxMap);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    if (!editEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setIsSavingEdit(true);
    try {
      await edgeFunctionFetch('admin-update-user', {
        user_id: editingUser.id,
        email: editEmail.trim(),
        full_name: editName.trim(),
        ...(editPassword ? { password: editPassword } : {}),
      });
      // Sync inbox memberships
      const previousIds = editingUser.memberships.map(m => m.inbox_id);
      const currentIds = new Set(Object.keys(editInboxes));
      const toRemove = previousIds.filter(id => !currentIds.has(id));
      for (const inboxId of toRemove) {
        await supabase.from('inbox_users').delete().eq('user_id', editingUser.id).eq('inbox_id', inboxId);
      }
      for (const [inboxId, role] of Object.entries(editInboxes)) {
        const existing = editingUser.memberships.find(m => m.inbox_id === inboxId);
        if (existing) {
          if (existing.role !== role) {
            await supabase.from('inbox_users').update({ role }).eq('user_id', editingUser.id).eq('inbox_id', inboxId);
          }
        } else {
          await supabase.from('inbox_users').insert({ user_id: editingUser.id, inbox_id: inboxId, role });
        }
      }
      toast.success('Atendente atualizado!');
      setEditingUser(null);
      fetchData();
    } catch (e) {
      handleError(e, 'Erro ao atualizar atendente');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Equipe de Atendimento</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os membros das caixas de entrada</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Membro
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-9 bg-card/50 backdrop-blur-sm border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'membro' : 'membros'}
        </span>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Nenhum membro encontrado</h3>
          <p className="text-sm text-muted-foreground">Crie um novo membro de atendimento para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-5 rounded-xl glass-card-hover">
              {/* User header */}
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-11 h-11 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{user.full_name || 'Sem nome'}</h3>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => openEditUser(user)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>

              {/* Inbox memberships */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Caixas de Entrada</p>
                {user.memberships.map((m) => (
                  <div
                    key={m.inbox_id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{m.inbox_name}</span>
                      {m.instance_name && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">({m.instance_name})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={ROLE_COLORS[m.role]}>
                        {ROLE_LABELS[m.role]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setRemoveMembership({
                            userId: user.id,
                            inboxId: m.inbox_id,
                            userName: user.full_name || user.email,
                            inboxName: m.inbox_name,
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateInboxUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={fetchData}
      />

      {/* Remove membership confirmation */}
      <AlertDialog open={!!removeMembership} onOpenChange={(open) => !open && setRemoveMembership(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro da caixa?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMembership && (
                <>
                  <strong>{removeMembership.userName}</strong> será removido da caixa{' '}
                  <strong>{removeMembership.inboxName}</strong>. Esta ação não exclui a conta do usuário.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMembership}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
            >
              {isRemoving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Atendente</DialogTitle>
            <DialogDescription>Altere nome, email ou senha do atendente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome completo" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="email@exemplo.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" placeholder="Deixe vazio para manter atual" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Caixas de Entrada</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {allInboxes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma caixa disponível</p>
                ) : (
                  allInboxes.map(inbox => {
                    const isChecked = inbox.id in editInboxes;
                    return (
                      <div key={inbox.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            setEditInboxes(prev => {
                              if (e.target.checked) return { ...prev, [inbox.id]: 'agente' };
                              const { [inbox.id]: _, ...rest } = prev;
                              return rest;
                            });
                          }}
                          className="h-4 w-4 rounded border-primary"
                        />
                        <span className="text-sm flex-1 truncate">{inbox.name} <span className="text-muted-foreground">({inbox.instance_name})</span></span>
                        {isChecked && (
                          <Select value={editInboxes[inbox.id]} onValueChange={(v: InboxRole) => setEditInboxes(prev => ({ ...prev, [inbox.id]: v }))}>
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="agente">Agente</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={handleEditUser} disabled={isSavingEdit}>
              {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InboxUsersManagement;
