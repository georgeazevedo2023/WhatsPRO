// Edge function: refresh-avatar
//
// Chamada do frontend (ContactAvatar.onError) quando uma foto cacheada
// expirou ou está faltando. Re-busca via UAZAPI, sobe pro bucket
// contact-avatars e devolve a URL pública nova.
//
// Body: { contact_id: string }
// Resposta: { ok: true, url: string | null }
//
// Segurança: requer JWT de usuário autenticado (verify_jwt=true).
// Service role faz UPDATE em contacts/storage. Risco: usuário pode
// disparar refresh em qualquer contact_id, custo = 1 chamada UAZAPI.
// Aceito como baixo risco em B2B (rate limit existe a nível de instância).

import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { syncContactAvatar } from '../_shared/avatarStorage.ts'

const log = createLogger('refresh-avatar')

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse(corsHeaders, 'Method not allowed', 405)
  }

  // verify_jwt=true (default) já validou o JWT no gateway. Confiamos no user.
  let body: { contact_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return errorResponse(corsHeaders, 'Invalid JSON', 400)
  }

  const contactId = body.contact_id
  if (!contactId || typeof contactId !== 'string') {
    return errorResponse(corsHeaders, 'contact_id required', 400)
  }

  const supabase = createServiceClient()

  // 1. Buscar contato + uma instância com token (via conversa)
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, jid, profile_pic_synced_at')
    .eq('id', contactId)
    .maybeSingle()

  if (contactErr || !contact) {
    log.warn('Contact not found', { contactId })
    return errorResponse(corsHeaders, 'Contact not found', 404)
  }

  // Throttle: já sincronizou nos últimos 5 minutos? evita refresh em loop
  // se foto realmente não existe ou UAZAPI falha.
  if (contact.profile_pic_synced_at) {
    const lastSync = new Date(contact.profile_pic_synced_at).getTime()
    if (Date.now() - lastSync < 5 * 60 * 1000) {
      return successResponse(corsHeaders, { url: null, throttled: true })
    }
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('inbox_id, inboxes!inner(instance_id, instances!inner(token))')
    .eq('contact_id', contactId)
    .limit(1)
    .maybeSingle()

  // deno-lint-ignore no-explicit-any
  const token = (conv as any)?.inboxes?.instances?.token as string | undefined
  if (!token) {
    log.warn('No instance token for contact', { contactId })
    return errorResponse(corsHeaders, 'No instance found for contact', 404)
  }

  const uazapiServerUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

  const result = await syncContactAvatar({
    supabase,
    contactId,
    contactJid: contact.jid,
    uazapiServerUrl,
    instanceToken: token,
  })

  if (!result.ok) {
    log.info('Sync failed', { contactId, reason: result.reason })
    // Mark synced_at mesmo em falha pra evitar loop de retry imediato
    await supabase
      .from('contacts')
      .update({ profile_pic_synced_at: new Date().toISOString() })
      .eq('id', contactId)
    return successResponse(corsHeaders, { url: null, reason: result.reason })
  }

  log.info('Avatar synced', { contactId, path: result.storagePath })
  return successResponse(corsHeaders, { url: result.url })
})
