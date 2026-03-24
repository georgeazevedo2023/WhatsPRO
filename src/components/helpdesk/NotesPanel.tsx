import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2, StickyNote } from 'lucide-react';
import { formatBR } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { Message } from '@/pages/dashboard/HelpDesk';

interface NotesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Message[];
  onNoteDeleted: (noteId: string) => void;
  agentNamesMap?: Record<string, string>;
}

export const NotesPanel = ({ open, onOpenChange, notes, onNoteDeleted, agentNamesMap = {} }: NotesPanelProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const { error } = await supabase
        .from('conversation_messages')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      onNoteDeleted(noteId);
      toast.success('Nota excluída');
    } catch (err) {
      handleError(err, 'Erro ao excluir nota', 'Error deleting note');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <StickyNote className="w-4 h-4 text-warning" />
            Notas Privadas
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <StickyNote className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma nota ainda</p>
            </div>
          ) : (
            notes.map(note => {
              const agentName = note.sender_id ? agentNamesMap[note.sender_id] || null : null;
              return (
                <div
                  key={note.id}
                  className="bg-secondary/60 border border-border/50 rounded-lg p-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {agentName && (
                          <span className="text-[10px] text-primary font-medium">
                            {agentName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatBR(note.created_at, "dd/MM/yyyy 'às' HH:mm")}
                        </span>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === note.id}
                        >
                          {deletingId === note.id ? (
                            <div className="w-3 h-3 border border-destructive border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(note.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
