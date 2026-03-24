import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import SecretsTab from '@/components/admin/SecretsTab';

const AdminSecrets = () => {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Secrets</h1>
          <p className="text-sm text-muted-foreground">Chaves de API e configuracoes sensiveis</p>
        </div>
      </div>
      <SecretsTab />
    </div>
  );
};

export default AdminSecrets;
