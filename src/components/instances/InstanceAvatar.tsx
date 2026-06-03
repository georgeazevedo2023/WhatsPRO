import { useEffect, useState, memo, useCallback } from 'react';
import { Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface InstanceAvatarProps {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
  /** Quando informado, dispara refresh-instance-avatar no onError/on-mount (lazy rehydrate) */
  instanceId?: string | null;
}

// Ref do projeto Supabase atual (ex: `prfcbfumyrrycsrcrvms`).
const CURRENT_SUPABASE_REF =
  (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || '';

// URLs assinadas do CDN do WhatsApp expiram (param oe=). URLs de Supabase de
// projeto antigo (pós-migração) também — DNS ERR_NAME_NOT_RESOLVED. Tratar
// como ausente evita poluir o console; o fallback (ícone) cobre o caso.
function isStaleSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.includes('pps.whatsapp.net')) return true;
  const m = src.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (m && CURRENT_SUPABASE_REF && m[1] !== CURRENT_SUPABASE_REF) return true;
  return false;
}

// Cache em memória de instance_ids já tentados nesta sessão — evita disparar
// refresh-instance-avatar repetidamente para instâncias sem foto.
const refreshedIds = new Set<string>();

export const InstanceAvatar = memo(function InstanceAvatar({
  src,
  name,
  size = 40,
  className = '',
  instanceId,
}: InstanceAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [refreshedSrc, setRefreshedSrc] = useState<string | null>(null);
  const px = `${size}px`;
  void name; // reservado p/ alt/title; fallback é ícone, não iniciais

  const triggerRefresh = useCallback(async () => {
    if (!instanceId || refreshedIds.has(instanceId)) return;
    refreshedIds.add(instanceId);
    try {
      const { data } = await supabase.functions.invoke('refresh-instance-avatar', {
        body: { instance_id: instanceId },
      });
      const url = (data as { url?: string | null })?.url;
      // Só usa URL fresca que NÃO seja CDN do WhatsApp (essas expiram e dão 403)
      if (typeof url === 'string' && url.startsWith('http') && !isStaleSrc(url)) {
        setRefreshedSrc(url);
        setImgError(false);
      }
    } catch {
      // silencioso — fallback de ícone já cobre o caso
    }
  }, [instanceId]);

  const effectiveSrc = refreshedSrc ?? (isStaleSrc(src) ? null : src);

  useEffect(() => {
    if (!effectiveSrc && instanceId && !refreshedIds.has(instanceId)) {
      triggerRefresh();
    }
  }, [instanceId, effectiveSrc, triggerRefresh]);

  if (effectiveSrc && !imgError) {
    return (
      <img
        src={effectiveSrc}
        alt={name || ''}
        loading="lazy"
        decoding="async"
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: px, height: px }}
        onError={() => {
          setImgError(true);
          triggerRefresh();
        }}
      />
    );
  }

  // Sem URL utilizável: ícone de instância (rehydrate tentado uma vez via effect).
  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      <Server
        className="text-muted-foreground"
        style={{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }}
      />
    </div>
  );
});

export default InstanceAvatar;
