import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FeatureKey =
  | 'manage_catalog'
  | 'manage_faq'
  | 'manage_qualification'
  | 'manage_excluded_products'
  | 'manage_blocked_numbers';

export const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  manage_catalog: {
    label: 'Catálogo (produtos com foto)',
    description: 'Cadastrar, editar e remover produtos do catálogo da IA',
  },
  manage_faq: {
    label: 'Base de Conhecimento (FAQ)',
    description: 'Gerenciar FAQ, documentos e mídias do agente',
  },
  manage_qualification: {
    label: 'Categorias de atendimento',
    description: 'Editar as categorias e etapas de qualificação do lead',
  },
  manage_excluded_products: {
    label: 'Produtos que NÃO vendemos',
    description: 'Cadastrar palavras-chave de produtos fora do escopo',
  },
  manage_blocked_numbers: {
    label: 'Números bloqueados',
    description: 'Lista de números que a IA não responde (equipe, spam, etc.)',
  },
};

export const FEATURE_KEYS: FeatureKey[] = Object.keys(FEATURE_LABELS) as FeatureKey[];

interface UseFeaturePermissionResult {
  canEdit: boolean;
  loading: boolean;
}

/**
 * Hook para checar se o usuário atual pode editar uma feature específica.
 *
 * Fallback por role (calculado no DB pela função `has_feature_permission`):
 *   - super_admin: sempre true
 *   - gerente: true por padrão (pode ser revogado via row can_edit=false)
 *   - user: false por padrão (precisa de row explícita can_edit=true)
 */
export function useFeaturePermission(feature: FeatureKey): UseFeaturePermissionResult {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setCanEdit(false);
      setLoading(false);
      return;
    }
    if (isSuperAdmin) {
      setCanEdit(true);
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc('has_feature_permission', {
        p_user_id: user.id,
        p_feature_key: feature,
      });
      if (cancelled) return;
      if (error) {
        console.error('useFeaturePermission rpc error', error);
        setCanEdit(false);
      } else {
        setCanEdit(Boolean(data));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isSuperAdmin, authLoading, feature]);

  return { canEdit, loading };
}
