import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Link, MessageSquare, Phone, Image as ImageIcon, Eye, LayoutGrid, X, ZoomIn, Maximize2 } from 'lucide-react';

interface CarouselButton {
  id: string;
  type: 'URL' | 'REPLY' | 'CALL';
  label: string;
  value: string;
}

interface CarouselCard {
  id: string;
  text: string;
  image: string;
  buttons: CarouselButton[];
}

export interface HistoryCarouselData {
  message: string;
  cards: CarouselCard[];
}

interface HistoryCarouselPreviewProps {
  data: HistoryCarouselData;
}

const formatWhatsAppText = (text: string): React.ReactNode => {
  if (!text) return null;

  const parseFormatting = (input: string): React.ReactNode[] => {
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
    const parts = input.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <strong key={index}>{part.slice(1, -1)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
        return <del key={index}>{part.slice(1, -1)}</del>;
      }
      return part;
    });
  };

  return parseFormatting(text);
};

const getButtonIcon = (type: CarouselButton['type']) => {
  switch (type) {
    case 'URL':
      return <Link className="w-3 h-3" />;
    case 'REPLY':
      return <MessageSquare className="w-3 h-3" />;
    case 'CALL':
      return <Phone className="w-3 h-3" />;
  }
};

export function HistoryCarouselPreview({ data }: HistoryCarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string>('');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  if (!data || !data.cards || data.cards.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-start gap-2 mb-2">
          <LayoutGrid className="w-4 h-4 text-muted-foreground mt-0.5" />
          <span className="text-xs text-muted-foreground">Carrossel (dados não disponíveis)</span>
        </div>
      </div>
    );
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? data.cards.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === data.cards.length - 1 ? 0 : prev + 1));
  };

  const handleFullscreenPrev = () => {
    setFullscreenIndex((prev) => (prev === 0 ? data.cards.length - 1 : prev - 1));
  };

  const handleFullscreenNext = () => {
    setFullscreenIndex((prev) => (prev === data.cards.length - 1 ? 0 : prev + 1));
  };

  const openLightbox = (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageUrl) {
      setLightboxImage(imageUrl);
      setLightboxOpen(true);
    }
  };

  const openFullscreen = () => {
    setFullscreenIndex(activeIndex);
    setFullscreenOpen(true);
  };

  return (
    <>
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="text-xs text-muted-foreground">Preview do carrossel ({data.cards.length} cards)</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openFullscreen}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Tela cheia
          </Button>
        </div>

        {/* Main message bubble */}
        {data.message && (
          <div className="flex justify-end mb-3">
            <div className="max-w-[85%] bg-primary/10 rounded-lg rounded-tr-none p-3 border border-border/30">
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatWhatsAppText(data.message)}
              </p>
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground">✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Carousel cards */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 shrink-0"
              disabled={data.cards.length <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 overflow-hidden">
              <div 
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                {data.cards.map((card, idx) => (
                  <div 
                    key={card.id || idx}
                    className="w-full flex-shrink-0 px-1"
                  >
                    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                      {/* Card image - aspect ratio container */}
                      <div 
                        className={`aspect-[4/3] bg-muted flex items-center justify-center relative overflow-hidden ${card.image ? 'cursor-pointer group' : ''}`}
                        onClick={(e) => card.image && openLightbox(card.image, e)}
                      >
                        {card.image ? (
                          <>
                            <img 
                              src={card.image}
                              alt={`Card ${idx + 1}`}
                              className="absolute inset-0 w-full h-full object-contain bg-muted"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            {/* Zoom overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Card content */}
                      <div className="p-2.5 space-y-1.5">
                        {card.text && (
                          <p className="text-xs whitespace-pre-wrap break-words line-clamp-2">
                            {formatWhatsAppText(card.text)}
                          </p>
                        )}

                        {/* Card buttons */}
                        {card.buttons && card.buttons.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/30">
                            {card.buttons.map((button, btnIdx) => (
                              <div
                                key={button.id || btnIdx}
                                className="flex items-center justify-center gap-1 py-1 px-2 bg-muted/50 rounded text-[10px] font-medium text-primary"
                              >
                                {getButtonIcon(button.type)}
                                <span>{button.label || 'Botão'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 shrink-0"
              disabled={data.cards.length <= 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Dots indicator */}
          {data.cards.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {data.cards.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    idx === activeIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Dialog for single image */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none">
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center justify-center p-4 min-h-[300px]">
            {lightboxImage && (
              <img 
                src={lightboxImage}
                alt="Imagem ampliada"
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Carousel Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-background overflow-hidden">
          <DialogTitle className="sr-only">Visualização em tela cheia do carrossel</DialogTitle>
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <span className="font-medium">Carrossel ({data.cards.length} cards)</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
            {/* Main message */}
            {data.message && (
              <div className="flex justify-end mb-6">
                <div className="max-w-[70%] bg-primary/10 rounded-lg rounded-tr-none p-4 border border-border/30">
                  <p className="text-base whitespace-pre-wrap break-words">
                    {formatWhatsAppText(data.message)}
                  </p>
                  <div className="flex justify-end items-center gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">✓✓</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fullscreen carousel navigation */}
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleFullscreenPrev}
                className="h-12 w-12 shrink-0"
                disabled={data.cards.length <= 1}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>

              <div className="flex-1 overflow-hidden">
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${fullscreenIndex * 100}%)` }}
                >
                  {data.cards.map((card, idx) => (
                    <div 
                      key={card.id || idx}
                      className="w-full flex-shrink-0 px-2"
                    >
                      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg max-w-md mx-auto">
                        {/* Card image - larger in fullscreen */}
                        <div 
                          className={`aspect-[4/3] bg-muted flex items-center justify-center relative overflow-hidden ${card.image ? 'cursor-pointer group' : ''}`}
                          onClick={(e) => card.image && openLightbox(card.image, e)}
                        >
                          {card.image ? (
                            <>
                              <img 
                                src={card.image}
                                alt={`Card ${idx + 1}`}
                                className="absolute inset-0 w-full h-full object-contain bg-muted"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              {/* Zoom overlay */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </>
                          ) : (
                            <ImageIcon className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>

                        {/* Card content */}
                        <div className="p-4 space-y-3">
                          {card.text && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {formatWhatsAppText(card.text)}
                            </p>
                          )}

                          {/* Card buttons */}
                          {card.buttons && card.buttons.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/30">
                              {card.buttons.map((button, btnIdx) => (
                                <div
                                  key={button.id || btnIdx}
                                  className="flex items-center justify-center gap-2 py-2 px-3 bg-muted/50 rounded-lg text-sm font-medium text-primary"
                                >
                                  {getButtonIcon(button.type)}
                                  <span>{button.label || 'Botão'}</span>
                                  {button.value && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({button.type === 'CALL' ? button.value : button.value.length > 30 ? button.value.slice(0, 30) + '...' : button.value})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleFullscreenNext}
                className="h-12 w-12 shrink-0"
                disabled={data.cards.length <= 1}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>

            {/* Fullscreen dots indicator */}
            {data.cards.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {data.cards.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFullscreenIndex(idx)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      idx === fullscreenIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default HistoryCarouselPreview;
