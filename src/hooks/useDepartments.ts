import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface DepartmentData {
  id: string;
  name: string;
  inbox_id: string;
}

interface UseDepartmentsOptions {
  /** Skip fetch when false. Default: true */
  enabled?: boolean;
  /** Filter by a single inbox ID */
  inboxId?: string;
  /** Filter by multiple inbox IDs (for grouped dropdown) */
  inboxIds?: string[];
}

export function useDepartments(options: UseDepartmentsOptions = {}) {
  const { enabled = true, inboxId, inboxIds } = options;

  // Stabilize inboxIds for dependency comparison
  const inboxIdsKey = inboxIds ? JSON.stringify([...inboxIds].sort()) : null;

  // Determine filter IDs
  const ids = inboxId ? [inboxId] : inboxIds;

  const { data: departments, loading, error, refetch } = useSupabaseQuery<DepartmentData>({
    queryFn: async () => {
      let query = supabase
        .from('departments')
        .select('id, name, inbox_id')
        .order('name');

      if (ids!.length === 1) {
        query = query.eq('inbox_id', ids![0]);
      } else {
        query = query.in('inbox_id', ids!);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      return (data as DepartmentData[]) || [];
    },
    enabled,
    initialLoading: false,
    errorLabel: 'useDepartments',
    deps: [inboxId, inboxIdsKey],
    shouldSkip: () => !ids || ids.length === 0,
  });

  /** Departments grouped by inbox_id */
  const departmentsByInbox = useMemo(() => {
    const map: Record<string, DepartmentData[]> = {};
    departments.forEach(d => {
      if (!map[d.inbox_id]) map[d.inbox_id] = [];
      map[d.inbox_id].push(d);
    });
    return map;
  }, [departments]);

  return { departments, departmentsByInbox, loading, error, refetch };
}
