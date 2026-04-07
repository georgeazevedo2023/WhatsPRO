import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface JourneyEvent {
  type: 'bio_capture' | 'campaign_visit' | 'form_submission' | 'conversation' | 'kanban'
  title: string
  subtitle?: string
  timestamp: string
}

/**
 * Fetches all touchpoints for a lead (by contact_id) to build a journey timeline.
 * Sources: bio_lead_captures, utm_visits, form_submissions, conversations, kanban_cards
 */
export function useLeadJourney(contactId: string | null) {
  return useQuery({
    queryKey: ['lead-journey', contactId],
    queryFn: async (): Promise<JourneyEvent[]> => {
      if (!contactId) return []

      const events: JourneyEvent[] = []

      // Parallel fetches
      const [bioRes, utmRes, formRes, convRes, kanbanRes] = await Promise.all([
        supabase
          .from('bio_lead_captures')
          .select('created_at, name, bio_pages(title)')
          .eq('contact_id', contactId)
          .order('created_at'),
        supabase
          .from('utm_visits')
          .select('created_at, matched_at, status, utm_campaigns(name, campaign_type)')
          .eq('contact_id', contactId)
          .order('created_at'),
        supabase
          .from('form_submissions')
          .select('submitted_at, data, whatsapp_forms(name)')
          .eq('contact_id', contactId)
          .order('submitted_at'),
        supabase
          .from('conversations')
          .select('created_at, status, tags')
          .eq('contact_id', contactId)
          .order('created_at')
          .limit(5),
        supabase
          .from('kanban_cards')
          .select('created_at, updated_at, title, kanban_columns(name), kanban_boards(name)')
          .eq('contact_id', contactId)
          .order('created_at'),
      ])

      // Bio captures
      for (const row of bioRes.data || []) {
        const pageTitle = (row as any).bio_pages?.title || 'Bio Link'
        events.push({
          type: 'bio_capture',
          title: `Bio Link: ${pageTitle}`,
          subtitle: row.name ? `Nome: ${row.name}` : undefined,
          timestamp: row.created_at,
        })
      }

      // UTM visits
      for (const row of utmRes.data || []) {
        const campaignName = (row as any).utm_campaigns?.name || 'Campanha'
        events.push({
          type: 'campaign_visit',
          title: `Campanha: ${campaignName}`,
          subtitle: row.status === 'matched' ? 'Convertido' : 'Visitou',
          timestamp: row.matched_at || row.created_at,
        })
      }

      // Form submissions
      for (const row of formRes.data || []) {
        const formName = (row as any).whatsapp_forms?.name || 'Formulario'
        events.push({
          type: 'form_submission',
          title: `Formulario: ${formName}`,
          subtitle: 'Preenchido',
          timestamp: row.submitted_at,
        })
      }

      // Conversations
      for (const row of convRes.data || []) {
        events.push({
          type: 'conversation',
          title: 'Conversa iniciada',
          subtitle: row.status || undefined,
          timestamp: row.created_at,
        })
      }

      // Kanban cards
      for (const row of kanbanRes.data || []) {
        const boardName = (row as any).kanban_boards?.name || 'Kanban'
        const colName = (row as any).kanban_columns?.name || ''
        events.push({
          type: 'kanban',
          title: `${boardName}: ${colName}`,
          subtitle: row.title || undefined,
          timestamp: row.updated_at || row.created_at,
        })
      }

      // Sort by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return events
    },
    enabled: !!contactId,
    staleTime: 30_000,
  })
}
