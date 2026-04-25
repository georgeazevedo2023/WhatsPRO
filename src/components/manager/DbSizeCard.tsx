// M19 S8 Camada 1: card de status do tamanho do banco
// Visível apenas para super_admin via condicional no caller
import { memo } from 'react';
import { Database, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDbSize, type DbSizeStatus } from '@/hooks/useDbSize';

const STATUS_STYLES: Record<DbSizeStatus, { bar: string; badge: string; label: string; ring: string }> = {
  green: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    label: 'Saudável',
    ring: 'ring-emerald-500/20',
  },
  yellow: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    label: 'Atenção',
    ring: 'ring-amber-500/30',
  },
  red: {
    bar: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    label: 'Crítico',
    ring: 'ring-rose-500/30',
  },
  critical: {
    bar: 'bg-red-600',
    badge: 'bg-red-600/15 text-red-500 border-red-600/30',
    label: 'URGENTE',
    ring: 'ring-red-600/40',
  },
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min === 1) return 'há 1 min';
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return 'há 1 hora';
  return `há ${hr} horas`;
}

const DbSizeCard = () => {
  const { data, loading, error, refetch } = useDbSize(300);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive text-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Erro ao carregar tamanho do banco</span>
        </div>
        {error && <p className="text-xs text-muted-foreground mt-1">{error}</p>}
      </div>
    );
  }

  const style = STATUS_STYLES[data.status];
  const percentClamped = Math.min(100, data.percent_used);

  return (
    <div className={cn(
      'rounded-xl border bg-card/40 p-4 space-y-3 transition-all',
      'border-border/50',
      data.status !== 'green' && 'ring-1',
      style.ring,
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tamanho do Banco
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={refetch}
          aria-label="Atualizar"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <span className="text-2xl font-display font-bold">{data.total_pretty}</span>
          <span className="text-xs text-muted-foreground ml-1.5">/ {data.threshold_mb} MB</span>
        </div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', style.badge)}>
          {style.label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', style.bar)}
            style={{ width: `${percentClamped}%` }}
            role="progressbar"
            aria-valuenow={percentClamped}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{data.percent_used}% usado</span>
          <span>{formatRelative(data.measured_at)}</span>
        </div>
      </div>

      {data.top_tables.length > 0 && (
        <details className="group">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground select-none list-none flex items-center justify-between">
            <span>Top {Math.min(5, data.top_tables.length)} tabelas</span>
            <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <ul className="mt-2 space-y-1">
            {data.top_tables.slice(0, 5).map(t => (
              <li key={t.name} className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-muted-foreground truncate pr-2">
                  {t.name.replace(/^public\./, '')}
                </span>
                <span className="font-medium tabular-nums shrink-0">{t.pretty}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default memo(DbSizeCard);
