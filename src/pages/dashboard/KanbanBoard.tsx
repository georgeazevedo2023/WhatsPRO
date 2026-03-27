import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, Search, Kanban, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { KanbanCardItem, CardData } from '@/components/kanban/KanbanCardItem';
import { CardDetailSheet } from '@/components/kanban/CardDetailSheet';
import { useKanbanBoardData } from '@/hooks/useKanbanBoardData';


const KanbanBoard = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    board, columns, cards, fields,
    entityValuesMap, entityValueLabels,
    teamMembers, loading, canAddCard,
    directMemberRole,
    setCards, setColumns, setFields,
    loadAll, loadCards,
  } = useKanbanBoardData(boardId);

  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBoard = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // ── Drag & Drop ──────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find(c => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    const overId = over.id as string;

    // Dropped over a column
    const overColumn = columns.find(col => col.id === overId);
    if (overColumn && activeCard.column_id !== overColumn.id) {
      setCards(prev =>
        prev.map(c => c.id === activeCard.id ? { ...c, column_id: overColumn.id } : c)
      );
      return;
    }

    // Dropped over another card
    const overCard = cards.find(c => c.id === overId);
    if (overCard && overCard.column_id !== activeCard.column_id) {
      setCards(prev =>
        prev.map(c => c.id === activeCard.id ? { ...c, column_id: overCard.column_id } : c)
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCardData = cards.find(c => c.id === activeId);
    if (!activeCardData) return;

    let newColumnId = activeCardData.column_id;

    // Check if dropped over a column header
    const overColumn = columns.find(col => col.id === overId);
    if (overColumn) {
      newColumnId = overColumn.id;
    }

    // Check if dropped over another card
    const overCard = cards.find(c => c.id === overId);
    if (overCard) {
      newColumnId = overCard.column_id;
    }

    // Reorder within column
    const colCards = cards.filter(c => c.column_id === newColumnId);
    const oldIdx = colCards.findIndex(c => c.id === activeId);
    const newIdx = overCard ? colCards.findIndex(c => c.id === overId) : colCards.length - 1;

    let reordered = colCards;
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(colCards, oldIdx, newIdx);
    }

    const otherCards = cards.filter(c => c.column_id !== newColumnId && c.id !== activeId);
    const updatedCards = [
      ...otherCards,
      ...reordered.map((c, i) => ({ ...c, column_id: newColumnId, position: i })),
    ];
    const previousCards = cards; // snapshot for rollback
    setCards(updatedCards);

    // Persist to DB
    const { error: colErr } = await supabase
      .from('kanban_cards')
      .update({ column_id: newColumnId })
      .eq('id', activeId);

    if (colErr) {
      console.error('[KanbanBoard] Error moving card:', colErr);
      toast.error('Erro ao mover card');
      setCards(previousCards);
      return;
    }

    // Update positions in parallel
    const posResults = await Promise.all(
      reordered.map((card, i) =>
        supabase.from('kanban_cards').update({ position: i }).eq('id', card.id)
      )
    );
    const posErrors = posResults.filter(({ error }) => error);
    if (posErrors.length > 0) {
      posErrors.forEach(({ error }) => console.error('[KanbanBoard] Error updating card position:', error));
      toast.error('Erro ao salvar posição dos cards');
    }

    // Check automation
    const targetCol = columns.find(c => c.id === newColumnId);
    if (targetCol?.automation_enabled && targetCol.automation_message && board?.instance_id) {
      toast.info(`Automação ativa: coluna "${targetCol.name}"`, { description: 'Configure o disparo na Etapa 4.' });
    }
  };

  // ── Add card ─────────────────────────────────────────────
  const handleAddCard = async (columnId: string, title: string) => {
    if (!title.trim() || !user || !boardId) return;

    const colCards = cards.filter(c => c.column_id === columnId);

    // Em quadros privados sem inbox, auto-atribuir ao usuário logado
    const autoAssign = board?.visibility === 'private' ? user.id : null;

    const { error } = await supabase.from('kanban_cards').insert({
      board_id: boardId,
      column_id: columnId,
      title: title.trim(),
      created_by: user.id,
      assigned_to: autoAssign,
      position: colCards.length,
      tags: [],
    });

    if (error) { toast.error('Erro ao criar card'); return; }

    toast.success('Card criado!');
    loadAll();
  };

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    setSheetOpen(true);
  };

  const handleMoveCard = async (cardId: string, direction: 'prev' | 'next') => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const sortedCols = [...columns].sort((a, b) => a.position - b.position);
    const currentIdx = sortedCols.findIndex(c => c.id === card.column_id);
    const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= sortedCols.length) return;

    const targetCol = sortedCols[targetIdx];
    const targetColCards = cards.filter(c => c.column_id === targetCol.id);

    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, column_id: targetCol.id, position: targetColCards.length } : c
    ));

    const { error: moveErr } = await supabase.from('kanban_cards').update({
      column_id: targetCol.id,
      position: targetColCards.length,
    }).eq('id', cardId);
    if (moveErr) console.error('[KanbanBoard] Error moving card:', moveErr);

    if (targetCol.automation_enabled && targetCol.automation_message && board?.instance_id) {
      toast.info(`Automação ativa: coluna "${targetCol.name}"`);
    }
  };

  // ── Filter ───────────────────────────────────────────────
  const searchFiltered = search
    ? cards.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
        (c.assignedName || '').toLowerCase().includes(search.toLowerCase())
      )
    : cards;

  const filteredByAssignee = filterAssignee
    ? searchFiltered.filter(c => c.assigned_to === filterAssignee)
    : searchFiltered;

  const filteredCards = filteredByAssignee;

  const getColumnCards = (colId: string) =>
    filteredCards.filter(c => c.column_id === colId).sort((a, b) => a.position - b.position);

  // Helper: initials from name
  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!board) return null;

  // Members who actually have cards (for chips)
  const membersWithCards = teamMembers.filter(m =>
    cards.some(c => c.assigned_to === m.id)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard/crm')} aria-label="Voltar para lista de quadros">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Kanban className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">{board.name}</h1>
              {board.description && (
                <p className="text-xs text-muted-foreground truncate hidden sm:block">{board.description}</p>
              )}
            </div>
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cards..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Buscar cards"
              className="h-8 pl-8 w-28 sm:w-48 text-sm"
            />
          </div>
          <span className="text-sm text-muted-foreground shrink-0" aria-live="polite">
            {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
          </span>
          {directMemberRole === 'viewer' && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
              👁️ Visualizador
            </span>
          )}
        </div>

        {/* Assignee filter chips */}
        {membersWithCards.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Filtrar:</span>
            {membersWithCards.map(m => {
              const name = m.full_name || m.email;
              const count = cards.filter(c => c.assigned_to === m.id).length;
              const isActive = filterAssignee === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setFilterAssignee(isActive ? null : m.id)}
                  aria-label={`Filtrar por ${name}`}
                  aria-pressed={isActive}
                  className={cn(
                    'flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-xs font-medium transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Avatar className="w-4 h-4 shrink-0">
                    <AvatarFallback className={cn('text-xs', isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary')}>
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{name.split(' ')[0]}</span>
                  <span className={cn('px-1 rounded-full text-xs', isActive ? 'bg-primary-foreground/20' : 'bg-muted')}>{count}</span>
                </button>
              );
            })}
            {filterAssignee && (
              <button
                onClick={() => setFilterAssignee(null)}
                aria-label="Limpar filtro de responsável"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kanban board */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scroll buttons — visíveis em touch/tablet */}
        <button
          onClick={() => scrollBoard('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-card/90 border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-card active:scale-95 transition-all md:hidden"
          aria-label="Rolar para esquerda"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scrollBoard('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-card/90 border border-border shadow-md text-muted-foreground hover:text-foreground hover:bg-card active:scale-95 transition-all md:hidden"
          aria-label="Rolar para direita"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div ref={scrollRef} className="h-full overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 h-full min-h-[calc(100vh-10rem)]">
            {columns.map((col, colIdx) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={getColumnCards(col.id)}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
                canAddCard={canAddCard}
                onMoveCard={handleMoveCard}
                hasPrev={colIdx > 0}
                hasNext={colIdx < columns.length - 1}
              />
            ))}

            {columns.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center">
                <div className="space-y-3">
                  <Kanban className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    Este quadro ainda não tem colunas.<br />
                    <span
                      className="text-primary cursor-pointer hover:underline"
                      onClick={() => navigate('/dashboard/crm')}
                    >
                      Edite o quadro
                    </span>{' '}
                    para adicionar etapas ao funil.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeCard && (
              <KanbanCardItem
                card={activeCard}
                onClick={() => {}}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
        </div>
      </div>

      {/* Card detail sheet */}
      <CardDetailSheet
        card={selectedCard}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        columns={columns}
        fields={fields}
        teamMembers={teamMembers}
        entityValuesMap={entityValuesMap}
        onSaved={loadAll}
        onDeleted={loadAll}
      />
    </div>
  );
};



export default KanbanBoard;

