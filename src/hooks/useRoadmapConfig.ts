import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_ROADMAP_CONFIG, type RoadmapConfig } from '@/data/roadmapConfig';

/**
 * Fetches roadmap config from system_settings (key: 'roadmap_config').
 * Falls back to DEFAULT_ROADMAP_CONFIG if not found in DB.
 *
 * This allows the roadmap/changelog/insights to be updated dynamically
 * without code changes — just update the JSON in system_settings.
 */
export function useRoadmapConfig() {
  return useQuery<RoadmapConfig>({
    queryKey: ['roadmap-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'roadmap_config')
        .maybeSingle();

      if (error || !data?.value) {
        console.log('[roadmap] No DB config found, using defaults');
        return DEFAULT_ROADMAP_CONFIG;
      }

      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        // Merge with defaults to fill any missing fields
        return {
          ...DEFAULT_ROADMAP_CONFIG,
          ...parsed,
          modules: parsed.modules || DEFAULT_ROADMAP_CONFIG.modules,
          roadmapItems: parsed.roadmapItems || DEFAULT_ROADMAP_CONFIG.roadmapItems,
          changelog: parsed.changelog || DEFAULT_ROADMAP_CONFIG.changelog,
          insights: parsed.insights || DEFAULT_ROADMAP_CONFIG.insights,
          infra: { ...DEFAULT_ROADMAP_CONFIG.infra, ...parsed.infra },
        } as RoadmapConfig;
      } catch {
        console.warn('[roadmap] Failed to parse DB config, using defaults');
        return DEFAULT_ROADMAP_CONFIG;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 min cache — roadmap data changes rarely
  });
}

/**
 * Save updated roadmap config to system_settings.
 * Used by Claude or admin to update the roadmap from code/PRD.
 */
export async function saveRoadmapConfig(config: RoadmapConfig): Promise<boolean> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'roadmap_config',
      value: JSON.stringify(config),
    }, { onConflict: 'key' });

  if (error) {
    console.error('[roadmap] Failed to save config:', error);
    return false;
  }
  return true;
}
