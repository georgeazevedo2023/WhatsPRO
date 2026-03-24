import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';

/**
 * Fetches and caches the contact's profile picture.
 * If the contact has no profile_pic_url, tries to fetch from UAZAPI and persists to DB.
 */
export function useContactProfilePic(
  contactId: string | undefined,
  contactJid: string | undefined,
  instanceId: string | undefined,
  existingPicUrl: string | null | undefined,
) {
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(existingPicUrl || null);

  useEffect(() => {
    setProfilePicUrl(existingPicUrl || null);
    if (existingPicUrl || !contactJid || !instanceId || !contactId) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await edgeFunctionFetch<Record<string, unknown>>('uazapi-proxy', {
          action: 'getProfilePic',
          instance_id: instanceId,
          jid: contactJid,
        });
        const picUrl = extractProfilePicUrl(data);
        if (picUrl && !cancelled) {
          setProfilePicUrl(picUrl);
          // Persist to DB for future use (fire-and-forget)
          supabase.from('contacts').update({ profile_pic_url: picUrl }).eq('id', contactId).then(() => {});
        }
      } catch {
        // Non-critical, silently fail
      }
    })();

    return () => { cancelled = true; };
  }, [contactId, contactJid, instanceId, existingPicUrl]);

  return profilePicUrl;
}

/** Extract profile pic URL from inconsistent UAZAPI response fields */
export function extractProfilePicUrl(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const url = (data.profilePicUrl || data.imgUrl || data.url || data.eurl) as string | undefined;
  return url && typeof url === 'string' && url.startsWith('http') ? url : null;
}
