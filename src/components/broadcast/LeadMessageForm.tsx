import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getAccessToken, getSessionUserId } from '@/hooks/useAuthSession';
import { Send, MessageSquare, Image, Loader2, CheckCircle2, XCircle, Clock, Pause, Play, Timer, StopCircle, Shield, LayoutGrid } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { toast } from 'sonner';
import MessagePreview from './MessagePreview';
import BroadcastMediaTab from './BroadcastMediaTab';
import { CarouselEditor, CarouselData, createEmptyCard } from './CarouselEditor';
import { CarouselPreview } from './CarouselPreview';
import { TemplateSelector } from './TemplateSelector';
import { uploadCarouselImage, base64ToFile } from '@/lib/uploadCarouselImage';
import { saveToHelpdesk } from '@/lib/saveToHelpdesk';
import type { MessageTemplate } from '@/hooks/useMessageTemplates';
import type { Instance } from '@/types';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

import {
  InitialData, MediaType, ActiveTab,
  MAX_MESSAGE_LENGTH,
  sendToNumber, sendMediaToNumber, sendCarouselToNumber,
  fileToBase64, formatTime, getRandomDelay,
} from '@/lib/broadcastSender';

interface LeadMessageFormProps {
  instance: Instance;
  selectedLeads: Lead[];
  onComplete?: () => void;
  initialData?: InitialData;
}

interface SendProgress {
  current: number;
  total: number;
  currentName: string;
  status: 'idle' | 'sending' | 'paused' | 'success' | 'error' | 'cancelled';
  results: { name: string; success: boolean; error?: string }[];
  startedAt: number | null;
}

const LeadMessageForm = ({ instance, selectedLeads, onComplete, initialData }: LeadMessageFormProps) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (initialData?.messageType === 'carousel') return 'carousel';
    if (initialData?.messageType && initialData.messageType !== 'text') return 'media';
    return 'text';
  });
  const [message, setMessage] = useState(initialData?.content || '');
  
  // Carousel state
  const [carouselData, setCarouselData] = useState<CarouselData>(() => {
    if (initialData?.carouselData && initialData.carouselData.cards) {
      return {
        message: initialData.carouselData.message || '',
        cards: initialData.carouselData.cards.map((card) => ({
          id: card.id || crypto.randomUUID(),
          text: card.text || '',
          image: card.image || '',
          buttons: card.buttons?.map((btn) => ({
            id: btn.id || crypto.randomUUID(),
            type: btn.type,
            label: btn.label,
            url: btn.type === 'URL' ? (btn.value || '') : '',
            phone: btn.type === 'CALL' ? (btn.value || '') : '',
          })) || [],
        })),
      };
    }
    return {
      message: '',
      cards: [createEmptyCard(), createEmptyCard()],
    };
  });
  const [randomDelay, setRandomDelay] = useState<'none' | '5-10' | '10-20'>('none');
  const [progress, setProgress] = useState<SendProgress>({
    current: 0,
    total: 0,
    currentName: '',
    status: 'idle',
    results: [],
    startedAt: null,
  });
  const [elapsedTime, setElapsedTime] = useState(0);

  // Pause and cancel control
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Media states
  const getInitialMediaType = (): MediaType => {
    if (!initialData?.messageType) return 'image';
    if (initialData.messageType === 'image') return 'image';
    if (initialData.messageType === 'video') return 'video';
    if (initialData.messageType === 'audio' || initialData.messageType === 'ptt') return 'audio';
    if (initialData.messageType === 'document' || initialData.messageType === 'file') return 'file';
    return 'image';
  };

  const [mediaType, setMediaType] = useState<MediaType>(getInitialMediaType());
  const [mediaUrl, setMediaUrl] = useState(initialData?.mediaUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.mediaUrl || null);
  const [caption, setCaption] = useState(initialData?.messageType !== 'text' ? (initialData?.content || '') : '');
  const [isPtt, setIsPtt] = useState(initialData?.messageType === 'ptt');
  const [filename, setFilename] = useState('');

  // Timer for elapsed time
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if ((progress.status === 'sending' || progress.status === 'paused') && progress.startedAt) {
      intervalId = setInterval(() => {
        if (progress.status === 'sending') {
          setElapsedTime(Math.floor((Date.now() - progress.startedAt!) / 1000));
        }
      }, 1000);
    } else if (progress.status === 'idle') {
      setElapsedTime(0);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [progress.status, progress.startedAt]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitWhilePaused = async (): Promise<void> => {
    while (isPausedRef.current) {
      await delay(100);
    }
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setProgress(p => ({ ...p, status: 'paused' }));
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setProgress(p => ({ ...p, status: 'sending' }));
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
  };

  const calculateEstimatedTime = (): string => {
    if (randomDelay === 'none') return '';
    
    const count = selectedLeads.length;
    const [minSec, maxSec] = randomDelay === '5-10' ? [5, 10] : [10, 20];
    
    const minTotal = Math.ceil((count * minSec) / 60);
    const maxTotal = Math.ceil((count * maxSec) / 60);
    
    if (maxTotal < 60) {
      return `${minTotal}-${maxTotal} min`;
    }
    
    const minHours = Math.floor(minTotal / 60);
    const minMins = minTotal % 60;
    const maxHours = Math.floor(maxTotal / 60);
    const maxMins = maxTotal % 60;
    
    return `${minHours}h${minMins > 0 ? minMins + 'min' : ''} - ${maxHours}h${maxMins > 0 ? maxMins + 'min' : ''}`;
  };

  const saveBroadcastLog = async (params: {
    messageType: string;
    content: string | null;
    mediaUrl: string | null;
    recipientsTargeted: number;
    recipientsSuccess: number;
    recipientsFailed: number;
    status: 'completed' | 'cancelled' | 'error';
    startedAt: number;
    errorMessage?: string;
    leadNames: string[];
    carouselData?: CarouselData;
  }) => {
    try {
      const userId = await getSessionUserId();

      const completedAt = Date.now();
      const durationSeconds = Math.round((completedAt - params.startedAt) / 1000);

      let storedCarouselData = null;
      if (params.carouselData) {
        const processedCards = await Promise.all(
          params.carouselData.cards.map(async (card, idx) => {
            let imageForStorage = card.image || '';
            try {
              if (card.imageFile) {
                imageForStorage = await uploadCarouselImage(card.imageFile);
              } else if (card.image && card.image.startsWith('data:')) {
                const file = await base64ToFile(card.image, `card-${idx}.jpg`);
                imageForStorage = await uploadCarouselImage(file);
              }
            } catch (uploadErr) {
              console.error('Error uploading carousel image:', uploadErr);
            }
            return {
              id: card.id,
              text: card.text,
              image: imageForStorage,
              buttons: card.buttons.map(btn => ({
                id: btn.id,
                type: btn.type,
                label: btn.label,
                value: btn.url || btn.phone || '',
              })),
            };
          })
        );
        storedCarouselData = {
          message: params.carouselData.message,
          cards: processedCards,
        };
      }

      await supabase.from('broadcast_logs').insert({
        user_id: userId,
        instance_id: instance.id,
        instance_name: instance.name,
        message_type: params.messageType,
        content: params.content,
        media_url: params.mediaUrl,
        groups_targeted: 0,
        recipients_targeted: params.recipientsTargeted,
        recipients_success: params.recipientsSuccess,
        recipients_failed: params.recipientsFailed,
        exclude_admins: false,
        random_delay: randomDelay,
        status: params.status,
        started_at: new Date(params.startedAt).toISOString(),
        completed_at: new Date(completedAt).toISOString(),
        duration_seconds: durationSeconds,
        error_message: params.errorMessage || null,
        group_names: params.leadNames,
        carousel_data: storedCarouselData,
      });
    } catch (err) {
      console.error('Error saving broadcast log:', err);
    }
  };

  // Template handlers
  const handleSelectTemplate = (template: MessageTemplate) => {
    if (template.message_type === 'carousel' && template.carousel_data) {
      setActiveTab('carousel');
      const data = template.carousel_data as {
        message?: string;
        cards?: Array<{
          id?: string;
          text?: string;
          image?: string;
          buttons?: Array<{
            id?: string;
            type: 'URL' | 'REPLY' | 'CALL';
            label: string;
            value?: string;
          }>;
        }>;
      };
      setCarouselData({
        message: data.message || '',
        cards: data.cards?.map((card) => ({
          id: card.id || crypto.randomUUID(),
          text: card.text || '',
          image: card.image || '',
          buttons: card.buttons?.map((btn) => ({
            id: btn.id || crypto.randomUUID(),
            type: btn.type,
            label: btn.label,
            url: btn.type === 'URL' ? (btn.value || '') : '',
            phone: btn.type === 'CALL' ? (btn.value || '') : '',
          })) || [],
        })) || [createEmptyCard(), createEmptyCard()],
      });
    } else if (template.message_type === 'text') {
      setActiveTab('text');
      setMessage(template.content || '');
    } else {
      setActiveTab('media');
      const typeMap: Record<string, MediaType> = {
        'image': 'image', 'video': 'video', 'audio': 'audio', 'ptt': 'audio', 'document': 'file',
      };
      setMediaType(typeMap[template.message_type] || 'image');
      setIsPtt(template.message_type === 'ptt');
      setMediaUrl(template.media_url || '');
      setCaption(template.content || '');
      setFilename(template.filename || '');
      setSelectedFile(null);
      setPreviewUrl(null);
    }
    toast.success(`Template "${template.name}" aplicado`);
  };

  const handleSaveTemplate = async () => {
    if (activeTab === 'carousel') {
      if (carouselData.cards.length < 2) {
        toast.error('O carrossel precisa ter pelo menos 2 cards');
        return null;
      }
      const hasLocalFiles = carouselData.cards.some(card => card.imageFile);
      if (hasLocalFiles) toast.info('Enviando imagens do carrossel...');
      try {
        const uploadedCards = await Promise.all(
          carouselData.cards.map(async (card) => {
            if (card.imageFile) {
              const url = await uploadCarouselImage(card.imageFile);
              return { ...card, image: url, imageFile: undefined };
            }
            return { ...card, imageFile: undefined };
          })
        );
        return {
          name: '',
          content: carouselData.message || undefined,
          message_type: 'carousel',
          carousel_data: { message: carouselData.message, cards: uploadedCards },
        };
      } catch (err) {
        console.error('Error uploading carousel images:', err);
        toast.error('Erro ao enviar imagens. Tente novamente.');
        return null;
      }
    } else if (activeTab === 'text') {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) { toast.error('Digite uma mensagem para salvar'); return null; }
      return { name: '', content: trimmedMessage, message_type: 'text' };
    } else {
      const trimmedUrl = mediaUrl.trim();
      if (!trimmedUrl && !selectedFile) { toast.error('Selecione uma mídia para salvar'); return null; }
      if (!trimmedUrl) { toast.error('Para salvar template de mídia, use uma URL'); return null; }
      const sendType = mediaType === 'audio' && isPtt ? 'ptt' : mediaType === 'file' ? 'document' : mediaType;
      return {
        name: '',
        content: caption.trim() || undefined,
        message_type: sendType,
        media_url: trimmedUrl,
        filename: mediaType === 'file' ? filename.trim() : undefined,
      };
    }
  };

  // Wrapper functions that bind instance.id to shared sender functions
  const sendText = (jid: string, text: string, accessToken: string) =>
    sendToNumber(instance.id, jid, text, accessToken);
  const sendMedia = (jid: string, mediaData: string, type: string, captionText: string, docName: string, accessToken: string) =>
    sendMediaToNumber(instance.id, jid, mediaData, type, captionText, docName, accessToken);
  const sendCarousel = (jid: string, carousel: CarouselData, accessToken: string) =>
    sendCarouselToNumber(instance.id, jid, carousel, accessToken, fileToBase64);

  // ── Generic send loop ──────────────────────────────────────────────
  const runSendLoop = async (
    accessToken: string,
    sendFn: (lead: Lead) => Promise<void>,
  ) => {
    const startedAt = Date.now();
    isPausedRef.current = false;
    isCancelledRef.current = false;

    setProgress({ current: 0, total: selectedLeads.length, currentName: '', status: 'sending', results: [], startedAt });

    const results: SendProgress['results'] = [];

    for (let i = 0; i < selectedLeads.length; i++) {
      if (isCancelledRef.current) {
        setProgress(p => ({ ...p, status: 'cancelled' }));
        toast.warning('Envio cancelado');
        break;
      }
      await waitWhilePaused();

      const lead = selectedLeads[i];
      const displayName = lead.name || lead.phone;
      setProgress(p => ({ ...p, current: i + 1, currentName: displayName }));

      try {
        await sendFn(lead);
        results.push({ name: displayName, success: true });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ name: displayName, success: false, error: msg });
      }

      setProgress(p => ({ ...p, results: [...results] }));

      if (i < selectedLeads.length - 1 && !isCancelledRef.current) {
        await delay(getRandomDelay(randomDelay));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (!isCancelledRef.current) {
      setProgress(p => ({ ...p, status: failCount > 0 ? 'error' : 'success' }));
    }

    return { startedAt, successCount, failCount, results };
  };

  const handleSendCarousel = async () => {
    const validCards = carouselData.cards.filter(c => (c.image || c.imageFile) && c.text.trim());
    if (validCards.length < 2) { toast.error('Preencha pelo menos 2 cards com imagem e texto'); return; }

    const carouselToSend: CarouselData = { ...carouselData, cards: validCards };
    const accessToken = await getAccessToken();

    const { startedAt, successCount, failCount } = await runSendLoop(accessToken, async (lead) => {
      await sendCarousel(lead.jid, carouselToSend, accessToken);
      try {
        const helpdeskCards = await Promise.all(
          validCards.map(async (c) => {
            let imageUrl = c.image || '';
            if (c.imageFile) imageUrl = await uploadCarouselImage(c.imageFile);
            else if (c.image && c.image.startsWith('data:')) {
              const file = await base64ToFile(c.image, `card-${c.id}.jpg`);
              imageUrl = await uploadCarouselImage(file);
            }
            return { id: c.id, text: c.text, image: imageUrl, buttons: c.buttons.map(b => ({ id: b.id, type: b.type, label: b.label, value: b.url || b.phone || '' })) };
          })
        );
        saveToHelpdesk(instance.id, lead.jid, lead.phone, lead.name || null, {
          content: carouselToSend.message || '📋 Carrossel enviado',
          media_type: 'carousel',
          media_url: JSON.stringify({ message: carouselToSend.message, cards: helpdeskCards }),
        });
      } catch (uploadErr) {
        console.error('[LeadMessageForm] Error uploading carousel images for helpdesk:', uploadErr);
      }
    });

    if (!isCancelledRef.current) {
      if (failCount === 0) toast.success(`Carrossel enviado para ${successCount} contato${successCount !== 1 ? 's' : ''}`);
      else toast.warning(`${successCount} enviados, ${failCount} falharam`);
    }

    const leadNames = selectedLeads.slice(0, 50).map(l => l.name || l.phone);
    await saveBroadcastLog({
      messageType: 'carousel', content: carouselToSend.message || null, mediaUrl: null,
      recipientsTargeted: selectedLeads.length, recipientsSuccess: successCount, recipientsFailed: failCount,
      status: isCancelledRef.current ? 'cancelled' : (failCount > 0 ? 'error' : 'completed'),
      startedAt, leadNames, carouselData: carouselToSend,
    });
  };

  const handleSendText = async () => {
    if (!message.trim()) { toast.error('Digite uma mensagem'); return; }

    const accessToken = await getAccessToken();

    const { startedAt, successCount, failCount } = await runSendLoop(accessToken, async (lead) => {
      await sendText(lead.jid, message.trim(), accessToken);
      saveToHelpdesk(instance.id, lead.jid, lead.phone, lead.name || null, { content: message.trim(), media_type: 'text' });
    });

    if (!isCancelledRef.current) {
      if (failCount === 0) toast.success(`Mensagem enviada para ${successCount} contato${successCount !== 1 ? 's' : ''}`);
      else toast.warning(`${successCount} enviados, ${failCount} falharam`);
    }

    const leadNames = selectedLeads.slice(0, 50).map(l => l.name || l.phone);
    await saveBroadcastLog({
      messageType: 'text', content: message.trim(), mediaUrl: null,
      recipientsTargeted: selectedLeads.length, recipientsSuccess: successCount, recipientsFailed: failCount,
      status: isCancelledRef.current ? 'cancelled' : (failCount > 0 ? 'error' : 'completed'),
      startedAt, leadNames,
    });
  };

  const handleSendMedia = async () => {
    if (!selectedFile && !mediaUrl.trim()) { toast.error('Selecione um arquivo ou informe uma URL'); return; }

    const accessToken = await getAccessToken();

    let mediaData = mediaUrl;
    if (selectedFile) mediaData = await fileToBase64(selectedFile);
    const actualMediaType = mediaType === 'audio' && isPtt ? 'ptt' : mediaType;

    const { startedAt, successCount, failCount } = await runSendLoop(accessToken, async (lead) => {
      await sendMedia(lead.jid, mediaData, actualMediaType, caption, filename || selectedFile?.name || 'file', accessToken);
      saveToHelpdesk(instance.id, lead.jid, lead.phone, lead.name || null, {
        content: caption || null,
        media_type: actualMediaType === 'ptt' ? 'audio' : mediaType === 'file' ? 'document' : actualMediaType,
        media_url: mediaUrl || null,
      });
    });

    if (!isCancelledRef.current) {
      if (failCount === 0) toast.success(`Mídia enviada para ${successCount} contato${successCount !== 1 ? 's' : ''}`);
      else toast.warning(`${successCount} enviados, ${failCount} falharam`);
    }

    const leadNames = selectedLeads.slice(0, 50).map(l => l.name || l.phone);
    await saveBroadcastLog({
      messageType: actualMediaType, content: caption || null, mediaUrl: mediaUrl || null,
      recipientsTargeted: selectedLeads.length, recipientsSuccess: successCount, recipientsFailed: failCount,
      status: isCancelledRef.current ? 'cancelled' : (failCount > 0 ? 'error' : 'completed'),
      startedAt, leadNames,
    });
  };

  const handleSend = async () => {
    try {
      if (activeTab === 'text') await handleSendText();
      else if (activeTab === 'carousel') await handleSendCarousel();
      else await handleSendMedia();
    } catch (error) {
      console.error('[LeadMessageForm] Send error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
      setProgress(p => ({ ...p, status: 'idle' }));
    }
  };

  const handleReset = () => {
    setProgress({ current: 0, total: 0, currentName: '', status: 'idle', results: [], startedAt: null });
    setElapsedTime(0);
    isPausedRef.current = false;
    isCancelledRef.current = false;
  };

  const canSend = activeTab === 'text'
    ? message.trim().length > 0
    : activeTab === 'carousel'
      ? carouselData.cards.filter(c => (c.image || c.imageFile) && c.text.trim()).length >= 2
      : !!(selectedFile || mediaUrl.trim());

  const isSending = progress.status === 'sending' || progress.status === 'paused';
  const isComplete = progress.status === 'success' || progress.status === 'error' || progress.status === 'cancelled';

  const successCount = progress.results.filter(r => r.success).length;
  const failCount = progress.results.filter(r => !r.success).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Message Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Compor Mensagem
            </CardTitle>
            <TemplateSelector
              onSelect={handleSelectTemplate}
              onSave={handleSaveTemplate}
              disabled={isSending}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-2">
                <Image className="w-4 h-4" />
                Mídia
              </TabsTrigger>
              <TabsTrigger value="carousel" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Carrossel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Mensagem</Label>
                  <span className={`text-xs ${message.length > MAX_MESSAGE_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4 mt-4">
              <BroadcastMediaTab
                mediaType={mediaType}
                setMediaType={setMediaType}
                mediaUrl={mediaUrl}
                setMediaUrl={setMediaUrl}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                previewUrl={previewUrl}
                setPreviewUrl={setPreviewUrl}
                caption={caption}
                setCaption={setCaption}
                isPtt={isPtt}
                setIsPtt={setIsPtt}
                filename={filename}
                setFilename={setFilename}
                isSending={isSending}
              />
            </TabsContent>

            <TabsContent value="carousel" className="space-y-4 mt-4">
              <CarouselEditor
                value={carouselData}
                onChange={setCarouselData}
                disabled={isSending}
              />
            </TabsContent>
          </Tabs>

          {/* Anti-Blocking Delay */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <Label>Delay anti-bloqueio</Label>
              </div>
              <Select value={randomDelay} onValueChange={(v) => setRandomDelay(v as 'none' | '5-10' | '10-20')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Desativado</SelectItem>
                  <SelectItem value="5-10">5-10 seg</SelectItem>
                  <SelectItem value="10-20">10-20 seg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {randomDelay !== 'none' && (
              <Badge variant="secondary" className="gap-1.5">
                <Timer className="w-3 h-3" />
                Tempo estimado: {calculateEstimatedTime()}
              </Badge>
            )}
          </div>

          {/* Send Button or Progress */}
          {!isSending && !isComplete && (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full"
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar para {selectedLeads.length} contato{selectedLeads.length !== 1 ? 's' : ''}
            </Button>
          )}

          {/* Progress Display */}
          {(isSending || isComplete) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {progress.status === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {progress.status === 'paused' && <Pause className="w-4 h-4" />}
                  {progress.status === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {progress.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  {progress.status === 'cancelled' && <StopCircle className="w-4 h-4 text-muted-foreground" />}
                  
                  {isSending && `Enviando: ${progress.currentName}`}
                  {progress.status === 'success' && 'Envio concluído!'}
                  {progress.status === 'error' && 'Envio concluído com erros'}
                  {progress.status === 'cancelled' && 'Envio cancelado'}
                </span>
                <span className="text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
              </div>

              <Progress value={(progress.current / progress.total) * 100} />

              {isSending && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(elapsedTime)}
                  </span>
                  <div className="flex gap-2">
                    {progress.status === 'paused' ? (
                      <Button variant="outline" size="sm" onClick={handleResume}>
                        <Play className="w-3 h-3 mr-1" />
                        Continuar
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handlePause}>
                        <Pause className="w-3 h-3 mr-1" />
                        Pausar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <StopCircle className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm">
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {successCount} sucesso
                    </span>
                    {failCount > 0 && (
                      <span className="text-destructive flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        {failCount} falha{failCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Novo Envio
                    </Button>
                    {onComplete && (
                      <Button size="sm" onClick={onComplete}>
                        Concluir
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === 'carousel' ? (
            <CarouselPreview message={carouselData.message} cards={carouselData.cards} />
          ) : (
            <MessagePreview
              type={activeTab === 'text' ? 'text' : mediaType}
              text={activeTab === 'text' ? message : caption}
              previewUrl={previewUrl}
              mediaUrl={activeTab === 'media' ? mediaUrl : undefined}
              filename={filename}
              isPtt={isPtt}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadMessageForm;
