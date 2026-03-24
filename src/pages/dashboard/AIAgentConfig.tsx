import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import AIAgentTab from '@/components/admin/AIAgentTab';

const AIAgentConfig = () => {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <AIAgentTab />
    </div>
  );
};

export default AIAgentConfig;
