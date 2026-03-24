import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';

import type { UazapiInstance } from '@/types/uazapi';

interface LocalInstance {
  id: string;
  name: string;
  status: string;
  user_id: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface SyncInstancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: () => void;
}

export default function SyncInstancesDialog({
  open,
  onOpenChange,
  onSync,
}: SyncInstancesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uazapiInstances, setUazapiInstances] = useState<UazapiInstance[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [userAssignments, setUserAssignments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Orphan instances state
  const [orphanedInstances, setOrphanedInstances] = useState<LocalInstance[]>([]);
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [deletingOrphans, setDeletingOrphans] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSelectedInstances(new Set());
    setUserAssignments({});
    setSelectedOrphans(new Set());

    try {
      // Fetch ALL local instances (not just IDs)
      const { data: localInstances } = await supabase
        .from('instances')
        .select('id, name, status, user_id');

      setExistingIds(new Set(localInstances?.map((i) => i.id) || []));

      // Fetch users
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .order('full_name');

      setUsers(usersData || []);

      // Fetch instances from UAZAPI
      const result = await uazapiProxy({ action: 'list' });

      if (!result || typeof result !== 'object') {
        throw new Error('Erro ao buscar instâncias da UAZAPI');
      }

      // Handle different response formats from UAZAPI
      let instances: UazapiInstance[] = [];

      const resultObj = result as Record<string, unknown>;

      // Extract the raw array from whatever wrapper format UAZAPI returns
      let rawList: Array<Record<string, unknown>> = [];
      if (Array.isArray(result)) {
        rawList = result;
      } else if (Array.isArray(resultObj.instances)) {
        rawList = resultObj.instances as Array<Record<string, unknown>>;
      } else if (Array.isArray(resultObj.data)) {
        rawList = resultObj.data as Array<Record<string, unknown>>;
      } else if (Array.isArray(resultObj.results)) {
        rawList = resultObj.results as Array<Record<string, unknown>>;
      } else {
        // Try to find any array value in the response
        for (const key of Object.keys(resultObj)) {
          if (Array.isArray(resultObj[key]) && (resultObj[key] as unknown[]).length > 0) {
            rawList = resultObj[key] as Array<Record<string, unknown>>;
            break;
          }
        }
      }

      instances = rawList
        .filter(inst => inst && typeof inst === 'object')
        .map((inst) => ({
          id: String(inst.id || inst.instanceId || inst.key || ''),
          instanceName: String(inst.instanceName || inst.name || inst.key || ''),
          token: String(inst.token || ''),
          connectionStatus: String(inst.connectionStatus || inst.status || 'disconnected'),
          ownerJid: String(inst.ownerJid || (inst.owner as Record<string, unknown>)?.jid || inst.owner || ''),
          profilePicUrl: (inst.profilePicUrl || inst.profilePic || inst.profilePictureUrl) as string | undefined,
          profileName: (inst.profileName || inst.pushname || inst.pushName) as string | undefined,
        }))
        .filter(inst => inst.id); // remove entries without ID

      setUazapiInstances(instances);

      // Identify orphaned instances (exist locally but NOT in UAZAPI)
      const uazapiIds = new Set(instances.map((i) => i.id));
      const orphaned = localInstances?.filter((inst) => !uazapiIds.has(inst.id)) || [];
      setOrphanedInstances(orphaned);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstance = (id: string) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleOrphan = (id: string) => {
    setSelectedOrphans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllOrphans = () => {
    if (selectedOrphans.size === orphanedInstances.length) {
      setSelectedOrphans(new Set());
    } else {
      setSelectedOrphans(new Set(orphanedInstances.map((i) => i.id)));
    }
  };

  const setUserForInstance = (instanceId: string, userId: string) => {
    setUserAssignments((prev) => ({
      ...prev,
      [instanceId]: userId,
    }));
  };

  const handleDeleteOrphans = async () => {
    if (selectedOrphans.size === 0) return;

    setDeletingOrphans(true);

    try {
      const orphanIds = Array.from(selectedOrphans);

      // Clean up connection logs (no FK, must delete manually)
      const { error: logsError } = await supabase
        .from('instance_connection_logs')
        .delete()
        .in('instance_id', orphanIds);

      if (logsError) {
        console.error('Error removing connection logs:', logsError);
      }

      // Clean up lead_database_entries via lead_databases
      const { data: leadDbs } = await supabase
        .from('lead_databases')
        .select('id')
        .in('instance_id', orphanIds);

      if (leadDbs && leadDbs.length > 0) {
        const leadDbIds = leadDbs.map(db => db.id);
        await supabase
          .from('lead_database_entries')
          .delete()
          .in('database_id', leadDbIds);
      }

      // Clean up lead_databases
      const { error: leadError } = await supabase
        .from('lead_databases')
        .delete()
        .in('instance_id', orphanIds);

      if (leadError) {
        console.error('Error removing lead databases:', leadError);
      }

      // Delete instances (FKs handle CASCADE for user_instance_access, scheduled_messages;
      // SET NULL for inboxes and kanban_boards)
      const { error: instError } = await supabase
        .from('instances')
        .delete()
        .in('id', orphanIds);

      if (instError) throw instError;

      toast.success(`${orphanIds.length} instância(s) órfã(s) removida(s)`);
      setSelectedOrphans(new Set());

      // Notify sidebar to refresh instances list
      window.dispatchEvent(new CustomEvent('instances-updated'));

      onSync();
      fetchData(); // Refresh data
    } catch (err) {
      handleError(err, 'Erro ao remover instâncias órfãs', 'Error deleting orphaned instances');
    } finally {
      setDeletingOrphans(false);
    }
  };

  const handleSync = async () => {
    const toSync = uazapiInstances.filter(
      (inst) => selectedInstances.has(inst.id) && !existingIds.has(inst.id)
    );

    // Validate all selected instances have user assignments
    const missingAssignments = toSync.filter((inst) => !userAssignments[inst.id]);
    if (missingAssignments.length > 0) {
      toast.error('Atribua um usuário a todas as instâncias selecionadas');
      return;
    }

    setSyncing(true);

    try {
      const inserts = toSync.map((inst) => ({
        id: inst.id,
        name: inst.instanceName,
        token: inst.token,
        status: inst.connectionStatus === 'connected' ? 'connected' : 'disconnected',
        owner_jid: inst.ownerJid || null,
        profile_pic_url: inst.profilePicUrl || null,
        user_id: userAssignments[inst.id],
      }));

      const { error: insertError } = await supabase.from('instances').insert(inserts);

      if (insertError) throw insertError;

      // Also create access records in user_instance_access table
      const accessInserts = toSync.map((inst) => ({
        instance_id: inst.id,
        user_id: userAssignments[inst.id],
      }));

      const { error: accessError } = await supabase
        .from('user_instance_access')
        .insert(accessInserts);

      if (accessError) {
        console.error('Error creating access records:', accessError);
        // Don't throw - instances were created successfully
      }

      toast.success(`${inserts.length} instância(s) importada(s) com sucesso!`);
      onSync();
      onOpenChange(false);
    } catch (err) {
      handleError(err, 'Erro ao sincronizar instâncias', 'Error syncing instances');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const isConnected = status === 'connected';
    return (
      <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
        {isConnected ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <XCircle className="w-3 h-3" />
        )}
        {isConnected ? 'Conectado' : 'Desconectado'}
      </Badge>
    );
  };

  const newInstances = uazapiInstances.filter((inst) => !existingIds.has(inst.id));
  const existingInBoth = uazapiInstances.filter((inst) => existingIds.has(inst.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sincronizar Instâncias da UAZAPI
          </DialogTitle>
          <DialogDescription>
            Importe instâncias existentes da UAZAPI e atribua a usuários do sistema
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Buscando instâncias da UAZAPI...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="w-8 h-8 mb-4" />
            <p>{error}</p>
            <Button variant="outline" onClick={fetchData} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        ) : uazapiInstances.length === 0 && orphanedInstances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-4 opacity-50" />
            <p>Nenhuma instância encontrada na UAZAPI</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-6">
              {/* New instances */}
              {newInstances.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Novas Instâncias ({newInstances.length})
                  </h3>
                  {newInstances.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                    >
                      <Checkbox
                        checked={selectedInstances.has(inst.id)}
                        onCheckedChange={() => toggleInstance(inst.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {inst.profileName || inst.instanceName}
                          </span>
                          {getStatusBadge(inst.connectionStatus)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {inst.instanceName} • {inst.id}
                        </p>
                      </div>
                      {selectedInstances.has(inst.id) && (
                        <Select
                          value={userAssignments[inst.id] || ''}
                          onValueChange={(value) => setUserForInstance(inst.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Atribuir usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name || user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Already synced */}
              {existingInBoth.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Já Sincronizadas ({existingInBoth.length})
                  </h3>
                  {existingInBoth.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-muted/50 opacity-60"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {inst.profileName || inst.instanceName}
                          </span>
                          {getStatusBadge(inst.connectionStatus)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {inst.instanceName} • Já existe no sistema
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Orphaned instances */}
              {orphanedInstances.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Instâncias Órfãs ({orphanedInstances.length})
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAllOrphans}
                      className="text-xs"
                    >
                      {selectedOrphans.size === orphanedInstances.length
                        ? 'Desmarcar todas'
                        : 'Selecionar todas'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Existem no sistema local mas não foram encontradas na UAZAPI
                  </p>
                  {orphanedInstances.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                    >
                      <Checkbox
                        checked={selectedOrphans.has(inst.id)}
                        onCheckedChange={() => toggleOrphan(inst.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{inst.name}</span>
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Não encontrada
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {inst.id} • Pode ser removida com segurança
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          
          {orphanedInstances.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteOrphans}
              disabled={deletingOrphans || selectedOrphans.size === 0}
            >
              {deletingOrphans ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover Órfãs {selectedOrphans.size > 0 ? `(${selectedOrphans.size})` : ''}
                </>
              )}
            </Button>
          )}
          
          <Button
            onClick={handleSync}
            disabled={syncing || selectedInstances.size === 0}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Importar {selectedInstances.size > 0 ? `(${selectedInstances.size})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}