import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeaturePermission, type FeatureKey } from '@/hooks/useFeaturePermission';

interface AnyFeatureRouteProps {
  features: FeatureKey[];
  fallbackPath?: string;
  children: React.ReactNode;
}

/**
 * Aceita o usuário se ele tem can_edit em PELO MENOS UMA das features listadas.
 * super_admin e gerente passam automaticamente (fallback no hook).
 *
 * Uso típico: rota raiz `/dashboard/ai-agent` que tem várias tabs internas
 * — qualquer um com 1+ feature AI Agent pode entrar.
 */
export function AnyFeatureRoute({
  features,
  fallbackPath = '/dashboard/helpdesk',
  children,
}: AnyFeatureRouteProps) {
  const { isSuperAdmin, isGerente, loading: authLoading } = useAuth();

  // Hooks na ordem fixa (regra dos hooks). Precisamos chamar pra TODOS os features.
  const perms = features.map(f => useFeaturePermission(f));
  const anyLoading = perms.some(p => p.loading);
  const anyEdit = perms.some(p => p.canEdit);

  if (authLoading || (anyLoading && !isSuperAdmin && !isGerente)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin && !isGerente && !anyEdit) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
