import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, AlertCircle } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { CarouselCardEditor, CarouselCard } from './CarouselCardEditor';
import { CarouselPreview } from './CarouselPreview';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface CarouselData {
  message: string;
  cards: CarouselCard[];
}

interface CarouselEditorProps {
  value: CarouselData;
  onChange: (value: CarouselData) => void;
  disabled?: boolean;
}

const MIN_CARDS = 2;
const MAX_CARDS = 10;

const createEmptyCard = (): CarouselCard => ({
  id: crypto.randomUUID(),
  text: '',
  image: '',
  buttons: [],
});

export function CarouselEditor({ value, onChange, disabled }: CarouselEditorProps) {
  const handleMessageChange = (message: string) => {
    onChange({ ...value, message });
  };

  const handleCardChange = (index: number, card: CarouselCard) => {
    const newCards = [...value.cards];
    newCards[index] = card;
    onChange({ ...value, cards: newCards });
  };

  const handleDeleteCard = (index: number) => {
    if (value.cards.length <= MIN_CARDS) return;
    const newCards = value.cards.filter((_, i) => i !== index);
    onChange({ ...value, cards: newCards });
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= value.cards.length) return;

    const newCards = [...value.cards];
    [newCards[index], newCards[newIndex]] = [newCards[newIndex], newCards[index]];
    onChange({ ...value, cards: newCards });
  };

  const handleAddCard = () => {
    if (value.cards.length >= MAX_CARDS) return;
    onChange({ ...value, cards: [...value.cards, createEmptyCard()] });
  };

  // Validation
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    
    if (value.cards.length < MIN_CARDS) {
      errors.push(`Mínimo de ${MIN_CARDS} cards obrigatório`);
    }

    value.cards.forEach((card, idx) => {
      if (!card.image && !card.imageFile) {
        errors.push(`Card ${idx + 1}: imagem obrigatória`);
      }
      if (!card.text.trim()) {
        errors.push(`Card ${idx + 1}: texto obrigatório`);
      }
      card.buttons.forEach((btn, btnIdx) => {
        if (!btn.label.trim()) {
          errors.push(`Card ${idx + 1}, Botão ${btnIdx + 1}: label obrigatório`);
        }
        if (btn.type === 'URL' && !btn.url?.trim()) {
          errors.push(`Card ${idx + 1}, Botão ${btnIdx + 1}: URL obrigatória`);
        }
        if (btn.type === 'CALL' && !btn.phone?.trim()) {
          errors.push(`Card ${idx + 1}, Botão ${btnIdx + 1}: telefone obrigatório`);
        }
      });
    });

    return errors;
  };

  const errors = getValidationErrors();
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-4">
      {/* Main Message */}
      <div className="space-y-2">
        <Label>Mensagem principal (opcional)</Label>
        <Textarea
          placeholder="Texto que aparece antes do carrossel..."
          value={value.message}
          onChange={(e) => handleMessageChange(e.target.value)}
          disabled={disabled}
          className="min-h-[80px] resize-none"
        />
        <EmojiPicker onEmojiSelect={(emoji) => handleMessageChange(value.message + emoji)} disabled={disabled} />
      </div>

      {/* Cards Header */}
      <div className="flex items-center justify-between">
        <Label>
          Cards do carrossel ({value.cards.length}/{MAX_CARDS})
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCard}
          disabled={disabled || value.cards.length >= MAX_CARDS}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Card
        </Button>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {value.cards.map((card, index) => (
          <CarouselCardEditor
            key={card.id}
            card={card}
            index={index}
            totalCards={value.cards.length}
            onChange={(updated) => handleCardChange(index, updated)}
            onDelete={() => handleDeleteCard(index)}
            onMoveUp={() => handleMoveCard(index, 'up')}
            onMoveDown={() => handleMoveCard(index, 'down')}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Validation Errors */}
      {hasErrors && (
        <Alert variant="warning" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <ul className="list-disc list-inside space-y-0.5">
              {errors.slice(0, 3).map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
              {errors.length > 3 && (
                <li>...e mais {errors.length - 3} erro(s)</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      <CarouselPreview message={value.message} cards={value.cards} />
    </div>
  );
}

export { createEmptyCard };
