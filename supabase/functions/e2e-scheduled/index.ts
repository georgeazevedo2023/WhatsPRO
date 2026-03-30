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

    log.info('Starting scenarios', { count: SCENARIOS.length, agentId: agent.id })

    const runResults: Array<Record<string, unknown>> = []
    const startTime = Date.now()

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
      })

      log.info('Scenario result', { scenarioId: scenario.id, passed: evaluation.passed, latency_ms: latency })

      // Wait between scenarios to avoid overloading
      await new Promise(r => setTimeout(r, 3000))
    }

    const totalLatency = Date.now() - startTime
    const passed = runResults.filter(r => r.passed)
    const failed = runResults.filter(r => !r.passed && !r.skipped)
    const skipped = runResults.filter(r => r.skipped)

    // Send WhatsApp alert if any failures
    if (failed.length > 0) {
      const lines: string[] = [
        `⚠️ *E2E Alerta* — ${failed.length}/${SCENARIOS.length} falharam`,
        '',
      ]

      for (const r of failed) {
        lines.push(`❌ ${r.scenario_name}: ${r.error || r.reason || 'erro desconhecido'}`)
      }
      for (const r of passed) {
        lines.push(`✅ ${r.scenario_name}: OK (${((r.latency_ms as number) / 1000).toFixed(1)}s)`)
      }
      for (const r of skipped) {
        lines.push(`⏭️ ${r.scenario_name}: SKIP (${r.skip_reason})`)
      }

      const totalTokens = runResults
        .flatMap(r => (r.results as Array<Record<string, unknown>>) || [])
        .reduce((sum: number, r) => sum + ((r.tokens as Record<string, number>)?.input || 0) + ((r.tokens as Record<string, number>)?.output || 0), 0)

      lines.push('')
      lines.push(`🕐 Total: ${(totalLatency / 1000).toFixed(1)}s | Tokens: ${(totalTokens / 1000).toFixed(1)}k`)

      await sendWhatsAppAlert(instance.token, alertNumber, lines.join('\n'))
    }

    log.info('Done', { passed: passed.length, failed: failed.length, skipped: skipped.length, total_ms: totalLatency })

    return successResponse(corsHeaders, {
      total: SCENARIOS.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      total_latency_ms: totalLatency,
      results: runResults,
    })

  } catch (err) {
    log.error('Error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return errorResponse(corsHeaders, err instanceof Error ? err.message : 'Unknown error')
  }
})
