import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Users, MessageSquare, ChevronRight, Check, ArrowLeft, Database } from 'lucide-react';
import { toast } from 'sonner';
import InstanceSelector from '@/components/broadcast/InstanceSelector';
import type { Instance } from '@/types';
import GroupSelector from '@/components/broadcast/GroupSelector';
import type { Group } from '@/types';
import BroadcastMessageForm from '@/components/broadcast/BroadcastMessageForm';
import BroadcasterHeader from '@/components/broadcast/BroadcasterHeader';
import CreateLeadDatabaseDialog from '@/components/broadcast/CreateLeadDatabaseDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ResendData {
  messageType: string;
  content: string | null;
  mediaUrl: string | null;
  instanceId: string;
  instanceName: string | null;
  carouselData?: unknown;
}

const Broadcaster = () => {
  const [step, setStep] = useState<'instance' | 'groups' | 'message'>('instance');
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
  const [resendData, setResendData] = useState<ResendData | null>(null);
  const [showCreateDatabaseDialog, setShowCreateDatabaseDialog] = useState(false);

  useEffect(() => {
    const storedData = sessionStorage.getItem('resendData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        setResendData(parsed);
        sessionStorage.removeItem('resendData');
        toast.info('Selecione a instância e os grupos para reenviar a mensagem', {
          duration: 4000,
        });
      } catch (e) {
        console.error('Failed to parse resend data:', e);
        sessionStorage.removeItem('resendData');
      }
    }
  }, []);

  const handleInstanceSelect = (instance: Instance) => {
    setSelectedInstance(instance);
    setSelectedGroups([]);
    setStep('groups');
  };

  const handleComplete = () => {
    toast.success('Disparo concluído!');
    setSelectedGroups([]);
    setStep('instance');
    setSelectedInstance(null);
    setResendData(null);
  };

  const handleBack = () => {
    if (step === 'message') {
      setStep('groups');
    } else if (step === 'groups') {
      setStep('instance');
      setSelectedInstance(null);
      setSelectedGroups([]);
      setResendData(null);
    }
  };

  const handleChangeInstance = () => {
    setStep('instance');
    setSelectedInstance(null);
    setSelectedGroups([]);
    setResendData(null);
  };

  const handleContinueToMessage = () => {
    setStep('message');
  };

  return (
    <ErrorBoundary section="Broadcast">
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Disparador</h1>
          <p className="text-sm text-muted-foreground">
            Envie mensagens para múltiplos grupos de uma vez
          </p>
        </div>
        
        {step !== 'instance' && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="self-start sm:self-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        )}
      </div>

      {/* Resend Banner */}
      {resendData && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Reenviando mensagem</span>
              <Badge variant="secondary" className="text-xs">
                {resendData.messageType === 'text' ? 'Texto' : 
                 resendData.messageType === 'carousel' ? 'Carrossel' :
                 resendData.messageType === 'image' ? 'Imagem' :
                 resendData.messageType === 'video' ? 'Vídeo' :
                 resendData.messageType === 'audio' || resendData.messageType === 'ptt' ? 'Áudio' : 'Documento'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResendData(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
          </div>
          {resendData.content && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              "{resendData.content}"
            </p>
          )}
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className={`flex items-center gap-1.5 ${selectedInstance ? 'text-primary' : 'text-muted-foreground'}`}>
          {selectedInstance ? (
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 md:w-4 md:h-4 text-primary-foreground" />
            </div>
          ) : (
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</div>
          )}
          <span className="font-medium text-xs md:text-sm">Instância</span>
        </div>
        
        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
        
        <div className={`flex items-center gap-1.5 ${step === 'message' ? 'text-primary' : step === 'groups' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {step === 'message' ? (
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 md:w-4 md:h-4 text-primary-foreground" />
            </div>
          ) : (
            <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'groups' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>2</div>
          )}
          <span className="font-medium text-xs md:text-sm">Grupos</span>
          {selectedGroups.length > 0 && (
            <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">{selectedGroups.length}</Badge>
          )}
        </div>
        
        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
        
        <div className={`flex items-center gap-1.5 ${step === 'message' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'message' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>3</div>
          <span className="font-medium text-xs md:text-sm">Mensagem</span>
        </div>
      </div>

      {/* Step 1: Instance Selection */}
      {step === 'instance' && (
        <Card className="glass-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="w-5 h-5" />
              Selecionar Instância
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InstanceSelector
              selectedInstance={selectedInstance}
              onSelect={handleInstanceSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Group Selection */}
      {step === 'groups' && selectedInstance && (
        <div className="space-y-4">
          {/* Compact Header with Instance */}
          <BroadcasterHeader
            instance={selectedInstance}
            onChangeInstance={handleChangeInstance}
            showDatabase={false}
          />

          <Card className="glass-card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Selecionar Grupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <GroupSelector
                instance={selectedInstance}
                selectedGroups={selectedGroups}
                onSelectionChange={setSelectedGroups}
              />
              
              {selectedGroups.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateDatabaseDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    <span className="sm:inline">Criar Base</span>
                  </Button>
                  <Button onClick={handleContinueToMessage} className="w-full sm:w-auto">
                    Continuar ({selectedGroups.length})
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Message Composition */}
      {step === 'message' && selectedInstance && selectedGroups.length > 0 && (
        <div className="space-y-4">
          {/* Compact Header */}
          <BroadcasterHeader
            instance={selectedInstance}
            onChangeInstance={handleChangeInstance}
            showDatabase={false}
          />

          {/* Selected Groups Summary */}
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {selectedGroups.length} grupo{selectedGroups.length !== 1 ? 's' : ''} selecionado{selectedGroups.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedGroups.reduce((acc, g) => acc + g.size, 0)} membros no total
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep('groups')}>
                  Alterar seleção
                </Button>
              </div>
              
              {/* Group names preview */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedGroups.slice(0, 5).map((group) => (
                  <Badge key={group.id} variant="secondary" className="text-xs">
                    {group.name}
                  </Badge>
                ))}
                {selectedGroups.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedGroups.length - 5} mais
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message Form */}
          <BroadcastMessageForm
            instance={selectedInstance}
            selectedGroups={selectedGroups}
            onComplete={handleComplete}
            initialData={resendData ? {
              messageType: resendData.messageType,
              content: resendData.content,
              mediaUrl: resendData.mediaUrl,
              carouselData: resendData.carouselData,
            } : undefined}
          />
        </div>
      )}

      {/* Create Lead Database Dialog */}
      <CreateLeadDatabaseDialog
        open={showCreateDatabaseDialog}
        onOpenChange={setShowCreateDatabaseDialog}
        groups={selectedGroups}
        onSuccess={() => {
          setShowCreateDatabaseDialog(false);
          toast.success('Base criada! Acesse em Disparador > Leads');
        }}
      />
    </div>
    </ErrorBoundary>
  );
};

export default Broadcaster;
