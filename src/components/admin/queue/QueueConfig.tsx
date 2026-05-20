/**
 * D30 Sprint D — Configuração da Fila Inteligente por departamento.
 *
 * Aberto a partir do botão "Fila" no card do departamento (DepartmentsTab).
 * Persiste em `departments` (queue_mode_*, default_assignee_id) e
 * `department_members` (queue_position drag-drop, queue_paused, gestor_in_queue).
 *
 * Sem mistério: sempre carrega state fresh do banco ao abrir, salva tudo numa
 * transação lógica (UPDATE departments + bulk UPDATE department_members) +
 * audit log via RPC `log_admin_action`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pause, Loader2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Member {
  user_id: string;
  full_name: string;
  queue_position: number | null;
  queue_paused: boolean;
  gestor_in_queue: boolean;
  /** Se este membro tem role gerente (decide se mostramos o toggle gestor_in_queue). */
  is_gerente: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string | null;
  departmentName: string;
  onSaved?: () => void;
}

const TIMEOUT_MIN = 1;
const TIMEOUT_MAX = 15;
const TIMEOUT_DEFAULT = 5;

function SortableMemberRow({ member, onTogglePaused, onToggleGestorInQueue }: {
  member: Member;
  onTogglePaused: () => void;
  onToggleGestorInQueue: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.user_id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${member.full_name}`}
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <UserCircle2 className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{member.full_name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {member.queue_paused && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Pause className="w-3 h-3" /> Pausado
            </Badge>
          )}
          {!member.queue_paused && <span className="text-xs text-muted-foreground">Disponível</span>}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={member.queue_paused ? 'outline' : 'ghost'}
        onClick={onTogglePaused}
        className="h-8"
      >
        {member.queue_paused ? 'Despausar' : 'Pausar'}
      </Button>
      {member.is_gerente && (
        <div className="flex items-center gap-2 pl-2 border-l">
          <Label htmlFor={`gestor-${member.user_id}`} className="text-xs whitespace-nowrap">
            Incluir gestor
          </Label>
          <Switch
            id={`gestor-${member.user_id}`}
            checked={member.gestor_in_queue}
            onCheckedChange={onToggleGestorInQueue}
          />
        </div>
      )}
    </div>
  );
}

const QueueConfig = ({ open, onOpenChange, departmentId, departmentName, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queueModeEnabled, setQueueModeEnabled] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(TIMEOUT_DEFAULT);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open || !departmentId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: dept }, { data: dms }] = await Promise.all([
          supabase
            .from('departments')
            .select('queue_mode_enabled, queue_mode_timeout_minutes, default_assignee_id')
            .eq('id', departmentId)
            .maybeSingle(),
          supabase
            .from('department_members')
            .select('user_id, queue_position, queue_paused, gestor_in_queue')
            .eq('department_id', departmentId),
        ]);
        if (cancelled) return;
        const userIds = (dms || []).map(d => d.user_id);
        const [{ data: profiles }, { data: roles }] = await Promise.all([
          userIds.length
            ? supabase.from('user_profiles').select('id, full_name').in('id', userIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
          userIds.length
            ? supabase.from('user_roles').select('user_id, role').in('user_id', userIds)
            : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
        ]);
        if (cancelled) return;
        const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || p.id]));
        const gerenteSet = new Set(
          (roles || []).filter(r => r.role === 'gerente').map(r => r.user_id),
        );
        const sorted = (dms || [])
          .map(d => ({
            user_id: d.user_id,
            full_name: profileMap.get(d.user_id) || d.user_id,
            queue_position: d.queue_position,
            queue_paused: !!d.queue_paused,
            gestor_in_queue: !!d.gestor_in_queue,
            is_gerente: gerenteSet.has(d.user_id),
          }))
          .sort((a, b) => {
            const ap = a.queue_position ?? Number.MAX_SAFE_INTEGER;
            const bp = b.queue_position ?? Number.MAX_SAFE_INTEGER;
            return ap - bp;
          });
        setQueueModeEnabled(!!dept?.queue_mode_enabled);
        setTimeoutMinutes(dept?.queue_mode_timeout_minutes || TIMEOUT_DEFAULT);
        setDefaultAssigneeId(dept?.default_assignee_id ?? null);
        setMembers(sorted);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar configuração da fila');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, departmentId]);

  const eligibleAssignees = useMemo(() => {
    return members.filter(m => !m.queue_paused);
  }, [members]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = members.findIndex(m => m.user_id === active.id);
    const newIdx = members.findIndex(m => m.user_id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setMembers(prev => arrayMove(prev, oldIdx, newIdx));
  };

  const togglePaused = (userId: string) => {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, queue_paused: !m.queue_paused } : m));
  };

  const toggleGestorInQueue = (userId: string) => {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, gestor_in_queue: !m.gestor_in_queue } : m));
  };

  const handleSave = async () => {
    if (!departmentId) return;
    setSaving(true);
    try {
      // 1. Atualiza departamento
      const { error: deptErr } = await supabase
        .from('departments')
        .update({
          queue_mode_enabled: queueModeEnabled,
          queue_mode_timeout_minutes: timeoutMinutes,
          default_assignee_id: defaultAssigneeId,
        })
        .eq('id', departmentId);
      if (deptErr) throw deptErr;

      // 2. Atualiza membros (queue_position por nova ordem * 10, queue_paused, gestor_in_queue)
      // Faz updates individuais — bulk upsert exigiria todas as colunas e PK.
      const memberUpdates = members.map((m, idx) =>
        supabase
          .from('department_members')
          .update({
            queue_position: (idx + 1) * 10,
            queue_paused: m.queue_paused,
            gestor_in_queue: m.gestor_in_queue,
          })
          .eq('department_id', departmentId)
          .eq('user_id', m.user_id),
      );
      const memberResults = await Promise.all(memberUpdates);
      const memberErr = memberResults.find(r => r.error)?.error;
      if (memberErr) throw memberErr;

      // 3. Reseta cursor RR para começar do topo após reordenação
      await supabase
        .from('departments')
        .update({ last_assignee_position: 0 })
        .eq('id', departmentId);

      // 4. R125: ao desligar Modo Fila, cancela queue_events ativos do dept
      // (badge "Em fila — Lucas (2:10)" sumiria só ao expirar — UX confusa).
      if (!queueModeEnabled) {
        await supabase
          .from('handoff_queue_events')
          .update({ status: 'cancelled' })
          .eq('department_id', departmentId)
          .eq('status', 'active');
      }

      // 5. Audit log (não-bloqueante)
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          await supabase.rpc('log_admin_action', {
            p_user_id: authData.user.id,
            p_action: 'update_dept_queue_config',
            p_target_table: 'departments',
            p_target_id: departmentId,
            p_details: {
              queue_mode_enabled: queueModeEnabled,
              queue_mode_timeout_minutes: timeoutMinutes,
              default_assignee_id: defaultAssigneeId,
              member_count: members.length,
              order: members.map(m => m.user_id),
            },
          });
        }
      } catch { /* audit log non-blocking */ }

      toast.success('Configuração da fila salva!');
      onOpenChange(false);
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fila Inteligente — {departmentName}</DialogTitle>
          <DialogDescription>
            Configura como handoffs deste departamento são distribuídos entre atendentes.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Modo Fila */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Modo Fila</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {queueModeEnabled
                    ? 'Round-robin global: cada handoff vai para o próximo atendente da fila.'
                    : 'Todos os handoffs vão para o atendente padrão (gestor-de-chão distribui manual).'}
                </p>
              </div>
              <Switch checked={queueModeEnabled} onCheckedChange={setQueueModeEnabled} />
            </div>

            {/* Timeout (só em Modo ON) */}
            {queueModeEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Timeout de resposta</Label>
                  <span className="text-sm font-medium tabular-nums">{timeoutMinutes} min</span>
                </div>
                <Slider
                  min={TIMEOUT_MIN}
                  max={TIMEOUT_MAX}
                  step={1}
                  value={[timeoutMinutes]}
                  onValueChange={([v]) => setTimeoutMinutes(v)}
                />
                <p className="text-xs text-muted-foreground">
                  Se o atendente não responder em {timeoutMinutes} min, a conversa avança para o próximo da fila.
                </p>
              </div>
            )}

            {/* Atendente padrão (só em Modo OFF) */}
            {!queueModeEnabled && (
              <div className="space-y-2">
                <Label>Atendente padrão</Label>
                <Select
                  value={defaultAssigneeId ?? '__none__'}
                  onValueChange={v => setDefaultAssigneeId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum (deixa não atribuído)</SelectItem>
                    {eligibleAssignees.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Todos os handoffs vão direto para esse atendente. Útil quando há um gestor-de-chão que distribui manual.
                </p>
              </div>
            )}

            {/* Drag-drop members */}
            <div className="space-y-3">
              <div>
                <Label>Ordem do round-robin</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Arraste para reordenar. Membros pausados são pulados. Gerentes só entram na fila com o toggle "Incluir gestor".
                </p>
              </div>
              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  Sem membros neste departamento. Adicione membros pelo botão "Editar" no card do departamento.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={members.map(m => m.user_id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {members.map(m => (
                        <SortableMemberRow
                          key={m.user_id}
                          member={m}
                          onTogglePaused={() => togglePaused(m.user_id)}
                          onToggleGestorInQueue={() => toggleGestorInQueue(m.user_id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QueueConfig;
