import { useState, useEffect, useCallback } from 'react';

export interface UseSupabaseQueryOptions<T> {
  /** Async function that returns the data array */
  queryFn: () => Promise<T[]>;
  /** Whether the query is enabled. Default: true */
  enabled?: boolean;
  /** Initial value for the loading state. Default: true */
  initialLoading?: boolean;
  /** Label used in console.error messages */
  errorLabel?: string;
  /** Dependencies that trigger a refetch (beyond `enabled`) */
  deps?: unknown[];
  /**
   * Called when enabled is true but the query should short-circuit
   * (e.g. empty filter arrays). Return true to skip the fetch and
   * reset data to [].
   */
  shouldSkip?: () => boolean;
}

export interface UseSupabaseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * @deprecated Use React Query (useQuery/useMutation from @tanstack/react-query) instead.
 * Remaining usages in Intelligence.tsx, ScheduledMessages.tsx, Settings.tsx
 * will be migrated in a future phase.
 * @see src/components/admin/SecretsTab.tsx — reference migration pattern
 */
export function useSupabaseQuery<T>(
  options: UseSupabaseQueryOptions<T>,
): UseSupabaseQueryResult<T> {
  const {
    queryFn,
    enabled = true,
    initialLoading = true,
    errorLabel = 'useSupabaseQuery',
    deps = [],
    shouldSkip,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    if (shouldSkip?.()) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      console.error(`[${errorLabel}] error:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
