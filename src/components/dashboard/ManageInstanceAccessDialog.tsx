import { useState, useEffect, useMemo } from 'react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import type { Instance } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Shield, User } from 'lucide-react';
import { toast } from 'sonner';


interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  isSuperAdmin?: boolean;
}

interface ManageInstanceAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onSave?: () => void;
}

export default function ManageInstanceAccessDialog({
  open,
  onOpenChange,
  instance,
  onSave,
}: ManageInstanceAccessDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [superAdminIds, setSuperAdminIds] = useState<Set<string>>(new Set());

  const { profiles: allProfiles, loading: profilesLoading } = useUserProfiles({ enabled: open });
  const users = useMemo<UserProfile[]>(() =>
    allProfiles.map(p => ({ ...p, isSuperAdmin: superAdminIds.has(p.id) })),
    [allProfiles, superAdminIds]
  );
  const loading = profilesLoading;

  useEffect(() => {
    if (open && instance) {
      fetchData();
    }
  }, [open, instance]);

  const fetchData = async () => {
    if (!instance) return;

    try {
      // Fetch roles to identify super admins
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'super_admin');

      setSuperAdminIds(new Set(roles?.map((r) => r.user_id) || []));

      // Fetch current access for this instance
      const { data: accessData, error: accessError } = await supabase
        .from('user_instance_access')
        .select('user_id')
        .eq('instance_id', instance.id);

      if (accessError) throw accessError;

      setSelectedUsers(new Set(accessData?.map((a) => a.user_id) || []));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const toggleUser = (userId: string, isSuperAdmin: boolean) => {
    // Super admins always have access via RLS, no need to toggle
    if (isSuperAdmin) return;

    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!instance) return;

    setSaving(true);
    try {
      // Get current access records
      const { data: currentAccess } = await supabase
        .from('user_instance_access')
        .select('user_id')
        .eq('instance_id', instance.id);

      const currentUserIds = new Set(currentAccess?.map((a) => a.user_id) || []);

      // Filter out super admins from selected (they don't need access records)
      const superAdminIds = new Set(users.filter((u) => u.isSuperAdmin).map((u) => u.id));
      const nonSuperAdminSelected = [...selectedUsers].filter((id) => !superAdminIds.has(id));

      // Find users to add
      const toAdd = nonSuperAdminSelected.filter((id) => !currentUserIds.has(id));

      // Find users to remove
      const toRemove = [...currentUserIds].filter(
        (id) => !selectedUsers.has(id) && !superAdminIds.has(id)
      );

      // Insert new access records
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('user_instance_access').insert(
          toAdd.map((userId) => ({
            user_id: userId,
            instance_id: instance.id,
          }))
        );
        if (insertError) throw insertError;
      }

      // Remove revoked access records
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_instance_access')
          .delete()
          .eq('instance_id', instance.id)
          .in('user_id', toRemove);
        if (deleteError) throw deleteError;
      }

      toast.success('Acessos atualizados com sucesso!');
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving access:', error);
      toast.error('Erro ao salvar acessos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gerenciar Acesso
          </DialogTitle>
          <DialogDescription>
            {instance ? (
              <>
                Selecione os usuários que terão acesso à instância{' '}
                <strong>{instance.name}</strong>
              </>
            ) : (
              'Carregando...'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando usuários...</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    u.isSuperAdmin ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  }`}
                >
                  <Checkbox
                    checked={u.isSuperAdmin || selectedUsers.has(u.id)}
                    disabled={u.isSuperAdmin}
                    onCheckedChange={() => toggleUser(u.id, u.isSuperAdmin || false)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {u.full_name || u.email}
                      </span>
                      {u.isSuperAdmin && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Shield className="w-3 h-3" />
                          Super Admin
                        </Badge>
                      )}
                    </div>
                    {u.full_name && (
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  {u.isSuperAdmin ? (
                    <span className="text-xs text-muted-foreground">Acesso automático</span>
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
