import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { parsePhoneToJid, formatPhoneDisplay } from '@/lib/phoneUtils';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface ManualTabProps {
  onLeadsImported: (leads: Lead[]) => void;
}

const ManualTab = ({ onLeadsImported }: ManualTabProps) => {
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const handleManualAdd = () => {
    if (!manualPhone.trim()) {
      toast.error('Digite o número do contato');
      return;
    }

    const jid = parsePhoneToJid(manualPhone);
    if (!jid) {
      toast.error('Número inválido');
      return;
    }

    const lead: Lead = {
      id: crypto.randomUUID(),
      phone: formatPhoneDisplay(manualPhone),
      name: manualName.trim() || undefined,
      jid,
      source: 'manual',
    };

    onLeadsImported([lead]);
    setManualPhone('');
    setManualName('');
    toast.success('Contato adicionado');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Número *</Label>
          <Input
            id="phone"
            placeholder="11999998888"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="name">Nome (opcional)</Label>
          <Input
            id="name"
            placeholder="João Silva"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={handleManualAdd} disabled={!manualPhone.trim()}>
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Contato
      </Button>
    </div>
  );
};

export default ManualTab;
