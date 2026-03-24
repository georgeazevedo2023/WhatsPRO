import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminPanel = () => {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  // Redirect to the first admin sub-page
  return <Navigate to="/dashboard/admin/inboxes" replace />;
};

export default AdminPanel;
