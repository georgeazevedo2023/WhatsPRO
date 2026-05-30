import { useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/hooks/useAuthSession';
import { useSignedUrl } from '@/hooks/useSignedUrl';

const PROXYABLE_MEDIA_HOSTS = [
  'whatsapp.net',
  'uazapi.com',
  'whatsappapp.net',
];

function isProxyableMediaUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXYABLE_MEDIA_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

interface UseMediaUrlResult {
  url: string | null;
  loading: boolean;
  error: boolean;
}

/**
 * Resolves message media for rendering:
 * - Supabase private bucket public URLs become signed URLs.
 * - Legacy UAZAPI/WhatsApp temporary URLs are fetched through uazapi-proxy and
 *   rendered as object URLs, preventing direct 403 noise in the browser console.
 */
export function useMediaUrl(
  mediaUrl: string | null | undefined,
  instanceId: string | null | undefined,
  enabled: boolean,
): UseMediaUrlResult {
  const signedUrl = useSignedUrl(enabled ? mediaUrl : null);
  const baseUrl = enabled ? (signedUrl || mediaUrl || null) : null;
  const shouldProxy = useMemo(() => isProxyableMediaUrl(baseUrl), [baseUrl]);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!baseUrl || !shouldProxy || !instanceId) {
      setObjectUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let nextObjectUrl: string | null = null;

    setObjectUrl(null);
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            action: 'download-media',
            instanceId,
            fileUrl: baseUrl,
          }),
        });

        if (!response.ok) throw new Error(`download-media:${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [baseUrl, instanceId, shouldProxy]);

  if (!enabled) return { url: null, loading: false, error: false };
  if (shouldProxy) return { url: objectUrl, loading, error };
  return { url: baseUrl, loading: false, error: false };
}
