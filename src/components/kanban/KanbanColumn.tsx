import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanCardItem, CardData } from './KanbanCardItem';

export interface ColumnData {
  id: string;
  name: string;
  color: string;
  position: number;
  automation_enabled: boolean;
  automation_message: string | null;
}

interface KanbanColumnProps {
  column: ColumnData;
  cards: CardData[];
  onCardClick: (card: CardData) => void;
  onAddCard: (columnId: string, title: string) => Promise<void>;
  canAddCard?: boolean;
  onMoveCard: (cardId: string, direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function KanbanColumn({ column, cards, onCardClick, onAddCard, canAddCard = false, onMoveCard, hasPrev, hasNext }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleConfirm = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    await onAddCard(column.id, newTitle.trim());
    setSaving(false);
    setNewTitle('');
    setIsAdding(false);
  };

  const handleCancel = () => {
    setNewTitle('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-muted/30 transition-colors duration-150 min-w-[300px] max-w-[300px]',
        isOver ? 'border-primary/50 bg-primary/5' : 'border-border'
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.color }}
          />
          <span className="text-base font-semibold text-foreground">{column.name}</span>
          <span className="text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
        {canAddCard && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-60 hover:opacity-100"
            onClick={() => setIsAdding(true)}
            title="Adicionar card"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Cards area */}
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex flex-col gap-2 p-2 flex-1 min-h-[200px] transition-colors duration-150',
            isOver && 'bg-primary/5'
          )}
        >
          {cards.map(card => (
            <KanbanCardItem
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              onMoveCard={onMoveCard}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          ))}

          {cards.length === 0 && !isAdding && (
            <div
              className={cn(
                'flex-1 flex items-center justify-center py-6 rounded-lg border-2 border-dashed transition-colors duration-150',
                isOver ? 'border-primary/40 bg-primary/5' : 'border-border/40'
              )}
            >
              <p className="text-xs text-muted-foreground">Arraste cards para cá</p>
            </div>
          )}
        </div>
      </SortableContext>

      {/* Inline add input */}
      {canAddCard && (
        <div className="p-2 border-t border-border/60">
          {isAdding ? (
            <div className="flex flex-col gap-1.5">
              <Input
                ref={inputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome do lead / cliente..."
                className="h-8 text-sm"
                disabled={saving}
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="flex-1 h-7 gap-1 text-sm"
                  onClick={handleConfirm}
                  disabled={!newTitle.trim() || saving}
                >
                  <Check className="w-3 h-3" />
                  {saving ? 'Criando...' : 'Criar'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-muted-foreground hover:text-foreground h-8 text-sm"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar card
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
