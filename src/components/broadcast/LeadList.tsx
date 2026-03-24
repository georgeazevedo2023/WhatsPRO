import { useState, useMemo, useCallback, memo, CSSProperties } from 'react';
import { List } from 'react-window';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CheckSquare, Square, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';

interface LeadListProps {
  leads: Lead[];
  selectedLeads: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

const ROW_HEIGHT = 52;

const getVerificationBadge = (lead: Lead) => {
  switch (lead.verificationStatus) {
    case 'valid':
      return (
        <Badge variant="default" className="text-xs bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          WhatsApp
        </Badge>
      );
    case 'invalid':
      return (
        <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/20">
          <XCircle className="w-3 h-3 mr-1" />
          Inválido
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Erro
        </Badge>
      );
    default:
      return null;
  }
};

const getSourceBadge = (source: Lead['source'], groupName?: string) => {
  switch (source) {
    case 'paste':
      return <Badge variant="outline" className="text-xs">Colado</Badge>;
    case 'manual':
      return <Badge variant="outline" className="text-xs">Manual</Badge>;
    case 'group':
      return (
        <Badge variant="secondary" className="text-xs truncate max-w-[120px]" title={groupName}>
          {groupName || 'Grupo'}
        </Badge>
      );
  }
};

interface LeadRowInlineProps {
  filteredLeads: Lead[];
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
}

function LeadRowComponent({
  index,
  style,
  filteredLeads,
  selectedLeads,
  onToggle,
}: { index: number; style: CSSProperties; ariaAttributes: Record<string, unknown> } & LeadRowInlineProps) {
  const lead = filteredLeads[index];
  if (!lead) return null;
  const isSelected = selectedLeads.has(lead.id);

  return (
    <div style={style} className="px-2">
      <div
        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-primary/10 border border-primary/20'
            : 'hover:bg-muted/50'
        }`}
        onClick={() => onToggle(lead.id)}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(lead.id)}
        />

        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {lead.verifiedName || lead.name || formatPhoneForDisplay(lead.phone || lead.jid?.split('@')[0] || '')}
          </p>
          {(lead.verifiedName || lead.name) && (
            <p className="text-xs text-muted-foreground">
              {formatPhoneForDisplay(lead.phone || lead.jid?.split('@')[0] || '')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {getVerificationBadge(lead)}
          {getSourceBadge(lead.source, lead.groupName)}
        </div>
      </div>
    </div>
  );
}

const LeadList = ({ leads, selectedLeads, onSelectionChange }: LeadListProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid' | 'pending'>('all');

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(lead =>
        lead.phone.includes(search) ||
        lead.name?.toLowerCase().includes(searchLower) ||
        lead.groupName?.toLowerCase().includes(searchLower) ||
        lead.verifiedName?.toLowerCase().includes(searchLower)
      );
    }
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        result = result.filter(l => !l.verificationStatus);
      } else {
        result = result.filter(l => l.verificationStatus === statusFilter);
      }
    }
    
    return result;
  }, [leads, search, statusFilter]);

  const handleToggle = useCallback((leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    onSelectionChange(newSelection);
  }, [selectedLeads, onSelectionChange]);

  const handleSelectAll = () => {
    const allIds = new Set(filteredLeads.map(l => l.id));
    onSelectionChange(allIds);
  };

  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeads.has(l.id));
  const hasVerifiedLeads = leads.some(l => l.verificationStatus);

  const rowProps = useMemo<LeadRowInlineProps>(() => ({
    filteredLeads,
    selectedLeads,
    onToggle: handleToggle,
  }), [filteredLeads, selectedLeads, handleToggle]);

  return (
    <div className="space-y-3">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, número ou grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {hasVerifiedLeads && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="valid">Válidos</SelectItem>
                <SelectItem value="invalid">Inválidos</SelectItem>
                <SelectItem value="pending">Não verificados</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={allSelected ? handleClearSelection : handleSelectAll}
            className="gap-1.5"
          >
            {allSelected ? (
              <>
                <Square className="w-4 h-4" />
                Limpar
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Selecionar todos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selection counter */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {selectedLeads.size} de {leads.length} selecionado{selectedLeads.size !== 1 ? 's' : ''}
        </span>
        {(search || statusFilter !== 'all') && filteredLeads.length !== leads.length && (
          <Badge variant="secondary" className="text-xs">
            {filteredLeads.length} resultado{filteredLeads.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Lead list — virtualized */}
      <div className="border rounded-lg overflow-hidden">
        {/* Total count indicator */}
        {filteredLeads.length > 0 && (
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/30">
            <span className="text-[11px] text-muted-foreground font-medium">
              {filteredLeads.length} {filteredLeads.length === 1 ? 'contato' : 'contatos'}
              {(search || statusFilter !== 'all') && filteredLeads.length !== leads.length && ' (filtrados)'}
            </span>
          </div>
        )}
        {filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {search || statusFilter !== 'all' ? 'Nenhum contato encontrado' : 'Nenhum contato importado'}
            </p>
          </div>
        ) : (
          <List
            rowCount={filteredLeads.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={LeadRowComponent}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rowProps={rowProps as any}
            overscanCount={5}
            style={{ height: 256 }}
          />
        )}
      </div>
    </div>
  );
};

export default LeadList;
