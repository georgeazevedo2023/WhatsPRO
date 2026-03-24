import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Label } from '@/types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
];

interface ManageLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: string;
  labels: Label[];
  onChanged: () => void;
}

export const ManageLabelsDialog = ({ open, onOpenChange, inboxId, labels, onChanged }: ManageLabelsDialogProps) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('labels').insert({
      inbox_id: inboxId,
      name: newName.trim(),
      color: newColor,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao criar etiqueta', description: error.message, variant: 'destructive' });
    } else {
      setNewName('');
      onChanged();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('labels').update({ name: editName.trim(), color: editColor }).eq('id', id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      setEditingId(null);
      onChanged();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('labels').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      onChanged();
    }
  };

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Etiquetas</DialogTitle>
        </DialogHeader>

        {/* Create new */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nova etiqueta..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()} className="h-8 px-3">
              <Plus className="w-4 h-4 mr-1" /> Criar
            </Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? 'hsl(var(--foreground))' : 'transparent',
                  transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-1 max-h-64 overflow-y-auto mt-2">
          {labels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta</p>
          )}
          {labels.map(label => (
            <div key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 group">
              {editingId === label.id ? (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(label.id)}
                    autoFocus
                  />
                  <div className="flex gap-0.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        className="w-3.5 h-3.5 rounded-full border"
                        style={{
                          backgroundColor: c,
                          borderColor: editColor === c ? 'hsl(var(--foreground))' : 'transparent',
                        }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdate(label.id)} disabled={saving}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="text-sm flex-1 truncate">{label.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => startEdit(label)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(label.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
