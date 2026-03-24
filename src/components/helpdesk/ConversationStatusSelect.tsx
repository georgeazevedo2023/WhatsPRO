import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ConversationStatusSelectProps {
  value: string;
  onChange: (status: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function ConversationStatusSelect({ value, onChange, size = 'sm', className }: ConversationStatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          'w-auto bg-transparent shadow-none focus:ring-0 gap-1 px-2',
          size === 'sm' ? 'h-7 text-xs border-border/50' : 'h-9 text-sm',
          className,
        )}
        aria-label="Alterar status da conversa"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${opt.color}`} />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
