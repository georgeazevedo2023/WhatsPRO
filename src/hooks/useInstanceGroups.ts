import { useState, useEffect, useCallback } from 'react';
import { uazapiProxy } from '@/lib/uazapiClient';
import { extractGroupsArray } from '@/types/uazapi';
import type { RawUazapiGroup, RawUazapiParticipant } from '@/types/uazapi';
import type { Group, Participant } from '@/types';
import { handleError } from '@/lib/errorUtils';

/**
 * Normalize a raw UAZAPI participant into the app Participant shape.
 * Handles PascalCase/camelCase inconsistencies from the provider.
 */
function normalizeParticipant(p: RawUazapiParticipant): Participant {
  let phoneNumber = p.PhoneNumber || p.phoneNumber || '';
  const jid = p.JID || p.jid || p.id || '';
  const pushName = p.PushName || p.pushName || p.DisplayName || p.Name || p.name || '';

  // Fallback: extract digits from pushName when phoneNumber is masked
  if ((!phoneNumber || phoneNumber.includes('·')) && pushName) {
    const digitsFromName = pushName.replace(/\D/g, '');
    if (digitsFromName.length >= 10) {
      phoneNumber = digitsFromName;
    }
  }

  // Discard masked phone numbers
  if (phoneNumber?.includes('·')) {
    phoneNumber = '';
  }

  return {
    jid: phoneNumber || jid,
    phoneNumber: phoneNumber || undefined,
    isAdmin: p.IsAdmin || p.isAdmin || false,
    isSuperAdmin: p.IsSuperAdmin || p.isSuperAdmin || false,
    name: pushName || undefined,
  };
}

/**
 * Normalize a raw UAZAPI group into the app Group shape.
 */
function normalizeGroup(g: RawUazapiGroup): Group {
  const rawParticipants = g.Participants || g.participants || [];
  const participants = rawParticipants.map(normalizeParticipant);

  return {
    id: g.JID || g.jid || g.id || '',
    name: g.Name || g.name || g.Subject || g.Topic || g.subject || 'Grupo sem nome',
    pictureUrl: g.profilePicUrl || g.pictureUrl || g.PictureUrl,
    size: participants.length || g.ParticipantCount || 0,
    participants,
  };
}

export interface UseInstanceGroupsOptions {
  /** Instance ID to fetch groups for */
  instanceId: string;
  /** If true, won't auto-fetch on mount (call `refetch` manually) */
  manual?: boolean;
  /** Only fetch when instance is connected */
  enabled?: boolean;
}

export interface UseInstanceGroupsReturn {
  groups: Group[];
  loading: boolean;
  refetch: () => Promise<Group[]>;
}

/**
 * Centralized hook for fetching and normalizing UAZAPI groups.
 * Replaces duplicated fetch+extract+normalize logic across 6+ components.
 */
export function useInstanceGroups({
  instanceId,
  manual = false,
  enabled = true,
}: UseInstanceGroupsOptions): UseInstanceGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(!manual && enabled);

  const refetch = useCallback(async (): Promise<Group[]> => {
    if (!instanceId) return [];
    setLoading(true);
    try {
      const data = await uazapiProxy({
        action: 'groups',
        instance_id: instanceId,
      });

      const rawGroups = extractGroupsArray(data);
      const normalized = rawGroups.map(normalizeGroup);
      setGroups(normalized);
      return normalized;
    } catch (error) {
      handleError(error, 'Erro ao carregar grupos', 'useInstanceGroups fetch');
      return [];
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!manual && enabled && instanceId) {
      refetch();
    }
    if (!enabled) {
      setLoading(false);
    }
  }, [instanceId, manual, enabled, refetch]);

  return { groups, loading, refetch };
}

// Re-export normalizers for edge cases where consumers need them
export { normalizeGroup, normalizeParticipant };
