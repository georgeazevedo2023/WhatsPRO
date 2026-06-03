// Edge function: refresh-instance-avatar
//
// Chamada do frontend (InstanceAvatar.onError / on-mount) quando a foto de
// perfil de uma instância está faltando ou expirou (URL pps.whatsapp.net do
// CDN expira em ~semanas). Re-busca via UAZAPI GET /instance/status, sobe pro
// bucket contact-avatars e devolve a URL pública nova (estável).
//
// Body: { instance_id: string }
// Resposta: { ok: true, url: string | null }
//
// Segurança: requer JWT de usuário autenticado (verify_jwt=true). Service
// role faz UPDATE em instances/storage. Custo = 1 chamada UAZAPI; throttle de
// 5 min via profile_pic_synced_at evita loop quando a instância não tem foto.

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { syncInstanceAvatar } from '../_shared/avatarStorage.ts'

const log = createLogger('refresh-instance-avatar')

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse(corsHeaders, 'Method not allowed', 405)
  }

  // verify_jwt=true (default) já validou o JWT no gateway. Confiamos no user.
  let body: { instance_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return errorResponse(corsHeaders, 'Invalid JSON', 400)
  }

  const instanceId = body.instance_id
  if (!instanceId || typeof instanceId !== 'string') {
    return errorResponse(corsHeaders, 'instance_id required', 400)
  }

  const supabase = createServiceClient()

  const { data: instance, error: instErr } = await supabase
    .from('instances')
    .select('id, token, profile_pic_synced_at')
    .eq('id', instanceId)
    .maybeSingle()

  if (instErr || !instance) {
    log.warn('Instance not found', { instanceId })
    return errorResponse(corsHeaders, 'Instance not found', 404)
  }

  // Throttle: já sincronizou nos últimos 5 minutos? evita refresh em loop
  // se a instância realmente não tem foto ou UAZAPI falha.
  if (instance.profile_pic_synced_at) {
    const lastSync = new Date(instance.profile_pic_synced_at).getTime()
    if (Date.now() - lastSync < 5 * 60 * 1000) {
      return successResponse(corsHeaders, { url: null, throttled: true })
    }
  }

  if (!instance.token) {
    log.warn('Instance without token', { instanceId })
    return errorResponse(corsHeaders, 'Instance has no token', 404)
  }

  const uazapiServerUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

  const result = await syncInstanceAvatar({
    supabase,
    instanceId,
    uazapiServerUrl,
    instanceToken: instance.token,
  })

  if (!result.ok) {
    log.info('Sync failed', { instanceId, reason: result.reason })
    // Marca synced_at mesmo em falha pra evitar loop de retry imediato.
    await supabase
      .from('instances')
      .update({ profile_pic_synced_at: new Date().toISOString() })
      .eq('id', instanceId)
    return successResponse(corsHeaders, { url: null, reason: result.reason })
  }

  log.info('Instance avatar synced', { instanceId, path: result.storagePath })
  return successResponse(corsHeaders, { url: result.url })
})
