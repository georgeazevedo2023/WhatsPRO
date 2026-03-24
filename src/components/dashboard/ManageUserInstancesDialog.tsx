import { useState, useEffect } from 'react';
import type { Instance } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { formatPhone } from '@/lib/phoneUtils';
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
import { Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';


interface UserData {
  id: string;
  full_name: string | null;
  email: string;
}

interface ManageUserInstancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
  onSave?: () => void;
}

// formatPhone imported from shared utils

export default function ManageUserInstancesDialog({
  open,
  onOpenChange,
  user,
  onSave,
}: ManageUserInstancesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchData();
    }
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch all instances
      const { data: allInstances, error: instancesError } = await supabase
        .from('instances')
        .select('id, name, owner_jid')
        .order('name');

      if (instancesError) throw instancesError;

      setInstances(allInstances || []);

      // Fetch current access for this user
      const { data: accessData, error: accessError } = await supabase
        .from('user_instance_access')
        .select('instance_id')
        .eq('user_id', user.id);

      if (accessError) throw accessError;

      setSelectedInstances(new Set(accessData?.map((a) => a.instance_id) || []));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstance = (instanceId: string) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Get current access records
      const { data: currentAccess } = await supabase
        .from('user_instance_access')
        .select('instance_id')
        .eq('user_id', user.id);

      const currentInstanceIds = new Set(currentAccess?.map((a) => a.instance_id) || []);

      // Find instances to add
      const toAdd = [...selectedInstances].filter((id) => !currentInstanceIds.has(id));

      // Find instances to remove
      const toRemove = [...currentInstanceIds].filter((id) => !selectedInstances.has(id));

      // Insert new access records
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('user_instance_access').insert(
          toAdd.map((instanceId) => ({
            user_id: user.id,
            instance_id: instanceId,
          }))
        );
        if (insertError) throw insertError;
      }

      // Remove revoked access records
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_instance_access')
          .delete()
          .eq('user_id', user.id)
          .in('instance_id', toRemove);
        if (deleteError) throw deleteError;
      }

      toast.success('Instâncias atualizadas com sucesso!');
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
            <Settings className="w-5 h-5" />
            Gerenciar Instâncias
          </DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                Selecione as instâncias que{' '}
                <strong>{user.full_name || user.email}</strong> terá acesso
              </>
            ) : (
              'Carregando...'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando instâncias...</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma instância disponível</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-2">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => toggleInstance(instance.id)}
                >
                  <Checkbox
                    checked={selectedInstances.has(instance.id)}
                    onCheckedChange={() => toggleInstance(instance.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{instance.name}</div>
                    {instance.owner_jid && (
                      <p className="text-sm text-muted-foreground">
                        {formatPhone(instance.owner_jid)}
                      </p>
                    )}
                  </div>
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
