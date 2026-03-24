import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Link, MessageSquare, Phone, Image as ImageIcon } from 'lucide-react';
import type { CarouselCard } from './CarouselCardEditor';
import type { CarouselButton } from './CarouselButtonEditor';

interface CarouselPreviewProps {
  message: string;
  cards: CarouselCard[];
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

export function CarouselPreview({ message, cards }: CarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const validCards = cards.filter(c => c.text || c.image || c.imageFile);
  
  if (validCards.length === 0 && !message) {
    return (
      <div className="mt-4 p-4 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Preencha os cards para ver o preview
        </p>
      </div>
    );
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        👁️ Preview do Carrossel
      </p>
      
      <div className="bg-muted/30 rounded-lg p-4">
        {/* Main message bubble */}
        {message && (
          <div className="flex justify-end mb-3">
            <div className="max-w-[85%] bg-primary/10 rounded-lg rounded-tr-none p-3 border border-border/30">
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatWhatsAppText(message)}
              </p>
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground">14:30</span>
                <span className="text-[10px] text-muted-foreground">✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Carousel cards */}
        {cards.length > 0 && (
          <div className="space-y-2">
            {/* Card carousel */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="h-8 w-8 shrink-0"
                disabled={cards.length <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex-1 overflow-hidden">
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                  {cards.map((card, idx) => (
                    <div 
                      key={card.id}
                      className="w-full flex-shrink-0 px-1"
                    >
                      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                        {/* Card image - aspect ratio container */}
                        <div className="aspect-[4/3] bg-muted flex items-center justify-center relative overflow-hidden">
                          {card.image || card.imageFile ? (
                            <img 
                              src={card.imageFile ? URL.createObjectURL(card.imageFile) : card.image}
                              alt={`Card ${idx + 1}`}
                              className="absolute inset-0 w-full h-full object-contain bg-muted"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>

                        {/* Card content */}
                        <div className="p-3 space-y-2">
                          {card.text && (
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                              {formatWhatsAppText(card.text)}
                            </p>
                          )}

                          {/* Card buttons */}
                          {card.buttons.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-border/30">
                              {card.buttons.map((button) => (
                                <div
                                  key={button.id}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-muted/50 rounded text-xs font-medium text-primary"
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
                disabled={cards.length <= 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Dots indicator */}
            {cards.length > 1 && (
              <div className="flex justify-center gap-1.5">
                {cards.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === activeIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
