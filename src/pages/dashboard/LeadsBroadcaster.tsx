import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, MessageSquare, ChevronRight, Check, ArrowLeft } from 'lucide-react';
import InstanceSelector from '@/components/broadcast/InstanceSelector';
import ContactsStep from '@/components/broadcast/ContactsStep';
import MessageStep from '@/components/broadcast/MessageStep';
import EditDatabaseDialog from '@/components/broadcast/EditDatabaseDialog';
import ManageLeadDatabaseDialog from '@/components/broadcast/ManageLeadDatabaseDialog';
import { useLeadsBroadcaster } from '@/hooks/useLeadsBroadcaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface Lead {
  id: string;
  phone: string;
  name?: string;
  jid: string;
  source: 'manual' | 'paste' | 'group';
  groupName?: string;
  isVerified?: boolean;
  verifiedName?: string;
  verificationStatus?: 'pending' | 'valid' | 'invalid' | 'error';
}

// Leads Broadcaster Component
const LeadsBroadcaster = () => {
  const {
    step,
    selectedInstance,
    selectedDatabases,
    databases,
    isLoadingDatabases,
    isCreatingNewDatabase,
    newDatabaseName,
    leads,
    selectedLeads,
    isVerifying,
    verificationProgress,
    isSavingDatabase,
    isLoadingLeads,
    editTarget,
    manageTarget,
    resendData,
    hasVerifiedLeads,
    validLeadsCount,
    invalidLeadsCount,
    selectedLeadsList,
    hasUnsavedChanges,
    canSaveDatabase,
    setStep,
    setNewDatabaseName,
    setSelectedLeads,
    setEditTarget,
    setManageTarget,
    setResendData,
    handleInstanceSelect,
    handleToggleDatabase,
    handleSaveDatabase,
    handleUpdateDatabase,
    handleLeadsImported,
    handleVerifyNumbers,
    handleRemoveInvalid,
    handleSelectOnlyValid,
    handleContinueToMessage,
    handleComplete,
    handleBack,
    handleChangeInstance,
    handleClearLeads,
    handleDatabaseUpdated,
    handleStartNewDatabase,
  } = useLeadsBroadcaster();

  return (
    <ErrorBoundary section="Broadcast Leads">
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Disparador de Leads</h1>
          <p className="text-muted-foreground">
            Envie mensagens para contatos individuais
          </p>
        </div>

        {step !== 'instance' && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
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

      {/* Progress Steps - Optimized: 3 steps */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-2 ${selectedInstance ? 'text-primary' : 'text-muted-foreground'}`}>
          {selectedInstance ? (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</div>
          )}
          <span className="font-medium">Instância</span>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground" />

        <div className={`flex items-center gap-2 ${step === 'message' ? 'text-primary' : step === 'contacts' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {step === 'message' ? (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'contacts' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>2</div>
          )}
          <span className="font-medium">Base + Contatos</span>
          {leads.length > 0 && (
            <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground" />

        <div className={`flex items-center gap-2 ${step === 'message' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'message' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>3</div>
          <span className="font-medium">Mensagem</span>
        </div>
      </div>

      {/* Step 1: Instance Selection */}
      {step === 'instance' && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
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

      {/* Step 2: Combined Base + Contacts */}
      {step === 'contacts' && selectedInstance && (
        <ContactsStep
          instance={selectedInstance}
          databases={databases}
          selectedDatabases={selectedDatabases}
          isLoadingDatabases={isLoadingDatabases}
          isCreatingNewDatabase={isCreatingNewDatabase}
          newDatabaseName={newDatabaseName}
          leads={leads}
          selectedLeads={selectedLeads}
          isVerifying={isVerifying}
          verificationProgress={verificationProgress}
          isSavingDatabase={isSavingDatabase}
          isLoadingLeads={isLoadingLeads}
          hasVerifiedLeads={hasVerifiedLeads}
          validLeadsCount={validLeadsCount}
          invalidLeadsCount={invalidLeadsCount}
          hasUnsavedChanges={hasUnsavedChanges}
          canSaveDatabase={canSaveDatabase}
          onChangeInstance={handleChangeInstance}
          onToggleDatabase={handleToggleDatabase}
          onStartNewDatabase={handleStartNewDatabase}
          onNewDatabaseNameChange={setNewDatabaseName}
          onSaveDatabase={handleSaveDatabase}
          onUpdateDatabase={handleUpdateDatabase}
          onManageDatabase={setManageTarget}
          onLeadsImported={handleLeadsImported}
          onVerifyNumbers={handleVerifyNumbers}
          onRemoveInvalid={handleRemoveInvalid}
          onSelectOnlyValid={handleSelectOnlyValid}
          onClearLeads={handleClearLeads}
          onSelectionChange={setSelectedLeads}
          onContinueToMessage={handleContinueToMessage}
        />
      )}

      {/* Step 3: Message Composition */}
      {step === 'message' && selectedInstance && selectedLeadsList.length > 0 && (
        <MessageStep
          instance={selectedInstance}
          selectedDatabases={selectedDatabases}
          selectedLeadsList={selectedLeadsList}
          resendData={resendData}
          onChangeInstance={handleChangeInstance}
          onChangeDatabase={() => setStep('contacts')}
          onComplete={handleComplete}
        />
      )}

      {/* Edit Database Dialog */}
      <EditDatabaseDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        database={editTarget}
        onSave={handleDatabaseUpdated}
      />

      {/* Manage Database Dialog */}
      <ManageLeadDatabaseDialog
        open={!!manageTarget}
        onOpenChange={(open) => !open && setManageTarget(null)}
        database={manageTarget}
        onDatabaseUpdated={(updated) => {
          handleDatabaseUpdated(updated);
          setManageTarget(updated);
        }}
      />
    </div>
    </ErrorBoundary>
  );
};

export default LeadsBroadcaster;
