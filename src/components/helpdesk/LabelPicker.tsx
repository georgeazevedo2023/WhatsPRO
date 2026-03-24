import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Label } from '@/types';

interface LabelPickerProps {
  conversationId: string;
  inboxLabels: Label[];
  assignedLabelIds: string[];
  onChanged: () => void;
}

export const LabelPicker = ({ conversationId, inboxLabels, assignedLabelIds, onChanged }: LabelPickerProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const toggle = async (labelId: string, isAssigned: boolean) => {
    setLoading(labelId);
    try {
      if (isAssigned) {
        await supabase
          .from('conversation_labels')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('label_id', labelId);
      } else {
        await supabase
          .from('conversation_labels')
          .insert({ conversation_id: conversationId, label_id: labelId });
      }
      onChanged();
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Etiquetas</p>
        {inboxLabels.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">Nenhuma etiqueta criada</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {inboxLabels.map(label => {
              const isAssigned = assignedLabelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-secondary/50 text-sm disabled:opacity-50"
                  onClick={() => toggle(label.id, isAssigned)}
                  disabled={loading === label.id}
                >
                  <Checkbox checked={isAssigned} className="pointer-events-none" />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="truncate">{label.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
