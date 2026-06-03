/**
 * InstanceBroadcastEnrollToggle — auto-cadastro de leads na base do Disparador.
 *
 * Persiste em `instance_settings.auto_enroll_broadcast_db` via UPSERT.
 * Quando true, a RPC `enroll_lead_in_instance_database` (chamada pelo whatsapp-webhook
 * a cada mensagem recebida) cadastra automaticamente o contato na base de disparos da
 * própria instância. Quando false (default), a RPC é no-op silencioso.
 *
 * Espelha o padrão de InstanceNotificationToggle.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  instanceId: string;
  className?: string;
}

export function InstanceBroadcastEnrollToggle({ instanceId, className }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('instance_settings')
          .select('auto_enroll_broadcast_db')
          .eq('instance_id', instanceId)
          .maybeSingle();
        if (alive) setEnabled((data?.auto_enroll_broadcast_db as boolean | undefined) ?? false);
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
          { instance_id: instanceId, auto_enroll_broadcast_db: next },
          { onConflict: 'instance_id' },
        );
      if (error) throw error;
      setEnabled(next);
      toast.success(next ? 'Auto-cadastro no Disparador ativado pra esta instância' : 'Auto-cadastro no Disparador desativado');
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
      <Send className="w-3.5 h-3.5 text-muted-foreground" />
      <Label htmlFor={`enroll-${instanceId}`} className="text-xs text-muted-foreground cursor-pointer">
        Auto-cadastro no Disparador
      </Label>
      <Switch
        id={`enroll-${instanceId}`}
        checked={enabled}
        onCheckedChange={toggle}
        disabled={saving}
        aria-label="Cadastrar leads automaticamente na base do Disparador desta instância"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground" aria-label="Sobre o auto-cadastro no Disparador">
            <HelpCircle className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            Quando ativado, todo contato que enviar mensagem pra esta instância entra
            automaticamente na base de leads do Disparador desta instância, ficando
            disponível pra receber campanhas de ofertas. O envio continua manual pelo wizard.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
