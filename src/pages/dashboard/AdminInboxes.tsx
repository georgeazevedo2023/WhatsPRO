import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Inbox, Plus } from 'lucide-react';
import InboxesTab from '@/components/admin/InboxesTab';

const AdminInboxes = () => {
  const { isSuperAdmin } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Caixas de Entrada</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas caixas de entrada e vincule instancias</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setOpenCreate(true)}>
          <Plus className="w-4 h-4" />
          Nova Caixa
        </Button>
      </div>
      <InboxesTab openCreate={openCreate} onOpenCreateChange={setOpenCreate} />
    </div>
  );
};

export default AdminInboxes;
