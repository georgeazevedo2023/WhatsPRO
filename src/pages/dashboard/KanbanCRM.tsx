import { useState, useEffect } from 'react';
import type { Inbox } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kanban, Plus, Search, LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BoardCard } from '@/components/kanban/BoardCard';
import { CreateBoardDialog } from '@/components/kanban/CreateBoardDialog';

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


const KanbanCRM = () => {
  const { user, isSuperAdmin, isGerente } = useAuth();
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);

    try {
      const [boardsRes, inboxesRes] = await Promise.all([
        supabase.from('kanban_boards').select('*').order('created_at', { ascending: false }),
        supabase.from('inboxes').select('id, name, instance_id').order('name'),
      ]);

      if (boardsRes.error) throw boardsRes.error;

      const boardList: KanbanBoard[] = boardsRes.data || [];
      const inboxList: Inbox[] = inboxesRes.data || [];
      setInboxes(inboxList);

      // Enrich boards with column/card/member counts in a single query
      const { data: countsData } = await supabase.rpc('get_kanban_board_counts');
      const countsMap = new Map((countsData || []).map((c: { board_id: string; column_count: number; card_count: number; member_count: number }) => [c.board_id, c]));

      const enriched = boardList.map((board) => {
        const counts = countsMap.get(board.id);
        const inbox = inboxList.find(i => i.id === board.inbox_id);
        return {
          ...board,
          columnCount: counts?.column_count ?? 0,
          cardCount: counts?.card_count ?? 0,
          inboxName: inbox?.name,
          directMemberCount: counts?.member_count ?? 0,
        };
      });

      setBoards(enriched);
    } catch (err) {
      console.error('[KanbanCRM] Error loading boards:', err);
      setLoadError(true);
      toast.error('Erro ao carregar quadros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const filtered = boards.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.description || '').toLowerCase().includes(search.toLowerCase())
  );

  // Apenas super_admin pode criar/gerenciar quadros
  const canManage = isSuperAdmin;

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Kanban className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Kanban CRM</h1>
            <p className="text-xs text-muted-foreground">{boards.length} quadro{boards.length !== 1 ? 's' : ''} {boards.length !== 1 ? 'disponíveis' : 'disponível'}</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Quadro
          </Button>
        )}
      </div>

      {/* Search */}
      {boards.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar quadro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <AlertTriangle className="w-12 h-12 opacity-40" />
          <p className="text-sm">Erro ao carregar quadros</p>
          <Button variant="outline" size="sm" className="gap-2" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </div>
      ) : boards.length === 0 ? (
        /* Empty state — diferenciado por papel */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Kanban className="w-10 h-10 text-primary" />
          </div>
          {canManage ? (
            <>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">Nenhum quadro criado</h2>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Crie seu primeiro pipeline para gerenciar leads, vendas ou processos de atendimento.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card text-center">
                  <LayoutGrid className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">Quadros Personalizados</span>
                  <span className="text-xs text-muted-foreground">Colunas, campos e regras de visibilidade</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card text-center">
                  <Kanban className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">Integração WhatsApp</span>
                  <span className="text-xs text-muted-foreground">Automações por etapa do funil</span>
                </div>
              </div>
              <Button size="lg" onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Primeiro Quadro
              </Button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">Nenhum quadro disponível</h2>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Você ainda não tem acesso a nenhum quadro. Aguarde o administrador configurar e vincular um quadro à sua caixa de atendimento.
                </p>
              </div>
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Nenhum quadro encontrado para "{search}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(board => (
            <BoardCard
              key={board.id}
              board={board}
              inboxes={inboxes}
              onRefresh={loadData}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {canManage && (
        <CreateBoardDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          inboxes={inboxes}
          onCreated={loadData}
        />
      )}
    </div>
  );
};

export default KanbanCRM;
