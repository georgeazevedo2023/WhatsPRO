import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import {
  CommandDialog, CommandInput, CommandList,
  CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, MessageSquare, User, Phone } from 'lucide-react';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const { query, setQuery, results, loading, isSearching } = useGlobalSearch();

  const handleSelect = (result: typeof results[0]) => {
    onOpenChange(false);
    setQuery('');
    navigate(`/dashboard/helpdesk?inbox=${result.inbox_id}&conv=${result.conversation_id}`);
  };

  // Group results by inbox
  const grouped = results.reduce<Record<string, typeof results>>((acc, r) => {
    const key = r.inbox_name || 'Sem inbox';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const matchIcon = (type: string) => {
    if (type === 'contact_name') return <User className="w-3 h-3" />;
    if (type === 'phone') return <Phone className="w-3 h-3" />;
    return <MessageSquare className="w-3 h-3" />;
  };

  const statusColor = (s: string) => {
    if (s === 'aberta') return 'bg-emerald-500';
    if (s === 'pendente') return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar por nome, telefone ou mensagem em todas as caixas..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Buscando...</span>
          </div>
        )}

        {!loading && isSearching && results.length === 0 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {!loading && !isSearching && query.length > 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Digite pelo menos 3 caracteres para buscar
          </div>
        )}

        {!loading && !isSearching && query.length === 0 && (
          <div className="py-6 text-center">
            <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Busque conversas em todas as caixas de entrada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Nome do contato, telefone ou conteudo de mensagem</p>
          </div>
        )}

        {Object.entries(grouped).map(([inboxName, items]) => (
          <CommandGroup key={inboxName} heading={inboxName}>
            {items.map((r) => (
              <CommandItem
                key={r.conversation_id}
                value={`${r.contact_name} ${r.contact_phone} ${r.message_snippet}`}
                onSelect={() => handleSelect(r)}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={r.contact_profile_pic_url || undefined} />
                  <AvatarFallback className="text-xs bg-muted">
                    {(r.contact_name || r.contact_phone || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {r.contact_name || r.contact_phone}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor(r.status)}`} />
                  </div>
                  {r.match_type === 'message' && r.message_snippet && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {r.message_snippet}
                    </p>
                  )}
                  {r.match_type === 'phone' && r.contact_name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {r.contact_phone}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                    {matchIcon(r.match_type)}
                    {r.match_type === 'contact_name' ? 'Nome' : r.match_type === 'phone' ? 'Tel' : 'Msg'}
                  </Badge>
                  {r.last_message_at && (
                    <span className="text-[10px] text-muted-foreground">{formatDate(r.last_message_at)}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
