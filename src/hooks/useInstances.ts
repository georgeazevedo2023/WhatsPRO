import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Instance } from '@/types';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface UseInstancesOptions {
  enabled?: boolean;
  excludeDisabled?: boolean;
}

export function useInstances(options: UseInstancesOptions = {}) {
  const { enabled = true, excludeDisabled = true } = options;

  const { data: instances, loading, error, refetch: fetchInstances } = useSupabaseQuery<Instance>({
    queryFn: async () => {
      let query = supabase
        .from('instances')
        .select('id, name, status, profile_pic_url, disabled, user_id, owner_jid, created_at, updated_at')
        .order('name');
      if (excludeDisabled) {
        query = query.eq('disabled', false);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      return data || [];
    },
    enabled,
    initialLoading: true,
    errorLabel: 'useInstances',
    deps: [excludeDisabled],
  });

  useEffect(() => {
    const handler = () => { fetchInstances(); };
    window.addEventListener('instances-updated', handler);
    return () => window.removeEventListener('instances-updated', handler);
  }, [fetchInstances]);

  return { instances, loading, error, refetch: fetchInstances };
}
