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

  // 3. Conversas do dia (via inboxes → instance_id)
  const { data: convRows } = await supabase
    .from('conversations')
    .select('id, assigned_to, status, resolved_at, created_at')
    .eq('inboxes.instance_id', instanceId)  // via join — PostgREST filter syntax
    .gte('created_at', start)
    .lte('created_at', end)

  // Fallback: join via inboxes
  const { data: convRowsDirect } = convRows
    ? { data: convRows }
    : await supabase
        .from('conversations')
        .select('id, assigned_to, status, resolved_at, created_at, inbox:inboxes!inner(instance_id)')
        .eq('inbox.instance_id', instanceId)
        .gte('created_at', start)
        .lte('created_at', end)

  const convs = convRowsDirect ?? []

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
          .filter((c) => c.resolved_at)
          .reduce((s, c) => {
            const diffMs = new Date(c.resolved_at as string).getTime() - new Date(c.created_at as string).getTime()
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
