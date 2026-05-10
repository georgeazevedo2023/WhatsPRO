import { useState, useEffect } from 'react';

// URL do projeto Supabase atual (refs como `prfcbfumyrrycsrcrvms`).
const CURRENT_SUPABASE_REF =
  (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || '';

/**
 * URL "stale" (não pode ser usada): URLs do CDN do WhatsApp (expiram em ~24h
 * e dão 403) ou URLs de Supabase de OUTRO projeto (legacy de migração — após
 * trocar `prfcbfumy...` o `profile_pic_url` velho aponta pra URL morta que
 * só dá ERR_NAME_NOT_RESOLVED).
 */
function isStaleWhatsAppUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes('pps.whatsapp.net')) return true;
  // Supabase storage de outro projeto?
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (m && CURRENT_SUPABASE_REF && m[1] !== CURRENT_SUPABASE_REF) return true;
  return false;
}

/**
 * Returns a valid profile picture URL or null.
 * Skips stale WhatsApp CDN URLs (pps.whatsapp.net) — these expire and cause 403.
 * When null, the UI shows fallback initials via ContactAvatar/AvatarFallback.
 */
export function useContactProfilePic(
  _contactId: string | undefined,
  _contactJid: string | undefined,
  _instanceId: string | undefined,
  existingPicUrl: string | null | undefined,
) {
  const validUrl = isStaleWhatsAppUrl(existingPicUrl) ? null : (existingPicUrl || null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(validUrl);

  useEffect(() => {
    setProfilePicUrl(isStaleWhatsAppUrl(existingPicUrl) ? null : (existingPicUrl || null));
  }, [existingPicUrl]);

  return profilePicUrl;
}

/** Extract profile pic URL from inconsistent UAZAPI response fields */
export function extractProfilePicUrl(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const url = (data.profilePicUrl || data.imgUrl || data.url || data.eurl) as string | undefined;
  return url && typeof url === 'string' && url.startsWith('http') ? url : null;
}
