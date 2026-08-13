import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_PUBLIC_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/;

/** Buckets PÚBLICOS (verificado em storage.buckets, 2026-08-13): a URL
 *  /object/public/ funciona como está — assinar custava 1 request de REDE por
 *  mídia renderizada (50 fotos = 50 chamadas) e devolvia 400 no console.
 *  Só o que NÃO estiver aqui (futuro bucket privado) passa pelo sign. */
const PUBLIC_BUCKETS = new Set(['helpdesk-media', 'carousel-images', 'audio-messages', 'contact-avatars', 'bio-images']);

/**
 * Resolves a Supabase storage public URL to a signed URL for private buckets.
 * Known public buckets are returned as-is (zero network).
 * Non-Supabase URLs are returned as-is.
 */
export function useSignedUrl(url: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSignedUrl(null);
      return;
    }

    const match = url.match(STORAGE_PUBLIC_REGEX);
    if (match && !PUBLIC_BUCKETS.has(match[1])) {
      const bucket = match[1];
      const path = decodeURIComponent(match[2].split('?')[0]);
      let cancelled = false;
      supabase.storage.from(bucket).createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (!cancelled) {
            setSignedUrl(data?.signedUrl || url);
          }
        })
        .catch(() => {
          if (!cancelled) setSignedUrl(url);
        });
      return () => { cancelled = true; };
    }

    setSignedUrl(url);
  }, [url]);

  return signedUrl;
}
