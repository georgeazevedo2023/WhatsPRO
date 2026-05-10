import { useState, memo, useCallback } from 'react';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ContactAvatarProps {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
  /** Quando informado, dispara refresh-avatar no onError (lazy rehydrate) */
  contactId?: string | null;
}

// Ref do projeto Supabase atual (ex: `prfcbfumyrrycsrcrvms`).
const CURRENT_SUPABASE_REF =
  (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || '';

// URLs assinadas do CDN do WhatsApp expiram em ~24h. URLs de Supabase de
// projeto antigo (pós-migração) também — DNS ERR_NAME_NOT_RESOLVED. Pular
// renderização evita poluir o console; iniciais cobrem o caso.
function isStaleSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.includes('pps.whatsapp.net')) return true;
  const m = src.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (m && CURRENT_SUPABASE_REF && m[1] !== CURRENT_SUPABASE_REF) return true;
  return false;
}

// Cache em memória de contact_ids já tentados nesta sessão — evita
// disparar refresh-avatar repetidamente para contatos sem foto.
const refreshedIds = new Set<string>();

export const ContactAvatar = memo(function ContactAvatar({
  src,
  name,
  size = 32,
  className = '',
  contactId,
}: ContactAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [refreshedSrc, setRefreshedSrc] = useState<string | null>(null);
  const initials = (name || '?').charAt(0).toUpperCase();
  const px = `${size}px`;

  const triggerRefresh = useCallback(async () => {
    if (!contactId || refreshedIds.has(contactId)) return;
    refreshedIds.add(contactId);
    try {
      const { data } = await supabase.functions.invoke('refresh-avatar', {
        body: { contact_id: contactId },
      });
      const url = (data as { url?: string | null })?.url;
      // Só usa URL fresca que NÃO seja CDN do WhatsApp (essas expiram em ~24h e dão 403)
      if (typeof url === 'string' && url.startsWith('http') && !isStaleSrc(url)) {
        setRefreshedSrc(url);
        setImgError(false);
      }
    } catch {
      // silencioso — fallback de iniciais já cobre o caso
    }
  }, [contactId]);

  const effectiveSrc = refreshedSrc ?? (isStaleSrc(src) ? null : src);

  if (effectiveSrc && !imgError) {
    return (
      <img
        src={effectiveSrc}
        alt=""
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

  // Sem URL utilizável: tentar rehydrate uma vez se ainda não tentou
  if (!effectiveSrc && contactId && !refreshedIds.has(contactId)) {
    triggerRefresh();
  }

  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {size >= 40 ? (
        <span className="text-muted-foreground font-semibold" style={{ fontSize: `${size * 0.4}px` }}>
          {initials}
        </span>
      ) : (
        <User className="text-muted-foreground" style={{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }} />
      )}
    </div>
  );
});
