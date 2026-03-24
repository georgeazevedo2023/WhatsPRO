import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Users, MessageSquare, Image } from 'lucide-react';
import { useInstanceGroups } from '@/hooks/useInstanceGroups';
import type { Instance, Group, Participant } from '@/types';
import SendMessageForm from '@/components/group/SendMessageForm';
import SendMediaForm from '@/components/group/SendMediaForm';

export type { Participant };

const SendToGroup = () => {
  const { instanceId, groupId } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);

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
    navigate(`/dashboard/instances/${instanceId}/groups/${groupId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!group || !instance) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Users className="w-16 h-16 text-muted-foreground" />
          <h3 className="text-lg font-medium">Grupo não encontrado</h3>
          <Button variant="outline" onClick={() => navigate(`/dashboard/instances/${instanceId}?tab=groups`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Enviar para o Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Mídia
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <SendMessageForm
                instanceToken={instance.id}
                groupJid={group.id}
                groupName={group.name}
                participants={group.participants}
              />
            </TabsContent>

            <TabsContent value="media">
              <SendMediaForm
                instanceToken={instance.id}
                groupJid={group.id}
                groupName={group.name}
                participants={group.participants}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SendToGroup;
