// M19 S4: Hook compartilhado para instâncias do gestor
// Extraído de ManagerDashboard para reutilização em fichas de detalhe
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseManagerInstancesOptions {
  includeSandbox?: boolean;
}

export function useManagerInstances({ includeSandbox = false }: UseManagerInstancesOptions = {}) {
  return useQuery({
    queryKey: ['manager-instances', includeSandbox],
    queryFn: async () => {
      let query = supabase
        .from('instances')
        .select('id, name, status, is_sandbox')
        .eq('disabled', false)
        .order('name');

      if (!includeSandbox) {
        query = query.eq('is_sandbox', false);
      }

      const { data } = await query;
      return (data || []) as { id: string; name: string; status: string; is_sandbox: boolean }[];
    },
    staleTime: 300_000,
  });
}
