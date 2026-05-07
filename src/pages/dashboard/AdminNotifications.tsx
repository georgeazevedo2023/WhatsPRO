import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { NotificationLogPanel } from '@/components/admin/notification/NotificationLogPanel';

const AdminNotifications = () => {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Notificações de Handoff</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de alertas WhatsApp enviados aos vendedores quando recebem leads atribuídos.
          </p>
        </div>
      </div>
      <NotificationLogPanel />
    </div>
  );
};

export default AdminNotifications;
