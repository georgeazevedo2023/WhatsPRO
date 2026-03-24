import { useState, useEffect } from 'react';
import { handleError } from '@/lib/errorUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
}

interface EditDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: LeadDatabase | null;
  onSave: (updated: LeadDatabase) => void;
}

const EditDatabaseDialog = ({ 
  open, 
  onOpenChange, 
  database, 
  onSave 
}: EditDatabaseDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (database) {
      setName(database.name);
      setDescription(database.description || '');
    }
  }, [database]);

  const handleSave = async () => {
    if (!database || !name.trim()) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('lead_databases')
        .update({ 
          name: name.trim(), 
          description: description.trim() || null 
        })
        .eq('id', database.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onSave(data);
        toast.success('Base atualizada com sucesso');
        onOpenChange(false);
      }
    } catch (error) {
      handleError(error, 'Erro ao atualizar base', 'Update database');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Base de Leads</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="db-name">Nome</Label>
            <Input
              id="db-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da base de leads"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="db-description">Descrição (opcional)</Label>
            <Textarea
              id="db-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição para esta base..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? (
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
};

export default EditDatabaseDialog;
