import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

const supabase = createServiceClient()
const log = createLogger('e2e-scheduled')

// ─── Automated E2E scenarios (subset for quick runs ~2min) ───────────
interface AutoScenario {
  id: string
  name: string
  steps: { content: string; media_type?: string }[]
  expected: {
    tools_must_use?: string[]
    tools_must_not_use?: string[]
    should_handoff: boolean
  }
  preconditions?: { field: string; check: 'exists' | 'not_empty' }[]
}

const SCENARIOS: AutoScenario[] = [
  {
    id: 'suporte-horario',
    name: 'Pergunta sobre horário',
    steps: [{ content: 'Qual o horario de funcionamento de voces?' }],
    expected: { tools_must_not_use: ['handoff_to_human'], should_handoff: false },
    preconditions: [{ field: 'business_info.hours', check: 'exists' }],
  },
  {
    id: 'suporte-pagamento',
    name: 'Formas de pagamento',
    steps: [
      { content: 'Quais as formas de pagamento?' },
      { content: 'Parcelam no cartao?' },
    ],
    expected: { tools_must_not_use: ['handoff_to_human'], should_handoff: false },
    preconditions: [{ field: 'business_info.payment_methods', check: 'exists' }],
  },
  {
    id: 'pergunta-preco',
    name: 'Preço de produto',
    steps: [{ content: 'Qual o preco do saco de cimento?' }],
    expected: { tools_must_use: ['search_products'], should_handoff: false },
    preconditions: [{ field: 'products_count', check: 'not_empty' }],
  },
  {
    id: 'curioso-navegando',
    name: 'Navegando sem intenção',
    steps: [
      { content: 'To so olhando' },
      { content: 'Que tipo de produtos voces vendem?' },
      { content: 'Vou pensar, obrigado' },
    ],
    expected: { tools_must_not_use: ['handoff_to_human'], should_handoff: false },
  },
  {
    id: 'transbordo-direto',
    name: 'Pede atendente direto',
    steps: [
      { content: 'Oi' },
      { content: 'Quero falar com um humano' },
    ],
    expected: { tools_must_use: ['handoff_to_human'], should_handoff: true },
  },
  {
    id: 'objecao-momento',
    name: 'Não é o momento',
    steps: [
      { content: 'Minha obra começa mes que vem' },
      { content: 'So quero ter uma ideia de preco por enquanto' },
    ],
    expected: { tools_must_not_use: ['handoff_to_human'], should_handoff: false },
  },
]

// ─── Precondition checker ────────────────────────────────────────────
async function checkPreconditions(
  scenario: AutoScenario,
  agent: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  if (!scenario.preconditions?.length) return { ok: true }

  for (const pre of scenario.preconditions) {
    if (pre.field === 'products_count') {
      const { count } = await supabase
        .from('ai_agent_products')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
        .eq('enabled', true)
      if (!count || count === 0) {
        return { ok: false, reason: '0 produtos no catálogo' }
      }
      continue
    }

    // Handle dotted fields like "business_info.hours"
    const parts = pre.field.split('.')
    let value: unknown = agent
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p]
    }

    if (pre.check === 'exists' && (value === null || value === undefined)) {
      return { ok: false, reason: `${pre.field} não configurado` }
    }
    if (pre.check === 'not_empty' && (!value || (typeof value === 'string' && !value.trim()))) {
      return { ok: false, reason: `${pre.field} vazio` }
    }
  }

  return { ok: true }
}

// ─── Evaluate results vs expected ────────────────────────────────────
function evaluateResult(
  scenario: AutoScenario,
  results: Array<Record<string, unknown>>,
): { passed: boolean; reason?: string } {
  const allToolsUsed = new Set(results.flatMap((r) => (r.tools_used as string[]) || []))

  // Check tools that MUST be used
  if (scenario.expected.tools_must_use?.length) {
    const missing = scenario.expected.tools_must_use.filter(t => !allToolsUsed.has(t))
    if (missing.length) {
      return { passed: false, reason: `tools esperadas não usadas: ${missing.join(', ')}` }
    }
  }

  // Check tools that MUST NOT be used
  if (scenario.expected.tools_must_not_use?.length) {
    const unexpected = scenario.expected.tools_must_not_use.filter(t => allToolsUsed.has(t))
    if (unexpected.length) {
      return { passed: false, reason: `tools inesperadas: ${unexpected.join(', ')}` }
    }
  }

  // Check handoff expectation
  const didHandoff = allToolsUsed.has('handoff_to_human')
  if (scenario.expected.should_handoff && !didHandoff) {
    return { passed: false, reason: 'esperava handoff mas não aconteceu' }
  }
  if (!scenario.expected.should_handoff && didHandoff) {
    return { passed: false, reason: 'handoff inesperado' }
  }

  // Check all steps got a response
  const noResponse = results.filter((r) => !r.agent_response && !(r.agent_raw as Record<string, unknown>)?.greeting)
  if (noResponse.length) {
    return { passed: false, reason: `${noResponse.length} step(s) sem resposta do agente` }
  }

  return { passed: true }
}

// ─── Send WhatsApp alert ─────────────────────────────────────────────
async function sendWhatsAppAlert(
  instanceToken: string,
  alertNumber: string,
  message: string,
) {
  const jid = alertNumber.includes('@')
    ? alertNumber
    : `${alertNumber.replace(/\D/g, '')}@s.whatsapp.net`

  try {
    await fetchWithTimeout(`${UAZAPI_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ number: jid, text: message }),
    }, 15000)
    log.info('Alert sent', { alertNumber })
  } catch (e) {
    log.error('Failed to send alert', { error: e instanceof Error ? e.message : String(e) })
  }
}

// ─── Main handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (!verifyCronOrService(req)) {
    return errorResponse(corsHeaders, 'Unauthorized', 401)
  }

  try {
    // Parse optional body (allows overriding alert_number, test_number)
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* empty body OK for cron */ }

    // Load first active agent
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, enabled, instance_id, business_info, debounce_seconds')
      .eq('enabled', true)
      .limit(1)
      .single()

    if (!agent) {
      return errorResponse(corsHeaders, 'No active agent found', 404)
    }

    // Load instance token for alerts
    const { data: instance } = await supabase
      .from('instances')
      .select('id, token')
      .eq('id', agent.instance_id)
      .maybeSingle()

    if (!instance?.token) {
      return errorResponse(corsHeaders, 'Instance token not found')
    }

    // Load alert number from system_settings or body
    const alertNumber = body.alert_number as string
      || (await supabase.from('system_settings').select('value').eq('key', 'e2e_alert_number').maybeSingle())?.data?.value
      || '5581985749970'
    const testNumber = (body.test_number as string) || alertNumber

    // ─── Guard: intervalo dinâmico ────────────────────────────────────────
    const { data: intervalSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'e2e_schedule_interval_hours')
      .maybeSingle()
    const intervalHours = parseInt(intervalSetting?.value || '6', 10)

    const { data: lastBatch } = await supabase
      .from('e2e_test_batches')
      .select('created_at')
      .eq('agent_id', agent.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const isManualTrigger = (body.force === true)
    if (lastBatch && !isManualTrigger) {
      const hoursSinceLast = (Date.now() - new Date(lastBatch.created_at).getTime()) / 3600000
      if (hoursSinceLast < intervalHours) {
        log.info('Skipping: too soon since last run', { hoursSinceLast, intervalHours })
        return successResponse(corsHeaders, { skipped: true, reason: `Last run ${hoursSinceLast.toFixed(1)}h ago, interval=${intervalHours}h` })
      }
    }

    log.info('Starting scenarios', { count: SCENARIOS.length, agentId: agent.id })

    const runResults: Array<Record<string, unknown>> = []
    const startTime = Date.now()

    // ─── Criar batch row (estado inicial: running) ────────────────────────
    const batchTimestamp = Date.now()
    const batchIdText = `batch_cron_${batchTimestamp}`
    const { data: batchRow } = await supabase
      .from('e2e_test_batches')
      .insert({
        agent_id: agent.id,
        run_type: 'scheduled',
        status: 'running',
        total: SCENARIOS.length,
        passed: 0,
        failed: 0,
        batch_id_text: batchIdText,
      })
      .select('id')
      .single()
    const batchUuid: string | null = batchRow?.id || null

    for (const scenario of SCENARIOS) {
      const scenarioStart = Date.now()

      // Check preconditions
      const precheck = await checkPreconditions(scenario, agent as Record<string, unknown>)
      if (!precheck.ok) {
        log.info('Scenario skipped', { scenarioId: scenario.id, reason: precheck.reason })
        const skipResult: Record<string, unknown> = {
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          passed: false,
          skipped: true,
          skip_reason: precheck.reason,
          results: [],
          latency_ms: 0,
        }
        runResults.push(skipResult)

        // Save to DB
        await supabase.from('e2e_test_runs').insert({
          agent_id: agent.id,
          instance_id: agent.instance_id,
          test_number: testNumber,
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          total_steps: scenario.steps.length,
          passed: false,
          skipped: true,
          skip_reason: precheck.reason,
          results: [],
          latency_ms: 0,
          batch_uuid: batchUuid,
          batch_id: batchIdText,
        })
        continue
      }

      // Call e2e-test edge function
      let e2eResult: Record<string, unknown> = {}
      try {
        const resp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/e2e-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            agent_id: agent.id,
            instance_id: agent.instance_id,
            test_number: testNumber,
            steps: scenario.steps,
          }),
        }, 120000) // 2min timeout for multi-step scenarios

        e2eResult = await resp.json()
      } catch (e) {
        e2eResult = { ok: false, error: e instanceof Error ? e.message : 'timeout' }
      }

      const latency = Date.now() - scenarioStart

      if (!e2eResult?.ok) {
        const failResult: Record<string, unknown> = {
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          passed: false,
          skipped: false,
          error: e2eResult?.error || 'E2E function returned error',
          results: [],
          latency_ms: latency,
        }
        runResults.push(failResult)

        await supabase.from('e2e_test_runs').insert({
          agent_id: agent.id,
          instance_id: agent.instance_id,
          test_number: testNumber,
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          total_steps: scenario.steps.length,
          passed: false,
          skipped: false,
          results: [],
          latency_ms: latency,
          error: e2eResult?.error || 'E2E function error',
          batch_uuid: batchUuid,
          batch_id: batchIdText,
        })
        continue
      }

      // Evaluate results
      const evaluation = evaluateResult(scenario, (e2eResult.results as Array<Record<string, unknown>>) || [])

      const scenarioResult: Record<string, unknown> = {
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        passed: evaluation.passed,
        skipped: false,
        reason: evaluation.reason,
        results: e2eResult.results,
        latency_ms: latency,
      }
      runResults.push(scenarioResult)

      // Save to DB
      await supabase.from('e2e_test_runs').insert({
        agent_id: agent.id,
        instance_id: agent.instance_id,
        test_number: testNumber,
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        total_steps: scenario.steps.length,
        passed: evaluation.passed,
        skipped: false,
        results: e2eResult.results || [],
        latency_ms: latency,
        error: evaluation.reason || null,
        batch_uuid: batchUuid,
        batch_id: batchIdText,
      })

      log.info('Scenario result', { scenarioId: scenario.id, passed: evaluation.passed, latency_ms: latency })

      // Wait between scenarios to avoid overloading
      await new Promise(r => setTimeout(r, 3000))
    }

    const totalLatency = Date.now() - startTime
    const passed = runResults.filter(r => r.passed)
    const failed = runResults.filter(r => !r.passed && !r.skipped)
    const skipped = runResults.filter(r => r.skipped)

    // ─── Calcular composite_score do batch atual ────────────────────────
    const passCount_final = passed.length
    const totalRan = passed.length + failed.length
    const compositeScore = totalRan > 0
      ? Math.round((passCount_final / totalRan) * 100)
      : null

    // ─── Regressão: comparar com batch anterior ──────────────────────────
    let isRegression = false
    let regressionContext: Record<string, unknown> | null = null

    if (batchUuid && compositeScore !== null) {
      const { data: previousBatch } = await supabase
        .rpc('get_previous_e2e_batch', {
          p_agent_id: agent.id,
          p_exclude_batch_uuid: batchUuid,
        })
        .maybeSingle()

      const [{ data: thresholdSetting }, { data: consecutiveSetting }, { data: healthySetting }] = await Promise.all([
        supabase.from('system_settings').select('value').eq('key', 'e2e_regression_threshold').maybeSingle(),
        supabase.from('system_settings').select('value').eq('key', 'e2e_consecutive_below_threshold').maybeSingle(),
        supabase.from('system_settings').select('value').eq('key', 'e2e_healthy_pass_rate').maybeSingle(),
      ])

      const threshold = parseFloat(thresholdSetting?.value || '10')
      const healthyRate = parseFloat(healthySetting?.value || '80')
      let consecutiveCount = parseInt(consecutiveSetting?.value || '0', 10)

      if (previousBatch?.composite_score !== undefined && previousBatch.composite_score !== null) {
        const delta = compositeScore - Number(previousBatch.composite_score)
        const isBelowHealthy = compositeScore < healthyRate

        if (isBelowHealthy) {
          consecutiveCount++
        } else {
          consecutiveCount = 0
        }

        if (delta < -threshold || consecutiveCount >= 2) {
          isRegression = true
          regressionContext = {
            delta,
            current_score: compositeScore,
            previous_score: Number(previousBatch.composite_score),
            previous_batch_uuid: previousBatch.batch_uuid,
            consecutive_below_threshold: consecutiveCount,
            failed_scenarios: failed.map((r: Record<string, unknown>) => ({
              id: r.scenario_id,
              name: r.scenario_name,
              reason: r.reason || r.error,
            })),
          }
        }

        await supabase
          .from('system_settings')
          .update({ value: String(consecutiveCount) })
          .eq('key', 'e2e_consecutive_below_threshold')
      }
    }

    // ─── Atualizar batch row com resultados finais ────────────────────────
    if (batchUuid) {
      await supabase
        .from('e2e_test_batches')
        .update({
          status: 'complete',
          passed: passed.length,
          failed: failed.length,
          total: SCENARIOS.length,
          composite_score: compositeScore,
          is_regression: isRegression,
          regression_context: regressionContext,
        })
        .eq('id', batchUuid)
    }

    // Send WhatsApp alert if any failures or regression detected
    if ((failed.length > 0 || isRegression) && alertNumber) {
      const { data: alertEnabledSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'e2e_alert_whatsapp_enabled')
        .maybeSingle()
      const alertEnabled = alertEnabledSetting?.value !== 'false'

      if (alertEnabled) {
        const lines: string[] = []

        if (isRegression) {
          const ctx = regressionContext as Record<string, unknown>
          lines.push(`🚨 *REGRESSÃO DETECTADA* — Score: ${compositeScore} (era ${ctx.previous_score}, delta: ${(ctx.delta as number).toFixed(0)}pts)`)
        } else {
          lines.push(`⚠️ *E2E Alerta* — ${failed.length}/${SCENARIOS.length} falharam`)
        }
        lines.push('')

        for (const r of failed) {
          lines.push(`❌ ${r.scenario_name}: ${r.error || r.reason || 'erro desconhecido'}`)
        }
        for (const r of passed) {
          lines.push(`✅ ${r.scenario_name}: OK`)
        }
        for (const r of skipped) {
          lines.push(`⏭️ ${r.scenario_name}: SKIP`)
        }

        lines.push('')
        lines.push(`📊 Score: ${compositeScore ?? '?'}/100`)
        if (isRegression) {
          lines.push(`⚙️ Revise o Prompt Studio → aba E2E Real → Histórico`)
        }

        await sendWhatsAppAlert(instance.token, alertNumber, lines.join('\n'))
      }
    }

    log.info('Done', { passed: passed.length, failed: failed.length, skipped: skipped.length, total_ms: totalLatency })

    return successResponse(corsHeaders, {
      total: SCENARIOS.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      total_latency_ms: totalLatency,
      composite_score: compositeScore,
      is_regression: isRegression,
      batch_uuid: batchUuid,
      results: runResults,
    })

  } catch (err) {
    log.error('Error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return errorResponse(corsHeaders, err instanceof Error ? err.message : 'Unknown error')
  }
})
