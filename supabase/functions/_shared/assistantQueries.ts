/**
 * M19-S5: Biblioteca de 20 intents parametrizados para o assistente IA.
 *
 * Cada intent executa queries via PostgREST (Supabase client) — SEM SQL raw.
 * Todas as queries filtram por instance_id (multi-tenant obrigatório).
 *
 * Uso:
 *   import { executeIntent, AVAILABLE_INTENTS } from '../_shared/assistantQueries.ts'
 *   const result = await executeIntent(supabase, 'leads_count', instanceId, { period: '30d' })
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type FormatType = 'number' | 'table' | 'chart' | 'comparison'

export interface IntentResult {
  data: Record<string, unknown>[] | Record<string, unknown>
  format_type: FormatType
  summary_hint: string
}

export interface IntentParams {
  period?: string      // 'today' | '7d' | '30d' | '90d'
  seller_id?: string
  limit?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function periodToSince(period: string): string {
  const days: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 }
  const d = days[period] ?? 30
  return new Date(Date.now() - d * 86400000).toISOString()
}

function periodToSinceDate(period: string): string {
  return periodToSince(period).slice(0, 10)
}

// ── Intents ────────────────────────────────────────────────────────────────

async function leads_count(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const since = periodToSince(params.period ?? '30d')
  const { count, error } = await sb
    .from('v_lead_metrics' as any)
    .select('lead_id', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .gte('lead_created_at', since)
  if (error) throw error
  return {
    data: { count: count ?? 0 },
    format_type: 'number',
    summary_hint: 'Total de leads novos no período',
  }
}

async function leads_by_origin(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const since = periodToSince(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_lead_metrics' as any)
    .select('lead_id, origin')
    .eq('instance_id', instanceId)
    .gte('lead_created_at', since)
  if (error) throw error
  const rows = (data || []) as { origin: string }[]
  const grouped: Record<string, number> = {}
  for (const r of rows) {
    const key = r.origin || 'direto'
    grouped[key] = (grouped[key] ?? 0) + 1
  }
  const result = Object.entries(grouped)
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count)
  return { data: result, format_type: 'table', summary_hint: 'Leads por canal de origem' }
}

async function conversion_rate(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_conversion_funnel' as any)
    .select('stage, unique_leads')
    .eq('instance_id', instanceId)
    .gte('event_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as { stage: string; unique_leads: number }[]
  const byStage: Record<string, number> = {}
  for (const r of rows) byStage[r.stage] = (byStage[r.stage] ?? 0) + r.unique_leads
  const contact = byStage['contact'] ?? 0
  const conversion = byStage['conversion'] ?? 0
  const rate = contact > 0 ? Math.round((conversion / contact) * 1000) / 10 : 0
  return {
    data: { contact, qualification: byStage['qualification'] ?? 0, intention: byStage['intention'] ?? 0, conversion, rate_pct: rate },
    format_type: 'number',
    summary_hint: `Taxa de conversão: ${rate}% (${conversion} conversões de ${contact} contatos)`,
  }
}

async function top_sellers(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const limit = params.limit ?? 5
  const { data, error } = await sb
    .from('v_vendor_activity' as any)
    .select('seller_id, conversations_handled, resolved_count, avg_resolution_minutes')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as any[]
  const agg: Record<string, { conversations: number; resolved: number; totalMin: number; days: number }> = {}
  for (const r of rows) {
    const sid = r.seller_id
    if (!agg[sid]) agg[sid] = { conversations: 0, resolved: 0, totalMin: 0, days: 0 }
    agg[sid].conversations += r.conversations_handled ?? 0
    agg[sid].resolved += r.resolved_count ?? 0
    agg[sid].totalMin += r.avg_resolution_minutes ?? 0
    agg[sid].days += 1
  }
  const result = Object.entries(agg)
    .map(([seller_id, v]) => ({
      seller_id,
      conversations: v.conversations,
      resolved: v.resolved,
      resolution_rate: v.conversations > 0 ? Math.round((v.resolved / v.conversations) * 100) : 0,
      avg_resolution_minutes: v.days > 0 ? Math.round(v.totalMin / v.days) : 0,
    }))
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, limit)
  return { data: result, format_type: 'table', summary_hint: `Top ${limit} vendedores por conversas resolvidas` }
}

async function worst_sellers(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const limit = params.limit ?? 5
  const { data, error } = await sb
    .from('v_vendor_activity' as any)
    .select('seller_id, conversations_handled, resolved_count, avg_resolution_minutes')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as any[]
  const agg: Record<string, { conversations: number; resolved: number; totalMin: number; days: number }> = {}
  for (const r of rows) {
    const sid = r.seller_id
    if (!agg[sid]) agg[sid] = { conversations: 0, resolved: 0, totalMin: 0, days: 0 }
    agg[sid].conversations += r.conversations_handled ?? 0
    agg[sid].resolved += r.resolved_count ?? 0
    agg[sid].totalMin += r.avg_resolution_minutes ?? 0
    agg[sid].days += 1
  }
  const result = Object.entries(agg)
    .map(([seller_id, v]) => ({
      seller_id,
      conversations: v.conversations,
      resolved: v.resolved,
      resolution_rate: v.conversations > 0 ? Math.round((v.resolved / v.conversations) * 100) : 0,
      avg_resolution_minutes: v.days > 0 ? Math.round(v.totalMin / v.days) : 0,
    }))
    .sort((a, b) => a.resolution_rate - b.resolution_rate)
    .slice(0, limit)
  return { data: result, format_type: 'table', summary_hint: `${limit} vendedores com menor taxa de resolução` }
}

async function handoff_rate(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const [agentRes, handoffRes] = await Promise.all([
    sb.from('v_agent_performance' as any).select('responses_sent, handoffs').eq('instance_id', instanceId).gte('activity_date', sinceDate),
    sb.from('v_handoff_details' as any).select('conversation_id').eq('instance_id', instanceId).gte('handoff_at', periodToSince(params.period ?? '30d')),
  ])
  if (agentRes.error) throw agentRes.error
  const agentRows = (agentRes.data || []) as any[]
  const totalResponses = agentRows.reduce((s: number, r: any) => s + (r.responses_sent ?? 0), 0)
  const totalHandoffs = agentRows.reduce((s: number, r: any) => s + (r.handoffs ?? 0), 0)
  const rate = (totalResponses + totalHandoffs) > 0
    ? Math.round((totalHandoffs / (totalResponses + totalHandoffs)) * 1000) / 10
    : 0
  return {
    data: { total_responses: totalResponses, total_handoffs: totalHandoffs, rate_pct: rate },
    format_type: 'number',
    summary_hint: `Taxa de transbordo: ${rate}% (${totalHandoffs} de ${totalResponses + totalHandoffs} interações)`,
  }
}

async function handoff_reasons(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const since = periodToSince(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_handoff_details' as any)
    .select('handoff_reason, conversation_id')
    .eq('instance_id', instanceId)
    .gte('handoff_at', since)
  if (error) throw error
  const rows = (data || []) as { handoff_reason: string }[]
  const grouped: Record<string, number> = {}
  for (const r of rows) {
    const key = r.handoff_reason || 'não informado'
    grouped[key] = (grouped[key] ?? 0) + 1
  }
  const result = Object.entries(grouped)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
  return { data: result, format_type: 'table', summary_hint: 'Motivos de transbordo ordenados por frequência' }
}

async function agent_cost(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_agent_performance' as any)
    .select('cost_usd_approx, total_tokens')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as any[]
  const totalCost = rows.reduce((s: number, r: any) => s + (Number(r.cost_usd_approx) || 0), 0)
  const totalTokens = rows.reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0)
  return {
    data: { cost_usd: Math.round(totalCost * 100) / 100, total_tokens: totalTokens },
    format_type: 'number',
    summary_hint: `Custo total da IA: $${(Math.round(totalCost * 100) / 100).toFixed(2)} (${totalTokens.toLocaleString()} tokens)`,
  }
}

async function agent_efficiency(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_agent_performance' as any)
    .select('activity_date, responses_sent, handoffs, errors, shadow_events, avg_response_latency_ms, cost_usd_approx')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
    .order('activity_date', { ascending: false })
    .limit(30)
  if (error) throw error
  return { data: (data || []) as any, format_type: 'table', summary_hint: 'Performance diária do agente IA' }
}

async function ia_vs_vendor(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_ia_vs_vendor' as any)
    .select('ia_responses, ia_handoffs, ia_coverage_pct, ia_avg_latency_ms, ia_cost_usd, vendor_conversations, vendor_resolved, vendor_avg_resolution_minutes, vendor_active_sellers')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as any[]
  const ia = {
    total_responses: rows.reduce((s: number, r: any) => s + (r.ia_responses ?? 0), 0),
    total_handoffs: rows.reduce((s: number, r: any) => s + (r.ia_handoffs ?? 0), 0),
    avg_coverage_pct: rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + (Number(r.ia_coverage_pct) ?? 0), 0) / rows.length) : 0,
    avg_latency_ms: rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + (r.ia_avg_latency_ms ?? 0), 0) / rows.length) : 0,
    total_cost_usd: Math.round(rows.reduce((s: number, r: any) => s + (Number(r.ia_cost_usd) ?? 0), 0) * 100) / 100,
  }
  const vendor = {
    total_conversations: rows.reduce((s: number, r: any) => s + (r.vendor_conversations ?? 0), 0),
    total_resolved: rows.reduce((s: number, r: any) => s + (r.vendor_resolved ?? 0), 0),
    avg_resolution_minutes: rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + (Number(r.vendor_avg_resolution_minutes) ?? 0), 0) / rows.length) : 0,
    active_sellers: Math.max(...rows.map((r: any) => r.vendor_active_sellers ?? 0), 0),
  }
  return { data: { ia, vendor }, format_type: 'comparison', summary_hint: 'Comparativo IA vs vendedores humanos' }
}

async function nps_average(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const since = periodToSince(params.period ?? '30d')
  const { data: polls, error: pe } = await sb
    .from('poll_messages' as any)
    .select('id')
    .eq('instance_id', instanceId)
    .eq('is_nps', true)
    .gte('created_at', since)
  if (pe) throw pe
  const pollIds = ((polls || []) as any[]).map(p => p.id)
  if (pollIds.length === 0) return { data: { nps_avg: null, total_responses: 0 }, format_type: 'number', summary_hint: 'Sem respostas NPS no período' }
  const { data: responses, error: re } = await sb
    .from('poll_responses' as any)
    .select('score')
    .in('poll_message_id', pollIds)
  if (re) throw re
  const scores = ((responses || []) as any[]).map(r => r.score).filter((s: number) => s != null)
  const avg = scores.length > 0 ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : null
  return { data: { nps_avg: avg, total_responses: scores.length }, format_type: 'number', summary_hint: `NPS médio: ${avg ?? 'N/A'} (${scores.length} respostas)` }
}

async function nps_by_seller(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const since = periodToSince(params.period ?? '30d')
  const { data: polls, error: pe } = await sb
    .from('poll_messages' as any)
    .select('id, conversation_id')
    .eq('instance_id', instanceId)
    .eq('is_nps', true)
    .gte('created_at', since)
  if (pe) throw pe
  if (!polls || polls.length === 0) return { data: [], format_type: 'table', summary_hint: 'Sem NPS no período' }
  const pollMap = new Map<string, string>()
  for (const p of polls as any[]) pollMap.set(p.id, p.conversation_id)
  const { data: responses, error: re } = await sb
    .from('poll_responses' as any)
    .select('poll_message_id, score')
    .in('poll_message_id', [...pollMap.keys()])
  if (re) throw re
  const convIds = [...new Set([...pollMap.values()])]
  const { data: convs, error: ce } = await sb
    .from('conversations' as any)
    .select('id, assigned_to')
    .in('id', convIds)
  if (ce) throw ce
  const convSeller = new Map<string, string>()
  for (const c of (convs || []) as any[]) if (c.assigned_to) convSeller.set(c.id, c.assigned_to)
  const sellerScores: Record<string, number[]> = {}
  for (const r of (responses || []) as any[]) {
    const convId = pollMap.get(r.poll_message_id)
    if (!convId) continue
    const sellerId = convSeller.get(convId)
    if (!sellerId) continue
    if (!sellerScores[sellerId]) sellerScores[sellerId] = []
    sellerScores[sellerId].push(r.score)
  }
  const result = Object.entries(sellerScores)
    .map(([seller_id, scores]) => ({
      seller_id,
      nps_avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      total_responses: scores.length,
    }))
    .sort((a, b) => b.nps_avg - a.nps_avg)
  return { data: result, format_type: 'table', summary_hint: 'NPS médio por vendedor' }
}

async function lead_score_distribution(
  sb: SupabaseClient, instanceId: string, _params: IntentParams
): Promise<IntentResult> {
  const { data: inboxes, error: ie } = await sb
    .from('inboxes' as any).select('id').eq('instance_id', instanceId)
  if (ie) throw ie
  const inboxIds = ((inboxes || []) as any[]).map(i => i.id)
  if (inboxIds.length === 0) return { data: [], format_type: 'chart', summary_hint: 'Sem leads nesta instância' }
  const { data: convs, error: ce } = await sb
    .from('conversations' as any).select('contact_id').in('inbox_id', inboxIds)
  if (ce) throw ce
  const contactIds = [...new Set(((convs || []) as any[]).map(c => c.contact_id))]
  if (contactIds.length === 0) return { data: [], format_type: 'chart', summary_hint: 'Sem leads nesta instância' }
  const { data: leads, error: le } = await sb
    .from('lead_profiles' as any).select('current_score').in('contact_id', contactIds)
  if (le) throw le
  const buckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
  for (const l of (leads || []) as any[]) {
    const s = l.current_score ?? 50
    if (s <= 20) buckets['0-20']++
    else if (s <= 40) buckets['21-40']++
    else if (s <= 60) buckets['41-60']++
    else if (s <= 80) buckets['61-80']++
    else buckets['81-100']++
  }
  const result = Object.entries(buckets).map(([range, count]) => ({ range, count }))
  return { data: result, format_type: 'chart', summary_hint: 'Distribuição de lead score por faixa' }
}

async function hot_leads(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const limit = params.limit ?? 10
  const { data: inboxes, error: ie } = await sb
    .from('inboxes' as any).select('id').eq('instance_id', instanceId)
  if (ie) throw ie
  const inboxIds = ((inboxes || []) as any[]).map(i => i.id)
  if (inboxIds.length === 0) return { data: [], format_type: 'table', summary_hint: 'Sem leads nesta instância' }
  const { data: convs, error: ce } = await sb
    .from('conversations' as any).select('contact_id').in('inbox_id', inboxIds)
  if (ce) throw ce
  const contactIds = [...new Set(((convs || []) as any[]).map(c => c.contact_id))]
  if (contactIds.length === 0) return { data: [], format_type: 'table', summary_hint: 'Sem leads nesta instância' }
  const { data: leads, error: le } = await sb
    .from('lead_profiles' as any)
    .select('id, full_name, current_score, tags, origin')
    .in('contact_id', contactIds)
    .gte('current_score', 70)
    .order('current_score', { ascending: false })
    .limit(limit)
  if (le) throw le
  return { data: (leads || []) as any, format_type: 'table', summary_hint: `${(leads || []).length} leads quentes (score ≥ 70)` }
}

async function funnel_stages(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_conversion_funnel' as any)
    .select('stage, unique_leads')
    .eq('instance_id', instanceId)
    .gte('event_date', sinceDate)
  if (error) throw error
  const rows = (data || []) as any[]
  const byStage: Record<string, number> = {}
  for (const r of rows) byStage[r.stage] = (byStage[r.stage] ?? 0) + r.unique_leads
  const order = ['contact', 'qualification', 'intention', 'conversion']
  const result = order.map(stage => ({ stage, unique_leads: byStage[stage] ?? 0 }))
  return { data: result, format_type: 'chart', summary_hint: 'Leads por etapa do funil de conversão' }
}

async function resolution_time(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_vendor_activity' as any)
    .select('avg_resolution_minutes')
    .eq('instance_id', instanceId)
    .gte('activity_date', sinceDate)
    .not('avg_resolution_minutes', 'is', null)
  if (error) throw error
  const rows = (data || []) as any[]
  const avg = rows.length > 0
    ? Math.round(rows.reduce((s: number, r: any) => s + (Number(r.avg_resolution_minutes) || 0), 0) / rows.length)
    : 0
  return {
    data: { avg_resolution_minutes: avg, data_points: rows.length },
    format_type: 'number',
    summary_hint: `Tempo médio de resolução: ${avg} minutos`,
  }
}

async function pending_conversations(
  sb: SupabaseClient, instanceId: string, _params: IntentParams
): Promise<IntentResult> {
  const { data: inboxes, error: ie } = await sb
    .from('inboxes' as any).select('id').eq('instance_id', instanceId)
  if (ie) throw ie
  const inboxIds = ((inboxes || []) as any[]).map(i => i.id)
  if (inboxIds.length === 0) return { data: { pending: 0 }, format_type: 'number', summary_hint: '0 conversas pendentes' }
  const { data, error } = await sb
    .from('conversations' as any)
    .select('id', { count: 'exact' })
    .in('inbox_id', inboxIds)
    .eq('status', 'pending')
  if (error) throw error
  const count = data?.length ?? 0
  return { data: { pending: count }, format_type: 'number', summary_hint: `${count} conversas pendentes agora` }
}

async function daily_trend(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('shadow_metrics' as any)
    .select('date, total_leads, total_conversations, total_handoffs, total_resolved')
    .eq('instance_id', instanceId)
    .eq('period', 'daily')
    .gte('date', sinceDate)
    .order('date', { ascending: true })
  if (error) throw error
  return { data: (data || []) as any, format_type: 'chart', summary_hint: 'Tendência diária de métricas' }
}

async function goals_progress(
  sb: SupabaseClient, instanceId: string, _params: IntentParams
): Promise<IntentResult> {
  const { data, error } = await sb
    .from('instance_goals' as any)
    .select('metric_key, target_value, period')
    .eq('instance_id', instanceId)
  if (error) throw error
  return { data: (data || []) as any, format_type: 'table', summary_hint: 'Metas configuradas para esta instância' }
}

async function seller_detail(
  sb: SupabaseClient, instanceId: string, params: IntentParams
): Promise<IntentResult> {
  if (!params.seller_id) return { data: { error: 'seller_id não informado' }, format_type: 'number', summary_hint: 'Informe o ID do vendedor' }
  const sinceDate = periodToSinceDate(params.period ?? '30d')
  const { data, error } = await sb
    .from('v_vendor_activity' as any)
    .select('activity_date, conversations_handled, resolved_count, pending_count, avg_resolution_minutes, unique_contacts')
    .eq('instance_id', instanceId)
    .eq('seller_id', params.seller_id)
    .gte('activity_date', sinceDate)
    .order('activity_date', { ascending: false })
  if (error) throw error
  return { data: (data || []) as any, format_type: 'table', summary_hint: `Atividade detalhada do vendedor ${params.seller_id}` }
}

// ── Registry ───────────────────────────────────────────────────────────────

type IntentFn = (sb: SupabaseClient, instanceId: string, params: IntentParams) => Promise<IntentResult>

const INTENT_REGISTRY: Record<string, IntentFn> = {
  leads_count,
  leads_by_origin,
  conversion_rate,
  top_sellers,
  worst_sellers,
  handoff_rate,
  handoff_reasons,
  agent_cost,
  agent_efficiency,
  ia_vs_vendor,
  nps_average,
  nps_by_seller,
  lead_score_distribution,
  hot_leads,
  funnel_stages,
  resolution_time,
  pending_conversations,
  daily_trend,
  goals_progress,
  seller_detail,
}

export const AVAILABLE_INTENTS = Object.keys(INTENT_REGISTRY)

export async function executeIntent(
  sb: SupabaseClient,
  intent: string,
  instanceId: string,
  params: IntentParams = {}
): Promise<IntentResult | null> {
  const fn = INTENT_REGISTRY[intent]
  if (!fn) return null
  return fn(sb, instanceId, params)
}
