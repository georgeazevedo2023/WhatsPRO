import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Link, MessageSquare, Phone } from 'lucide-react';

export interface CarouselButton {
  id: string;
  type: 'URL' | 'REPLY' | 'CALL';
  label: string;
  url?: string;
  phone?: string;
}

interface CarouselButtonEditorProps {
  button: CarouselButton;
  onChange: (button: CarouselButton) => void;
  onDelete: () => void;
  disabled?: boolean;
}

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

// Format phone number as +55 (11) 99999-9999
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 13 digits (country code + area + number)
  const limited = digits.slice(0, 13);
  
  if (limited.length === 0) return '';
  
  let formatted = '+';
  
  // Country code (up to 2 digits)
  if (limited.length >= 1) {
    formatted += limited.slice(0, 2);
  }
  
  // Area code
  if (limited.length >= 3) {
    formatted += ' (' + limited.slice(2, 4);
  }
  
  if (limited.length >= 5) {
    formatted += ') ';
  }
  
  // First part of number (5 digits for mobile, 4 for landline)
  if (limited.length >= 5) {
    const remaining = limited.slice(4);
    if (remaining.length <= 5) {
      formatted += remaining;
    } else {
      formatted += remaining.slice(0, 5) + '-' + remaining.slice(5);
    }
  }
  
  return formatted;
};

// Extract only digits for storage
const extractPhoneDigits = (formatted: string): string => {
  return formatted.replace(/\D/g, '');
};

export function CarouselButtonEditor({ 
  button, 
  onChange, 
  onDelete,
  disabled 
}: CarouselButtonEditorProps) {
  const handleTypeChange = (type: CarouselButton['type']) => {
    onChange({
      ...button,
      type,
      url: type === 'URL' ? button.url || '' : undefined,
      phone: type === 'CALL' ? button.phone || '' : undefined,
    });
  };

  const handleLabelChange = (label: string) => {
    onChange({ ...button, label });
  };

  const handleUrlChange = (url: string) => {
    onChange({ ...button, url });
  };

  const handlePhoneChange = (input: string) => {
    // Format and store
    const formatted = formatPhoneNumber(input);
    // Store only digits for API compatibility
    const digits = extractPhoneDigits(formatted);
    onChange({ ...button, phone: digits });
  };

  // Get formatted display value
  const formattedPhone = button.phone ? formatPhoneNumber(button.phone) : '';

  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-2">
      {/* Row 1: Type and Label */}
      <div className="flex items-center gap-2">
        <Select 
          value={button.type} 
          onValueChange={(v) => handleTypeChange(v as CarouselButton['type'])}
          disabled={disabled}
        >
          <SelectTrigger className="w-[110px] h-9 bg-background border-border/50">
            <div className="flex items-center gap-1.5">
              {getButtonIcon(button.type)}
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="URL">URL</SelectItem>
            <SelectItem value="REPLY">Resposta</SelectItem>
            <SelectItem value="CALL">Ligar</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Texto do botão"
          value={button.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          disabled={disabled}
          className="h-9 flex-1 min-w-0 bg-background border-border/50"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={disabled}
          className="h-9 w-9 shrink-0 hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      {/* Row 2: URL or Phone input (conditional) */}
      {button.type === 'URL' && (
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <Input
            placeholder="https://exemplo.com"
            value={button.url || ''}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={disabled}
            className="h-9 flex-1 bg-background border-border/50"
            type="url"
          />
        </div>
      )}

      {button.type === 'CALL' && (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <Input
            placeholder="+55 (11) 99999-9999"
            value={formattedPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            disabled={disabled}
            className="h-9 flex-1 bg-background border-border/50"
            type="tel"
          />
        </div>
      )}
    </div>
  );
}
