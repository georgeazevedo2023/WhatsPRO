import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { formatPhone } from '@/lib/phoneUtils';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Search, Shield, User, Loader2, Users, Settings, Phone, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Navigate } from 'react-router-dom';
import ManageUserInstancesDialog from '@/components/dashboard/ManageUserInstancesDialog';

interface InstanceInfo {
  id: string;
  name: string;
  phone: string | null;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_super_admin: boolean;
  instance_count: number;
  instances: InstanceInfo[];
}


const UsersManagement = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  
  // Manage instances dialog state
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isManageInstancesOpen, setIsManageInstancesOpen] = useState(false);

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect if not super admin
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch instance access
      const { data: instanceAccess, error: accessError } = await supabase
        .from('user_instance_access')
        .select('user_id, instance_id');

      if (accessError) throw accessError;

      // Fetch all instances
      const { data: allInstances, error: instancesError } = await supabase
        .from('instances')
        .select('id, name, owner_jid');

      if (instancesError) throw instancesError;

      // Create instance lookup map
      const instanceMap = new Map(
        (allInstances || []).map((inst) => [inst.id, inst])
      );

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRoles = roles?.filter((r) => r.user_id === profile.id) || [];
        const userInstanceAccess = instanceAccess?.filter((i) => i.user_id === profile.id) || [];
        
        const instances: InstanceInfo[] = userInstanceAccess
          .map((access) => {
            const inst = instanceMap.get(access.instance_id);
            if (!inst) return null;
            return {
              id: inst.id,
              name: inst.name,
              phone: inst.owner_jid,
            };
          })
          .filter((inst): inst is InstanceInfo => inst !== null);

        return {
          ...profile,
          is_super_admin: userRoles.some((r) => r.role === 'super_admin'),
          instance_count: instances.length,
          instances,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      handleError(error, 'Erro ao carregar usuários', 'Fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsCreating(true);

    try {
      await edgeFunctionFetch('admin-create-user', {
        email: newUserEmail,
        password: newUserPassword,
        full_name: newUserName,
        is_super_admin: newUserIsAdmin,
      });

      toast.success('Usuário criado com sucesso!');
      setIsCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserIsAdmin(false);
      fetchUsers();
    } catch (error) {
      handleError(error, 'Erro ao criar usuário', 'Error creating user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    try {
      if (currentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'super_admin');

        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'super_admin' });

        if (error) throw error;
      }

      toast.success(currentlyAdmin ? 'Privilégios de admin removidos' : 'Privilégios de admin concedidos');
      fetchUsers();
    } catch (error) {
      handleError(error, 'Erro ao alterar permissões', 'Toggle admin');
    }
  };

  const handleOpenManageInstances = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsManageInstancesOpen(true);
  };

  const handleOpenDeleteDialog = (user: UserWithRole) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      await edgeFunctionFetch('admin-delete-user', { user_id: userToDelete.id });

      toast.success('Usuário excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      handleError(error, 'Erro ao excluir usuário', 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie uma nova conta de usuário no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Nome Completo</Label>
                <Input
                  id="user-name"
                  placeholder="Nome do usuário"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email *</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Senha *</Label>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Super Admin</Label>
                  <p className="text-sm text-muted-foreground">
                    Conceder privilégios de administrador
                  </p>
                </div>
                <Switch
                  checked={newUserIsAdmin}
                  onCheckedChange={setNewUserIsAdmin}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            className="pl-9 bg-card/50 backdrop-blur-sm border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}
        </span>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Nenhum usuário encontrado</h3>
          <p className="text-sm text-muted-foreground">Tente ajustar sua busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="relative p-5 rounded-xl glass-card-hover"
            >
              {/* Header: Avatar + Name + Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{user.full_name || 'Sem nome'}</h3>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                {user.is_super_admin ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 shrink-0">
                    <Shield className="w-3 h-3" />
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 shrink-0">
                    <User className="w-3 h-3" />
                    Usuário
                  </Badge>
                )}
              </div>

              {/* Instances Section */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                  Instâncias atribuídas
                </p>
                {user.instances.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 italic">Nenhuma instância</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.instances.slice(0, 4).map((inst) => (
                      <div
                        key={inst.id}
                        className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30 text-sm"
                      >
                        <span className="font-medium">{inst.name}</span>
                        {inst.phone && (
                          <span className="text-muted-foreground flex items-center gap-1 mt-0.5 text-xs">
                            <Phone className="w-3 h-3" />
                            {formatPhone(inst.phone)}
                          </span>
                        )}
                      </div>
                    ))}
                    {user.instances.length > 4 && (
                      <div className="px-3 py-1.5 rounded-lg bg-muted/30 text-sm text-muted-foreground flex items-center">
                        +{user.instances.length - 4} mais
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenManageInstances(user)}
                >
                  <Settings className="w-4 h-4 mr-1.5" />
                  Gerenciar Instâncias
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleAdmin(user.id, user.is_super_admin)}
                >
                  {user.is_super_admin ? 'Remover Admin' : 'Tornar Admin'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleOpenDeleteDialog(user)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage User Instances Dialog */}
      <ManageUserInstancesDialog
        open={isManageInstancesOpen}
        onOpenChange={setIsManageInstancesOpen}
        user={selectedUser}
        onSave={fetchUsers}
      />

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Tem certeza que deseja excluir o usuário{' '}
                <span className="font-semibold text-foreground">
                  {userToDelete?.full_name || userToDelete?.email}
                </span>
                ?
              </p>
              
              {userToDelete && userToDelete.instances.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Atenção: Este usuário possui {userToDelete.instances.length} instância(s) atribuída(s)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {userToDelete.instances.slice(0, 3).map((inst) => (
                      <span
                        key={inst.id}
                        className="px-2 py-0.5 rounded bg-muted/50 text-xs"
                      >
                        {inst.name}
                      </span>
                    ))}
                    {userToDelete.instances.length > 3 && (
                      <span className="px-2 py-0.5 rounded bg-muted/50 text-xs text-muted-foreground">
                        +{userToDelete.instances.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Esta ação é irreversível. O usuário será removido permanentemente do sistema, incluindo todos os seus dados e acessos.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Usuário
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersManagement;
