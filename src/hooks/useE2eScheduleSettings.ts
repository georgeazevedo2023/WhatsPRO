import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface E2eScheduleSettings {
  intervalHours: number      // 2 | 6 | 12 | 24
  healthyPassRate: number    // 0-100
  regressionThreshold: number // pontos de queda (ex: 10)
  whatsappEnabled: boolean   // alerta WhatsApp habilitado
}

const SETTING_KEYS = [
  'e2e_schedule_interval_hours',
  'e2e_healthy_pass_rate',
  'e2e_regression_threshold',
  'e2e_alert_whatsapp_enabled',
] as const

export function useE2eScheduleSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['e2e-schedule-settings'],
    queryFn: async (): Promise<E2eScheduleSettings> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', SETTING_KEYS as unknown as string[])
      if (error) throw error
      const map = Object.fromEntries((data || []).map(s => [s.key, s.value]))
      return {
        intervalHours: parseInt(map.e2e_schedule_interval_hours || '6', 10),
        healthyPassRate: parseInt(map.e2e_healthy_pass_rate || '80', 10),
        regressionThreshold: parseInt(map.e2e_regression_threshold || '10', 10),
        whatsappEnabled: map.e2e_alert_whatsapp_enabled !== 'false',
      }
    },
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (patch: Partial<E2eScheduleSettings>) => {
      const updates: Array<{ key: string; value: string }> = []
      if (patch.intervalHours !== undefined)
        updates.push({ key: 'e2e_schedule_interval_hours', value: String(patch.intervalHours) })
      if (patch.healthyPassRate !== undefined)
        updates.push({ key: 'e2e_healthy_pass_rate', value: String(patch.healthyPassRate) })
      if (patch.regressionThreshold !== undefined)
        updates.push({ key: 'e2e_regression_threshold', value: String(patch.regressionThreshold) })
      if (patch.whatsappEnabled !== undefined)
        updates.push({ key: 'e2e_alert_whatsapp_enabled', value: String(patch.whatsappEnabled) })
      for (const u of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: u.value })
          .eq('key', u.key)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['e2e-schedule-settings'] })
      toast.success('Configurações salvas')
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  })

  return {
    settings: query.data,
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
