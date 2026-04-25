// M19 S8 Camada 1: hook para sumário do tamanho do banco
// Chama RPC get_db_size_summary, refetch a cada 5min
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DbSizeStatus = 'green' | 'yellow' | 'red' | 'critical';

export interface DbSizeTopTable {
  name: string;
  bytes: number;
  pretty: string;
}

export interface DbSizeSummary {
  total_bytes: number;
  total_pretty: string;
  threshold_mb: number;
  threshold_bytes: number;
  percent_used: number;
  status: DbSizeStatus;
  top_tables: DbSizeTopTable[];
  measured_at: string;
}

const REFETCH_MS = 5 * 60 * 1000;

export function useDbSize(thresholdMb: number = 300) {
  const [data, setData] = useState<DbSizeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setError(null);
    const { data: rpc, error: rpcError } = await supabase.rpc('get_db_size_summary' as never, { threshold_mb: thresholdMb } as never);
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    setData(rpc as unknown as DbSizeSummary);
    setLoading(false);
  }, [thresholdMb]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, REFETCH_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
