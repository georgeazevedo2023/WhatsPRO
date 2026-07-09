import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parsePhoneToJid, jidToDigits } from '@/lib/phoneUtils';
import type { LeadEntry } from './leadDatabaseTypes';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LeadEntry | null;
  /** Telefones já presentes na base (para barrar duplicata, exceto o próprio). */
  existingPhones: string[];
  onSaved: (updated: LeadEntry) => void;
}

const EditContactDialog = ({
  open,
  onOpenChange,
  entry,
  existingPhones,
  onSaved,
}: EditContactDialogProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setName(entry.name || '');
      setPhone(entry.phone || '');
    }
  }, [open, entry]);

  const handleSave = async () => {
    if (!entry) return;
    const jid = parsePhoneToJid(phone);
    if (!jid) {
      toast.error('Número de telefone inválido');
      return;
    }
    const cleanPhone = jidToDigits(jid);
    if (cleanPhone !== entry.phone && existingPhones.includes(cleanPhone)) {
      toast.error('Este número já existe na base');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('lead_database_entries')
        .update({ name: name.trim() || null, phone: cleanPhone, jid })
        .eq('id', entry.id);
      if (error) throw error;

      onSaved({ ...entry, name: name.trim() || null, phone: cleanPhone, jid });
      toast.success('Contato atualizado');
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating contact:', err);
      toast.error('Erro ao atualizar contato');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription className="sr-only">Edição do nome e telefone do contato da base.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-contact-name">Nome (opcional)</Label>
            <Input
              id="edit-contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-contact-phone">Telefone</Label>
            <Input
              id="edit-contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5581999999999"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !phone.trim()}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditContactDialog;
