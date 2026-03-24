import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Database, Loader2 } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Group } from '@/types';

interface CreateLeadDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  onSuccess?: () => void;
}

interface ExtractedLead {
  phone: string;
  name: string | null;
  jid: string;
  source: string;
  group_name: string;
}

const CreateLeadDatabaseDialog = ({
  open,
  onOpenChange,
  groups,
  onSuccess,
}: CreateLeadDatabaseDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Extract unique leads from all selected groups
  const extractedLeads = useMemo(() => {
    const seenPhones = new Set<string>();
    const leads: ExtractedLead[] = [];

    for (const group of groups) {
      if (!group.participants) continue;

      for (const participant of group.participants) {
        // Skip admins and super admins
        if (participant.isAdmin || participant.isSuperAdmin) continue;

        // Extract phone from phoneNumber or JID
        const phoneMatch = (participant.phoneNumber || participant.jid)?.match(/^(\d+)@?/);
        if (!phoneMatch) continue;

        const phone = phoneMatch[1];
        
        // Skip duplicates
        if (seenPhones.has(phone)) continue;
        seenPhones.add(phone);

        // Format phone with BR country code if needed
        let formattedPhone = phone;
        if (phone.length <= 11 && !phone.startsWith('55')) {
          formattedPhone = `55${phone}`;
        }

        leads.push({
          phone: formattedPhone,
          name: participant.name || null,
          jid: `${phone}@s.whatsapp.net`,
          source: 'group',
          group_name: group.name,
        });
      }
    }

    return leads;
  }, [groups]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome da base é obrigatório');
      return;
    }

    if (extractedLeads.length === 0) {
      toast.error('Nenhum participante válido encontrado nos grupos selecionados');
      return;
    }

    setIsCreating(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Create the lead database
      const { data: database, error: dbError } = await supabase
        .from('lead_databases')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          user_id: user.id,
          leads_count: extractedLeads.length,
        })
        .select()
        .single();

      if (dbError) {
        handleError(dbError, 'Erro ao criar base de dados', 'Create lead DB');
        return;
      }

      // Insert all leads
      const leadsToInsert = extractedLeads.map((lead) => ({
        database_id: database.id,
        phone: lead.phone,
        name: lead.name,
        jid: lead.jid,
        source: lead.source,
        group_name: lead.group_name,
        is_verified: false,
      }));

      const { error: entriesError } = await supabase
        .from('lead_database_entries')
        .insert(leadsToInsert);

      if (entriesError) {
        // Rollback - delete the database
        await supabase.from('lead_databases').delete().eq('id', database.id);
        handleError(entriesError, 'Erro ao inserir leads na base', 'Insert leads');
        return;
      }

      toast.success(`Base "${name}" criada com ${extractedLeads.length} leads!`);
      
      // Reset form
      setName('');
      setDescription('');
      
      onSuccess?.();
    } catch (error) {
      handleError(error, 'Erro ao criar base de leads', 'Create lead DB');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      if (!newOpen) {
        setName('');
        setDescription('');
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Criar Base de Leads
          </DialogTitle>
          <DialogDescription>
            Salve os participantes dos grupos selecionados como uma base de leads reutilizável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview Stats */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>{groups.length} grupo{groups.length !== 1 ? 's' : ''} selecionado{groups.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {extractedLeads.length} participantes únicos
              </Badge>
              <span className="text-xs text-muted-foreground">(excluindo admins)</span>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="db-name">Nome da Base *</Label>
            <Input
              id="db-name"
              placeholder="Ex: Leads Março 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="db-description">Descrição (opcional)</Label>
            <Textarea
              id="db-description"
              placeholder="Ex: Participantes extraídos dos grupos de vendas"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={2}
            />
          </div>

          {/* Groups Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Grupos incluídos:</Label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {groups.slice(0, 8).map((group) => (
                <Badge key={group.id} variant="outline" className="text-xs">
                  {group.name}
                </Badge>
              ))}
              {groups.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{groups.length - 8} mais
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || extractedLeads.length === 0}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Criar Base
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLeadDatabaseDialog;
