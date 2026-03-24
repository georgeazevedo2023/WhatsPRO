import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId } from '@/hooks/useAuthSession';
import { uazapiProxyRaw } from '@/lib/uazapiClient';
import { getAccessToken } from '@/hooks/useAuthSession';
import { Send, Users, Clock } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { toast } from '@/hooks/use-toast';
import SendStatusModal, { SendStatus } from './SendStatusModal';
import { ScheduleMessageDialog, ScheduleConfig } from './ScheduleMessageDialog';
import type { Participant } from '@/pages/dashboard/SendToGroup';

interface SendMessageFormProps {
  instanceToken: string; // now used as instance_id
  groupJid: string;
  groupName?: string;
  participants?: Participant[];
  onMessageSent?: () => void;
}

const MAX_MESSAGE_LENGTH = 4096;
const SEND_DELAY_MS = 350; // Delay entre envios para rate limiting

const SendMessageForm = ({ instanceToken, groupJid, groupName, participants, onMessageSent }: SendMessageFormProps) => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [message, setMessage] = useState('');
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Contagem de membros comuns (não admins/donos)
  const regularMembers = participants?.filter(p => !p.isAdmin && !p.isSuperAdmin) || [];
  const regularMemberCount = regularMembers.length;

  const sendToNumber = async (number: string, text: string, accessToken: string) => {
    return uazapiProxyRaw(accessToken, {
      action: 'send-message',
      instance_id: instanceToken,
      groupjid: number,
      message: text,
    });
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      setErrorMessage('Digite uma mensagem');
      setSendStatus('error');
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setErrorMessage(`Mensagem muito longa (máximo ${MAX_MESSAGE_LENGTH} caracteres)`);
      setSendStatus('error');
      return;
    }

    setSendStatus('sending');
    setErrorMessage('');

    try {
      const accessToken = await getAccessToken();

      if (excludeAdmins && participants && regularMembers.length > 0) {
        // Envio individual para membros não-admins
        setSendingProgress({ current: 0, total: regularMembers.length });
        let failCount = 0;

        for (let i = 0; i < regularMembers.length; i++) {
          try {
            await sendToNumber(regularMembers[i].jid, trimmedMessage, accessToken);
          } catch (err) {
            console.error(`Erro ao enviar para ${regularMembers[i].jid}:`, err);
            failCount++;
          }
          
          setSendingProgress({ current: i + 1, total: regularMembers.length });
          
          // Delay entre envios (exceto no último)
          if (i < regularMembers.length - 1) {
            await delay(SEND_DELAY_MS);
          }
        }

        if (failCount > 0) {
          setErrorMessage(`${failCount} de ${regularMembers.length} mensagens falharam`);
          setSendStatus('error');
          return;
        }
      } else {
        // Envio normal para o grupo
        await sendToNumber(groupJid, trimmedMessage, accessToken);
      }

      setSendStatus('success');
      setMessage('');
      setSendingProgress({ current: 0, total: 0 });
      onMessageSent?.();
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
      setSendStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCloseModal = () => {
    setSendStatus('idle');
    setErrorMessage('');
    setSendingProgress({ current: 0, total: 0 });
  };

  const handleSchedule = async (config: ScheduleConfig) => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      toast({ title: 'Erro', description: 'Digite uma mensagem', variant: 'destructive' });
      return;
    }

    if (!instanceId) {
      toast({ title: 'Erro', description: 'Instância não encontrada', variant: 'destructive' });
      return;
    }

    setIsScheduling(true);

    try {
      const userId = await getSessionUserId();

      const recipients = excludeAdmins && regularMembers.length > 0
        ? regularMembers.map(m => ({ jid: m.jid }))
        : null;

      const { error } = await supabase.from('scheduled_messages').insert({
        user_id: userId,
        instance_id: instanceId,
        group_jid: groupJid,
        group_name: groupName || null,
        exclude_admins: excludeAdmins,
        recipients,
        message_type: 'text',
        content: trimmedMessage,
        scheduled_at: config.scheduledAt.toISOString(),
        next_run_at: config.scheduledAt.toISOString(),
        is_recurring: config.isRecurring,
        recurrence_type: config.isRecurring ? config.recurrenceType : null,
        recurrence_interval: config.recurrenceInterval,
        recurrence_days: config.recurrenceDays.length > 0 ? config.recurrenceDays : null,
        recurrence_end_at: config.recurrenceEndAt?.toISOString() || null,
        recurrence_count: config.recurrenceCount || null,
        random_delay: config.randomDelay,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Agendado com sucesso!',
        description: `Mensagem será enviada em ${config.scheduledAt.toLocaleDateString('pt-BR')} às ${config.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      });

      setMessage('');
      setShowScheduleDialog(false);
      onMessageSent?.();
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast({
        title: 'Erro ao agendar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > MAX_MESSAGE_LENGTH;
  const isSending = sendStatus === 'sending';

  return (
    <>
      <SendStatusModal
        status={sendStatus}
        message={errorMessage}
        onClose={handleCloseModal}
        progress={sendingProgress.total > 1 ? sendingProgress : undefined}
      />

      <div className="space-y-3">
        <Textarea
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          className="min-h-[100px] resize-none"
          maxLength={MAX_MESSAGE_LENGTH + 100}
        />
        
        <div className="flex items-center justify-between">
          <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} disabled={isSending} />
          <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {characterCount.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()} caracteres
          </span>
        </div>

        {/* Toggle para excluir admins */}
        {participants && participants.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="exclude-admins" className="text-sm font-medium cursor-pointer">
                  Não enviar para Admins/Donos
                </Label>
                <p className="text-xs text-muted-foreground">
                  {excludeAdmins 
                    ? `Enviará para ${regularMemberCount} membro${regularMemberCount !== 1 ? 's' : ''} comum${regularMemberCount !== 1 ? 'ns' : ''}`
                    : 'Envia para todos do grupo'
                  }
                </p>
              </div>
            </div>
            <Switch
              id="exclude-admins"
              checked={excludeAdmins}
              onCheckedChange={setExcludeAdmins}
              disabled={isSending}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowScheduleDialog(true)}
            disabled={isSending || !message.trim() || isOverLimit}
            size="sm"
          >
            <Clock className="w-4 h-4 mr-2" />
            Agendar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim() || isOverLimit || (excludeAdmins && regularMemberCount === 0)}
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {excludeAdmins ? `Enviar para ${regularMemberCount}` : 'Enviar'}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Pressione Ctrl+Enter para enviar rapidamente
        </p>
      </div>

      <ScheduleMessageDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onConfirm={handleSchedule}
        isLoading={isScheduling}
      />
    </>
  );
};

export default SendMessageForm;
