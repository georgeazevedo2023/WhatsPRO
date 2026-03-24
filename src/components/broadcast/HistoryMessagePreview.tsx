import React from 'react';
import {
  Eye,
  Play,
  Mic,
  FileIcon,
} from 'lucide-react';
import { HistoryCarouselPreview, HistoryCarouselData } from './HistoryCarouselPreview';

// WhatsApp formatting parser (same logic as MessagePreview)
const formatWhatsAppText = (text: string): React.ReactNode => {
  const wrapWithStyle = (
    content: React.ReactNode[],
    style: 'bold' | 'italic' | 'strike',
    key: string
  ): React.ReactNode => {
    const className =
      style === 'bold'
        ? 'font-bold'
        : style === 'italic'
        ? 'italic'
        : 'line-through';
    return (
      <span key={key} className={className}>
        {content}
      </span>
    );
  };

  const applyFormatting = (
    content: string,
    keyPrefix: string = 'fmt'
  ): React.ReactNode[] => {
    const patterns: { regex: RegExp; style: 'bold' | 'italic' | 'strike' }[] = [
      { regex: /\*([^*]+)\*/, style: 'bold' },
      { regex: /_([^_]+)_/, style: 'italic' },
      { regex: /~([^~]+)~/, style: 'strike' },
    ];

    let firstMatch: RegExpExecArray | null = null;
    let matchedPattern: (typeof patterns)[0] | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(content);
      if (match && (!firstMatch || match.index < firstMatch.index)) {
        firstMatch = match;
        matchedPattern = pattern;
      }
    }

    if (!firstMatch || !matchedPattern) {
      return content ? [<span key={keyPrefix}>{content}</span>] : [];
    }

    const parts: React.ReactNode[] = [];

    if (firstMatch.index > 0) {
      parts.push(
        ...applyFormatting(content.slice(0, firstMatch.index), `${keyPrefix}-pre`)
      );
    }

    const innerContent = applyFormatting(firstMatch[1], `${keyPrefix}-inner`);
    const wrappedContent = wrapWithStyle(
      innerContent,
      matchedPattern.style,
      `${keyPrefix}-wrap`
    );
    parts.push(wrappedContent);

    const afterIndex = firstMatch.index + firstMatch[0].length;
    if (afterIndex < content.length) {
      parts.push(
        ...applyFormatting(content.slice(afterIndex), `${keyPrefix}-post`)
      );
    }

    return parts;
  };

  return <>{applyFormatting(text)}</>;
};

interface HistoryMessagePreviewProps {
  type: string;
  content: string | null;
  mediaUrl: string | null;
  carouselData?: HistoryCarouselData | null;
}

export const HistoryMessagePreview = ({
  type,
  content,
  mediaUrl,
  carouselData,
}: HistoryMessagePreviewProps) => {
  const isImage = type === 'image';
  const isVideo = type === 'video';
  const isAudio = type === 'audio' || type === 'ptt';
  const isDocument = type === 'document' || type === 'file';
  const isCarousel = type === 'carousel';

  // Render carousel preview
  if (isCarousel && carouselData) {
    return <HistoryCarouselPreview data={carouselData} />;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <Eye className="w-4 h-4 text-muted-foreground mt-0.5" />
        <span className="text-xs text-muted-foreground">Preview da mensagem</span>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary/10 rounded-lg rounded-tr-none p-3 border border-border/30">
          {/* Media rendering */}
          {isImage && mediaUrl && (
            <div className="mb-2 rounded-md overflow-hidden">
              <img
                src={mediaUrl}
                alt="Preview"
                className="max-h-32 w-auto object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          {isVideo && mediaUrl && (
            <div className="mb-2 rounded-md overflow-hidden bg-muted relative">
              <div className="w-full h-24 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary ml-0.5" fill="currentColor" />
                </div>
              </div>
            </div>
          )}

          {isAudio && (
            <div className="mb-2 flex items-center gap-2 bg-muted/50 rounded-full px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 h-1 bg-muted rounded-full">
                <div className="w-1/3 h-full bg-primary/50 rounded-full" />
              </div>
              <span className="text-xs text-muted-foreground">0:00</span>
            </div>
          )}

          {isDocument && (
            <div className="mb-2 flex items-center gap-2 bg-muted/50 rounded-md p-2">
              <FileIcon className="w-8 h-8 text-primary" />
              <span className="text-xs text-muted-foreground truncate">Documento</span>
            </div>
          )}

          {/* Text content */}
          {content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {formatWhatsAppText(content)}
            </p>
          )}

          {/* Timestamp */}
          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryMessagePreview;
