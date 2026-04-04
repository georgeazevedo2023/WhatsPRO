import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { FormSubmission, FormStats } from '@/types/forms'

// ─── useFormSubmissions ───────────────────────────────────────────────────────
export function useFormSubmissions(formId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['form-submissions', formId, limit],
    queryFn: async (): Promise<FormSubmission[]> => {
      if (!formId) return []
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as FormSubmission[]
    },
    enabled: !!formId,
    staleTime: 15_000,
  })
}

// ─── useFormStats ─────────────────────────────────────────────────────────────
export function useFormStats(formId: string | null) {
  return useQuery({
    queryKey: ['form-stats', formId],
    queryFn: async (): Promise<FormStats> => {
      if (!formId) return { total: 0, today: 0 }
      const { data, error } = await supabase.rpc('get_form_stats', { p_form_id: formId })
      if (error) throw error
      const row = (data as Array<{ total: number; today: number }>)?.[0]
      return { total: row?.total ?? 0, today: row?.today ?? 0 }
    },
    enabled: !!formId,
    staleTime: 30_000,
  })
}
