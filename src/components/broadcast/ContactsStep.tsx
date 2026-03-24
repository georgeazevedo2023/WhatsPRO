import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Users, ChevronRight, ShieldCheck, Loader2, Database, Save, Plus, Settings2 } from 'lucide-react';
import type { Instance } from '@/types';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';
import type { LeadDatabase } from '@/hooks/useLeadsBroadcaster';
import BroadcasterHeader from '@/components/broadcast/BroadcasterHeader';
import LeadImporter from '@/components/broadcast/LeadImporter';
import LeadList from '@/components/broadcast/LeadList';

interface ContactsStepProps {
  instance: Instance;
  databases: LeadDatabase[];
  selectedDatabases: LeadDatabase[];
  isLoadingDatabases: boolean;
  isCreatingNewDatabase: boolean;
  newDatabaseName: string;
  leads: Lead[];
  selectedLeads: Set<string>;
  isVerifying: boolean;
  verificationProgress: number;
  isSavingDatabase: boolean;
  isLoadingLeads: boolean;
  hasVerifiedLeads: boolean;
  validLeadsCount: number;
  invalidLeadsCount: number;
  hasUnsavedChanges: boolean;
  canSaveDatabase: string | boolean;
  onChangeInstance: () => void;
  onToggleDatabase: (db: LeadDatabase) => void;
  onStartNewDatabase: () => void;
  onNewDatabaseNameChange: (name: string) => void;
  onSaveDatabase: () => void;
  onUpdateDatabase: () => void;
  onManageDatabase: (db: LeadDatabase) => void;
  onLeadsImported: (leads: Lead[]) => void;
  onVerifyNumbers: () => void;
  onRemoveInvalid: () => void;
  onSelectOnlyValid: () => void;
  onClearLeads: () => void;
  onSelectionChange: (selection: Set<string>) => void;
  onContinueToMessage: () => void;
}

const ContactsStep = ({
  instance,
  databases,
  selectedDatabases,
  isLoadingDatabases,
  isCreatingNewDatabase,
  newDatabaseName,
  leads,
  selectedLeads,
  isVerifying,
  verificationProgress,
  isSavingDatabase,
  isLoadingLeads,
  hasVerifiedLeads,
  validLeadsCount,
  invalidLeadsCount,
  hasUnsavedChanges,
  canSaveDatabase,
  onChangeInstance,
  onToggleDatabase,
  onStartNewDatabase,
  onNewDatabaseNameChange,
  onSaveDatabase,
  onUpdateDatabase,
  onManageDatabase,
  onLeadsImported,
  onVerifyNumbers,
  onRemoveInvalid,
  onSelectOnlyValid,
  onClearLeads,
  onSelectionChange,
  onContinueToMessage,
}: ContactsStepProps) => {
  return (
    <div className="space-y-4">
      {/* Compact Header with Instance */}
      <BroadcasterHeader
        instance={instance}
        database={selectedDatabases}
        onChangeInstance={onChangeInstance}
        showDatabase={false}
      />

      {/* Database Selector - Multi-select Cards */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-3 block">Bases de Leads</Label>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-dashed justify-start gap-2"
              onClick={onStartNewDatabase}
              disabled={isLoadingDatabases}
            >
              <Plus className="w-4 h-4" />
              Criar Nova Base
            </Button>

            {isLoadingDatabases ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              databases.map(db => {
                const isSelected = selectedDatabases.some(d => d.id === db.id);
                return (
                  <div
                    key={db.id}
                    onClick={() => onToggleDatabase(db)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50"
                    )}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{db.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{db.leads_count ?? 0} contatos</span>
                  </div>
                );
              })
            )}
          </div>

          {/* New Database Name Input */}
          {isCreatingNewDatabase && (
            <div className="mt-3 pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Nome da Nova Base</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Clientes VIP..."
                  value={newDatabaseName}
                  onChange={(e) => onNewDatabaseNameChange(e.target.value)}
                />
                <Button
                  onClick={onSaveDatabase}
                  disabled={!canSaveDatabase || isSavingDatabase}
                  size="sm"
                  className="shrink-0"
                >
                  {isSavingDatabase ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {hasUnsavedChanges && !newDatabaseName.trim() && (
                <p className="text-xs text-destructive mt-2">
                  Digite um nome para salvar a base de leads
                </p>
              )}
            </div>
          )}

          {/* Database Actions - only when exactly 1 selected */}
          {selectedDatabases.length === 1 && !isCreatingNewDatabase && (
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageDatabase(selectedDatabases[0])}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Gerenciar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onUpdateDatabase}
                disabled={isSavingDatabase}
              >
                {isSavingDatabase ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Atualizar Base
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Section */}
      {!isLoadingLeads && (selectedDatabases.length > 0 || isCreatingNewDatabase) && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Importar Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadImporter
              instance={instance}
              onLeadsImported={onLeadsImported}
            />
          </CardContent>
        </Card>
      )}

      {/* Leads List */}
      {leads.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Contatos Importados
                <Badge variant="secondary">{leads.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onVerifyNumbers}
                  disabled={isVerifying || leads.length === 0}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando... {Math.round(verificationProgress)}%
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Verificar Números
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={onClearLeads}>
                  Limpar
                </Button>
              </div>
            </div>

            {hasVerifiedLeads && (
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t">
                <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20">
                  {validLeadsCount} válidos
                </Badge>
                <Badge variant="destructive" className="bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/20">
                  {invalidLeadsCount} inválidos
                </Badge>
                <div className="flex gap-2 ml-auto">
                  {invalidLeadsCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onRemoveInvalid} className="text-xs h-7 text-destructive hover:text-destructive">
                      Remover inválidos
                    </Button>
                  )}
                  {validLeadsCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onSelectOnlyValid} className="text-xs h-7">
                      Selecionar válidos
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <LeadList
              leads={leads}
              selectedLeads={selectedLeads}
              onSelectionChange={onSelectionChange}
            />

            {selectedLeads.size > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <Button onClick={onContinueToMessage}>
                  Continuar com {selectedLeads.size} contato{selectedLeads.size !== 1 ? 's' : ''}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContactsStep;
