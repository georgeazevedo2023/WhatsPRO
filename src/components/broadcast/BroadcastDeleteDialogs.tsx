import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { formatBR } from '@/lib/dateUtils';
import { getMessageTypeLabel } from './BroadcastLogCard';
import type { BroadcastLog } from './BroadcastHistoryTypes';

interface BroadcastDeleteDialogsProps {
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  logToDelete: BroadcastLog | null;
  confirmDelete: () => void;
  deleteIsPending: boolean;
  batchDeleteDialogOpen: boolean;
  setBatchDeleteDialogOpen: (open: boolean) => void;
  selectedCount: number;
  confirmBatchDelete: () => void;
  batchDeleteIsPending: boolean;
}

const BroadcastDeleteDialogs = ({
  deleteDialogOpen,
  setDeleteDialogOpen,
  logToDelete,
  confirmDelete,
  deleteIsPending,
  batchDeleteDialogOpen,
  setBatchDeleteDialogOpen,
  selectedCount,
  confirmBatchDelete,
  batchDeleteIsPending,
}: BroadcastDeleteDialogsProps) => {
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir registro
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro do histórico? Esta ação não pode ser desfeita.
              {logToDelete && (
                <span className="block mt-2 text-sm">
                  <strong>Tipo:</strong> {getMessageTypeLabel(logToDelete.message_type)} •
                  <strong> Grupos:</strong> {logToDelete.groups_targeted} •
                  <strong> Data:</strong> {formatBR(logToDelete.created_at, "dd/MM/yyyy")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:w-auto w-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto w-full"
              disabled={deleteIsPending}
            >
              {deleteIsPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir {selectedCount} registros
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedCount} registros</strong> do histórico?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:w-auto w-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto w-full"
              disabled={batchDeleteIsPending}
            >
              {batchDeleteIsPending ? 'Excluindo...' : `Excluir ${selectedCount} registros`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BroadcastDeleteDialogs;
