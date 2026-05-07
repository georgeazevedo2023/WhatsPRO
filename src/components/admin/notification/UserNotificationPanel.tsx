/**
 * UserNotificationPanel — Painel de configuração de notificações WhatsApp
 * de um vendedor. Renderizado dentro do CollapsibleContent de UsersTab.
 *
 * Funcionalidades:
 *   - Cadastro/edição do `personal_whatsapp` (E.164 com máscara).
 *   - Toggle `notify_on_assignment` (opt-in geral).
 *   - Status visual da janela WhatsApp 24h (handshake, expiração).
 *   - Botão "Pausar" → modal com presets (1h / fim do dia / 3 dias / indef / custom).
 *   - Botão "Reativar" quando já pausado.
 *
 * Não persiste localmente — todas as ops via supabase. Pause via RPC `pause_user_notifications`.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bell, BellOff, MessageCircle, Loader2, Pencil, Pause, Play,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserNotificationData {
  id: string;
  full_name: string | null;
  personal_whatsapp: string | null;
  notify_on_assignment: boolean;
  whatsapp_handshake_at: string | null;
  whatsapp_session_until: string | null;
  notifications_paused_until: string | null;
  notifications_paused_reason: string | null;
}

interface Props {
  user: UserNotificationData;
  onUpdated?: () => void;
}

type SessionState = 'no_number' | 'never_handshake' | 'expired' | 'expiring_soon' | 'active' | 'paused';

function getSessionState(u: UserNotificationData): SessionState {
  if (u.notifications_paused_until && new Date(u.notifications_paused_until) > new Date()) return 'paused';
  if (!u.personal_whatsapp) return 'no_number';
  if (!u.whatsapp_handshake_at || !u.whatsapp_session_until) return 'never_handshake';
  const until = new Date(u.whatsapp_session_until).getTime();
  const now = Date.now();
  if (until < now) return 'expired';
  if (until - now < 2 * 60 * 60 * 1000) return 'expiring_soon';
  return 'active';
}

function formatPhoneInputE164(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  return '+' + digits.slice(0, 15);
}

const PAUSE_PRESETS = [
  { label: '1 hora', minutes: 60 },
  { label: 'Fim do dia', minutes: -1 },
  { label: '3 dias', minutes: 3 * 24 * 60 },
  { label: '7 dias', minutes: 7 * 24 * 60 },
  { label: 'Indefinido', minutes: 365 * 24 * 60 },
];

export function UserNotificationPanel({ user, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user.personal_whatsapp || '');
  const [saving, setSaving] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pausePreset, setPausePreset] = useState<number>(60);
  const [pauseSaving, setPauseSaving] = useState(false);

  const state = getSessionState(user);

  const savePhone = useCallback(async () => {
    const normalized = phoneInput.trim() || null;
    if (normalized && !/^\+[1-9][0-9]{9,14}$/.test(normalized)) {
      toast.error('Formato E.164 inválido. Ex: +5511987654321');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ personal_whatsapp: normalized })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('WhatsApp salvo');
      setEditing(false);
      onUpdated?.();
    } catch (e) {
      handleError(e, 'Erro ao salvar WhatsApp');
    } finally {
      setSaving(false);
    }
  }, [phoneInput, user.id, onUpdated]);

  const toggleOptIn = useCallback(async (next: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ notify_on_assignment: next })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(next ? 'Notificações ativadas' : 'Notificações desativadas');
      onUpdated?.();
    } catch (e) {
      handleError(e, 'Erro ao alterar opt-in');
    } finally {
      setSaving(false);
    }
  }, [user.id, onUpdated]);

  const applyPause = useCallback(async () => {
    let until: Date | null;
    if (pausePreset === -1) {
      until = new Date();
      until.setHours(23, 59, 59, 999);
    } else {
      until = new Date(Date.now() + pausePreset * 60 * 1000);
    }
    setPauseSaving(true);
    try {
      const { data, error } = await supabase.rpc('pause_user_notifications', {
        _target_user_id: user.id,
        _until: until.toISOString(),
        _reason: pauseReason.trim() || null,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) {
        toast.error(
          result.error === 'forbidden_cross_dept'
            ? 'Você só pode pausar membros do seu departamento'
            : result.error === 'forbidden'
            ? 'Sem permissão pra pausar notificações'
            : `Erro: ${result.error}`,
        );
        return;
      }
      toast.success('Notificações pausadas');
      setPauseOpen(false);
      setPauseReason('');
      onUpdated?.();
    } catch (e) {
      handleError(e, 'Erro ao pausar');
    } finally {
      setPauseSaving(false);
    }
  }, [pausePreset, pauseReason, user.id, onUpdated]);

  const reactivate = useCallback(async () => {
    setPauseSaving(true);
    try {
      const { data, error } = await supabase.rpc('pause_user_notifications', {
        _target_user_id: user.id,
        _until: null,
        _reason: null,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) {
        toast.error(`Erro: ${result.error}`);
        return;
      }
      toast.success('Notificações reativadas');
      onUpdated?.();
    } catch (e) {
      handleError(e, 'Erro ao reativar');
    } finally {
      setPauseSaving(false);
    }
  }, [user.id, onUpdated]);

  const renderStatusBadge = () => {
    const cfg: Record<SessionState, { label: string; className: string; Icon: typeof Bell }> = {
      no_number: { label: 'Não cadastrado', className: 'bg-muted/40 text-muted-foreground border-border/40', Icon: BellOff },
      never_handshake: { label: 'Aguardando 1ª msg do vendedor', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', Icon: Clock },
      expired: { label: 'Janela expirou — pedir "oi" no WhatsApp', className: 'bg-red-500/10 text-red-600 border-red-500/30', Icon: AlertTriangle },
      expiring_soon: { label: 'Janela expira em <2h', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', Icon: Clock },
      active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', Icon: CheckCircle2 },
      paused: {
        label: user.notifications_paused_until
          ? `Pausado até ${new Date(user.notifications_paused_until).toLocaleString('pt-BR')}`
          : 'Pausado',
        className: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
        Icon: Pause,
      },
    };
    const c = cfg[state];
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium', c.className)}>
        <c.Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" /> Notificações WhatsApp
        </p>
        {renderStatusBadge()}
      </div>

      <div className="rounded-lg bg-muted/20 border border-border/30 p-3 space-y-3">
        {/* Linha 1: Número pessoal */}
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-[11px] text-muted-foreground/80 min-w-[100px]">WhatsApp pessoal</Label>
          {editing ? (
            <>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(formatPhoneInputE164(e.target.value))}
                placeholder="+5511987654321"
                className="h-8 text-xs flex-1 min-w-[180px]"
                aria-label="Número WhatsApp pessoal em formato E.164"
              />
              <Button size="sm" className="h-8 text-xs" onClick={savePhone} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setEditing(false);
                  setPhoneInput(user.personal_whatsapp || '');
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs font-mono flex-1">
                {user.personal_whatsapp || <span className="text-muted-foreground/60 italic">Não cadastrado</span>}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Editar WhatsApp">
                    <Pencil className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Cadastre/altere o número</p></TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Linha 2: Toggle opt-in */}
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`notify-${user.id}`} className="text-[11px] text-muted-foreground/80 cursor-pointer flex items-center gap-1.5">
            <Bell className="w-3 h-3" />
            Receber notif quando atribuído
          </Label>
          <Switch
            id={`notify-${user.id}`}
            checked={user.notify_on_assignment}
            onCheckedChange={toggleOptIn}
            disabled={saving}
            aria-label="Opt-in geral pra notificações"
          />
        </div>

        {/* Linha 3: Pausa/Reativar */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/20">
          {state === 'paused' ? (
            <>
              <p className="text-[11px] text-muted-foreground flex-1">
                {user.notifications_paused_reason && <span className="italic">"{user.notifications_paused_reason}"</span>}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={reactivate}
                disabled={pauseSaving}
                aria-label="Reativar notificações agora"
              >
                {pauseSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Reativar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 ml-auto"
              onClick={() => setPauseOpen(true)}
              aria-label="Pausar notificações temporariamente"
            >
              <Pause className="w-3 h-3" />
              Pausar
            </Button>
          )}
        </div>

        {/* Hint pra cadastrar handshake */}
        {state === 'never_handshake' && user.personal_whatsapp && (
          <p className="text-[10px] text-amber-600/80 leading-tight">
            Peça pro vendedor mandar qualquer mensagem (ex: "oi") pro WhatsApp da empresa pra ativar a janela de notificações.
          </p>
        )}
        {state === 'expired' && (
          <p className="text-[10px] text-red-600/80 leading-tight">
            A janela WhatsApp de 24h expirou. O vendedor precisa mandar uma nova mensagem pro WhatsApp da empresa pra reativar.
          </p>
        )}
      </div>

      {/* Modal Pausar */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar notificações de {user.full_name || 'membro'}</DialogTitle>
            <DialogDescription>
              Durante a pausa, o vendedor não recebe alertas de novos atendimentos no WhatsApp pessoal. Ele ainda vê tudo no painel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Pausar por</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAUSE_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPausePreset(p.minutes)}
                    className={cn(
                      'p-2 rounded-md border text-xs transition',
                      pausePreset === p.minutes
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pause-reason-${user.id}`} className="text-xs">Motivo (opcional)</Label>
              <Input
                id={`pause-reason-${user.id}`}
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Ex.: Férias, reunião, plantão"
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>Cancelar</Button>
            <Button onClick={applyPause} disabled={pauseSaving}>
              {pauseSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pausando...</> : 'Pausar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
