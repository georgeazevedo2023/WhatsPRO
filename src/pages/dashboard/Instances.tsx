import { useEffect, useState } from 'react';
import type { Instance } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { extractQrCode } from '@/lib/uazapiUtils';
import { useQrConnect } from '@/hooks/useQrConnect';
import InstanceCard from '@/components/dashboard/InstanceCard';
import SyncInstancesDialog from '@/components/dashboard/SyncInstancesDialog';
import ManageInstanceAccessDialog from '@/components/dashboard/ManageInstanceAccessDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Server, Loader2, RefreshCw, QrCode, AlertTriangle } from 'lucide-react';
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
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

const Instances = () => {
  const { isSuperAdmin, user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [selectedInstanceForAccess, setSelectedInstanceForAccess] = useState<Instance | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Estado para delete dialog
  const [instanceToDelete, setInstanceToDelete] = useState<Instance | null>(null);
  const [isDeletingInstance, setIsDeletingInstance] = useState(false);

  // Centralised QR connect hook
  const qr = useQrConnect({ onConnected: () => fetchInstances() });

  useEffect(() => {
    fetchInstances();
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  // Polling para atualizar status a cada 30 segundos
  useEffect(() => {
    const updateInstancesStatus = async () => {
      try {
        const rawResult = await uazapiProxy({ action: 'list' });
        // Extract array from various response formats
        let uazapiList: Array<Record<string, unknown>> = [];
        if (Array.isArray(rawResult)) {
          uazapiList = rawResult;
        } else if (rawResult && typeof rawResult === 'object') {
          const obj = rawResult as Record<string, unknown>;
          const candidate = obj.instances || obj.data || obj.results;
          if (Array.isArray(candidate)) uazapiList = candidate as Array<Record<string, unknown>>;
        }
        if (uazapiList.length === 0) return;

        const statusMap = new Map<string, { status: string; owner: string | null; profilePic: string | null }>();
        uazapiList.forEach((inst) => {
          const id = String(inst.id || inst.instanceId || '');
          if (!id) return;
          statusMap.set(id, {
            status: String(inst.connectionStatus || inst.status || 'disconnected') === 'connected' ? 'connected' : 'disconnected',
            owner: String(inst.ownerJid || inst.owner || '') || null,
            profilePic: String(inst.profilePicUrl || inst.profilePic || '') || null,
          });
        });

        const updates: (() => Promise<void>)[] = [];
        const updatedInstances = instances.map((instance) => {
          const uazapiStatus = statusMap.get(instance.id);
          if (uazapiStatus && uazapiStatus.status !== instance.status) {
            updates.push(async () => {
              const { error } = await supabase
                .from('instances')
                .update({
                  status: uazapiStatus.status,
                  owner_jid: uazapiStatus.owner || instance.owner_jid,
                  profile_pic_url: uazapiStatus.profilePic || instance.profile_pic_url,
                })
                .eq('id', instance.id);
              if (error) console.error('[Instances] Error syncing status:', error);
            });
            return {
              ...instance,
              status: uazapiStatus.status,
              owner_jid: uazapiStatus.owner || instance.owner_jid,
              profile_pic_url: uazapiStatus.profilePic || instance.profile_pic_url,
            };
          }
          return instance;
        });

        if (updates.length > 0) {
          await Promise.all(updates.map(fn => fn()));
          setInstances(updatedInstances);
        }
      } catch (error) {
        console.error('Error updating instances status:', error);
      }
    };

    if (instances.length > 0) {
      updateInstancesStatus();
    }

    const interval = setInterval(updateInstancesStatus, 30000);
    return () => clearInterval(interval);
  }, [instances.length > 0]);

  const fetchInstances = async () => {
    try {
      const { data: instancesData, error: instancesError } = await supabase
        .from('instances')
        .select('*')
        .eq('disabled', false)
        .order('created_at', { ascending: false });

      if (instancesError) throw instancesError;

      if (instancesData && instancesData.length > 0) {
        const userIds = [...new Set(instancesData.map((i) => i.user_id))];
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

        const instancesWithProfiles = instancesData.map((instance) => ({
          ...instance,
          user_profiles: profilesMap.get(instance.user_id),
        }));

        setInstances(instancesWithProfiles as Instance[]);
      } else {
        setInstances([]);
      }
    } catch (error) {
      handleError(error, 'Erro ao carregar instâncias', 'Error fetching instances');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error('Digite um nome para a instância');
      return;
    }

    const targetUserId = isSuperAdmin && selectedUserId ? selectedUserId : user?.id;
    if (!targetUserId) {
      toast.error('Usuário não identificado');
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create instance on UAZAPI
      const createResult = await uazapiProxy({
        action: 'create-instance',
        instanceName: newInstanceName.trim(),
      }) as Record<string, unknown>;

      // Extract instance data from response
      const instData = (createResult.instance || createResult) as Record<string, unknown>;
      const instanceId = String(instData.instanceId || instData.id || instData.key || `inst_${Date.now()}`);
      const instanceToken = String(instData.token || generateToken());

      // 2. Save to database
      const { error: dbError } = await supabase.from('instances').insert({
        id: instanceId,
        name: newInstanceName.trim(),
        token: instanceToken,
        user_id: targetUserId,
        status: 'disconnected',
      });

      if (dbError) throw dbError;

      // 3. Create access record
      await supabase.from('user_instance_access').insert({
        instance_id: instanceId,
        user_id: targetUserId,
      }).then(({ error }) => {
        if (error) console.error('Error creating access record:', error);
      });

      toast.success('Instância criada com sucesso!');
      setIsCreateDialogOpen(false);
      setNewInstanceName('');
      setSelectedUserId('');
      fetchInstances();

      // 4. Auto-connect: get QR code
      try {
        const connectResult = await uazapiProxy({
          action: 'connect',
          instance_id: instanceId,
        }) as Record<string, unknown>;

        const qrCodeStr = extractQrCode(connectResult);
        if (qrCodeStr) {
          const newInstance: Instance = {
            id: instanceId,
            name: newInstanceName.trim(),
            token: instanceToken,
            user_id: targetUserId,
            status: 'disconnected',
            owner_jid: null,
            profile_pic_url: null,
          };
          qr.openWithQr(newInstance, qrCodeStr);
        }
      } catch (qrErr) {
        // QR code not available yet, user can connect later
      }
    } catch (error) {
      handleError(error, 'Erro ao criar instância', 'Error creating instance');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = async (instance: Instance) => {
    qr.connect(instance);
  };

  const handleDelete = (instance: Instance) => {
    setInstanceToDelete(instance);
  };

  const [deleteFromUazapi, setDeleteFromUazapi] = useState(false);

  const confirmDeleteInstance = async () => {
    if (!instanceToDelete) return;
    setIsDeletingInstance(true);
    try {
      // Delete from UAZAPI if checkbox is checked
      if (deleteFromUazapi) {
        try {
          await uazapiProxy({
            action: 'delete-instance',
            instance_id: instanceToDelete.id,
            deleteInstanceId: instanceToDelete.id,
            instanceName: instanceToDelete.name,
          });
        } catch (uazapiErr) {
          console.error('UAZAPI delete failed (continuing with local):', uazapiErr);
        }

        // Full delete from database (FKs handle CASCADE)
        const { error } = await supabase.from('instances').delete().eq('id', instanceToDelete.id);
        if (error) throw error;
        toast.success('Instância excluída da UAZAPI e do sistema');
      } else {
        // Soft delete (just hide from panel)
        const { error } = await supabase.from('instances').update({ disabled: true }).eq('id', instanceToDelete.id);
        if (error) throw error;
        toast.success('Instância removida do painel');
      }

      setInstanceToDelete(null);
      setDeleteFromUazapi(false);
      fetchInstances();
      window.dispatchEvent(new CustomEvent('instances-updated'));
    } catch (error) {
      handleError(error, 'Erro ao remover instância', 'Error deleting instance');
    } finally {
      setIsDeletingInstance(false);
    }
  };

  const handleManageAccess = (instance: Instance) => {
    setSelectedInstanceForAccess(instance);
    setIsAccessDialogOpen(true);
  };

  const filteredInstances = instances.filter(
    (instance) =>
      instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.user_profiles?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Instâncias</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? 'Gerencie todas as instâncias do sistema'
              : 'Suas instâncias do WhatsApp'}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Instância
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Instância</DialogTitle>
                  <DialogDescription>
                    Crie uma nova instância do WhatsApp e atribua a um usuário
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="instance-name">Nome da Instância</Label>
                    <Input
                      id="instance-name"
                      placeholder="Ex: Suporte - João"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-select">Atribuir ao Usuário</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateInstance} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Instância'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Sync Dialog */}
        <SyncInstancesDialog
          open={isSyncDialogOpen}
          onOpenChange={setIsSyncDialogOpen}
          onSync={fetchInstances}
        />

        {/* Manage Access Dialog */}
        <ManageInstanceAccessDialog
          open={isAccessDialogOpen}
          onOpenChange={setIsAccessDialogOpen}
          instance={selectedInstanceForAccess}
          onSave={fetchInstances}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar instâncias..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Instances Grid */}
      {filteredInstances.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma instância encontrada</p>
          {isSuperAdmin && (
            <p className="text-sm mt-2">
              Clique em "Nova Instância" para criar uma
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              showOwner={isSuperAdmin}
              onConnect={handleConnect}
              onDelete={isSuperAdmin ? handleDelete : undefined}
              onManageAccess={isSuperAdmin ? handleManageAccess : undefined}
            />
          ))}
        </div>
      )}

      {/* Delete Instance Dialog */}
      <AlertDialog open={!!instanceToDelete} onOpenChange={(open) => { if (!open) { setInstanceToDelete(null); setDeleteFromUazapi(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remover instância
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  A instância <strong>{instanceToDelete?.name}</strong> será removida do painel.
                </p>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-secondary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={deleteFromUazapi}
                    onChange={(e) => setDeleteFromUazapi(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Excluir também na UAZAPI</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Remove permanentemente a instância do servidor UAZAPI. Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </label>
                {!deleteFromUazapi && (
                  <p className="text-xs text-muted-foreground">
                    Sem marcar a opção acima, a instância será apenas ocultada do painel e poderá ser restaurada via Sincronizar.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingInstance}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInstance}
              disabled={isDeletingInstance}
              className={cn(
                deleteFromUazapi
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              )}
            >
              {isDeletingInstance ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {deleteFromUazapi ? 'Excluir permanentemente' : 'Ocultar do painel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de QR Code Centralizado */}
      <Dialog open={!!qr.activeInstance} onOpenChange={() => qr.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conectar {qr.activeInstance?.name}
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 gap-4">
            {qr.isLoadingQr ? (
              <div className="w-64 h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Gerando QR Code...</span>
                </div>
              </div>
            ) : qr.qrCode ? (
              <>
                <img
                  src={qr.qrCode}
                  alt="QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Aguardando leitura do QR… (verificando status a cada 5s)
                </p>
              </>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-center px-4">
                  Erro ao gerar QR Code. Tente novamente.
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => qr.close()}>
              Fechar
            </Button>
            <Button onClick={qr.regenerateQr} disabled={qr.isLoadingQr}>
              <RefreshCw className={cn("w-4 h-4 mr-2", qr.isLoadingQr && "animate-spin")} />
              Gerar novo QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Instances;
