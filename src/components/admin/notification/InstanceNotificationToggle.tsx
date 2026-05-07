/**
 * InstanceNotificationToggle — toggle simples de feature flag por instância.
 *
 * Persiste em `instance_settings.notifications_enabled` via UPSERT.
 * Quando false, a edge function `notify-vendor-assignment` pula tudo silenciosamente.
 *
 * Comportamento:
 *   - Carrega o estado on demand (lazy) via fetch.
 *   - UPSERT no toggle (insere row se ainda não existe).
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Bell, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  instanceId: string;
  className?: string;
}

export function InstanceNotificationToggle({ instanceId, className }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('instance_settings')
          .select('notifications_enabled')
          .eq('instance_id', instanceId)
          .maybeSingle();
        if (alive) setEnabled((data?.notifications_enabled as boolean | undefined) ?? false);
      } catch {
        if (alive) setEnabled(false);
      }
    })();
    return () => { alive = false; };
  }, [instanceId]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('instance_settings')
        .upsert(
          { instance_id: instanceId, notifications_enabled: next },
          { onConflict: 'instance_id' },
        );
      if (error) throw error;
      setEnabled(next);
      toast.success(next ? 'Notificações ativadas pra esta instância' : 'Notificações desativadas');
    } catch (e) {
      handleError(e, 'Erro ao alterar configuração');
    } finally {
      setSaving(false);
    }
  };

  if (enabled === null) {
    return (
      <div className={className}>
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Bell className="w-3.5 h-3.5 text-muted-foreground" />
      <Label htmlFor={`notif-${instanceId}`} className="text-xs text-muted-foreground cursor-pointer">
        Notif WhatsApp
      </Label>
      <Switch
        id={`notif-${instanceId}`}
        checked={enabled}
        onCheckedChange={toggle}
        disabled={saving}
        aria-label="Ativar notificações WhatsApp pra esta instância"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground" aria-label="Sobre notificações">
            <HelpCircle className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            Quando ativado, vendedores recebem alerta no WhatsApp pessoal sempre que receberem um lead.
            Eles precisam mandar qualquer mensagem pro número desta instância uma vez por dia pra reativar a janela.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
