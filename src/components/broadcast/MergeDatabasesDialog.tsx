import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, GitMerge, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MergeDatabasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após o merge (para recarregar a lista de bases). */
  onDone: () => void;
}

interface DbOption {
  id: string;
  name: string;
  leads_count: number;
}

const MergeDatabasesDialog = ({ open, onOpenChange, onDone }: MergeDatabasesDialogProps) => {
  const [databases, setDatabases] = useState<DbOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());
  const [targetId, setTargetId] = useState('');
  const [deleteSources, setDeleteSources] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceIds(new Set());
    setTargetId('');
    setDeleteSources(true);
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('lead_databases')
          .select('id, name, leads_count')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        setDatabases((data || []) as DbOption[]);
      } catch (err) {
        console.error('Error loading databases:', err);
        toast.error('Erro ao carregar bases');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Mantém o destino sempre dentro das bases selecionadas.
  useEffect(() => {
    if (targetId && !sourceIds.has(targetId)) {
      setTargetId('');
    }
    if (!targetId && sourceIds.size > 0) {
      setTargetId(Array.from(sourceIds)[0]);
    }
  }, [sourceIds, targetId]);

  const toggleSource = (id: string) => {
    setSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDbs = databases.filter((d) => sourceIds.has(d.id));

  const handleSubmit = async () => {
    if (sourceIds.size < 2) {
      toast.error('Selecione pelo menos 2 bases para unir');
      return;
    }
    if (!targetId) {
      toast.error('Selecione a base destino');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('merge_lead_databases', {
        p_source_ids: Array.from(sourceIds),
        p_target_db: targetId,
        p_delete_sources: deleteSources,
      });
      if (error) throw error;
      const res = (data || {}) as { merged?: number };
      toast.success(`Bases unidas · ${res.merged ?? 0} contato(s) consolidado(s)`);
      onOpenChange(false);
      onDone();
    } catch (err) {
      console.error('Error merging databases:', err);
      toast.error('Erro ao unir bases');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Unir bases de leads
          </DialogTitle>
          <DialogDescription>
            Selecione 2+ bases para unir numa só. Telefones duplicados são removidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bases para unir</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </div>
            ) : databases.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                É preciso ter pelo menos 2 bases para unir.
              </p>
            ) : (
              <ScrollArea className="h-44 border rounded-lg">
                <div className="p-2 space-y-1">
                  {databases.map((db) => (
                    <label
                      key={db.id}
                      className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={sourceIds.has(db.id)}
                        onCheckedChange={() => toggleSource(db.id)}
                      />
                      <span className="flex-1 text-sm truncate">{db.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Users className="w-3 h-3" />
                        {db.leads_count}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {sourceIds.size >= 2 && (
            <>
              <div className="space-y-1.5">
                <Label>Base destino (recebe os contatos)</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a base destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDbs.map((db) => (
                      <SelectItem key={db.id} value={db.id}>
                        {db.name} ({db.leads_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={deleteSources}
                  onCheckedChange={(c) => setDeleteSources(c === true)}
                />
                <span className="text-sm">Excluir as outras bases após unir</span>
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || sourceIds.size < 2 || !targetId}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unir bases'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeDatabasesDialog;
