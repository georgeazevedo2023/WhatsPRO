import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','🥱','😌','😛','😜','🤪','😝','🤑','🤭','🤫','🤥','😬','😲','🤯','😳','🥺','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  },
  {
    name: 'Gestos',
    icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦶','🦵','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'],
  },
  {
    name: 'Corações',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💌','💋','💍','💎'],
  },
  {
    name: 'Objetos',
    icon: '📱',
    emojis: ['📱','💻','⌨️','🖥️','🖨️','🖱️','📷','📸','📹','🎥','📞','☎️','📺','📻','🎵','🎶','🎤','🎧','🎸','🎹','🎺','🎻','🥁','📚','📖','📝','✏️','📌','📎','🔒','🔑','🔔','📦','📧','💡','🔋','💰','💵','💳','🏆','🎯','🎮','🎲','🧩'],
  },
  {
    name: 'Natureza',
    icon: '🌿',
    emojis: ['🌞','🌙','⭐','🌟','✨','⚡','🔥','🌈','☀️','🌤️','⛅','🌧️','❄️','💧','🌊','🌸','🌺','🌻','🌹','🌷','🌱','🌿','☘️','🍀','🌳','🍃','🍂','🍁','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦋','🐛','🐝','🐞'],
  },
  {
    name: 'Comida',
    icon: '🍕',
    emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🌽','🥕','🧅','🥔','🍞','🥐','🧀','🍕','🍔','🍟','🌭','🍿','🥤','🍺','🍷','🥂','☕','🍵','🧃','🧁','🍰','🎂','🍫','🍬','🍭','🍩','🍪'],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const all: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      all.push(...cat.emojis);
    }
    // Simple filter: just return all emojis (unicode search isn't text-based, so show all when searching)
    // For a better UX we'd need emoji names, but keeping it simple
    return all;
  }, [search]);

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    // Don't close - let user pick multiple
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 z-[100]"
        side="top"
        align="start"
      >
        {/* Category tabs */}
        <div className="flex border-b border-border px-1 pt-1 gap-0.5 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => { setActiveCategory(i); setSearch(''); }}
              className={cn(
                'px-2 py-1.5 text-base rounded-t-md transition-colors flex-shrink-0',
                activeCategory === i
                  ? 'bg-muted'
                  : 'hover:bg-muted/50'
              )}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-2 pb-0">
          <Input
            placeholder="Buscar emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Emoji grid */}
        <div className="p-2 h-[200px] overflow-y-auto">
          <div className="grid grid-cols-8 gap-0.5">
            {(filteredEmojis || EMOJI_CATEGORIES[activeCategory].emojis).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmojiPickerContent({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const all: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      all.push(...cat.emojis);
    }
    return all;
  }, [search]);

  return (
    <>
      <div className="flex border-b border-border px-1 pt-1 gap-0.5 overflow-x-auto">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => { setActiveCategory(i); setSearch(''); }}
            className={cn(
              'px-2 py-1.5 text-base rounded-t-md transition-colors flex-shrink-0',
              activeCategory === i ? 'bg-muted' : 'hover:bg-muted/50'
            )}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      <div className="p-2 pb-0">
        <Input
          placeholder="Buscar emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="p-2 h-[200px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {(filteredEmojis || EMOJI_CATEGORIES[activeCategory].emojis).map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => onEmojiSelect(emoji)}
              className="h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-muted transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
