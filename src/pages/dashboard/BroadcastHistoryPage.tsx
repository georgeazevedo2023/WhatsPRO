import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BroadcastHistory from '@/components/broadcast/BroadcastHistory';
import ResendOptionsDialog from '@/components/broadcast/ResendOptionsDialog';

interface BroadcastLog {
  id: string;
  instance_id: string;
  instance_name: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  carousel_data: unknown;
  groups_targeted: number;
}

const BroadcastHistoryPage = () => {
  const navigate = useNavigate();
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);

  const handleResendClick = (log: BroadcastLog) => {
    setSelectedLog(log);
    setResendDialogOpen(true);
  };

  const handleResendConfirm = (options: {
    destination: 'groups' | 'leads';
    excludeAdmins: boolean;
  }) => {
    if (!selectedLog) return;

    // Store resend data in sessionStorage
    sessionStorage.setItem('resendData', JSON.stringify({
      messageType: selectedLog.message_type,
      content: selectedLog.content,
      mediaUrl: selectedLog.media_url,
      instanceId: selectedLog.instance_id,
      instanceName: selectedLog.instance_name,
      carouselData: selectedLog.carousel_data,
      excludeAdmins: options.excludeAdmins,
    }));
    
    // Navigate to appropriate broadcaster
    if (options.destination === 'leads') {
      navigate('/dashboard/broadcast/leads');
    } else {
      navigate('/dashboard/broadcast');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Envios</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie o histórico de mensagens enviadas
        </p>
      </div>
      <BroadcastHistory onResend={handleResendClick} />

      {/* Resend Options Dialog */}
      {selectedLog && (
        <ResendOptionsDialog
          open={resendDialogOpen}
          onOpenChange={setResendDialogOpen}
          onConfirm={handleResendConfirm}
          messageType={selectedLog.message_type}
          originalTarget={selectedLog.groups_targeted === 0 ? 'leads' : 'groups'}
        />
      )}
    </div>
  );
};

export default BroadcastHistoryPage;
