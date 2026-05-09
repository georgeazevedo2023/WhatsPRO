/**
 * VendorNotificationBanner — alerta no header do Helpdesk pro vendedor
 * que ainda não tem `personal_whatsapp` cadastrado.
 *
 * UAZAPI não tem janela WhatsApp 24h (regra da Business API oficial), então
 * o único estado que justifica banner é o vendor sem número cadastrado —
 * sinaliza pro vendor que admin precisa cadastrar pra ele receber notif.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISS_KEY_PREFIX = 'wpro_notif_no_number_dismissed_';

export function VendorNotificationBanner() {
  const { user, isSuperAdmin, isGerente } = useAuth();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Admin/gerente não atendem na fila — banner não se aplica
    if (isSuperAdmin || isGerente) { setShow(false); return; }
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('personal_whatsapp')
          .eq('id', user.id)
          .maybeSingle();
        const personal = (data as { personal_whatsapp?: string | null } | null)?.personal_whatsapp;
        if (alive) setShow(!personal);
      } catch {
        if (alive) setShow(false);
      }
    })();

    return () => { alive = false; };
  }, [user?.id, isSuperAdmin, isGerente]);

  if (!user?.id || !show || dismissed) return null;

  const dismissKey = `${DISMISS_KEY_PREFIX}${user.id}`;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dismissKey) === '1') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border text-xs',
        'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <p className="flex-1 leading-tight">
        <strong>Notificações WhatsApp não configuradas.</strong> Peça ao admin pra cadastrar seu número pessoal em <em>Equipe</em> pra receber alertas de novos atendimentos no seu WhatsApp.
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
