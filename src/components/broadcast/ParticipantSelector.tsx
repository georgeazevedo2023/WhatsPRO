import { useState, useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Search, CheckCircle2, XCircle } from 'lucide-react';
import type { Group } from '@/types';
import { formatPhoneDisplay } from '@/lib/phoneUtils';

interface ParticipantInfo {
  jid: string;
  displayName: string;
  pushName?: string;
  groupName: string;
  isLidOnly: boolean;
}

interface ParticipantSelectorProps {
  selectedGroups: Group[];
  selectedParticipants: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  disabled?: boolean;
}

// Verifica se o participante só tem LID (sem PhoneNumber real)
const isLidOnlyJid = (jid: string, phoneNumber?: string): boolean => {
  if (phoneNumber) return false;
  return jid.includes('@lid') || (!jid.includes('@s.whatsapp.net') && !jid.includes('@g.us'));
};

const ParticipantSelector = ({
  selectedGroups,
  selectedParticipants,
  onSelectionChange,
  disabled = false,
}: ParticipantSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Obtém membros únicos (não-admin, não-superadmin) com metadados
  const uniqueParticipants = useMemo((): ParticipantInfo[] => {
    const seenJids = new Set<string>();
    const participants: ParticipantInfo[] = [];

    for (const group of selectedGroups) {
      const regularMembers = group.participants.filter(
        (p) => !p.isAdmin && !p.isSuperAdmin
      );
      for (const member of regularMembers) {
        if (!seenJids.has(member.jid)) {
          seenJids.add(member.jid);
          
          const hasPhoneNumber = !!member.phoneNumber;
          const rawNumber = member.phoneNumber || member.jid || '';
          const isLid = isLidOnlyJid(member.jid, member.phoneNumber);
          
          // For LID participants: show PushName as primary, no "[Sem número]"
          const displayName = hasPhoneNumber
            ? formatPhoneDisplay(rawNumber)
            : isLid
              ? (member.name || member.jid.split('@')[0])
              : formatPhoneDisplay(rawNumber);
          
          participants.push({
            jid: member.jid,
            displayName,
            pushName: member.name,
            groupName: group.name,
            isLidOnly: isLid,
          });
        }
      }
    }

    return participants;
  }, [selectedGroups]);

  // Filtra participantes pela busca
  const filteredParticipants = useMemo(() => {
    if (!searchTerm.trim()) return uniqueParticipants;

    const search = searchTerm.toLowerCase().replace(/[+\-\s]/g, '');
    return uniqueParticipants.filter((p) => {
      const normalizedPhone = p.displayName.replace(/[+\-\s]/g, '').toLowerCase();
      const normalizedGroup = p.groupName.toLowerCase();
      const normalizedName = (p.pushName || '').toLowerCase();
      return normalizedPhone.includes(search) || 
             normalizedGroup.includes(search) || 
             normalizedName.includes(search);
    });
  }, [uniqueParticipants, searchTerm]);

  const handleToggle = useCallback(
    (jid: string) => {
      const newSet = new Set(selectedParticipants);
      if (newSet.has(jid)) {
        newSet.delete(jid);
      } else {
        newSet.add(jid);
      }
      onSelectionChange(newSet);
    },
    [selectedParticipants, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const newSet = new Set(uniqueParticipants.map((p) => p.jid));
    onSelectionChange(newSet);
  }, [uniqueParticipants, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const allSelected =
    uniqueParticipants.length > 0 &&
    uniqueParticipants.every((p) => selectedParticipants.has(p.jid));
  const noneSelected = selectedParticipants.size === 0;

  if (uniqueParticipants.length === 0) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border border-border/50 text-center text-muted-foreground">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum membro regular encontrado nos grupos selecionados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Participantes para envio</Label>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedParticipants.size} de {uniqueParticipants.length} selecionado(s)
        </span>
      </div>

      {/* Search and Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, nome ou grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={disabled || allSelected}
          className="shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Todos
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={disabled || noneSelected}
          className="shrink-0"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Limpar
        </Button>
      </div>

      {/* Participant List */}
      <ScrollArea className="h-[200px] rounded-md border border-border/50 bg-background">
        <div className="p-2 space-y-1">
          {filteredParticipants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum participante encontrado para "{searchTerm}"
            </p>
          ) : (
            filteredParticipants.map((participant) => (
              <div
                key={participant.jid}
                className={`flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer ${
                  selectedParticipants.has(participant.jid) ? 'bg-muted/30' : ''
                }`}
                onClick={() => !disabled && handleToggle(participant.jid)}
              >
                <Checkbox
                  checked={selectedParticipants.has(participant.jid)}
                  onCheckedChange={() => handleToggle(participant.jid)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  {participant.pushName ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{participant.pushName}</p>
                        {participant.isLidOnly && (
                          <Badge variant="outline" className="text-muted-foreground border-border text-[10px] px-1 py-0">
                            LID
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {participant.displayName} • {participant.groupName}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {participant.displayName}
                        </p>
                        {participant.isLidOnly && (
                          <Badge variant="outline" className="text-muted-foreground border-border text-[10px] px-1 py-0">
                            LID
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {participant.groupName}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selection Info */}
      {selectedParticipants.size > 0 && selectedParticipants.size < uniqueParticipants.length && (
        <p className="text-xs text-muted-foreground">
          {uniqueParticipants.length - selectedParticipants.size} participante(s) não receberão a mensagem.
        </p>
      )}
    </div>
  );
};

export default ParticipantSelector;
