import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GripVertical, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardData {
  id: string;
  title: string;
  column_id: string;
  board_id: string;
  assigned_to: string | null;
  tags: string[];
  position: number;
  notes?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_pic?: string | null;
  assignedName?: string;
  primaryFieldValue?: string;
  primaryFieldName?: string;
  fieldValues?: Array<{ name: string; value: string; isPrimary: boolean; showOnCard: boolean }>;
}

interface KanbanCardItemProps {
  card: CardData;
  onClick: () => void;
  isDragging?: boolean;
  onMoveCard?: (cardId: string, direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const TAG_COLORS = [
  'bg-primary/10 text-primary border-primary/20',
  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
];

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

const getInitials = (name: string) => {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
};

export const KanbanCardItem = memo(function KanbanCardItem({ card, onClick, isDragging, onMoveCard, hasPrev, hasNext }: KanbanCardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col gap-2 p-3 rounded-lg border border-border bg-card',
        'cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-150',
        (isSortDragging || isDragging) && 'opacity-40 shadow-xl border-primary/50',
      )}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground hover:text-foreground"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Lead badge */}
      {card.contact_id && (
        <div className="flex items-center gap-1.5 mb-0.5">
          {card.contact_pic ? (
            <img src={card.contact_pic} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : null}
          <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Lead</span>
          {card.contact_phone && <span className="text-[9px] text-muted-foreground">{card.contact_phone}</span>}
        </div>
      )}

      {/* Title — só exibe se não houver campo primário com valor */}
      {(!card.primaryFieldValue) && (
        <p className="text-base font-medium text-foreground leading-snug pr-6 line-clamp-2">
          {card.title}
        </p>
      )}

      {/* Primary field value — vira o "título" do card */}
      {card.primaryFieldValue && (
        <p className="text-base font-semibold text-foreground leading-snug pr-6 line-clamp-2">
          {card.primaryFieldValue}
        </p>
      )}

      {/* Outros campos (exceto o primário), até 5 */}
      {card.fieldValues && card.fieldValues.filter(fv => !fv.isPrimary && fv.value && fv.showOnCard).length > 0 && (
        <div className="flex flex-col gap-0.5">
          {card.fieldValues
            .filter(fv => !fv.isPrimary && fv.value && fv.showOnCard)
            .slice(0, 5)
            .map(fv => (
              <div key={fv.name} className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground shrink-0">{fv.name}:</span>
                <span className="text-sm font-medium text-foreground truncate">{fv.value}</span>
              </div>
            ))}
        </div>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', getTagColor(tag))}
            >
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{card.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: assignee + botões mover coluna */}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        {/* Assignee */}
        {card.assignedName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(card.assignedName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate">{card.assignedName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 opacity-60" title="Sem responsável atribuído">
            <UserX className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sem responsável</span>
          </div>
        )}

        {/* Botões < > mover entre colunas */}
        {onMoveCard && (
          <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <button
              disabled={!hasPrev}
              onClick={() => onMoveCard(card.id, 'prev')}
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                hasPrev
                  ? 'border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5'
                  : 'border-border/30 text-muted-foreground/30 cursor-not-allowed'
              )}
              title="Mover para coluna anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={!hasNext}
              onClick={() => onMoveCard(card.id, 'next')}
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                hasNext
                  ? 'border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5'
                  : 'border-border/30 text-muted-foreground/30 cursor-not-allowed'
              )}
              title="Mover para próxima coluna"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
