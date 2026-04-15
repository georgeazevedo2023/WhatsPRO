import { useState, useEffect } from 'react';

/** WhatsApp CDN URLs expire regularly — treat as stale to avoid 403 console errors */
function isStaleWhatsAppUrl(url: string | null | undefined): boolean {
  return !!url && url.includes('pps.whatsapp.net');
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
