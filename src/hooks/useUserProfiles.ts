import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface UserProfileData {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface UseUserProfilesOptions {
  /** Skip fetch when false. Default: true */
  enabled?: boolean;
  /** Filter by specific user IDs. Omit to fetch all visible profiles. */
  userIds?: string[];
}

export function useUserProfiles(options: UseUserProfilesOptions = {}) {
  const { enabled = true, userIds } = options;

  // Stabilize userIds for dependency comparison
  const userIdsKey = userIds ? JSON.stringify(userIds.sort()) : null;

  const { data: profiles, loading, error, refetch } = useSupabaseQuery<UserProfileData>({
    queryFn: async () => {
      let query = supabase.from('user_profiles').select('id, full_name, email, avatar_url').order('full_name');

      if (userIds) {
        query = query.in('id', userIds);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      return (data as UserProfileData[]) || [];
    },
    enabled,
    initialLoading: false,
    errorLabel: 'useUserProfiles',
    deps: [userIdsKey],
    shouldSkip: () => userIds !== undefined && userIds.length === 0,
  });

  /** Map of id → UserProfileData for O(1) lookup */
  const profilesMap = useMemo(() => {
    const map: Record<string, UserProfileData> = {};
    profiles.forEach(p => { map[p.id] = p; });
    return map;
  }, [profiles]);

  /** Map of id → full_name (skips nulls) for agent name display */
  const namesMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => {
      if (p.full_name) map[p.id] = p.full_name;
    });
    return map;
  }, [profiles]);

  return { profiles, profilesMap, namesMap, loading, error, refetch };
}
