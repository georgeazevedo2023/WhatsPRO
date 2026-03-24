import { useNavigate } from 'react-router-dom';
import type { Inbox } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Edit, Copy, Trash2, ArrowRight, Columns, FileText, Users, Lock, MessageSquare, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { EditBoardDialog } from './EditBoardDialog';

interface KanbanBoard {
  id: string;
  name: string;
  description: string | null;
  visibility: 'shared' | 'private';
  inbox_id: string | null;
  instance_id: string | null;
  columnCount?: number;
  cardCount?: number;
  inboxName?: string;
  directMemberCount?: number;
}


interface BoardCardProps {
  board: KanbanBoard;
  inboxes: Inbox[];
  onRefresh: () => void;
  canManage?: boolean;
}

export function BoardCard({ board, inboxes, onRefresh, canManage = false }: BoardCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    if (!user) return;
    setDuplicating(true);

    try {
      const { data: newBoard, error: boardErr } = await supabase
        .from('kanban_boards')
        .insert({
          name: `${board.name} (Cópia)`,
          description: board.description,
          visibility: board.visibility,
          inbox_id: board.inbox_id,
          instance_id: board.instance_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (boardErr || !newBoard) {
        toast.error('Erro ao duplicar quadro');
        return;
      }

      const { data: srcCols } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position');

      if (srcCols && srcCols.length > 0) {
        const { error: colErr } = await supabase.from('kanban_columns').insert(
          srcCols.map(col => ({
            board_id: newBoard.id,
            name: col.name,
            color: col.color,
            position: col.position,
            automation_enabled: col.automation_enabled,
            automation_message: col.automation_message,
          }))
        );
        if (colErr) throw colErr;
      }

      // Duplicate entities and build ID mapping
      const entityIdMap: Record<string, string> = {};
      const { data: srcEntities } = await supabase
        .from('kanban_entities')
        .select('*')
        .eq('board_id', board.id)
        .order('position');

      if (srcEntities && srcEntities.length > 0) {
        for (const entity of srcEntities) {
          const { data: newEntity, error: entErr } = await supabase
            .from('kanban_entities')
            .insert({
              board_id: newBoard.id,
              name: entity.name,
              position: entity.position,
            })
            .select('id')
            .single();

          if (entErr) throw entErr;

          if (newEntity) {
            entityIdMap[entity.id] = newEntity.id;

            // Duplicate entity values
            const { data: srcValues } = await supabase
              .from('kanban_entity_values')
              .select('*')
              .eq('entity_id', entity.id)
              .order('position');

            if (srcValues && srcValues.length > 0) {
              const { error: valErr } = await supabase.from('kanban_entity_values').insert(
                srcValues.map(v => ({
                  entity_id: newEntity.id,
                  label: v.label,
                  position: v.position,
                }))
              );
              if (valErr) throw valErr;
            }
          }
        }
      }

      // Duplicate fields with remapped entity_id
      const { data: srcFields } = await supabase
        .from('kanban_fields')
        .select('*')
        .eq('board_id', board.id)
        .order('position');

      if (srcFields && srcFields.length > 0) {
        const { error: fieldErr } = await supabase.from('kanban_fields').insert(
          srcFields.map(f => ({
            board_id: newBoard.id,
            name: f.name,
            field_type: f.field_type,
            options: f.options,
            position: f.position,
            is_primary: f.is_primary,
            required: f.required,
            show_on_card: f.show_on_card,
            entity_id: f.entity_id ? (entityIdMap[f.entity_id] || null) : null,
          }))
        );
        if (fieldErr) throw fieldErr;
      }

      toast.success('Quadro duplicado com sucesso!');
      onRefresh();
    } catch (err) {
      console.error('[BoardCard] Duplicate error:', err);
      toast.error('Erro ao duplicar quadro. Algumas partes podem ter sido copiadas parcialmente.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('kanban_boards').delete().eq('id', board.id);
    if (error) {
      toast.error('Erro ao excluir quadro');
      return;
    }
    toast.success('Quadro excluído');
    onRefresh();
  };

  return (
    <>
      <div className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{board.name}</h3>
            {board.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{board.description}</p>
            )}
          </div>

          {/* Menu de ações — apenas para quem pode gerenciar (super_admin) */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
                  <Copy className="w-4 h-4 mr-2" /> {duplicating ? 'Duplicando...' : 'Duplicar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={e => e.preventDefault()}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Excluir Quadro?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os cards e dados deste quadro serão perdidos. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Columns className="w-3.5 h-3.5" />
            {board.columnCount ?? 0} colunas
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {board.cardCount ?? 0} cards
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 ${
              board.visibility === 'shared'
                ? 'border-primary/40 text-primary bg-primary/5'
                : 'border-warning/40 text-warning bg-warning/5'
            }`}
          >
            {board.visibility === 'shared' ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {board.visibility === 'shared' ? 'Compartilhado' : 'Individual'}
          </Badge>
          {board.inboxName && (
            <Badge variant="outline" className="text-[10px] gap-1 border-border">
              <MessageSquare className="w-3 h-3" />
              {board.inboxName}
            </Badge>
          )}
          {(board.directMemberCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-info/40 text-info bg-info/5">
              <Users className="w-3 h-3" />
              {board.directMemberCount} membro{board.directMemberCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Open button */}
        <Button
          className="w-full gap-2 mt-1"
          onClick={() => navigate(`/dashboard/crm/${board.id}`)}
        >
          Abrir Quadro
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {canManage && (
        <EditBoardDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          board={board}
          inboxes={inboxes}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}
