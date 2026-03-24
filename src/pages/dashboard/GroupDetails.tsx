import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { Instance } from '@/types';
import { toast } from 'sonner';
import { ArrowLeft, Users, Search, MessageSquare } from 'lucide-react';
import { formatPhoneSimple as formatPhone } from '@/lib/phoneUtils';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';

const GroupDetails = () => {
  const { instanceId, groupId } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchInstance = async () => {
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('id', instanceId)
        .single();

      if (error || !data) {
        toast.error('Instância não encontrada');
        navigate('/dashboard/instances');
        return;
      }
      setInstance(data);
      setLoadingInstance(false);
    };
    fetchInstance();
  }, [instanceId]);

  const { groups, loading: loadingGroups } = useInstanceGroups({
    instanceId: instanceId || '',
    enabled: !!instance,
  });

  const loading = loadingInstance || loadingGroups;

  const decodedGroupId = decodeURIComponent(groupId || '');
  const group = groups.find(g => g.id === decodedGroupId) || null;

  const handleBack = () => {
    navigate(`/dashboard/instances/${instanceId}?tab=groups`);
  };

  // Sort participants: superadmin > admin > members
  const sortedParticipants = group?.participants
    ? [...group.participants].sort((a, b) => {
        const order = (p: typeof a) => p.isSuperAdmin ? 0 : p.isAdmin ? 1 : 2;
        return order(a) - order(b);
      })
    : [];

  const filteredParticipants = sortedParticipants.filter((p) => {
    const phone = formatPhone(p.jid).toLowerCase();
    const name = (p.name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return phone.includes(search) || name.includes(search);
  });

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Users className="w-16 h-16 text-muted-foreground" />
          <h3 className="text-lg font-medium">Grupo não encontrado</h3>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16 border">
          <AvatarImage src={group.pictureUrl} />
          <AvatarFallback className="bg-primary/10 text-primary">
            <Users className="w-8 h-8" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            {group.size} participante{group.size !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Button
        onClick={() => navigate(`/dashboard/instances/${instanceId}/groups/${groupId}/send`)}
        className="w-full sm:w-auto"
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Enviar Mensagem para o Grupo
      </Button>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar participante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {searchTerm && (
        <Badge variant="secondary">
          {filteredParticipants.length} de {sortedParticipants.length} participantes
        </Badge>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredParticipants.map((participant, idx) => (
          <div
            key={participant.jid || idx}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-secondary text-sm font-medium">
                {idx + 1}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {participant.name || formatPhone(participant.jid)}
              </p>
              {participant.name && (
                <p className="text-sm text-muted-foreground truncate">
                  {formatPhone(participant.jid)}
                </p>
              )}
            </div>
            {(participant.isAdmin || participant.isSuperAdmin) && (
              <Badge variant="outline" className="text-xs shrink-0">
                {participant.isSuperAdmin ? 'Dono' : 'Admin'}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {filteredParticipants.length === 0 && searchTerm && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 space-y-2">
            <Search className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum participante encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GroupDetails;
