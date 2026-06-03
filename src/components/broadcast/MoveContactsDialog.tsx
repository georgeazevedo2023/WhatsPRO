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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowRightLeft, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MoveContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryIds: string[];
  currentDatabaseId: string;
  /** Chamado após mover/copiar com sucesso (para recarregar a lista/contadores). */
  onDone: () => void;
}

interface DbOption {
  id: string;
  name: string;
  leads_count: number;
}

const MoveContactsDialog = ({
  open,
  onOpenChange,
  entryIds,
  currentDatabaseId,
  onDone,
}: MoveContactsDialogProps) => {
  const [databases, setDatabases] = useState<DbOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<'move' | 'copy'>('move');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetId('');
    setMode('move');
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('lead_databases')
          .select('id, name, leads_count')
          .neq('id', currentDatabaseId)
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
  }, [open, currentDatabaseId]);

  const handleSubmit = async () => {
    if (!targetId) {
      toast.error('Selecione a base destino');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('move_lead_entries', {
        p_entry_ids: entryIds,
        p_target_db: targetId,
        p_copy: mode === 'copy',
      });
      if (error) throw error;

      const res = (data || {}) as { moved?: number; deduped?: number };
      const moved = res.moved ?? 0;
      const deduped = res.deduped ?? 0;
      toast.success(
        `${moved} contato(s) ${mode === 'copy' ? 'copiado(s)' : 'movido(s)'}` +
          (deduped ? ` · ${deduped} duplicado(s) ignorado(s)` : '')
      );
      onOpenChange(false);
      onDone();
    } catch (err) {
      console.error('Error moving contacts:', err);
      toast.error('Erro ao mover contatos');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mover ou copiar {entryIds.length} contato{entryIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Escolha a base destino. Telefones duplicados são ignorados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as 'move' | 'copy')}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="move" id="mode-move" />
              <Label htmlFor="mode-move" className="flex items-center gap-1.5 cursor-pointer">
                <ArrowRightLeft className="w-4 h-4" />
                Mover
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="copy" id="mode-copy" />
              <Label htmlFor="mode-copy" className="flex items-center gap-1.5 cursor-pointer">
                <Copy className="w-4 h-4" />
                Copiar
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-1.5">
            <Label>Base destino</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </div>
            ) : databases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma outra base disponível. Crie uma base primeiro.
              </p>
            ) : (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.name} ({db.leads_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !targetId}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'copy' ? (
              'Copiar'
            ) : (
              'Mover'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveContactsDialog;
