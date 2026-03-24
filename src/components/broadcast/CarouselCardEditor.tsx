import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Upload, 
  X, 
  Plus, 
  Image as ImageIcon,
  Link
} from 'lucide-react';
import { CarouselButtonEditor, CarouselButton } from './CarouselButtonEditor';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface CarouselCard {
  id: string;
  text: string;
  image: string;
  imageFile?: File;
  buttons: CarouselButton[];
}

interface CarouselCardEditorProps {
  card: CarouselCard;
  index: number;
  totalCards: number;
  onChange: (card: CarouselCard) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}

const MAX_BUTTONS_PER_CARD = 3;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function CarouselCardEditor({
  card,
  index,
  totalCards,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled,
}: CarouselCardEditorProps) {
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>(
    card.imageFile ? 'upload' : 'url'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleTextChange = (text: string) => {
    onChange({ ...card, text });
  };

  const handleImageUrlChange = (image: string) => {
    onChange({ ...card, image, imageFile: undefined });
    setPreviewUrl(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onChange({ ...card, imageFile: file, image: '' });
  };

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onChange({ ...card, imageFile: undefined, image: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addButton = () => {
    if (card.buttons.length >= MAX_BUTTONS_PER_CARD) return;
    
    const newButton: CarouselButton = {
      id: crypto.randomUUID(),
      type: 'REPLY',
      label: '',
    };
    onChange({ ...card, buttons: [...card.buttons, newButton] });
  };

  const updateButton = (buttonIndex: number, updatedButton: CarouselButton) => {
    const newButtons = [...card.buttons];
    newButtons[buttonIndex] = updatedButton;
    onChange({ ...card, buttons: newButtons });
  };

  const deleteButton = (buttonIndex: number) => {
    const newButtons = card.buttons.filter((_, i) => i !== buttonIndex);
    onChange({ ...card, buttons: newButtons });
  };

  const displayImage = previewUrl || card.image;

  return (
    <Card className="border-border/50 bg-muted/20">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Card {index + 1}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={disabled || index === 0}
              className="h-7 w-7"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={disabled || index === totalCards - 1}
              className="h-7 w-7"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={disabled || totalCards <= 2}
              className="h-7 w-7"
              title={totalCards <= 2 ? 'Mínimo de 2 cards' : 'Excluir card'}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Image Section */}
          <div className="space-y-2">
            <Label className="text-xs">Imagem *</Label>
            <Tabs 
              value={imageInputType} 
              onValueChange={(v) => setImageInputType(v as 'upload' | 'url')}
            >
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="upload" className="text-xs">
                  <Upload className="w-3 h-3 mr-1" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="url" className="text-xs">
                  <Link className="w-3 h-3 mr-1" />
                  URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={disabled}
                />
                {card.imageFile || previewUrl ? (
                  <div className="relative">
                    <img 
                      src={previewUrl || ''} 
                      alt="Preview" 
                      className="w-full h-24 object-cover rounded border border-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={clearFile}
                      disabled={disabled}
                      className="absolute top-1 right-1 h-6 w-6"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="w-full h-24 flex flex-col gap-1"
                  >
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Escolher imagem</span>
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="url" className="mt-2 space-y-2">
                <Input
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={card.image}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  disabled={disabled}
                  className="h-8 text-xs"
                />
                {card.image && !card.imageFile && (
                  <img 
                    src={card.image} 
                    alt="Preview" 
                    className="w-full h-20 object-cover rounded border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Text Section */}
          <div className="space-y-2">
            <Label className="text-xs">Texto do card *</Label>
            <Textarea
              placeholder="Descrição do card..."
              value={card.text}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={disabled}
              className="min-h-[80px] resize-none text-sm"
            />
            <EmojiPicker onEmojiSelect={(emoji) => handleTextChange(card.text + emoji)} disabled={disabled} />
          </div>
        </div>

        {/* Buttons Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Botões ({card.buttons.length}/{MAX_BUTTONS_PER_CARD})</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addButton}
              disabled={disabled || card.buttons.length >= MAX_BUTTONS_PER_CARD}
              className="h-6 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar
            </Button>
          </div>

          {card.buttons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhum botão adicionado
            </p>
          ) : (
            <div className="space-y-2">
              {card.buttons.map((button, btnIndex) => (
                <CarouselButtonEditor
                  key={button.id}
                  button={button}
                  onChange={(updated) => updateButton(btnIndex, updated)}
                  onDelete={() => deleteButton(btnIndex)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
