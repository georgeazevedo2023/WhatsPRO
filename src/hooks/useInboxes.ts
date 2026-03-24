import { supabase } from '@/integrations/supabase/client';
import type { Inbox } from '@/types';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface UseInboxesOptions {
  enabled?: boolean;
}

export function useInboxes(options: UseInboxesOptions = {}) {
  const { enabled = true } = options;

  const { data: inboxes, loading, error, refetch } = useSupabaseQuery<Inbox>({
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('inboxes')
        .select('id, name, instance_id')
        .order('name');
      if (err) throw err;
      return data || [];
    },
    enabled,
    initialLoading: true,
    errorLabel: 'useInboxes',
  });

  return { inboxes, loading, error, refetch };
}
