import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2, X, Plus, Save, StickyNote } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DynamicFormField, KanbanField } from './DynamicFormField';
import type { CardData } from './KanbanCardItem';
import type { ColumnData } from './KanbanColumn';

interface EntityValueOption {
  id: string;
  label: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface CardDetailSheetProps {
  card: CardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnData[];
  fields: KanbanField[];
  teamMembers: TeamMember[];
  entityValuesMap?: Record<string, EntityValueOption[]>;
  onSaved: () => void;
  onDeleted: () => void;
}

export function CardDetailSheet({
  card,
  open,
  onOpenChange,
  columns,
  fields,
  teamMembers,
  entityValuesMap,
  onSaved,
  onDeleted,
}: CardDetailSheetProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [columnId, setColumnId] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!card || !open) return;
    setTitle(card.title);
    setColumnId(card.column_id);
    setAssignedTo(card.assigned_to || 'none');
    setTags(card.tags || []);
    setNotes(card.notes || '');
    setTagInput('');
    loadCardData();
  }, [card, open]);

  const loadCardData = async () => {
    if (!card) return;
    const { data } = await supabase
      .from('kanban_card_data')
      .select('field_id, value')
      .eq('card_id', card.id);

    const vals: Record<string, string> = {};
    (data || []).forEach(d => { vals[d.field_id] = d.value || ''; });
    setFieldValues(vals);
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);

    // Usar o valor do campo primário como título, se existir
    const primaryField = fields.find(f => f.is_primary);
    const effectiveTitle = primaryField
      ? (fieldValues[primaryField.id]?.trim() || title.trim())
      : title.trim();

    if (!effectiveTitle) {
      toast.error('Preencha o campo principal');
      setSaving(false);
      return;
    }

    // Update card
    const { error: cardErr } = await supabase
      .from('kanban_cards')
      .update({
        title: effectiveTitle,
        column_id: columnId,
        assigned_to: assignedTo !== 'none' ? assignedTo : null,
        tags,
        notes: notes || null,
      })
      .eq('id', card.id);

    if (cardErr) {
      toast.error('Erro ao salvar card');
      setSaving(false);
      return;
    }

    // Upsert field values in a single batch
    const upsertRows = fields
      .filter(field => fieldValues[field.id] !== undefined)
      .map(field => ({
        card_id: card.id,
        field_id: field.id,
        value: fieldValues[field.id] ?? '',
      }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('kanban_card_data')
        .upsert(upsertRows, { onConflict: 'card_id,field_id' });

      if (upsertErr) {
        console.error('[CardDetailSheet] Error upserting field values:', upsertErr);
        toast.error('Erro ao salvar campos do card');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success('Card salvo!');
    onSaved();
  };

  const handleDelete = async () => {
    if (!card) return;
    const { error } = await supabase.from('kanban_cards').delete().eq('id', card.id);
    if (error) {
      toast.error('Erro ao excluir card');
      return;
    }
    toast.success('Card excluído');
    onOpenChange(false);
    onDeleted();
  };

  if (!card) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-base">Detalhes do Card</SheetTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Card?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os dados deste card serão excluídos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Lead vinculado */}
          {card?.contact_id && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
              {(card as any).contact_pic ? (
                <img src={(card as any).contact_pic} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {((card as any).contact_name || '?')[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{(card as any).contact_name || 'Lead'}</p>
                <p className="text-xs text-muted-foreground">{(card as any).contact_phone || ''}</p>
              </div>
              <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Lead</Badge>
            </div>
          )}

          {/* Title — só exibe quando não há campo primário configurado */}
          {!fields.some(f => f.is_primary) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome / Título *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Nome do lead ou cliente"
                className="font-medium"
              />
            </div>
          )}

          {/* Column */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa (Coluna)</Label>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      {col.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned to */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem responsável —</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Adicionar tag..."
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              />
              <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={handleAddTag}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map(tag => (
                  <Badge key={tag} variant="outline" className="gap-1 text-xs pr-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <StickyNote className="w-3 h-3" />
              Notas internas
            </Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observações sobre este lead (visível apenas internamente)..."
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          {/* Dynamic fields */}
          {fields.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações do Lead</p>
              {fields.map(field => (
                <DynamicFormField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id] ?? ''}
                  onChange={v => setFieldValues(prev => ({ ...prev, [field.id]: v }))}
                  entityValuesMap={entityValuesMap}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <Button
            className="w-full gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
