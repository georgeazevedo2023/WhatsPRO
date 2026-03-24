import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import type { Instance } from '@/types';
import { handleError } from '@/lib/errorUtils';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Server, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import InstanceOverview from '@/components/instance/InstanceOverview';
import InstanceGroups from '@/components/instance/InstanceGroups';
import InstanceStats from '@/components/instance/InstanceStats';
import InstanceHistory from '@/components/instance/InstanceHistory';


const InstanceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      fetchInstance();
    }
  }, [id]);

  const fetchInstance = async () => {
    try {
      setLoading(true);
      
      // Buscar instância
      const { data: instanceData, error: instanceError } = await supabase
        .from('instances')
        .select('*')
        .eq('id', id)
        .single();

      if (instanceError) throw instanceError;

      // Buscar perfil do usuário separadamente
      if (instanceData?.user_id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', instanceData.user_id)
          .single();

        if (profileData) {
          setInstance({
            ...instanceData,
            user_profiles: profileData,
          });
        } else {
          setInstance(instanceData);
        }
      } else {
        setInstance(instanceData);
      }

      // Atualizar status da UAZAPI
      await updateInstanceStatus();
    } catch (error) {
      handleError(error, 'Erro ao carregar instância', 'Fetch instance');
    } finally {
      setLoading(false);
    }
  };

  const updateInstanceStatus = async () => {
    try {
      const uazapiInstances = await uazapiProxy({ action: 'list' });
      if (!Array.isArray(uazapiInstances)) return;

      const uazapiInstance = uazapiInstances.find((inst: Record<string, unknown>) => inst.id === id);
      if (uazapiInstance) {
        const newStatus = uazapiInstance.status === 'connected' ? 'connected' : 'disconnected';
        
        if (instance && instance.status !== newStatus) {
          await supabase
            .from('instances')
            .update({
              status: newStatus,
              owner_jid: uazapiInstance.owner || instance.owner_jid,
              profile_pic_url: uazapiInstance.profilePicUrl || instance.profile_pic_url,
            })
            .eq('id', id);

          setInstance(prev => prev ? {
            ...prev,
            status: newStatus,
            owner_jid: uazapiInstance.owner || prev.owner_jid,
            profile_pic_url: uazapiInstance.profilePicUrl || prev.profile_pic_url,
          } : null);
        }
      }
    } catch (error) {
      handleError(error, 'Erro ao atualizar status', 'Update instance status');
    }
  };

  const isConnected = instance?.status === 'connected' || instance?.status === 'online';
  const phoneNumber = instance?.owner_jid?.split('@')[0];

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Server className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Instância não encontrada</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/instances')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Instâncias
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header com botão voltar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/dashboard/instances')}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Instâncias
      </Button>

      {/* Informações principais */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-border">
            <AvatarImage src={instance.profile_pic_url || undefined} />
            <AvatarFallback className="bg-secondary text-lg">
              <Server className="w-6 h-6 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            {phoneNumber && (
              <p className="text-muted-foreground">+{phoneNumber}</p>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 text-sm px-3 py-1',
            isConnected
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              Conectado
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Desconectado
            </>
          )}
        </Badge>
      </div>

      {/* Navegação customizada */}
      <div className="flex w-full bg-muted rounded-lg p-1 gap-1">
        {[
          { id: 'overview', label: 'Visão Geral' },
          { id: 'groups', label: 'Grupos' },
          { id: 'stats', label: 'Estatísticas' },
          { id: 'history', label: 'Histórico' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && <InstanceOverview instance={instance} onUpdate={fetchInstance} />}
        {activeTab === 'groups' && <InstanceGroups instance={instance} />}
        {activeTab === 'stats' && <InstanceStats instance={instance} />}
        {activeTab === 'history' && <InstanceHistory instance={instance} />}
      </div>
    </div>
  );
};

export default InstanceDetails;
