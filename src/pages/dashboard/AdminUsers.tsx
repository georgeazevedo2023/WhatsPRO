import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import UsersTab from '@/components/admin/UsersTab';

const AdminUsers = () => {
  const { isSuperAdmin } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Equipe</h1>
            <p className="text-sm text-muted-foreground">Gerencie membros da equipe e permissoes</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setOpenCreate(true)}>
          <UserPlus className="w-4 h-4" />
          Novo Membro
        </Button>
      </div>
      <UsersTab openCreate={openCreate} onOpenCreateChange={setOpenCreate} />
    </div>
  );
};

export default AdminUsers;
