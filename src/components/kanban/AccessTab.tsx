import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Lock, UserPlus, Pencil, Eye, MessageSquare, Search, X } from 'lucide-react';
import type { BoardMember, UserProfile } from './EditBoardDialog';

interface AccessTabProps {
  visibility: 'shared' | 'private';
  boardInboxId: string | null;
  members: BoardMember[];
  allUsers: UserProfile[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  selectedUser: UserProfile | null;
  setSelectedUser: (u: UserProfile | null) => void;
  newMemberRole: 'editor' | 'viewer';
  setNewMemberRole: (r: 'editor' | 'viewer') => void;
  addingMember: boolean;
  inboxMemberCount: number;
  inboxName: string;
  filteredUsers: UserProfile[];
  handleAddMember: () => void;
  handleRemoveMember: (memberId: string, memberName: string) => void;
  handleUpdateMemberRole: (memberId: string, role: 'editor' | 'viewer') => void;
  getInitials: (name: string | null, email: string) => string;
}

export function AccessTab({
  visibility, boardInboxId, members, filteredUsers,
  userSearch, setUserSearch, selectedUser, setSelectedUser,
  newMemberRole, setNewMemberRole, addingMember,
  inboxMemberCount, inboxName,
  handleAddMember, handleRemoveMember, handleUpdateMemberRole, getInitials,
}: AccessTabProps) {
  return (
    <>
      {/* Visibilidade contextual */}
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${
        visibility === 'private'
          ? 'border-warning/40 bg-warning/5'
          : 'border-primary/30 bg-primary/5'
      }`}>
        {visibility === 'private' ? (
          <Lock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
        ) : (
          <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        )}
        <div>
          <p className="text-xs font-medium text-foreground">
            Modo: {visibility === 'shared' ? 'Compartilhado' : 'Individual'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {visibility === 'shared'
              ? 'Todos os membros com acesso a este quadro veem todos os cards uns dos outros.'
              : 'Cada atendente vê apenas os cards onde é criador ou responsável. Ideal para corretores, representantes comerciais e vendedores autônomos.'
            }
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Para alterar, vá na aba <strong>Geral</strong>.
          </p>
        </div>
      </div>

      {/* Acesso via inbox */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Acesso via WhatsApp / Caixa de Entrada
        </p>
        {boardInboxId ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{inboxName || 'Caixa vinculada'}</p>
              <p className="text-xs text-muted-foreground">{inboxMemberCount} membro{inboxMemberCount !== 1 ? 's' : ''} com acesso automático</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border text-muted-foreground">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <p className="text-xs">Sem caixa de entrada vinculada — acesso independente de WhatsApp</p>
          </div>
        )}
      </div>

      {/* Membros diretos */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Membros com Acesso Direto
        </p>
        {members.length === 0 ? (
          <div className="text-center py-6 rounded-lg border border-dashed border-border text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Nenhum membro adicionado diretamente</p>
            <p className="text-[11px] mt-0.5 opacity-70">Use o campo abaixo para conceder acesso a usuários específicos</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{member.full_name || member.email}</p>
                  {member.full_name && <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>}
                </div>
                <Select
                  value={member.role}
                  onValueChange={(v) => handleUpdateMemberRole(member.id, v as 'editor' | 'viewer')}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor" className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Pencil className="w-3 h-3" /> Editor
                      </span>
                    </SelectItem>
                    <SelectItem value="viewer" className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3" /> Visualizador
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRemoveMember(member.id, member.full_name || member.email)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar membro */}
      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar Membro</p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={userSearch}
            onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {selectedUser && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/30">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                {getInitials(selectedUser.full_name, selectedUser.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-primary flex-1 truncate">{selectedUser.full_name || selectedUser.email}</span>
            <button onClick={() => { setSelectedUser(null); setUserSearch(''); }}>
              <X className="w-3 h-3 text-primary" />
            </button>
          </div>
        )}
        {userSearch.length > 0 && !selectedUser && filteredUsers.length > 0 && (
          <div className="border border-border rounded-md bg-popover shadow-md max-h-40 overflow-y-auto">
            {filteredUsers.slice(0, 8).map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                onClick={() => { setSelectedUser(u); setUserSearch(''); }}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                    {getInitials(u.full_name, u.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{u.full_name || u.email}</p>
                  {u.full_name && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {userSearch.length > 0 && !selectedUser && filteredUsers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum usuário encontrado</p>
        )}
        <div className="flex gap-2">
          <Select value={newMemberRole} onValueChange={v => setNewMemberRole(v as 'editor' | 'viewer')}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-3 h-3" /> Editor
                </span>
              </SelectItem>
              <SelectItem value="viewer">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3 h-3" /> Visualizador
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddMember}
            disabled={!selectedUser || addingMember}
            className="gap-1.5 flex-1"
            size="sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {addingMember ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium">Sobre os papéis:</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Pencil className="w-2.5 h-2.5 shrink-0" />
            <strong>Editor</strong> — pode criar, mover e editar cards
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Eye className="w-2.5 h-2.5 shrink-0" />
            <strong>Visualizador</strong> — apenas visualiza os cards, sem editar
          </p>
        </div>
      </div>
    </>
  );
}
