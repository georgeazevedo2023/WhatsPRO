import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId, getAccessToken } from '@/hooks/useAuthSession';
import { uazapiProxyRaw } from '@/lib/uazapiClient';
import { Image, FileIcon, Upload, Send, X, Video, Mic, Users, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import SendStatusModal, { SendStatus } from './SendStatusModal';
import { ScheduleMessageDialog, ScheduleConfig } from './ScheduleMessageDialog';
import type { Participant } from '@/pages/dashboard/SendToGroup';

interface SendMediaFormProps {
  instanceToken: string; // now used as instance_id
  groupJid: string;
  groupName?: string;
  participants?: Participant[];
  onMediaSent?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/mp3'];

const SEND_DELAY_MS = 350; // Delay entre envios para rate limiting

const SendMediaForm = ({ instanceToken, groupJid, groupName, participants, onMediaSent }: SendMediaFormProps) => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'file'>('image');
  const [isPtt, setIsPtt] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [filename, setFilename] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contagem de membros comuns (não admins/donos)
  const regularMembers = participants?.filter(p => !p.isAdmin && !p.isSuperAdmin) || [];
  const regularMemberCount = regularMembers.length;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Arquivo muito grande (máximo 10MB)');
      setSendStatus('error');
      return;
    }

    if (mediaType === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage('Tipo de imagem não suportado. Use JPG, PNG, GIF ou WebP');
      setSendStatus('error');
      return;
    }

    if (mediaType === 'video' && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setErrorMessage('Tipo de vídeo não suportado. Use apenas MP4');
      setSendStatus('error');
      return;
    }

    if (mediaType === 'audio' && !ALLOWED_AUDIO_TYPES.includes(file.type)) {
      setErrorMessage('Tipo de áudio não suportado. Use MP3 ou OGG');
      setSendStatus('error');
      return;
    }

    setSelectedFile(file);
    setFilename(file.name);

    // Create preview for images and audio
    if (mediaType === 'image' && ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (mediaType === 'audio' && ALLOWED_AUDIO_TYPES.includes(file.type)) {
      const audioUrl = URL.createObjectURL(file);
      setPreviewUrl(audioUrl);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearFile = () => {
    // Revoke object URL to prevent memory leaks
    if (previewUrl && mediaType === 'audio') {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFilename('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sendMediaToNumber = async (number: string, finalMediaUrl: string, accessToken: string) => {
    const payload: Record<string, unknown> = {
      action: 'send-media',
      instance_id: instanceToken,
      groupjid: number,
      mediaUrl: finalMediaUrl,
      mediaType: mediaType === 'image' 
        ? 'image' 
        : mediaType === 'video' 
          ? 'video' 
          : mediaType === 'audio' 
            ? (isPtt ? 'ptt' : 'audio') 
            : 'document',
      caption: caption.trim(),
    };

    if (mediaType === 'file' && filename.trim()) {
      payload.filename = filename.trim();
    }

    try {
      return await uazapiProxyRaw(accessToken, payload);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao enviar mídia';
      if (errorMsg.includes('certificate') || errorMsg.includes('tls')) {
        throw new Error('URL com certificado SSL inválido. Tente fazer upload direto ou usar outra URL.');
      } else if (errorMsg.includes('fetch') && errorMsg.includes('URL')) {
        throw new Error('Não foi possível acessar a URL. Verifique se o link é válido ou faça upload direto.');
      }
      throw err;
    }
  };

  const handleSend = async () => {
    const finalMediaUrl = selectedFile ? await fileToBase64(selectedFile) : mediaUrl.trim();

    if (!finalMediaUrl) {
      setErrorMessage('Informe a URL ou selecione um arquivo');
      setSendStatus('error');
      return;
    }

    if (mediaType === 'file' && !filename.trim()) {
      setErrorMessage('Informe o nome do arquivo');
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
            await sendMediaToNumber(regularMembers[i].jid, finalMediaUrl, accessToken);
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
          setErrorMessage(`${failCount} de ${regularMembers.length} envios falharam`);
          setSendStatus('error');
          return;
        }
      } else {
        // Envio normal para o grupo
        await sendMediaToNumber(groupJid, finalMediaUrl, accessToken);
      }

      setSendStatus('success');
      
      // Clear form
      setMediaUrl('');
      setCaption('');
      setFilename('');
      clearFile();
      setSendingProgress({ current: 0, total: 0 });
      
      onMediaSent?.();
    } catch (error) {
      console.error('Error sending media:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar mídia');
      setSendStatus('error');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCloseModal = () => {
    setSendStatus('idle');
    setErrorMessage('');
    setSendingProgress({ current: 0, total: 0 });
  };

  const handleSchedule = async (config: ScheduleConfig) => {
    // Para agendamento de mídia, precisamos de uma URL (não arquivo local)
    if (selectedFile) {
      toast({
        title: 'Erro',
        description: 'Para agendar, use uma URL de mídia ao invés de arquivo local',
        variant: 'destructive',
      });
      return;
    }

    const finalMediaUrl = mediaUrl.trim();
    if (!finalMediaUrl) {
      toast({ title: 'Erro', description: 'Informe a URL da mídia', variant: 'destructive' });
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

      const messageTypeToSave = mediaType === 'audio' && isPtt ? 'ptt' : 
                                 mediaType === 'file' ? 'document' : mediaType;

      const { error } = await supabase.from('scheduled_messages').insert({
        user_id: userId,
        instance_id: instanceId,
        group_jid: groupJid,
        group_name: groupName || null,
        exclude_admins: excludeAdmins,
        recipients,
        message_type: messageTypeToSave,
        content: caption.trim() || null,
        media_url: finalMediaUrl,
        filename: mediaType === 'file' ? filename.trim() : null,
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
        description: `Mídia será enviada em ${config.scheduledAt.toLocaleDateString('pt-BR')} às ${config.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      });

      setMediaUrl('');
      setCaption('');
      setFilename('');
      setShowScheduleDialog(false);
      onMediaSent?.();
    } catch (error) {
      console.error('Error scheduling media:', error);
      toast({
        title: 'Erro ao agendar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const isSending = sendStatus === 'sending';

  const canSend = (mediaUrl.trim() || selectedFile) && (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' || filename.trim()) && (!excludeAdmins || regularMemberCount > 0);

  return (
    <>
      <SendStatusModal
        status={sendStatus}
        message={errorMessage}
        mediaType={
          mediaType === 'image' ? 'image' : 
          mediaType === 'video' ? 'video' : 
          mediaType === 'audio' ? (isPtt ? 'ptt' : 'audio') : 
          'document'
        }
        progress={sendingProgress.total > 1 ? sendingProgress : undefined}
        onClose={handleCloseModal}
      />

      <div className="space-y-4">
        <Tabs value={mediaType} onValueChange={(v) => { setMediaType(v as 'image' | 'video' | 'audio' | 'file'); clearFile(); setMediaUrl(''); setIsPtt(false); }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Imagem
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Vídeo
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Áudio
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <FileIcon className="w-4 h-4" />
              Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL da Imagem</Label>
              <Input
                placeholder="https://exemplo.com/imagem.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={!!selectedFile}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OU</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label>Selecionar do dispositivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!mediaUrl}
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher Imagem
              </Button>
            </div>

            {/* Preview */}
            {previewUrl && (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-48 rounded-lg border"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 w-6 h-6"
                  onClick={clearFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL do Vídeo</Label>
              <Input
                placeholder="https://exemplo.com/video.mp4"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={!!selectedFile}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OU</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label>Selecionar do dispositivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!mediaUrl}
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher Vídeo
              </Button>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Video className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6"
                  onClick={clearFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL do Áudio</Label>
              <Input
                placeholder="https://exemplo.com/audio.mp3"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={!!selectedFile}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OU</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label>Selecionar do dispositivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/ogg,audio/mp3"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!mediaUrl}
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher Áudio
              </Button>
            </div>

            {selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Mic className="w-5 h-5 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-6 h-6"
                    onClick={clearFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {previewUrl && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <audio 
                      src={previewUrl} 
                      controls 
                      className="w-full h-10"
                      controlsList="nodownload"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ptt"
                checked={isPtt}
                onCheckedChange={(checked) => setIsPtt(checked === true)}
              />
              <Label htmlFor="ptt" className="text-sm font-normal cursor-pointer">
                Enviar como mensagem de voz (PTT)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              PTT aparece como "bolinha" de áudio no WhatsApp
            </p>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL do Arquivo</Label>
              <Input
                placeholder="https://exemplo.com/documento.pdf"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={!!selectedFile}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OU</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label>Selecionar do dispositivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!mediaUrl}
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher Arquivo
              </Button>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileIcon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6"
                  onClick={clearFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome do Arquivo *</Label>
              <Input
                placeholder="documento.pdf"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Caption (shared) */}
        <div className="space-y-2">
          <Label>Legenda (opcional)</Label>
          <Textarea
            placeholder="Adicione uma legenda..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[60px] resize-none"
            maxLength={1024}
            disabled={isSending}
          />
        </div>

        {/* Toggle para excluir admins */}
        {participants && participants.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="exclude-admins-media" className="text-sm font-medium cursor-pointer">
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
              id="exclude-admins-media"
              checked={excludeAdmins}
              onCheckedChange={setExcludeAdmins}
              disabled={isSending}
            />
          </div>
        )}

        {/* Send buttons */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowScheduleDialog(true)}
            disabled={!mediaUrl.trim() || isSending || (mediaType === 'file' && !filename.trim())}
            size="sm"
          >
            <Clock className="w-4 h-4 mr-2" />
            Agendar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || isSending}
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {excludeAdmins 
              ? `Enviar para ${regularMemberCount}`
              : `Enviar ${
                  mediaType === 'image' ? 'Imagem' : 
                  mediaType === 'video' ? 'Vídeo' : 
                  mediaType === 'audio' ? (isPtt ? 'Voz' : 'Áudio') : 
                  'Arquivo'
                }`
            }
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Tamanho máximo: 10MB. Para agendar, use URL ao invés de arquivo local.
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

export default SendMediaForm;