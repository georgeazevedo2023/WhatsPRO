import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_PUBLIC_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/;

/**
 * Resolves a Supabase storage public URL to a signed URL for private buckets.
 * Carousel-images bucket is kept public and returned as-is.
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
    if (match && match[1] !== 'carousel-images') {
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
