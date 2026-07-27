/**
 * Telemetria de falha de envio de mídia (auditoria 2026-06-09).
 *
 * Recebe um beacon fire-and-forget do frontend quando um envio de foto/arquivo
 * falha no Helpdesk e grava em `media_send_telemetry` — antes a falha
 * client-side era invisível (nenhum rastro no DB).
 *
 * verify_jwt=false DE PROPÓSITO: o cenário nº1 monitorado é exatamente sessão
 * expirada/zumbi — exigir JWT mataria a telemetria do caso mais importante.
 * Mitigações de abuso: POST-only, payload ≤ 4KB, whitelists de stage/outcome,
 * truncamento de strings, e a tabela é RLS-locked (só service role lê/escreve).
 */
import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('log-send-failure')

// 'done'/'success' (2026-07-26): evento de SUCESSO — sem ele não dá pra medir
// taxa de falha por plataforma (a auditoria do caso Android ficou meio-cega).
const VALID_STAGES = new Set(['validate', 'normalize', 'upload', 'proxy', 'confirm', 'insert', 'done', 'unknown'])
const VALID_OUTCOMES = new Set(['fail', 'hang_timeout', 'success'])
const MAX_BODY_BYTES = 4096

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asUuid(v: unknown): string | null {
  return typeof v === 'string' && UUID_RE.test(v) ? v : null
}

function asText(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null
}

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'payload too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const body = JSON.parse(raw) as Record<string, unknown>

    const stage = typeof body.stage === 'string' && VALID_STAGES.has(body.stage) ? body.stage : 'unknown'
    const outcome = typeof body.outcome === 'string' && VALID_OUTCOMES.has(body.outcome) ? body.outcome : 'fail'

    const supabase = createServiceClient()
    const { error } = await supabase.from('media_send_telemetry').insert({
      stage,
      outcome,
      user_id: asUuid(body.user_id),
      conversation_id: asUuid(body.conversation_id),
      instance_id: asText(body.instance_id, 64),
      detected_kind: asText(body.detected_kind, 16),
      file_size: typeof body.file_size === 'number' && Number.isFinite(body.file_size) ? Math.max(0, Math.floor(body.file_size)) : null,
      file_type: asText(body.file_type, 100),
      raw_error: asText(body.raw_error, 500),
      app_build: asText(body.app_build, 40),
      user_agent: asText(body.user_agent, 300),
    })
    if (error) {
      log.error('insert failed', { error: error.message })
      return new Response(JSON.stringify({ ok: false }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log.error('bad request', { error: (err as Error).message })
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
