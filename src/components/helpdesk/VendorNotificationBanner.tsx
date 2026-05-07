/**
 * VendorNotificationBanner — banner contextual no header do Helpdesk.
 *
 * Mostra alerta APENAS quando:
 *   - Vendor tem `personal_whatsapp` cadastrado, E
 *   - Janela WhatsApp 24h vai expirar em <2h (amarelo), OU
 *   - Janela já expirou (vermelho).
 *
 * Vendor sem cadastro → não renderiza nada (admin que cadastra; vendedor não precisa
 * ser confrontado com um banner que ele não pode resolver).
 *
 * Inclui número de telefone da primeira instância do user pra mostrar onde mandar msg.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/phoneUtils';

type State = 'hidden' | 'expiring_soon' | 'expired';

interface SessionInfo {
  state: State;
  minutesRemaining: number;
  instancePhone: string | null;
}

const DISMISS_KEY_PREFIX = 'wpro_notif_banner_dismissed_';

export function VendorNotificationBanner() {
  const { user } = useAuth();
  const [info, setInfo] = useState<SessionInfo>({ state: 'hidden', minutesRemaining: 0, instancePhone: null });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    (async () => {
      try {
        const [{ data: profile }, { data: access }] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('personal_whatsapp, whatsapp_session_until')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('user_instance_access')
            .select('instance_id')
            .eq('user_id', user.id)
            .limit(1),
        ]);

        if (!alive) return;

        const personal = (profile as { personal_whatsapp?: string | null } | null)?.personal_whatsapp;
        const sessionUntil = (profile as { whatsapp_session_until?: string | null } | null)?.whatsapp_session_until;

        if (!personal) {
          setInfo({ state: 'hidden', minutesRemaining: 0, instancePhone: null });
          return;
        }

        // Carrega phone da primeira instância (pra mostrar onde mandar "oi")
        const firstInstanceId = (access as { instance_id?: string }[] | null)?.[0]?.instance_id;
        let instancePhone: string | null = null;
        if (firstInstanceId) {
          const { data: inst } = await supabase
            .from('instances')
            .select('owner_jid')
            .eq('id', firstInstanceId)
            .maybeSingle();
          const ownerJid = (inst as { owner_jid?: string | null } | null)?.owner_jid;
          if (ownerJid) {
            instancePhone = String(ownerJid).split('@')[0].replace(/[^\d]/g, '');
          }
        }

        const now = Date.now();
        if (!sessionUntil) {
          // Tem número mas nunca fez handshake → comporta como expired (precisa mandar msg).
          if (alive) setInfo({ state: 'expired', minutesRemaining: 0, instancePhone });
          return;
        }

        const untilMs = new Date(sessionUntil).getTime();
        if (untilMs < now) {
          if (alive) setInfo({ state: 'expired', minutesRemaining: 0, instancePhone });
        } else if (untilMs - now < 2 * 60 * 60 * 1000) {
          if (alive) setInfo({
            state: 'expiring_soon',
            minutesRemaining: Math.round((untilMs - now) / 60000),
            instancePhone,
          });
        } else {
          if (alive) setInfo({ state: 'hidden', minutesRemaining: 0, instancePhone });
        }
      } catch {
        if (alive) setInfo({ state: 'hidden', minutesRemaining: 0, instancePhone: null });
      }
    })();

    return () => { alive = false; };
  }, [user?.id]);

  if (!user?.id || info.state === 'hidden' || dismissed) return null;

  // Banner pode ser dispensado por sessão (não persiste após reload — intencional).
  const dismissKey = `${DISMISS_KEY_PREFIX}${user.id}_${info.state}`;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dismissKey) === '1') {
    return null;
  }

  const isExpired = info.state === 'expired';
  const phoneDisplay = info.instancePhone ? formatPhone(info.instancePhone) : 'WhatsApp da empresa';

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border text-xs',
        isExpired
          ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      )}
      role="alert"
      aria-live="polite"
    >
      {isExpired
        ? <AlertTriangle className="w-4 h-4 shrink-0" />
        : <Clock className="w-4 h-4 shrink-0" />
      }
      <p className="flex-1 leading-tight">
        {isExpired ? (
          <>
            <strong>Notificações inativas</strong> — mande qualquer mensagem (ex: "oi") pra <strong>{phoneDisplay}</strong> pra reativar pelas próximas 24h.
          </>
        ) : (
          <>
            Janela de notificações expira em <strong>{info.minutesRemaining} min</strong>. Renove agora mandando qualquer msg pra <strong>{phoneDisplay}</strong>.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(dismissKey, '1');
          setDismissed(true);
        }}
        className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
        aria-label="Dispensar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
