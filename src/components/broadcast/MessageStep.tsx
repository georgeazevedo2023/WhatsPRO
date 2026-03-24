import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import type { Instance } from '@/types';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';
import type { LeadDatabase, ResendData } from '@/hooks/useLeadsBroadcaster';
import BroadcasterHeader from '@/components/broadcast/BroadcasterHeader';
import LeadMessageForm from '@/components/broadcast/LeadMessageForm';

interface MessageStepProps {
  instance: Instance;
  selectedDatabases: LeadDatabase[];
  selectedLeadsList: Lead[];
  resendData: ResendData | null;
  onChangeInstance: () => void;
  onChangeDatabase: () => void;
  onComplete: () => void;
}

const MessageStep = ({
  instance,
  selectedDatabases,
  selectedLeadsList,
  resendData,
  onChangeInstance,
  onChangeDatabase,
  onComplete,
}: MessageStepProps) => {
  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <BroadcasterHeader
        instance={instance}
        database={selectedDatabases}
        onChangeInstance={onChangeInstance}
        onChangeDatabase={onChangeDatabase}
      />

      {/* Selected Leads Summary */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {selectedLeadsList.length} contato{selectedLeadsList.length !== 1 ? 's' : ''} selecionado{selectedLeadsList.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Envio individual para cada número
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onChangeDatabase}>
              Alterar seleção
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedLeadsList.slice(0, 5).map((lead) => (
              <Badge key={lead.id} variant="secondary" className="text-xs">
                {lead.name || lead.phone}
              </Badge>
            ))}
            {selectedLeadsList.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{selectedLeadsList.length - 5} mais
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message Form */}
      <LeadMessageForm
        instance={instance}
        selectedLeads={selectedLeadsList}
        onComplete={onComplete}
        initialData={resendData ? {
          messageType: resendData.messageType,
          content: resendData.content,
          mediaUrl: resendData.mediaUrl,
          carouselData: resendData.carouselData,
        } : undefined}
      />
    </div>
  );
};

export default MessageStep;
