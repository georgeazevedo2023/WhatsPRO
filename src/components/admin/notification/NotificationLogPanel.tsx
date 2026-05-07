/**
 * NotificationLogPanel — tabela de auditoria de notificações enviadas.
 *
 * Renderiza lista paginada de `notification_log` com filtros básicos.
 * Pensada pra debug ("por que Lucas não recebeu nada hoje?") e auditoria.
 *
 * RLS já filtra: super_admin vê tudo, gerente vê do mesmo dept.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotifLogRow {
  id: string;
  conversation_id: string;
  assigned_to_id: string;
  status: 'sent' | 'error' | 'skipped';
  skip_reason: string | null;
  error_message: string | null;
  message_text: string | null;
  sent_at: string;
  vendor_name?: string;
  vendor_email?: string;
}

const STATUS_CONFIG = {
  sent: { label: 'Enviado', Icon: CheckCircle2, color: 'text-emerald-600' },
  error: { label: 'Erro', Icon: XCircle, color: 'text-red-600' },
  skipped: { label: 'Pulado', Icon: AlertCircle, color: 'text-muted-foreground' },
} as const;

const SKIP_REASON_LABELS: Record<string, string> = {
  skip_disabled: 'Notif desativada na instância',
  skip_optout: 'Vendedor optou-out',
  skip_no_number: 'Sem número cadastrado',
  skip_session_expired: 'Janela WhatsApp expirou',
  skip_paused: 'Pausado pelo admin/gestor',
  skip_off_hours: 'Fora do horário comercial',
  skip_queue_paused: 'Vendedor pausou a fila',
  skip_rate_limited: 'Mais de 3 notif/hora',
  skip_no_handshake: 'Vendedor nunca fez handshake',
  skip_no_instance_token: 'Instância sem token',
};

export function NotificationLogPanel() {
  const [rows, setRows] = useState<NotifLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'error' | 'skipped'>('all');
  const [search, setSearch] = useState('');

  const [stats, setStats] = useState<{ sent_30d: number; estimated_cost_brl: string } | null>(null);
  const [kpiResponse, setKpiResponse] = useState<{ avg_minutes: number; sample_size: number; p50_minutes: number; p90_minutes: number } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('notification_log')
        .select('id, conversation_id, assigned_to_id, status, skip_reason, error_message, message_text, sent_at')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;
      const logs = (data || []) as NotifLogRow[];

      // Stats: count sent nos últimos 30d + custo estimado (Gap E).
      // Custo conservador R$ 0.08 por msg (UAZAPI plano padrão).
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: sent30d } = await supabase
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', thirtyDaysAgo);
      setStats({
        sent_30d: sent30d ?? 0,
        estimated_cost_brl: ((sent30d ?? 0) * 0.08).toFixed(2),
      });

      // KPI primeira resposta (Gap F).
      try {
        const { data: kpiData } = await supabase.rpc('kpi_avg_first_response_minutes', { _days: 30 });
        if (kpiData) setKpiResponse(kpiData as typeof kpiResponse);
      } catch { /* non-blocking */ }

      // Bulk-fetch de vendedor names
      const vendorIds = Array.from(new Set(logs.map(l => l.assigned_to_id)));
      if (vendorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', vendorIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        for (const log of logs) {
          const p = profileMap.get(log.assigned_to_id);
          log.vendor_name = (p?.full_name as string) || undefined;
          log.vendor_email = (p?.email as string) || undefined;
        }
      }

      setRows(logs);
    } catch (e) {
      handleError(e, 'Erro ao carregar log de notificações');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.vendor_name?.toLowerCase().includes(q) ||
      r.vendor_email?.toLowerCase().includes(q) ||
      r.skip_reason?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      {/* Stats cards (Gap E + F) */}
      {(stats || kpiResponse) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats && (
            <>
              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Notif enviadas (30d)</p>
                <p className="text-2xl font-bold mt-1">{stats.sent_30d}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Custo estimado UAZAPI</p>
                <p className="text-2xl font-bold mt-1">R$ {stats.estimated_cost_brl}</p>
                <p className="text-[10px] text-muted-foreground/70">~R$ 0,08/msg</p>
              </div>
            </>
          )}
          {kpiResponse && kpiResponse.sample_size > 0 && (
            <div className="rounded-lg border border-border/40 bg-card/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Tempo médio 1ª resposta</p>
              <p className="text-2xl font-bold mt-1">{kpiResponse.avg_minutes.toFixed(1)} min</p>
              <p className="text-[10px] text-muted-foreground/70">
                p50: {kpiResponse.p50_minutes.toFixed(0)}min · p90: {kpiResponse.p90_minutes.toFixed(0)}min · n={kpiResponse.sample_size}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por vendedor ou motivo..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar notificações"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="skipped">Pulado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLogs} aria-label="Recarregar">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Recarregar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredRows.length} {filteredRows.length === 1 ? 'evento' : 'eventos'}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          Nenhuma notificação registrada ainda.
        </div>
      ) : (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground/80">
              <tr>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Vendedor</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredRows.map(r => {
                const cfg = STATUS_CONFIG[r.status];
                const Icon = cfg.Icon;
                const detail = r.status === 'skipped'
                  ? (SKIP_REASON_LABELS[r.skip_reason || ''] || r.skip_reason || '—')
                  : r.status === 'error'
                  ? (r.error_message || '—')
                  : (r.message_text?.split('\n')[0] || '—');
                return (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.sent_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <p className="font-medium truncate max-w-[200px]">{r.vendor_name || '—'}</p>
                      {r.vendor_email && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{r.vendor_email}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cfg.color)}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[400px] truncate" title={detail}>
                      {detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
