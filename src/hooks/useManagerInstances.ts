// M19 S4: Hook compartilhado para instâncias do gestor
// Extraído de ManagerDashboard para reutilização em fichas de detalhe
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useManagerInstances() {
  return useQuery({
    queryKey: ['manager-instances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instances')
        .select('id, name, status')
        .eq('disabled', false)
        .order('name');
      return (data || []) as { id: string; name: string; status: string }[];
    },
    staleTime: 300_000,
  });
}
