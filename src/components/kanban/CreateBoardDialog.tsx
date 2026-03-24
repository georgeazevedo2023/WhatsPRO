import { useState } from 'react';
import type { Inbox } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Lock } from 'lucide-react';


interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxes: Inbox[];
  onCreated: () => void;
}

export function CreateBoardDialog({ open, onOpenChange, inboxes, onCreated }: CreateBoardDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'shared' | 'private'>('shared');
  const [inboxId, setInboxId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);

    const selectedInbox = inboxId !== 'none' ? inboxes.find(i => i.id === inboxId) : null;

    const { error } = await supabase.from('kanban_boards').insert({
      name: name.trim(),
      description: description.trim() || null,
      visibility,
      inbox_id: selectedInbox?.id || null,
      instance_id: selectedInbox?.instance_id || null,
      created_by: user.id,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao criar quadro');
      return;
    }

    toast.success('Quadro criado com sucesso!');
    setName('');
    setDescription('');
    setVisibility('shared');
    setInboxId('none');
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Quadro Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do Quadro *</Label>
            <Input
              placeholder="Ex: Vendas - Time A"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva o objetivo deste pipeline..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Privacidade dos Leads</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('shared')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-left ${
                  visibility === 'shared'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-xs font-medium">Compartilhado</span>
                <span className="text-[10px] text-center leading-tight opacity-70">Todo mundo vê tudo</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-left ${
                  visibility === 'private'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="text-xs font-medium">Individual</span>
                <span className="text-[10px] text-center leading-tight opacity-70">Só vê seus próprios leads</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Caixa de Entrada WhatsApp (opcional)</Label>
            <Select value={inboxId} onValueChange={setInboxId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem conexão WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conexão WhatsApp</SelectItem>
                {inboxes.map(inbox => (
                  <SelectItem key={inbox.id} value={inbox.id}>{inbox.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Habilita automações de mensagem por coluna</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Criando...' : 'Criar Quadro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
