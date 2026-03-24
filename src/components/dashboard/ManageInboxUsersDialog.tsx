import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Loader2, Trash2, UserPlus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { Database } from '@/integrations/supabase/types';

type InboxRole = Database['public']['Enums']['inbox_role'];

interface Member {
  id: string; // inbox_users.id
  user_id: string;
  role: InboxRole;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface ManageInboxUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: string;
  inboxName: string;
  onUpdate: () => void;
}

const ROLE_LABELS: Record<InboxRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  agente: 'Agente',
};

const ROLE_COLORS: Record<InboxRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  gestor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  agente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const ManageInboxUsersDialog = ({
  open,
  onOpenChange,
  inboxId,
  inboxName,
  onUpdate,
}: ManageInboxUsersDialogProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Add form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<InboxRole>('agente');

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchUsers();
    }
  }, [open, inboxId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_users')
        .select('id, user_id, role')
        .eq('inbox_id', inboxId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setMembers([]);
        return;
      }

      // Fetch profiles for members
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: Member[] = data.map(m => {
        const profile = profileMap.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          full_name: profile?.full_name || null,
          email: profile?.email || 'Usuário removido',
          avatar_url: profile?.avatar_url || null,
        };
      });

      setMembers(enriched);
    } catch (error) {
      handleError(error, 'Erro ao carregar membros', 'Fetch inbox members');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .order('full_name');

    if (data) setAllUsers(data);
  };

  const availableUsers = allUsers.filter(
    u => !members.some(m => m.user_id === u.id)
  );

  const handleAdd = async () => {
    if (!selectedUserId) {
      toast.error('Selecione um usuário');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('inbox_users').insert({
        inbox_id: inboxId,
        user_id: selectedUserId,
        role: selectedRole,
      });

      if (error) throw error;

      toast.success('Membro adicionado');
      setSelectedUserId('');
      setSelectedRole('agente');
      fetchMembers();
      onUpdate();
    } catch (error) {
      handleError(error, 'Erro ao adicionar', 'Error adding member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const { error } = await supabase
        .from('inbox_users')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membro removido');
      fetchMembers();
      onUpdate();
    } catch (error) {
      handleError(error, 'Erro ao remover', 'Error removing member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: InboxRole) => {
    setUpdatingId(memberId);
    try {
      const { error } = await supabase
        .from('inbox_users')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Cargo atualizado');
      fetchMembers();
    } catch (error) {
      handleError(error, 'Erro ao atualizar cargo', 'Error updating role');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros — {inboxName}</DialogTitle>
          <DialogDescription>
            Adicione ou remova membros e defina seus cargos nesta caixa de entrada
          </DialogDescription>
        </DialogHeader>

        {/* Add member form */}
        <div className="flex items-end gap-2 pt-2">
          <div className="flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">Usuário</span>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Todos os usuários já são membros
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1">
            <span className="text-xs text-muted-foreground">Cargo</span>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as InboxRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as InboxRole[]).map(role => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={adding || !selectedUserId}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Members list */}
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum membro adicionado
            </div>
          ) : (
            members.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30"
              >
                <Avatar className="w-9 h-9">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {member.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground truncate">ID: {member.user_id}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(member.user_id);
                        toast.success('ID copiado!');
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(v) => handleRoleChange(member.id, v as InboxRole)}
                  disabled={updatingId === member.id}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as InboxRole[]).map(role => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                >
                  {removingId === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageInboxUsersDialog;
