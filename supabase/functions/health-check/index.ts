import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'

/**
 * Health check endpoint — verifies database connectivity and key services.
 * Used by monitoring dashboards and load balancers.
 *
 * GET /functions/v1/health-check → { status: 'ok', checks: {...} }
 */

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface CheckResult {
  ok: boolean
  latency_ms: number
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { error } = await supabase.from('instances').select('id', { count: 'exact', head: true })
    return { ok: !error, latency_ms: Date.now() - start, error: error?.message }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
  }
}

async function checkVault(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { error } = await supabase.rpc('has_inbox_access_fast', {
      _user_id: '00000000-0000-0000-0000-000000000000',
      _inbox_id: '00000000-0000-0000-0000-000000000000',
    })
    return { ok: !error, latency_ms: Date.now() - start, error: error?.message }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const start = Date.now()
  const [db, vault] = await Promise.all([checkDatabase(), checkVault()])

  const allOk = db.ok && vault.ok
  const body = {
    status: allOk ? 'ok' : 'degraded',
    uptime_s: Math.floor(performance.now() / 1000),
    total_latency_ms: Date.now() - start,
    checks: { database: db, materialized_view: vault },
    env: {
      supabase_url: Deno.env.get('SUPABASE_URL')?.replace(/https?:\/\//, '').split('.')[0] || 'unknown',
      webhook_secret_set: !!Deno.env.get('WEBHOOK_SECRET'),
      gemini_key_set: !!Deno.env.get('GEMINI_API_KEY'),
      groq_key_set: !!Deno.env.get('GROQ_API_KEY'),
    },
  }

  return new Response(JSON.stringify(body), {
    status: allOk ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
