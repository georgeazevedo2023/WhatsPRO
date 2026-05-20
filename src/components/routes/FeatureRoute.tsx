import { Navigate } from 'react-router-dom';
import { useFeaturePermission, type FeatureKey } from '@/hooks/useFeaturePermission';

interface FeatureRouteProps {
  feature: FeatureKey;
  fallbackPath?: string;
  children: React.ReactNode;
}

/**
 * Guard de rota baseado em permissão por feature.
 *
 * Uso:
 *   <FeatureRoute feature="manage_catalog">
 *     <AIAgentCatalog />
 *   </FeatureRoute>
 *
 * super_admin sempre passa. gerente passa por padrão. user (atendente) precisa
 * de row em user_feature_permissions com can_edit=true.
 */
export function FeatureRoute({
  feature,
  fallbackPath = '/dashboard/helpdesk',
  children,
}: FeatureRouteProps) {
  const { canEdit, loading } = useFeaturePermission(feature);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canEdit) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
