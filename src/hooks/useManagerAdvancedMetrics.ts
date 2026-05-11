// Dashboard do Gestor — Fase 2: métricas avançadas
// Consome 4 RPCs em paralelo: response time P50/P95, conversas abandonadas,
// demanda vs cobertura por hora, conversão por origem.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';

export interface ResponseTimePercentiles {
  p50Seconds: number;
  p95Seconds: number;
  sampleSize: number;
}

export interface AbandonedConversation {
  conversationId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  lastIncomingAt: string;
  hoursWaiting: number;
}

export interface HourBucket {
  hour: number;
  demand: number;
  coverage: number;
}

export interface ConversionByOrigin {
  origin: string;
  totalLeads: number;
  fechadas: number;
  conversionPct: number;
}

export interface UnansweredLead {
  conversationId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  firstIncomingAt: string;
  hoursWaiting: number;
}

export interface ActiveQuote {
  conversationId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assignedTo: string | null;
  lastMessageAt: string;
  hoursSinceLastMsg: number;
}

export interface ManagerAdvancedMetrics {
  responseTime: ResponseTimePercentiles;
  abandoned: AbandonedConversation[];
  hours: HourBucket[];
  conversionByOrigin: ConversionByOrigin[];
  unanswered: UnansweredLead[];
  activeQuotes: ActiveQuote[];
}

export function useManagerAdvancedMetrics(
  instanceId: string | null,
  periodDays = 30,
  abandonedHoursThreshold = 24,
) {
  return useQuery({
    queryKey: ['manager-advanced', instanceId, periodDays, abandonedHoursThreshold],
    enabled: !!instanceId,
    staleTime: 60_000,
    queryFn: async (): Promise<ManagerAdvancedMetrics> => {
      if (!instanceId) throw new Error('instanceId required');
      const now = new Date();
      const start = startOfDay(subDays(now, periodDays - 1)).toISOString();
      const end = new Date(now.getTime() + 1000).toISOString();

      const [rtRes, abRes, hrRes, coRes, unRes, qtRes] = await Promise.all([
        supabase.rpc('get_response_time_percentiles', {
          p_instance_id: instanceId,
          p_start: start,
          p_end: end,
        }),
        supabase.rpc('get_abandoned_conversations', {
          p_instance_id: instanceId,
          p_hours_threshold: abandonedHoursThreshold,
        }),
        supabase.rpc('get_demand_vs_coverage_by_hour', {
          p_instance_id: instanceId,
          p_start: start,
          p_end: end,
        }),
        supabase.rpc('get_conversion_by_origin', {
          p_instance_id: instanceId,
          p_start: start,
          p_end: end,
        }),
        supabase.rpc('get_unanswered_first_messages', {
          p_instance_id: instanceId,
          p_days_lookback: periodDays,
        }),
        supabase.rpc('get_active_quotes', { p_instance_id: instanceId }),
      ]);

      const rtRow = rtRes.data?.[0];
      const responseTime: ResponseTimePercentiles = {
        p50Seconds: Number(rtRow?.p50_seconds ?? 0),
        p95Seconds: Number(rtRow?.p95_seconds ?? 0),
        sampleSize: Number(rtRow?.sample_size ?? 0),
      };

      const abandoned: AbandonedConversation[] = (abRes.data || []).map((r) => ({
        conversationId: r.conversation_id,
        contactId: r.contact_id,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        lastIncomingAt: r.last_incoming_at,
        hoursWaiting: Number(r.hours_waiting),
      }));

      const hours: HourBucket[] = (hrRes.data || []).map((r) => ({
        hour: Number(r.hour),
        demand: Number(r.demand),
        coverage: Number(r.coverage),
      }));

      const conversionByOrigin: ConversionByOrigin[] = (coRes.data || []).map((r) => ({
        origin: r.origin,
        totalLeads: Number(r.total_leads),
        fechadas: Number(r.fechadas),
        conversionPct: Number(r.conversion_pct),
      }));

      const unanswered: UnansweredLead[] = (unRes.data || []).map((r) => ({
        conversationId: r.conversation_id,
        contactId: r.contact_id,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        firstIncomingAt: r.first_incoming_at,
        hoursWaiting: Number(r.hours_waiting),
      }));

      const activeQuotes: ActiveQuote[] = (qtRes.data || []).map((r) => ({
        conversationId: r.conversation_id,
        contactId: r.contact_id,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        assignedTo: r.assigned_to,
        lastMessageAt: r.last_message_at,
        hoursSinceLastMsg: Number(r.hours_since_last_msg),
      }));

      return { responseTime, abandoned, hours, conversionByOrigin, unanswered, activeQuotes };
    },
  });
}
