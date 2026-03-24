import { cn } from '@/lib/utils';
import type { Label } from '@/types';

export type { Label };

interface ConversationLabelsProps {
  labels: Label[];
  size?: 'sm' | 'md';
  className?: string;
  onRemove?: (labelId: string) => void;
}

export const ConversationLabels = ({ labels, size = 'sm', className, onRemove }: ConversationLabelsProps) => {
  if (labels.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {labels.map(label => (
        <span
          key={label.id}
          className={cn(
            'inline-flex items-center rounded-full font-medium border gap-0.5',
            size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'
          )}
          style={{
            backgroundColor: `${label.color}20`,
            color: label.color,
            borderColor: `${label.color}40`,
          }}
        >
          {label.name}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(label.id); }}
              className="ml-0.5 hover:opacity-70 transition-opacity leading-none"
              title="Remover etiqueta"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
};
