import { useState, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { formatBR } from '@/lib/dateUtils';
import { ImageIcon, ExternalLink, FileText, Download, Loader2, LayoutGrid, BarChart3, Link, Phone, MessageSquare, User, ChevronRight, UserPlus, Copy, Reply } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { toast } from 'sonner';
import type { Message } from '@/pages/dashboard/HelpDesk';

interface MessageBubbleProps {
  message: Message;
  instanceId?: string;
  agentNamesMap?: Record<string, string>;
  onReply?: (message: Message) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, instanceId, agentNamesMap, onReply }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';
  const isNote = message.direction === 'private_note';
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Resolve Supabase storage URLs to signed URLs for private buckets
  const needsSignedUrl = ['image', 'audio', 'video', 'document', 'sticker'].includes(message.media_type);
  const resolvedMediaUrl = useSignedUrl(needsSignedUrl ? message.media_url : null);
  const mediaUrl = needsSignedUrl ? (resolvedMediaUrl || message.media_url) : message.media_url;

  // Parse carousel data from media_url when media_type is 'carousel'
  const carouselData = useMemo(() => {
    if (message.media_type !== 'carousel' || !message.media_url) return null;
    try {
      return JSON.parse(message.media_url) as {
        message?: string;
        cards?: Array<{
          id?: string;
          text?: string;
          image?: string;
          buttons?: Array<{ type: string; label: string; value?: string }>;
        }>;
      };
    } catch {
      return null;
    }
  }, [message.media_type, message.media_url]);

  // M17 F4: Parse poll data from media_url when media_type is 'poll'
  const pollData = useMemo(() => {
    if (message.media_type !== 'poll' || !message.media_url) return null;
    try {
      return JSON.parse(message.media_url) as {
        question?: string;
        options?: string[];
        selectable_count?: number;
      };
    } catch { return null; }
  }, [message.media_type, message.media_url]);

  // Parse contact (vCard) data from media_url when media_type is 'contact'
  const contactData = useMemo(() => {
    if (message.media_type !== 'contact' || !message.media_url) return null;
    try {
      const parsed = JSON.parse(message.media_url) as { displayName?: string; vcard?: string };
      if (!parsed.vcard) return null;
      // Parse vcard fields
      const vcard = parsed.vcard;
      const getField = (field: string) => {
        const match = vcard.match(new RegExp(`${field}[^:]*:(.+)`, 'i'));
        return match ? match[1].trim() : '';
      };
      // Extract phone from TEL line (handles waid format)
      const telMatch = vcard.match(/TEL[^:]*:(\+?[\d]+)/i);
      const phone = telMatch ? telMatch[1] : '';
      return {
        displayName: parsed.displayName || getField('FN') || 'Contato',
        org: getField('ORG')?.replace(/;/g, '').trim(),
        email: getField('EMAIL'),
        url: getField('URL'),
        phone,
      };
    } catch {
      return null;
    }
  }, [message.media_type, message.media_url]);

  const handleDocumentOpen = async () => {
    if (!mediaUrl) return;
    setDownloading(true);
    try {
      const { fileName } = getDocumentInfo();
      
      // Try fetch + programmatic download using signed/resolved URL
      const isStorageUrl = mediaUrl.includes('supabase.co/storage') || 
                          mediaUrl.includes('lovable.dev/storage');
      
      if (isStorageUrl) {
        const response = await fetch(mediaUrl);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback: proxy for legacy UAZAPI URLs
      if (!instanceId) return;
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'download-media', fileUrl: mediaUrl, instanceId },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data)], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading document:', err);
      toast.error('Não foi possível baixar o arquivo');
      window.open(mediaUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  // Extract friendly file name for documents
  const getDocumentInfo = () => {
    const raw = (typeof message.content === 'string' && message.content) 
      ? message.content 
      : message.media_url?.split('/').pop()?.split('?')[0] || 'Documento';
    // If name looks like a hash (64+ hex chars), show generic name
    const isHash = /^[0-9a-f]{32,}\.\w+$/i.test(raw);
    const fileName = isHash ? `Documento.${raw.split('.').pop() || 'pdf'}` : raw;
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'DOC' : 'DOC';
    return { fileName, ext };
  };

  return (
    <div
      className={cn(
        'flex',
        isOutgoing ? 'justify-end' : 'justify-start',
        isNote && 'justify-start'
      )}
    >
      <div className="relative group max-w-[75%]">
        {/* Action buttons on hover */}
        <div className={cn(
          'opacity-0 group-hover:opacity-100 absolute -top-3 z-10 flex items-center gap-0.5 bg-card border border-border rounded-md shadow-sm transition-all',
          isOutgoing ? 'left-2' : 'right-2'
        )}>
          {message.content && (
            <button
              onClick={() => { navigator.clipboard.writeText(message.content || '').catch(() => {}); toast.success('Copiado!'); }}
              className="p-1 hover:bg-accent rounded-sm"
              title="Copiar"
              aria-label="Copiar mensagem"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 hover:bg-accent rounded-sm"
              title="Responder"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
        </div>
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm relative',
            message.media_type === 'sticker' || message.media_type === 'contact'
              ? 'bg-transparent p-0'
              : isNote
                ? 'bg-warning/10 border border-warning/20 text-foreground italic rounded-xl'
                : isOutgoing
                  ? 'bg-primary text-primary-foreground rounded-br-md bubble-tail-right shadow-sm'
                  : 'bg-muted text-foreground rounded-bl-md bubble-tail-left'
          )}
        >
        {isNote && (
          <span className="text-[10px] font-semibold text-warning block mb-0.5">
            📝 Nota privada
          </span>
        )}
        {isOutgoing && !isNote && message.sender_id && agentNamesMap?.[message.sender_id] && (
          <span className="text-[11px] text-primary/70 block mb-0.5">
            {agentNamesMap[message.sender_id]} · {message.sender_id.substring(0, 8)}
          </span>
        )}

        {/* Sticker - transparent background, fixed size */}
        {message.media_type === 'sticker' && mediaUrl && (
          <div className="mb-1">
            {!imgError ? (
              <img
                src={mediaUrl}
                alt="Figurinha"
                loading="lazy"
                decoding="async"
                className="max-w-[180px] max-h-[180px] object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="rounded-lg bg-muted/50 border border-border flex items-center justify-center p-4">
                <span className="text-xs text-muted-foreground">Figurinha</span>
              </div>
            )}
          </div>
        )}

        {/* Image with error fallback */}
        {message.media_type === 'image' && mediaUrl && (
          <div className="mb-1">
            {!imgError ? (
              <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={mediaUrl}
                  alt="Imagem"
                  loading="lazy"
                  decoding="async"
                  className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                  onError={() => setImgError(true)}
                />
              </a>
            ) : (
              <div className="rounded-lg bg-muted/50 border border-border flex flex-col items-center justify-center py-6 px-4 gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir imagem
                </a>
              </div>
            )}
          </div>
        )}

        {message.media_type === 'audio' && (
          <div>
            {mediaUrl ? (
            <AudioPlayer src={mediaUrl} direction={message.direction} />
            ) : (
              <div className="text-xs text-muted-foreground italic py-2">Áudio indisponível</div>
            )}
            {message.transcription ? (
              <p className="text-[11px] text-muted-foreground italic mt-1 whitespace-pre-wrap">
                📝 {message.transcription}
              </p>
            ) : message.direction === 'incoming' ? (
              <div className="flex items-center gap-1.5 mt-1 animate-pulse">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
                <span className="text-[11px] text-muted-foreground italic">Transcrevendo...</span>
              </div>
            ) : null}
          </div>
        )}
        {message.media_type === 'video' && mediaUrl && (
          <video
            controls
            playsInline
            preload="metadata"
            className="rounded-lg max-w-full mb-1"
          >
            <source src={mediaUrl} />
          </video>
        )}

        {message.media_type === 'document' && mediaUrl && (() => {
          const { fileName, ext } = getDocumentInfo();
          return (
            <button
              onClick={handleDocumentOpen}
              disabled={downloading}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors mb-1 w-full text-left cursor-pointer disabled:opacity-50"
            >
              <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{fileName}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{ext}</span>
              </div>
              {downloading ? (
                <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          );
        })()}

        {/* Contact Card (vCard) - WhatsApp style */}
        {message.media_type === 'contact' && contactData && (
          <div className="rounded-xl border border-border bg-card overflow-hidden min-w-[240px] max-w-[280px]">
            {/* Header: avatar + name + chevron */}
            <div className="flex items-center gap-3 p-3">
              <div className="shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground truncate flex-1">
                {contactData.displayName}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            {/* Divider */}
            <div className="border-t border-border" />
            {/* Action buttons */}
            <div className="grid grid-cols-2 divide-x divide-border">
              {contactData.phone ? (
                <a
                  href={`https://wa.me/${contactData.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary hover:bg-muted/50 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversar
                </a>
              ) : (
                <span className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversar
                </span>
              )}
              <button className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary hover:bg-muted/50 transition-colors">
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
          </div>
        )}

        {/* Carousel */}
        {message.media_type === 'carousel' && carouselData && (
          <div className="mb-1">
            {carouselData.message && (
              <p className="whitespace-pre-wrap break-words mb-2 font-medium flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {carouselData.message}
              </p>
            )}
            {carouselData.cards && carouselData.cards.length > 0 && (
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {carouselData.cards.map((card, idx) => (
                    <div
                      key={card.id || idx}
                      className="shrink-0 w-48 rounded-lg border border-border bg-muted/30 overflow-hidden"
                    >
                      {card.image && (
                        <div className="aspect-[4/3] overflow-hidden">
                          <img
                            src={card.image}
                            alt={`Card ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {card.text && (
                        <p className="text-xs p-2 whitespace-pre-wrap break-words">{card.text}</p>
                      )}
                      {card.buttons && card.buttons.length > 0 && (
                        <div className="px-2 pb-2 space-y-1">
                          {card.buttons.map((btn, bIdx) => (
                            <div
                              key={bIdx}
                              className="flex items-center gap-1 text-[10px] text-primary truncate"
                            >
                              {btn.type === 'URL' && <Link className="h-3 w-3 shrink-0" />}
                              {btn.type === 'CALL' && <Phone className="h-3 w-3 shrink-0" />}
                              {btn.type === 'REPLY' && <MessageSquare className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{btn.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </div>
        )}

        {/* M17 F4: Poll */}
        {message.media_type === 'poll' && pollData && (
          <div className="mb-1 min-w-[200px]">
            <p className="font-medium mb-2 flex items-center gap-1.5 text-sm">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {pollData.question}
            </p>
            <div className="space-y-1">
              {pollData.options?.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30 border border-border">
                  <span className="w-4 h-4 rounded-full border border-muted-foreground/40 shrink-0 flex items-center justify-center text-[9px]">
                    {pollData.selectable_count === 0 ? '☐' : '○'}
                  </span>
                  <span className="flex-1">{opt}</span>
                </div>
              ))}
            </div>
            {pollData.selectable_count === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">Selecao multipla</p>
            )}
          </div>
        )}

        {message.media_type !== 'document' && message.media_type !== 'carousel' && message.media_type !== 'contact' && message.media_type !== 'poll' && message.content && typeof message.content === 'string' && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.content && typeof message.content === 'object' && (
          <p className="whitespace-pre-wrap break-words text-muted-foreground italic text-xs">[Mídia]</p>
        )}

        <span className={cn('text-[10px] flex items-center justify-end gap-1 mt-0.5', isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
          {formatBR(message.created_at, 'HH:mm')}
          {isOutgoing && !isNote && (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
              <path d="M1.5 8.5L5 12L14.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 8.5L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
            </svg>
          )}
        </span>
        </div>
      </div>
    </div>
  );
});
