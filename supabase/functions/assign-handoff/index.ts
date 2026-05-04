// =============================================================================
// assign-handoff — D30 Fila Inteligente (Sprint B)
//
// Wrapper HTTP fino ao redor de `_shared/handoffQueue.ts`. Chamado por:
//   - cron `requeue-conversations` (Sprint C) quando timeout expira
//   - Helpdesk gestor manual reassign (Sprint F)
//
// O `ai-agent` NÃO chama via HTTP — importa o helper direto pra evitar latência
// extra nos 6 paths de handoff.
//
// Auth: verify_jwt=false (config.toml) + verifyCronOrService manual no body.
//       Cron usa SUPABASE_SERVICE_ROLE_KEY. Helpdesk no Sprint F passa ANON_KEY +
//       payload com user JWT pra checagem de permissão (não implementado aqui).
// =============================================================================

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { assignHandoff } from '../_shared/handoffQueue.ts'

// @ts-ignore -- Deno serve config
Deno.serve(async (req: Request) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const conversation_id = typeof body.conversation_id === 'string' ? body.conversation_id : null
  const department_id = typeof body.department_id === 'string' ? body.department_id : null
  const previous_assignee_id = typeof body.previous_assignee_id === 'string'
    ? body.previous_assignee_id : null
  const skip_user_ids = Array.isArray(body.skip_user_ids)
    ? body.skip_user_ids.filter((u): u is string => typeof u === 'string')
    : []

  if (!conversation_id) {
    return new Response(JSON.stringify({ error: 'conversation_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const log = createLogger('assign-handoff')
  const supabase = createServiceClient()

  const result = await assignHandoff({
    supabase,
    conversation_id,
    department_id,
    previous_assignee_id,
    skip_user_ids,
    logger: log,
  })

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
