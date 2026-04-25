// M19 S8 Camada 3: Admin UI para retention policies
// Lista, toggle, dry-run, log
import { useEffect, useState, useCallback } from 'react';
import { Database, Play, AlertTriangle, ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RetentionPolicy {
  id: number;
  table_name: string;
  days_to_keep: number;
  condition_sql: string | null;
  enabled: boolean;
  dry_run: boolean;
  backup_before_delete: boolean;
  description: string | null;
  last_run_at: string | null;
  last_deleted_count: number | null;
}

interface CleanupLog {
  id: number;
  policy_id: number | null;
  table_name: string;
  ran_at: string;
  was_dry_run: boolean;
  candidate_count: number | null;
  deleted_count: number | null;
  error_message: string | null;
}

const AdminRetention = () => {
  const { isSuperAdmin } = useAuth();
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [logs, setLogs] = useState<CleanupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, lRes] = await Promise.all([
      supabase.from('db_retention_policies').select('*').order('id'),
      supabase.from('db_cleanup_log').select('*').order('ran_at', { ascending: false }).limit(20),
    ]);
    if (pRes.error) handleError(pRes.error, 'Erro ao carregar policies');
    else setPolicies((pRes.data || []) as RetentionPolicy[]);
    if (lRes.error) handleError(lRes.error, 'Erro ao carregar log');
    else setLogs((lRes.data || []) as CleanupLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const togglePolicy = async (id: number, field: 'enabled' | 'dry_run', value: boolean) => {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;

    // Bloqueio: não pode habilitar policy que requer backup
    if (field === 'enabled' && value && policy.backup_before_delete) {
      toast.error('Backup JSONL ainda não shipado (S8.1). Mantenha apenas em dry-run.');
      return;
    }

    setPolicies(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    const { error } = await supabase
      .from('db_retention_policies')
      .update({ [field]: value })
      .eq('id', id);
    if (error) {
      handleError(error, 'Erro ao atualizar policy');
      fetchAll();
    } else {
      toast.success(`${field === 'enabled' ? 'Habilitação' : 'Dry-run'} atualizado`);
    }
  };

  const updateDays = async (id: number, days: number) => {
    if (days <= 0) return;
    const { error } = await supabase
      .from('db_retention_policies')
      .update({ days_to_keep: days })
      .eq('id', id);
    if (error) handleError(error, 'Erro ao atualizar dias');
    else fetchAll();
  };

  const runNow = async (id: number) => {
    setRunning(id);
    const { data, error } = await supabase.rpc('apply_retention_policy' as never, { _policy_id: id } as never);
    setRunning(null);
    if (error) {
      handleError(error, 'Erro ao executar policy');
      return;
    }
    const result = data as { error?: string; message?: string; dry_run?: boolean; candidate_count?: number; deleted_count?: number };
    if (result.error) {
      toast.error(result.message || result.error);
    } else if (result.dry_run) {
      toast.success(`Dry-run: ${result.candidate_count} registro(s) seriam deletado(s)`);
    } else {
      toast.success(`${result.deleted_count} registro(s) deletado(s)`);
    }
    fetchAll();
  };

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">Retenção de Dados</h1>
          <p className="text-xs text-muted-foreground">
            Políticas configuráveis de limpeza automática. Cron weekly (dom 04:13 UTC).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Aviso sobre backup */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-semibold text-amber-500 mb-1">Backup JSONL deferido para S8.1</p>
          <p className="text-muted-foreground">
            A policy <code className="bg-muted/50 px-1 rounded">conversation_messages</code> requer backup
            antes de DELETE. Enquanto S8.1 não shipar, ela só funciona em modo <strong>dry-run</strong>.
            As outras 5 podem ser habilitadas normalmente.
          </p>
        </div>
      </div>

      {/* Lista de policies */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Políticas</h2>
        {loading && policies.length === 0 ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {policies.map(p => {
              const isLocked = p.backup_before_delete;
              return (
                <div key={p.id} className={cn(
                  'rounded-xl border bg-card/40 p-4 space-y-3',
                  isLocked && 'border-amber-500/20 bg-amber-500/5'
                )}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isLocked ? <Lock className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                      <code className="font-mono font-semibold text-sm">{p.table_name}</code>
                      {p.enabled && <Badge variant="default" className="h-5 text-[10px]">ativa</Badge>}
                      {p.dry_run && <Badge variant="outline" className="h-5 text-[10px]">dry-run</Badge>}
                      {p.backup_before_delete && (
                        <Badge variant="outline" className="h-5 text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-500">
                          backup obrigatório
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runNow(p.id)}
                      disabled={running === p.id}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Play className="w-3 h-3" />
                      {running === p.id ? 'Executando...' : 'Executar agora'}
                    </Button>
                  </div>

                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}

                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={p.enabled}
                        onCheckedChange={(v) => togglePolicy(p.id, 'enabled', v)}
                        disabled={isLocked}
                      />
                      <span>Habilitada</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={p.dry_run}
                        onCheckedChange={(v) => togglePolicy(p.id, 'dry_run', v)}
                      />
                      <span>Dry-run (sem deletar)</span>
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Manter</span>
                      <Input
                        type="number"
                        min={1}
                        defaultValue={p.days_to_keep}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (v && v !== p.days_to_keep) updateDays(p.id, v);
                        }}
                        className="w-20 h-7 text-xs"
                      />
                      <span className="text-muted-foreground">dias</span>
                    </div>
                    {p.last_run_at && (
                      <span className="text-[11px] text-muted-foreground">
                        última: {new Date(p.last_run_at).toLocaleString('pt-BR')}
                        {p.last_deleted_count != null && p.last_deleted_count > 0 && ` (${p.last_deleted_count} deletados)`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Log */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico (últimas {logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma execução ainda</p>
        ) : (
          <div className="rounded-xl border bg-card/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="p-2 font-semibold">Quando</th>
                  <th className="p-2 font-semibold">Tabela</th>
                  <th className="p-2 font-semibold">Modo</th>
                  <th className="p-2 font-semibold text-right">Candidatos</th>
                  <th className="p-2 font-semibold text-right">Deletados</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-t border-border/30">
                    <td className="p-2 text-muted-foreground">{new Date(l.ran_at).toLocaleString('pt-BR')}</td>
                    <td className="p-2 font-mono">{l.table_name}</td>
                    <td className="p-2">
                      {l.error_message ? (
                        <span className="text-rose-500">erro</span>
                      ) : l.was_dry_run ? (
                        <span className="text-amber-500">dry-run</span>
                      ) : (
                        <span className="text-emerald-500">real</span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">{l.candidate_count ?? '—'}</td>
                    <td className="p-2 text-right tabular-nums">{l.deleted_count ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminRetention;
