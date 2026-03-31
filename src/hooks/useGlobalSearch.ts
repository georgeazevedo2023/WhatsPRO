import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { GlobalSearchResult } from '@/types';

const MIN_QUERY_LENGTH = 3;

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .rpc('global_search_conversations', { _query: debouncedQuery, _limit: 20 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[globalSearch] RPC error:', error);
          setResults([]);
        } else {
          setResults((data || []) as GlobalSearchResult[]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[globalSearch] fetch error:', err);
        setResults([]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const isSearching = query.length >= MIN_QUERY_LENGTH;

  return { query, setQuery, results, loading, isSearching };
}
