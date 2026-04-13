import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

/**
 * aggregate-metrics — Consolida shadow_extractions em shadow_metrics.
 *
 * Modos:
 *   daily (default) — processa extrações do dia anterior, insere/atualiza shadow_metrics daily
 *   daily_consolidation — agrega diários em weekly/monthly
 *
 * Chamado via cron:
 *   hourly  (0 * * * *)  → mode=daily
 *   daily   (30 0 * * *) → mode=daily_consolidation
 *
 * Fallback: se shadow_extractions vazia, usa ai_agent_logs.
 */

const supabase = createServiceClient()
const log = createLogger('aggregate-metrics')

// Custo estimado por token (gpt-4.1-mini)
const COST_INPUT_PER_TOKEN  = 0.0000004   // $0.40/1M
const COST_OUTPUT_PER_TOKEN = 0.0000016   // $1.60/1M

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AggregateBody {
  mode?: 'daily' | 'daily_consolidation'
  instance_id?: string  // se omitido, processa todas as instâncias
  date?: string         // YYYY-MM-DD, default = ontem
}

interface MetricsPayload {
  leads_count:               number
  conversations_count:       number
  messages_count:            number
  shadow_extractions_count:  number
  handoffs_count:            number
  resolved_count:            number
  avg_resolution_minutes:    number | null
  ia_responses:              number
  ia_tokens:                 number
  ia_cost_usd:               number
  avg_response_latency_ms:   number | null
  objections_by_type:        Record<string, number>
  top_tags:                  string[]
  shadow_source:             'extractions' | 'ai_agent_logs' | 'none'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function yesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function dateRange(dateStr: string): { start: string; end: string } {
  return {
    start: `${dateStr}T00:00:00.000Z`,
    end:   `${dateStr}T23:59:59.999Z`,
  }
}

/** Extrai instâncias ativas (com ai_agent configurado) */
async function getActiveInstances(instanceId?: string): Promise<string[]> {
  let query = supabase.from('ai_agents').select('instance_id').eq('enabled', true)
  if (instanceId) query = query.eq('instance_id', instanceId)
  const { data, error } = await query
  if (error) throw new Error(`getActiveInstances: ${error.message}`)
  return (data ?? []).map((r) => r.instance_id as string)
}

// ─────────────────────────────────────────────────────────────────────────────
// T3: Daily aggregation — shadow_extractions → shadow_metrics
// ─────────────────────────────────────────────────────────────────────────────

async function aggregateDaily(instanceId: string, dateStr: string): Promise<MetricsPayload> {
  const { start, end } = dateRange(dateStr)

  // 1. shadow_extractions do dia
  const { data: extractions } = await supabase
    .from('shadow_extractions')
    .select('dimension, extracted_data, processing_cost_brl, conversation_id')
    .eq('instance_id', instanceId)
    .gte('processed_at', start)
    .lte('processed_at', end)

  const hasShadow = (extractions ?? []).length > 0

  // 2. ai_agent_logs do dia (independente do shadow)
  const { data: agentLogs } = await supabase
    .from('ai_agent_logs')
    .select('event, input_tokens, output_tokens, latency_ms, conversation_id, metadata')
    .eq('agent_id',
      // subquery via join não disponível em PostgREST direto — usamos agent_id via ai_agents
      // Abordagem: buscar agent_id primeiro
      (await supabase
        .from('ai_agents')
        .select('id')
        .eq('instance_id', instanceId)
        .maybeSingle()
      ).data?.id ?? '00000000-0000-0000-0000-000000000000'
    )
    .gte('created_at', start)
    .lte('created_at', end)

  const logs = agentLogs ?? []

  // 3. Conversas do dia — via inboxes da instância (join explícito, dois passos)
  const { data: inboxRows } = await supabase
    .from('inboxes')
    .select('id')
    .eq('instance_id', instanceId)

  const inboxIds = (inboxRows ?? []).map((r) => r.id as string)

  const { data: convRows } = inboxIds.length > 0
    ? await supabase
        .from('conversations')
        .select('id, assigned_to, status, updated_at, created_at')
        .in('inbox_id', inboxIds)
        .gte('created_at', start)
        .lte('created_at', end)
    : { data: [] }

  const convs = convRows ?? []

  // 4. Calcular métricas de agent logs
  const iaResponses  = logs.filter((l) => l.event === 'response_sent').length
  const handoffs     = logs.filter((l) => l.event === 'handoff_to_human').length
  const totalTokens  = logs.reduce((s, l) => s + (l.input_tokens ?? 0) + (l.output_tokens ?? 0), 0)
  const totalCostUsd = logs.reduce(
    (s, l) => s + (l.input_tokens ?? 0) * COST_INPUT_PER_TOKEN + (l.output_tokens ?? 0) * COST_OUTPUT_PER_TOKEN,
    0
  )
  const responseLogs = logs.filter((l) => l.event === 'response_sent' && l.latency_ms)
  const avgLatency   = responseLogs.length > 0
    ? Math.round(responseLogs.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / responseLogs.length)
    : null

  // 5. Métricas de conversas
  const resolvedConvs    = convs.filter((c) => c.status === 'resolved')
  const avgResolutionMin = resolvedConvs.length > 0
    ? Math.round(
        resolvedConvs
          .filter((c) => c.updated_at)
          .reduce((s, c) => {
            // updated_at em conversas resolvidas é proxy de resolved_at (conversations não tem a coluna)
            const diffMs = new Date(c.updated_at as string).getTime() - new Date(c.created_at as string).getTime()
            return s + diffMs / 60000
          }, 0) / resolvedConvs.length
      )
    : null

  // 6. Extração de tags/objeções do shadow
  const objectionsByType: Record<string, number> = {}
  const allTags: string[] = []

  if (hasShadow) {
    for (const ext of extractions ?? []) {
      const data = (ext.extracted_data ?? {}) as Record<string, unknown>
      if (ext.dimension === 'objection' && data.type) {
        const t = String(data.type)
        objectionsByType[t] = (objectionsByType[t] ?? 0) + 1
      }
      // Coleta tags dos extractions de lead
      if (ext.dimension === 'lead' && Array.isArray(data.tags)) {
        allTags.push(...(data.tags as string[]))
      }
    }
  }

  // Top 10 tags mais frequentes
  const tagFreq: Record<string, number> = {}
  for (const t of allTags) tagFreq[t] = (tagFreq[t] ?? 0) + 1
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag)

  // T7: Atualiza lead scores baseado nas extrações shadow do dia
  if (hasShadow) {
    try {
      await updateLeadScores(instanceId, extractions ?? [])
    } catch (err) {
      log.error('updateLeadScores failed', { instanceId, error: (err as Error).message })
    }
  }

  // T8: Registra transições de etapa no funil de conversão
  if (hasShadow) {
    try {
      await recordFunnelEvents(instanceId, extractions ?? [])
    } catch (err) {
      log.error('recordFunnelEvents failed', { instanceId, error: (err as Error).message })
    }
  }

  return {
    leads_count:               new Set(convs.map((c) => c.id)).size, // unique conversations as proxy
    conversations_count:       convs.length,
    messages_count:            logs.length,
    shadow_extractions_count:  (extractions ?? []).length,
    handoffs_count:            handoffs,
    resolved_count:            resolvedConvs.length,
    avg_resolution_minutes:    avgResolutionMin,
    ia_responses:              iaResponses,
    ia_tokens:                 totalTokens,
    ia_cost_usd:               Number(totalCostUsd.toFixed(8)),
    avg_response_latency_ms:   avgLatency,
    objections_by_type:        objectionsByType,
    top_tags:                  topTags,
    shadow_source:             hasShadow ? 'extractions' : logs.length > 0 ? 'ai_agent_logs' : 'none',
  }
}

/** Salva métricas diárias em shadow_metrics (upsert por instância + data) */
async function saveDailyMetrics(
  instanceId: string,
  dateStr: string,
  metrics: MetricsPayload,
  sellerId: string | null = null
): Promise<void> {
  // Índices parciais garantem unicidade — usamos upsert manual via delete+insert
  // (PostgREST não suporta onConflict com índices parciais diretamente)
  await supabase
    .from('shadow_metrics')
    .delete()
    .eq('instance_id', instanceId)
    .eq('period_type', 'daily')
    .eq('period_date', dateStr)
    .is('seller_id', null)  // global da instância

  const { error } = await supabase
    .from('shadow_metrics')
    .insert({
      instance_id:  instanceId,
      seller_id:    sellerId,
      period_type:  'daily',
      period_date:  dateStr,
      metrics,
      computed_at:  new Date().toISOString(),
    })

  if (error) throw new Error(`saveDailyMetrics: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// T4: Consolidação weekly/monthly — agrega diários
// ─────────────────────────────────────────────────────────────────────────────

async function consolidatePeriod(
  instanceId: string,
  periodType: 'weekly' | 'monthly',
  dateStr: string
): Promise<void> {
  const targetDate = new Date(dateStr)

  let start: Date
  let end: Date

  if (periodType === 'weekly') {
    // ISO week: segunda a domingo
    const day = targetDate.getUTCDay() || 7 // 0=domingo→7
    start = new Date(targetDate)
    start.setUTCDate(targetDate.getUTCDate() - day + 1)
    end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
  } else {
    // Mensal: primeiro ao último dia do mês
    start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1))
    end   = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0))
  }

  const startStr = start.toISOString().slice(0, 10)
  const endStr   = end.toISOString().slice(0, 10)

  const { data: dailies } = await supabase
    .from('shadow_metrics')
    .select('metrics')
    .eq('instance_id', instanceId)
    .eq('period_type', 'daily')
    .is('seller_id', null)
    .gte('period_date', startStr)
    .lte('period_date', endStr)

  if (!dailies || dailies.length === 0) return

  // Soma métricas numéricas, mantém objetos como merge
  const consolidated: Record<string, number | null | Record<string, number> | string[]> = {
    leads_count: 0, conversations_count: 0, messages_count: 0,
    shadow_extractions_count: 0, handoffs_count: 0, resolved_count: 0,
    ia_responses: 0, ia_tokens: 0, ia_cost_usd: 0,
    days_with_data: dailies.length,
  }
  const latencies: number[] = []
  const resolutions: number[] = []
  const objAgg: Record<string, number> = {}
  const tagFreq: Record<string, number> = {}

  for (const { metrics } of dailies) {
    const m = metrics as MetricsPayload
    ;(consolidated.leads_count as number)              += m.leads_count ?? 0
    ;(consolidated.conversations_count as number)      += m.conversations_count ?? 0
    ;(consolidated.messages_count as number)           += m.messages_count ?? 0
    ;(consolidated.shadow_extractions_count as number) += m.shadow_extractions_count ?? 0
    ;(consolidated.handoffs_count as number)           += m.handoffs_count ?? 0
    ;(consolidated.resolved_count as number)           += m.resolved_count ?? 0
    ;(consolidated.ia_responses as number)             += m.ia_responses ?? 0
    ;(consolidated.ia_tokens as number)                += m.ia_tokens ?? 0
    ;(consolidated.ia_cost_usd as number)              += m.ia_cost_usd ?? 0

    if (m.avg_response_latency_ms != null) latencies.push(m.avg_response_latency_ms)
    if (m.avg_resolution_minutes != null)  resolutions.push(m.avg_resolution_minutes)

    for (const [k, v] of Object.entries(m.objections_by_type ?? {})) {
      objAgg[k] = (objAgg[k] ?? 0) + (v as number)
    }
    for (const tag of m.top_tags ?? []) {
      tagFreq[tag] = (tagFreq[tag] ?? 0) + 1
    }
  }

  consolidated.avg_response_latency_ms = latencies.length > 0
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : null
  consolidated.avg_resolution_minutes = resolutions.length > 0
    ? Math.round(resolutions.reduce((s, v) => s + v, 0) / resolutions.length)
    : null
  consolidated.objections_by_type = objAgg
  consolidated.top_tags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag)
  consolidated.period_start = startStr
  consolidated.period_end   = endStr

  // Upsert: delete + insert (mesmo padrão do daily)
  await supabase
    .from('shadow_metrics')
    .delete()
    .eq('instance_id', instanceId)
    .eq('period_type', periodType)
    .eq('period_date', startStr)
    .is('seller_id', null)

  await supabase
    .from('shadow_metrics')
    .insert({
      instance_id:  instanceId,
      seller_id:    null,
      period_type:  periodType,
      period_date:  startStr,
      metrics:      consolidated,
      computed_at:  new Date().toISOString(),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// T7: Lead score — calcula delta por tags shadow e persiste em lead_score_history
// ─────────────────────────────────────────────────────────────────────────────

function calculateScoreDelta(tags: string[]): number {
  let delta = 0
  for (const tag of tags) {
    if      (tag === 'intencao:alta')               delta += 15
    else if (tag === 'intencao:media')              delta += 8
    else if (tag === 'intencao:baixa')              delta += 2
    else if (tag.startsWith('conversao:comprou'))   delta += 30
    else if (tag.startsWith('conversao:converteu')) delta += 25
    else if (tag.startsWith('conversao:'))          delta += 10
    else if (tag.startsWith('objecao:'))            delta -= 5
    else if (tag.startsWith('motivo_perda:'))       delta -= 20
    else if (tag.startsWith('concorrente:'))        delta -= 5
  }
  return delta
}

type ExtractionRow = {
  dimension: string
  extracted_data: unknown
  conversation_id: string | null
}

async function updateLeadScores(instanceId: string, extractions: ExtractionRow[]): Promise<void> {
  const leadExts = extractions.filter((e) => e.dimension === 'lead' && e.conversation_id)
  if (leadExts.length === 0) return

  const convIds = [...new Set(leadExts.map((e) => e.conversation_id as string))]

  const { data: convRows } = await supabase
    .from('conversations').select('id, contact_id').in('id', convIds)
  const convToContact = new Map((convRows ?? []).map((c) => [c.id as string, c.contact_id as string]))

  const contactIds = [...new Set([...convToContact.values()].filter(Boolean))]
  if (contactIds.length === 0) return

  const { data: lpRows } = await supabase
    .from('lead_profiles').select('id, contact_id, current_score').in('contact_id', contactIds)
  const contactToLp = new Map((lpRows ?? []).map((lp) => [lp.contact_id as string, lp]))

  // Agrega deltas por lead (pode haver múltiplas extrações por lead no dia)
  const lpDeltas = new Map<string, { delta: number; tags: string[]; convId: string; current: number }>()

  for (const ext of leadExts) {
    const data  = (ext.extracted_data ?? {}) as Record<string, unknown>
    const tags  = Array.isArray(data.tags) ? (data.tags as string[]) : []
    const delta = calculateScoreDelta(tags)
    if (delta === 0) continue

    const contactId = convToContact.get(ext.conversation_id as string)
    if (!contactId) continue
    const lp = contactToLp.get(contactId)
    if (!lp) continue

    const relevantTags = tags.filter((t) =>
      t.startsWith('intencao:') || t.startsWith('conversao:') ||
      t.startsWith('objecao:')  || t.startsWith('motivo_perda:')
    )
    const lpId = lp.id as string
    const existing = lpDeltas.get(lpId)
    if (existing) {
      existing.delta += delta
      existing.tags.push(...relevantTags)
    } else {
      lpDeltas.set(lpId, {
        delta,
        tags: relevantTags,
        convId:  ext.conversation_id as string,
        current: (lp.current_score as number) ?? 50,
      })
    }
  }

  for (const [lpId, { delta, tags, convId, current }] of lpDeltas) {
    const scoreAfter = Math.max(0, Math.min(100, current + delta))
    await supabase.from('lead_profiles').update({ current_score: scoreAfter }).eq('id', lpId)
    await supabase.from('lead_score_history').insert({
      lead_id:         lpId,
      conversation_id: convId,
      score_delta:     delta,
      reason:          tags.length > 0 ? `shadow: ${tags.join(', ')}` : 'shadow_aggregate',
      score_after:     scoreAfter,
      metadata:        { instance_id: instanceId },
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T8: Funil de conversão — detecta etapa e registra em conversion_funnel_events
// ─────────────────────────────────────────────────────────────────────────────

function detectFunnelStage(tags: string[]): 'qualification' | 'intention' | 'conversion' | null {
  if (tags.some((t) => t.startsWith('conversao:')))                                  return 'conversion'
  if (tags.some((t) => t === 'intencao:alta' || t === 'intencao:media'))             return 'intention'
  if (tags.some((t) => t.startsWith('intencao:') || t.startsWith('dado_pessoal:'))) return 'qualification'
  return null  // 'contact' (trivial) não é registrado
}

async function recordFunnelEvents(instanceId: string, extractions: ExtractionRow[]): Promise<void> {
  const leadExts = extractions.filter((e) => e.dimension === 'lead' && e.conversation_id)
  if (leadExts.length === 0) return

  const convIds = [...new Set(leadExts.map((e) => e.conversation_id as string))]

  const { data: convRows } = await supabase
    .from('conversations').select('id, contact_id').in('id', convIds)
  const convToContact = new Map((convRows ?? []).map((c) => [c.id as string, c.contact_id as string]))

  const contactIds = [...new Set([...convToContact.values()].filter(Boolean))]
  if (contactIds.length === 0) return

  const { data: lpRows } = await supabase
    .from('lead_profiles').select('id, contact_id').in('contact_id', contactIds)
  const contactToLp = new Map((lpRows ?? []).map((lp) => [lp.contact_id as string, lp]))

  // Eventos já existentes (evita duplicatas)
  const { data: existing } = await supabase
    .from('conversion_funnel_events')
    .select('conversation_id, stage')
    .eq('instance_id', instanceId)
    .in('conversation_id', convIds)
  const seen = new Set((existing ?? []).map((e) => `${e.conversation_id}:${e.stage}`))

  const toInsert: Array<{ instance_id: string; lead_id: string; conversation_id: string; stage: string }> = []

  for (const ext of leadExts) {
    const data  = (ext.extracted_data ?? {}) as Record<string, unknown>
    const tags  = Array.isArray(data.tags) ? (data.tags as string[]) : []
    const stage = detectFunnelStage(tags)
    if (!stage) continue

    const convId    = ext.conversation_id as string
    const contactId = convToContact.get(convId)
    if (!contactId) continue
    const lp = contactToLp.get(contactId)
    if (!lp) continue

    const key = `${convId}:${stage}`
    if (seen.has(key)) continue
    seen.add(key)

    toInsert.push({ instance_id: instanceId, lead_id: lp.id as string, conversation_id: convId, stage })
  }

  if (toInsert.length > 0) {
    await supabase.from('conversion_funnel_events').insert(toInsert)
    log.info('Funnel events recorded', { instanceId, count: toInsert.length })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body: AggregateBody = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {}

    const mode       = body.mode ?? 'daily'
    const dateStr    = body.date ?? yesterday()
    const filterInst = body.instance_id

    const instances = await getActiveInstances(filterInst)
    if (instances.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, reason: 'no_active_instances' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ instance_id: string; status: string; error?: string }> = []

    for (const instanceId of instances) {
      try {
        if (mode === 'daily') {
          const metrics = await aggregateDaily(instanceId, dateStr)
          await saveDailyMetrics(instanceId, dateStr, metrics)
          results.push({ instance_id: instanceId, status: 'ok' })
          log.info('Daily aggregation done', { instanceId, dateStr, source: metrics.shadow_source })
        } else {
          // Consolida weekly e monthly para a data alvo
          await consolidatePeriod(instanceId, 'weekly', dateStr)
          await consolidatePeriod(instanceId, 'monthly', dateStr)
          results.push({ instance_id: instanceId, status: 'ok' })
          log.info('Period consolidation done', { instanceId, dateStr })
        }
      } catch (err) {
        const msg = (err as Error).message
        log.error('Instance aggregation failed', { instanceId, error: msg })
        results.push({ instance_id: instanceId, status: 'error', error: msg })
      }
    }

    return new Response(JSON.stringify({ ok: true, mode, date: dateStr, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log.error('aggregate-metrics fatal', { error: (err as Error).message })
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
