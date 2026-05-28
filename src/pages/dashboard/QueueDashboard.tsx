/**
 * Dashboard de Fila — visão do Gestor (v7.57.x, 2026-05-28).
 *
 * Mobile-first. Cobre o pedido do dono:
 *   - Fila ativa agora: na fila / disponíveis / pausados / tempo médio espera
 *   - Por atendente no período (Hoje/Ontem/7d/15d/30d): Recebidos / Atendidos /
 *     Deixou de atender (breakdown: timeout vs outro pegou)
 *   - Status individual: Disponível / Pausado
 *   - Drill-down: lista de leads perdidos com link pro Helpdesk
 *
 * Dados: 3 RPCs (get_queue_live_status, get_queue_attendant_stats,
 * get_queue_lost_leads). Realtime no header (broadcast queue-update); polling 30s
 * nas stats do período.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstances } from '@/hooks/useInstances';
import {
  useQueueLive,
  useQueueStats,
  useQueueLostLeads,
  resolveQueuePeriod,
  formatDuration,
  type QueuePeriod,
  type AttendantStat,
} from '@/hooks/useQueueDashboard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Users, Pause, Timer, AlertCircle, CheckCircle2, UserX, ArrowRight, Clock, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIODS: { value: QueuePeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7', label: '7 dias' },
  { value: 'last15', label: '15 dias' },
  { value: 'last30', label: '30 dias' },
];

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function StatusBadge({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <Badge variant="outline" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
        <Pause className="mr-1 h-3 w-3" />Pausado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
      <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />Disponível
    </Badge>
  );
}

function LiveHeader({ instanceId }: { instanceId: string | null }) {
  const { data, isLoading } = useQueueLive(instanceId);
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="flex flex-col items-center justify-center p-3 sm:p-4">
        <Users className="mb-1 h-5 w-5 text-orange-500" />
        <div className="text-2xl font-bold tabular-nums sm:text-3xl">{data.active_count}</div>
        <div className="text-center text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Na fila agora</div>
        {data.avg_wait_seconds > 0 && (
          <div className="mt-1 text-[10px] text-muted-foreground">~{formatDuration(data.avg_wait_seconds)}</div>
        )}
      </Card>
      <Card className="flex flex-col items-center justify-center p-3 sm:p-4">
        <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-500" />
        <div className="text-2xl font-bold tabular-nums sm:text-3xl">{data.available_count}</div>
        <div className="text-center text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Disponíveis</div>
      </Card>
      <Card className="flex flex-col items-center justify-center p-3 sm:p-4">
        <Pause className="mb-1 h-5 w-5 text-amber-500" />
        <div className="text-2xl font-bold tabular-nums sm:text-3xl">{data.paused_count}</div>
        <div className="text-center text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Pausados</div>
      </Card>
    </div>
  );
}

function AttendantCard({
  stat,
  onOpenLost,
}: {
  stat: AttendantStat;
  onOpenLost: (userId: string, name: string) => void;
}) {
  const lost = stat.timed_out + stat.manual_override + stat.cancelled;
  const hasLost = lost > 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <Avatar className="h-11 w-11 shrink-0">
          {stat.avatar_url ? <AvatarImage src={stat.avatar_url} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary">{initials(stat.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{stat.full_name}</h3>
            <StatusBadge paused={stat.queue_paused} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <div className="text-xl font-bold tabular-nums">{stat.received}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Recebidos</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-center dark:bg-emerald-950/30">
              <div className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{stat.responded}</div>
              <div className="text-[10px] uppercase text-emerald-700/80 dark:text-emerald-300/80">Atendidos</div>
            </div>
            <div className="rounded-lg bg-red-50 p-2 text-center dark:bg-red-950/30">
              <div className="text-xl font-bold tabular-nums text-red-700 dark:text-red-300">{lost}</div>
              <div className="text-[10px] uppercase text-red-700/80 dark:text-red-300/80">Perdidos</div>
            </div>
          </div>
          {hasLost && (
            <button
              type="button"
              onClick={() => onOpenLost(stat.user_id, stat.full_name)}
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-left text-xs transition hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-950/40"
            >
              <div className="flex flex-col gap-0.5">
                {stat.timed_out > 0 && (
                  <span className="flex items-center gap-1.5 text-red-800 dark:text-red-300">
                    <Timer className="h-3.5 w-3.5" />
                    <strong className="tabular-nums">{stat.timed_out}</strong> perdidos por tempo esgotado
                  </span>
                )}
                {stat.manual_override > 0 && (
                  <span className="flex items-center gap-1.5 text-red-800 dark:text-red-300">
                    <UserX className="h-3.5 w-3.5" />
                    <strong className="tabular-nums">{stat.manual_override}</strong> outro atendente assumiu
                  </span>
                )}
                {stat.cancelled > 0 && (
                  <span className="flex items-center gap-1.5 text-red-800 dark:text-red-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <strong className="tabular-nums">{stat.cancelled}</strong> cancelados
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-red-500" />
            </button>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {stat.responded > 0 && stat.avg_response_seconds > 0 && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />1ª resposta ~{formatDuration(stat.avg_response_seconds)}</span>
            )}
            {stat.active > 0 && (
              <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-orange-500" />{stat.active} esperando agora</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function LostLeadsDrawer({
  instanceId,
  userId,
  userName,
  period,
  open,
  onClose,
}: {
  instanceId: string | null;
  userId: string | null;
  userName: string;
  period: QueuePeriod;
  open: boolean;
  onClose: () => void;
}) {
  const { data: leads = [], isLoading } = useQueueLostLeads(instanceId, userId, period, open);
  const range = resolveQueuePeriod(period);
  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Leads perdidos — {userName}</DrawerTitle>
          <DrawerDescription>
            {range.label} · {format(range.from, "dd 'de' MMM HH:mm", { locale: ptBR })} → {format(range.to, "HH:mm", { locale: ptBR })}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          )}
          {!isLoading && leads.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem leads perdidos no período.</p>
          )}
          {!isLoading && leads.length > 0 && (
            <ul className="space-y-2">
              {leads.map((lead) => (
                <li key={`${lead.conversation_id}-${lead.created_at}`}>
                  <Link
                    to={`/dashboard/helpdesk?conv=${lead.conversation_id}`}
                    onClick={onClose}
                    className="block rounded-lg border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="truncate text-sm">{lead.contact_name}</strong>
                          {lead.contact_phone && (
                            <span className="text-xs text-muted-foreground">{lead.contact_phone}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {lead.status === 'timed_out' && <Timer className="h-3 w-3 text-red-500" />}
                          {lead.status === 'manual_override' && <UserX className="h-3 w-3 text-red-500" />}
                          {lead.status === 'cancelled' && <AlertCircle className="h-3 w-3 text-red-500" />}
                          <span>{lead.lost_reason}</span>
                          {lead.next_assignee_name && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              <ArrowRight className="mr-1 inline h-3 w-3" />
                              {lead.next_assignee_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.created_at), { locale: ptBR, addSuffix: true })}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function QueueDashboard() {
  const { instances, loading: instancesLoading } = useInstances();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [period, setPeriod] = useState<QueuePeriod>('today');
  const [drillUserId, setDrillUserId] = useState<string | null>(null);
  const [drillName, setDrillName] = useState<string>('');

  useEffect(() => {
    if (!instanceId && instances && instances.length > 0) {
      setInstanceId(instances[0].id);
    }
  }, [instances, instanceId]);

  const { data: stats = [], isLoading: statsLoading } = useQueueStats(instanceId, period);
  const range = resolveQueuePeriod(period);

  const totalReceived = stats.reduce((s, a) => s + a.received, 0);
  const totalResponded = stats.reduce((s, a) => s + a.responded, 0);
  const totalLost = stats.reduce((s, a) => s + a.timed_out + a.manual_override + a.cancelled, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-3 sm:p-6">
      {/* Header título + instância */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">Fila de Atendimento</h1>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {format(range.from, "dd/MM HH:mm", { locale: ptBR })} → {format(range.to, "HH:mm", { locale: ptBR })}
          </span>
        </div>
        {!instancesLoading && instances && instances.length > 1 && (
          <Select value={instanceId ?? ''} onValueChange={setInstanceId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
            <SelectContent>
              {instances.map((i) => (<SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Period chips — sticky no mobile */}
      <div className="sticky top-0 z-10 -mx-3 bg-background/90 px-3 py-2 backdrop-blur sm:relative sm:mx-0 sm:p-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2 sm:pb-0">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                period === p.value
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header live (3 cards grandes) */}
      <LiveHeader instanceId={instanceId} />

      {/* Resumo do período */}
      {!statsLoading && stats.length > 0 && (
        <Card className="p-3 sm:p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">No período</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold tabular-nums sm:text-xl">{totalReceived}</div>
              <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Recebidos</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums text-emerald-600 sm:text-xl">{totalResponded}</div>
              <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Atendidos</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums text-red-600 sm:text-xl">{totalLost}</div>
              <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Perdidos</div>
            </div>
          </div>
          {totalReceived > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="flex h-full"
                style={{ width: '100%' }}
              >
                <div className="h-full bg-emerald-500" style={{ width: `${(totalResponded / totalReceived) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(totalLost / totalReceived) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Lista de atendentes */}
      <div className="space-y-3">
        {statsLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        {!statsLoading && stats.length === 0 && (
          <Card className="p-8 text-center">
            <Users className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Sem atendentes cadastrados no departamento de fila desta instância.
            </p>
          </Card>
        )}
        {!statsLoading && stats.length > 0 && stats.map((stat) => (
          <AttendantCard
            key={stat.user_id}
            stat={stat}
            onOpenLost={(uid, name) => { setDrillUserId(uid); setDrillName(name); }}
          />
        ))}
      </div>

      <LostLeadsDrawer
        instanceId={instanceId}
        userId={drillUserId}
        userName={drillName}
        period={period}
        open={!!drillUserId}
        onClose={() => setDrillUserId(null)}
      />
    </div>
  );
}
