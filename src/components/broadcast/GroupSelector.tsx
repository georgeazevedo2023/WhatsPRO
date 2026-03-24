import { useMemo, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, CheckSquare, Square, MessageSquare } from 'lucide-react';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';
import type { Instance, Group } from '@/types';
import { useState } from 'react';

interface GroupSelectorProps {
  instance: Instance;
  selectedGroups: Group[];
  onSelectionChange: (groups: Group[]) => void;
}

const GroupSelector = ({ instance, selectedGroups, onSelectionChange }: GroupSelectorProps) => {
  const { groups, loading } = useInstanceGroups({ instanceId: instance.id });
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() =>
    groups.filter((group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [groups, searchTerm]
  );

  const toggleGroup = useCallback((group: Group) => {
    if (selectedGroups.some(g => g.id === group.id)) {
      onSelectionChange(selectedGroups.filter(g => g.id !== group.id));
    } else {
      onSelectionChange([...selectedGroups, group]);
    }
  }, [selectedGroups, onSelectionChange]);

  const selectAll = useCallback(() => {
    onSelectionChange(filteredGroups);
  }, [filteredGroups, onSelectionChange]);

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const { totalMembers, totalRegularMembers } = useMemo(() => {
    const totalMembers = selectedGroups.reduce((acc, g) => acc + g.size, 0);
    const totalRegularMembers = selectedGroups.reduce((acc, g) => {
      const regular = g.participants.filter(p => !p.isAdmin && !p.isSuperAdmin);
      return acc + regular.length;
    }, 0);
    return { totalMembers, totalRegularMembers };
  }, [selectedGroups]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare className="w-4 h-4 mr-2" />
            Todos
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <Square className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Selection Counter */}
      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Badge variant="secondary" className="gap-1">
            <MessageSquare className="w-3 h-3" />
            {selectedGroups.length} grupo{selectedGroups.length !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {totalMembers} membro{totalMembers !== 1 ? 's' : ''} total
          </Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            {totalRegularMembers} não-admin{totalRegularMembers !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo disponível'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGroups.map((group) => {
            const selected = selectedGroups.some(g => g.id === group.id);
            const regularCount = group.participants.filter(p => !p.isAdmin && !p.isSuperAdmin).length;

            return (
              <Card
                key={group.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md border-border/40 ${
                  selected ? 'ring-2 ring-primary bg-primary/5 border-primary/30' : 'hover:border-border/60'
                }`}
                onClick={() => toggleGroup(group)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleGroup(group)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {group.pictureUrl ? (
                      <img
                        src={group.pictureUrl}
                        alt={group.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <Users className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{group.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {group.size} membro{group.size !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {regularCount} não-admin{regularCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(GroupSelector);
