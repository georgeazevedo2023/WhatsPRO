import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';
import type { Instance } from '@/types';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface GroupsTabProps {
  instance: Instance;
  onLeadsImported: (leads: Lead[]) => void;
}

const GroupsTab = ({ instance, onLeadsImported }: GroupsTabProps) => {
  const { groups, loading: loadingGroups, refetch } = useInstanceGroups({
    instanceId: instance.id,
    manual: true,
  });

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const handleGroupToggle = (groupId: string) => {
    const newSelection = new Set(selectedGroupIds);
    if (newSelection.has(groupId)) newSelection.delete(groupId);
    else newSelection.add(groupId);
    setSelectedGroupIds(newSelection);
  };

  const handleExtractFromGroups = () => {
    if (selectedGroupIds.size === 0) { toast.error('Selecione pelo menos um grupo'); return; }
    setIsExtracting(true);

    const leads: Lead[] = [];
    const seenPhones = new Set<string>();

    selectedGroupIds.forEach(groupId => {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      group.participants.forEach(participant => {
        if (participant.isAdmin || participant.isSuperAdmin) return;
        const phoneMatch = participant.jid?.match(/^(\d+)@/);
        if (!phoneMatch) return;
        const phone = phoneMatch[1];
        if (seenPhones.has(phone)) return;
        seenPhones.add(phone);

        leads.push({
          id: crypto.randomUUID(),
          phone: formatPhoneDisplay(phone),
          name: participant.name || undefined,
          jid: participant.jid,
          source: 'group',
          groupName: group.name,
        });
      });
    });

    setIsExtracting(false);

    if (leads.length > 0) {
      onLeadsImported(leads);
      setSelectedGroupIds(new Set());
      toast.success(`${leads.length} contato${leads.length !== 1 ? 's' : ''} extraído${leads.length !== 1 ? 's' : ''} dos grupos`);
    } else {
      toast.error('Nenhum membro encontrado nos grupos selecionados');
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  if (loadingGroups) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Clique para carregar os grupos</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Carregar Grupos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar grupo..."
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-64 border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredGroups.map(group => {
            const regularMembers = group.participants.filter(p => !p.isAdmin && !p.isSuperAdmin).length;
            return (
              <Card
                key={group.id}
                className={`cursor-pointer transition-all ${selectedGroupIds.has(group.id) ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => handleGroupToggle(group.id)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox
                    checked={selectedGroupIds.has(group.id)}
                    onCheckedChange={() => handleGroupToggle(group.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {regularMembers} membro{regularMembers !== 1 ? 's' : ''} (excluindo admins)
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {selectedGroupIds.size > 0 && (
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {selectedGroupIds.size} grupo{selectedGroupIds.size !== 1 ? 's' : ''} selecionado{selectedGroupIds.size !== 1 ? 's' : ''}
          </Badge>
          <Button onClick={handleExtractFromGroups} disabled={isExtracting}>
            {isExtracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
            Extrair Membros
          </Button>
        </div>
      )}
    </div>
  );
};

export { GroupsTab };
export type { GroupsTabProps };
export default GroupsTab;
