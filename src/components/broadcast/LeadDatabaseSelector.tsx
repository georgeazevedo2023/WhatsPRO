import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Database, Plus, Trash2, Users, Calendar, ChevronRight, FolderOpen, Pencil, MessageCircle, Settings2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBR } from '@/lib/dateUtils';
import EditDatabaseDialog from './EditDatabaseDialog';
import ManageLeadDatabaseDialog from './ManageLeadDatabaseDialog';

interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
  instance_id?: string | null;
}

interface LeadDatabaseSelectorProps {
  onSelectDatabase: (database: LeadDatabase | null) => void;
  onCreateNew: () => void;
  selectedDatabase: LeadDatabase | null;
}

const LeadDatabaseSelector = ({ 
  onSelectDatabase, 
  onCreateNew,
  selectedDatabase 
}: LeadDatabaseSelectorProps) => {
  const [databases, setDatabases] = useState<LeadDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<LeadDatabase | null>(null);
  const [editTarget, setEditTarget] = useState<LeadDatabase | null>(null);
  const [manageTarget, setManageTarget] = useState<LeadDatabase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDatabases = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('lead_databases')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDatabases(data || []);
    } catch (error) {
      console.error('Error fetching databases:', error);
      toast.error('Erro ao carregar bases de leads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('lead_databases')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      setDatabases(prev => prev.filter(d => d.id !== deleteTarget.id));
      
      if (selectedDatabase?.id === deleteTarget.id) {
        onSelectDatabase(null);
      }
      
      toast.success('Base de leads removida');
    } catch (error) {
      console.error('Error deleting database:', error);
      toast.error('Erro ao remover base');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDatabaseUpdated = (updated: LeadDatabase) => {
    setDatabases(prev => prev.map(d => d.id === updated.id ? updated : d));
    
    // Update selected database if it was the one edited
    if (selectedDatabase?.id === updated.id) {
      onSelectDatabase(updated);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatBR(dateStr, "dd 'de' MMM, yyyy");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create New Button */}
      <Button
        variant="outline"
        className="w-full h-14 border-dashed flex items-center justify-center gap-2"
        onClick={onCreateNew}
      >
        <Plus className="w-5 h-5" />
        <span>Criar Nova Base de Leads</span>
      </Button>

      {/* Existing Databases */}
      {databases.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Bases existentes ({databases.length})
          </Label>
          
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {databases.map((db) => (
                <Card
                  key={db.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedDatabase?.id === db.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border/50'
                  }`}
                  onClick={() => onSelectDatabase(db)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                       <div className="flex items-start gap-3 flex-1 min-w-0">
                         <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                           <Database className="w-5 h-5 text-primary" />
                         </div>
                         <div className="min-w-0 flex-1">
                           <div className="flex items-center gap-2">
                             <h4 className="font-medium truncate">{db.name}</h4>
                             {db.instance_id && (
                               <Badge variant="outline" className="flex items-center gap-1 shrink-0 text-xs">
                                 <MessageCircle className="w-3 h-3" />
                                 Helpdesk
                               </Badge>
                             )}
                           </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {db.leads_count} contato{db.leads_count !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(db.updated_at)}
                            </span>
                          </div>
                          {db.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {db.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Gerenciar contatos"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageTarget(db);
                          }}
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Editar nome/descrição"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(db);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(db);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${
                          selectedDatabase?.id === db.id ? 'rotate-90' : ''
                        }`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty State */}
      {databases.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium text-muted-foreground">
              Nenhuma base de leads
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma nova base para organizar seus contatos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Database Dialog */}
      <EditDatabaseDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        database={editTarget}
        onSave={handleDatabaseUpdated}
      />

      {/* Manage Database Dialog */}
      <ManageLeadDatabaseDialog
        open={!!manageTarget}
        onOpenChange={(open) => !open && setManageTarget(null)}
        database={manageTarget}
        onDatabaseUpdated={(updated) => {
          handleDatabaseUpdated(updated);
          // Update manageTarget so dialog reflects changes
          setManageTarget(updated);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remover base de leads?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente a base "{deleteTarget?.name}" e todos os {deleteTarget?.leads_count} contatos. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadDatabaseSelector;
