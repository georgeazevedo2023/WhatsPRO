import { useState, useEffect, useMemo, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Image, LayoutGrid } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { ScheduleMessageDialog } from '@/components/group/ScheduleMessageDialog';
import { TemplateSelector } from './TemplateSelector';
import MessagePreview from './MessagePreview';
import { CarouselEditor, CarouselData, createEmptyCard } from './CarouselEditor';
import { uploadCarouselImage } from '@/lib/uploadCarouselImage';
import BroadcastProgressModal from './BroadcastProgressModal';
import BroadcastMediaTab from './BroadcastMediaTab';
import BroadcastSendControls from './BroadcastSendControls';
import type { MessageTemplate } from '@/hooks/useMessageTemplates';
import type { Instance } from '@/types';
import type { Group } from '@/types';
import { useBroadcastSend } from '@/hooks/useBroadcastSend';

import {
  InitialData, MediaType, ActiveTab,
  MAX_MESSAGE_LENGTH, MAX_FILE_SIZE,
  fileToBase64,
} from '@/lib/broadcastSender';

interface BroadcastMessageFormProps {
  instance: Instance;
  selectedGroups: Group[];
  onComplete?: () => void;
  initialData?: InitialData;
}

const BroadcastMessageForm = ({ instance, selectedGroups, onComplete, initialData }: BroadcastMessageFormProps) => {
  // ── Form state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (initialData?.messageType === 'carousel') return 'carousel';
    if (initialData && initialData.messageType !== 'text') return 'media';
    return 'text';
  });
  const [message, setMessage] = useState(() => initialData?.content || '');
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [randomDelay, setRandomDelay] = useState<'none' | '5-10' | '10-20'>('none');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Media state
  const [mediaType, setMediaType] = useState<MediaType>(() => {
    if (initialData) {
      if (initialData.messageType === 'image') return 'image';
      if (initialData.messageType === 'video') return 'video';
      if (initialData.messageType === 'audio' || initialData.messageType === 'ptt') return 'audio';
      if (initialData.messageType === 'document' || initialData.messageType === 'file') return 'file';
    }
    return 'image';
  });
  const [mediaUrl, setMediaUrl] = useState(() => initialData?.mediaUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState(() => {
    if (initialData && initialData.messageType !== 'text') return initialData.content || '';
    return '';
  });
  const [isPtt, setIsPtt] = useState(() => initialData?.messageType === 'ptt');
  const [filename, setFilename] = useState('');

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
    return { message: '', cards: [createEmptyCard(), createEmptyCard()] };
  });

  // ── Computed values ──────────────────────────────────────────────
  const totalMembers = selectedGroups.reduce((acc, g) => acc + g.size, 0);
  const totalRegularMembers = selectedGroups.reduce(
    (acc, g) => acc + g.participants.filter(p => !p.isAdmin && !p.isSuperAdmin).length, 0,
  );

  const uniqueRegularMembers = useMemo(() => {
    const seen = new Set<string>();
    const members: { jid: string; groupName: string }[] = [];
    for (const group of selectedGroups) {
      for (const m of group.participants.filter(p => !p.isAdmin && !p.isSuperAdmin)) {
        if (!seen.has(m.jid)) { seen.add(m.jid); members.push({ jid: m.jid, groupName: group.name }); }
      }
    }
    return members;
  }, [selectedGroups]);

  const uniqueRegularMembersCount = uniqueRegularMembers.length;

  // ── Hook ─────────────────────────────────────────────────────────
  const broadcast = useBroadcastSend({
    instance, selectedGroups, excludeAdmins, randomDelay,
    uniqueRegularMembers, selectedParticipants, onComplete,
  });

  // ── Effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (excludeAdmins) {
      setSelectedParticipants(new Set(uniqueRegularMembers.map(m => m.jid)));
    } else {
      setSelectedParticipants(new Set());
    }
  }, [excludeAdmins, uniqueRegularMembers]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleParticipantSelectionChange = useCallback((s: Set<string>) => setSelectedParticipants(s), []);

  // ── Send dispatcher ──────────────────────────────────────────────
  const handleSend = async () => {
    if (activeTab === 'text') {
      await broadcast.sendText({ message });
      if (message.trim()) setMessage('');
    } else if (activeTab === 'carousel') {
      await broadcast.sendCarousel({ carouselData });
      setCarouselData({ message: '', cards: [createEmptyCard(), createEmptyCard()] });
    } else {
      const mediaData = selectedFile ? await fileToBase64(selectedFile) : mediaUrl.trim();
      await broadcast.sendMedia({ mediaData, mediaType, caption, isPtt, filename, mediaUrl });
      clearFile(); setMediaUrl(''); setCaption('');
    }
  };

  const handleSchedule = async (config: import('@/components/group/ScheduleMessageDialog').ScheduleConfig) => {
    if (activeTab === 'text') {
      await broadcast.scheduleText({ message, config });
      if (message.trim()) { setMessage(''); setShowScheduleDialog(false); }
    } else if (activeTab === 'carousel') {
      toast.error('Agendamento de carrossel não suportado ainda');
    } else {
      await broadcast.scheduleMedia({ mediaData: '', mediaType, caption, isPtt, filename, mediaUrl, config });
      if (mediaUrl.trim()) { setMediaUrl(''); setCaption(''); setFilename(''); setShowScheduleDialog(false); }
    }
  };

  // ── File helpers ─────────────────────────────────────────────────
  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null); setPreviewUrl(null); setFilename('');
  };

  // ── Validation ───────────────────────────────────────────────────
  const characterCount = message.length;
  const isOverLimit = characterCount > MAX_MESSAGE_LENGTH;

  const isMediaValid = activeTab === 'media' && (selectedFile || mediaUrl.trim()) && (mediaType !== 'file' || filename.trim());
  const isTextValid = activeTab === 'text' && message.trim() && !isOverLimit;
  const isCarouselValid = activeTab === 'carousel' && carouselData.cards.length >= 2 &&
    carouselData.cards.every(c => (c.image || c.imageFile) && c.text.trim()) &&
    carouselData.cards.every(c => c.buttons.every(btn =>
      btn.label.trim() && (btn.type !== 'URL' || btn.url?.trim()) && (btn.type !== 'CALL' || btn.phone?.trim())
    ));
  const canSend = (isTextValid || isMediaValid || isCarouselValid) && selectedGroups.length > 0 &&
    !(excludeAdmins && activeTab !== 'carousel' && selectedParticipants.size === 0);
  const canSchedule = activeTab === 'text'
    ? !!(message.trim() && !isOverLimit && selectedGroups.length > 0)
    : activeTab === 'media'
      ? !!(mediaUrl.trim() && selectedGroups.length > 0 && (mediaType !== 'file' || filename.trim()))
      : false;

  // ── Template handlers ────────────────────────────────────────────
  const handleSelectTemplate = (template: MessageTemplate) => {
    if (template.message_type === 'carousel' && template.carousel_data) {
      setActiveTab('carousel'); setCarouselData(template.carousel_data);
    } else if (template.message_type === 'text') {
      setActiveTab('text'); setMessage(template.content || '');
    } else {
      setActiveTab('media');
      const typeMap: Record<string, MediaType> = { image: 'image', video: 'video', audio: 'audio', ptt: 'audio', document: 'file' };
      setMediaType(typeMap[template.message_type] || 'image');
      setIsPtt(template.message_type === 'ptt');
      setMediaUrl(template.media_url || '');
      setCaption(template.content || '');
      setFilename(template.filename || '');
      clearFile();
    }
    toast.success(`Template "${template.name}" aplicado`);
  };

  const handleSaveTemplate = async () => {
    if (activeTab === 'carousel') {
      if (carouselData.cards.length < 2) { toast.error('O carrossel precisa ter pelo menos 2 cards'); return null; }
      const hasLocalFiles = carouselData.cards.some(c => c.imageFile);
      if (hasLocalFiles) toast.info('Enviando imagens do carrossel...');
      try {
        const uploadedCards = await Promise.all(
          carouselData.cards.map(async (card) => {
            if (card.imageFile) {
              const url = await uploadCarouselImage(card.imageFile);
              return { ...card, image: url, imageFile: undefined };
            }
            return { ...card, imageFile: undefined };
          }),
        );
        return {
          name: '', content: carouselData.message || undefined, message_type: 'carousel',
          carousel_data: { message: carouselData.message, cards: uploadedCards },
        };
      } catch (err) {
        handleError(err, 'Erro ao enviar imagens. Tente novamente.', 'Upload carousel images');
        return null;
      }
    } else if (activeTab === 'text') {
      const trimmed = message.trim();
      if (!trimmed) { toast.error('Digite uma mensagem para salvar'); return null; }
      return { name: '', content: trimmed, message_type: 'text' };
    } else {
      const trimmedUrl = mediaUrl.trim();
      if (!trimmedUrl && !selectedFile) { toast.error('Selecione uma mídia para salvar'); return null; }
      if (!trimmedUrl) { toast.error('Para salvar template de mídia, use uma URL'); return null; }
      const sendType = mediaType === 'audio' && isPtt ? 'ptt' : mediaType === 'file' ? 'document' : mediaType;
      return { name: '', content: caption.trim() || undefined, message_type: sendType, media_url: trimmedUrl, filename: mediaType === 'file' ? filename.trim() : undefined };
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <BroadcastProgressModal
        progress={broadcast.progress}
        elapsedTime={broadcast.elapsedTime}
        remainingTime={broadcast.remainingTime}
        excludeAdmins={excludeAdmins}
        activeTab={activeTab}
        formatDuration={broadcast.formatDuration}
        onPause={broadcast.handlePause}
        onResume={broadcast.handleResume}
        onCancel={broadcast.handleCancel}
        onClose={broadcast.handleCloseProgress}
      />

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
              disabled={broadcast.isSending}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Mídia
              </TabsTrigger>
              <TabsTrigger value="carousel" className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Carrossel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <Textarea
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={broadcast.isSending}
                className="min-h-[120px] resize-none"
                maxLength={MAX_MESSAGE_LENGTH + 100}
              />
              <div className="flex items-center justify-between">
                <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} disabled={broadcast.isSending} />
                <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {characterCount.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()} caracteres
                </span>
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <BroadcastMediaTab
                mediaType={mediaType} setMediaType={setMediaType}
                mediaUrl={mediaUrl} setMediaUrl={setMediaUrl}
                selectedFile={selectedFile} setSelectedFile={setSelectedFile}
                previewUrl={previewUrl} setPreviewUrl={setPreviewUrl}
                caption={caption} setCaption={setCaption}
                isPtt={isPtt} setIsPtt={setIsPtt}
                filename={filename} setFilename={setFilename}
                isSending={broadcast.isSending}
              />
            </TabsContent>

            <TabsContent value="carousel" className="space-y-4">
              <CarouselEditor value={carouselData} onChange={setCarouselData} disabled={broadcast.isSending} />
            </TabsContent>

            {activeTab !== 'carousel' && (
              <MessagePreview
                type={activeTab === 'text' ? 'text' : mediaType}
                text={activeTab === 'text' ? message : caption}
                mediaUrl={activeTab === 'media' ? mediaUrl : undefined}
                previewUrl={activeTab === 'media' ? previewUrl : undefined}
                filename={filename} isPtt={isPtt}
                onTextChange={(t) => activeTab === 'text' ? setMessage(t) : setCaption(t)}
                disabled={broadcast.isSending}
              />
            )}

            <BroadcastSendControls
              activeTab={activeTab} selectedGroups={selectedGroups}
              excludeAdmins={excludeAdmins} setExcludeAdmins={setExcludeAdmins}
              selectedParticipants={selectedParticipants}
              onParticipantSelectionChange={handleParticipantSelectionChange}
              uniqueRegularMembersCount={uniqueRegularMembersCount}
              totalMembers={totalMembers} totalRegularMembers={totalRegularMembers}
              randomDelay={randomDelay} setRandomDelay={setRandomDelay}
              estimatedTime={broadcast.estimatedTime}
              formatDuration={broadcast.formatDuration}
              mediaType={mediaType} isPtt={isPtt}
              carouselCardCount={carouselData.cards.length}
              isSending={broadcast.isSending} canSend={canSend} canSchedule={canSchedule}
              onSend={handleSend}
              onSchedule={() => setShowScheduleDialog(true)}
            />
          </Tabs>
        </CardContent>
      </Card>

      <ScheduleMessageDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onConfirm={handleSchedule}
        isLoading={broadcast.isScheduling}
      />
    </>
  );
};

export default BroadcastMessageForm;
