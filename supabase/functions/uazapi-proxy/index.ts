import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('uazapi-proxy')

/**
 * Resolve instance token server-side from instance_id.
 * Verifies the user has access to the instance via user_instance_access or is super_admin.
 * Returns the token or null if not found/unauthorized.
 */
async function resolveInstanceToken(
  userId: string,
  instanceId: string
): Promise<string | null> {
  const serviceClient = createServiceClient()

  // Check user has access (super_admin or explicit access)
  const { data: roles, error: rolesError } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['super_admin', 'gerente'])

  if (rolesError) {
    log.error('Error fetching user roles', { error: rolesError.message })
    return null
  }

  const isSuperAdmin = roles?.some(r => r.role === 'super_admin') ?? false

  if (!isSuperAdmin) {
    const { data: access, error: accessError } = await serviceClient
      .from('user_instance_access')
      .select('id')
      .eq('user_id', userId)
      .eq('instance_id', instanceId)
      .maybeSingle()

    if (accessError) {
      log.error('Error checking instance access', { error: accessError.message })
      return null
    }

    if (!access) {
      log.error('User does not have access to instance', { userId, instanceId })
      return null
    }
  }

  // Fetch token
  const { data: instance, error } = await serviceClient
    .from('instances')
    .select('token')
    .eq('id', instanceId)
    .single()

  if (error || !instance) {
    log.error('Instance not found', { instanceId, error: error?.message })
    return null
  }

  return instance.token
}

Deno.serve(async (req) => {
  // Dynamic CORS — checks Origin against ALLOWED_ORIGIN whitelist
  const corsHeaders = getDynamicCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createUserClient(req)

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id
    const body = await req.json()
    const { action, instanceName, groupjid } = body

    // Resolve instance token server-side from instance_id
    // Falls back to body.token for backward compatibility (will be removed)
    let instanceToken: string | null = null
    const instanceId = body.instance_id || body.instanceId
    
    if (instanceId) {
      instanceToken = await resolveInstanceToken(userId, instanceId)
      if (!instanceToken && action !== 'list') {
        return new Response(
          JSON.stringify({ error: 'Instance not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (action !== 'list') {
      // instance_id is required for all actions except 'list'
      return new Response(
        JSON.stringify({ error: 'instance_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')

    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: 'UAZAPI admin token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let response: Response

    switch (action) {
      case 'connect': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        log.info('Connecting instance (resolved server-side)')

        response = await fetchWithTimeout(`${uazapiUrl}/instance/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({}),
        })
        
        log.info('Connect response status', { status: response.status })

        const connectRawText = await response.text()
        log.info('Connect response', { preview: connectRawText.substring(0, 500) })
        
        let connectData: unknown
        try {
          connectData = JSON.parse(connectRawText)
        } catch {
          connectData = { raw: connectRawText }
        }
        
        return new Response(
          JSON.stringify(connectData),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'status': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        response = await fetchWithTimeout(`${uazapiUrl}/instance/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
        })
        
        log.info('Status response status', { status: response.status })
        break
      }

      case 'list': {
        log.info('Fetching instances', { url: `${uazapiUrl}/instance/all` })
        response = await fetchWithTimeout(`${uazapiUrl}/instance/all`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': adminToken,
            'token': adminToken,
          },
        })
        log.info('UAZAPI list response status', { status: response.status })
        break
      }

      case 'groups': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const groupsResponse = await fetchWithTimeout(`${uazapiUrl}/group/list?noparticipants=false`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
        })
        log.info('Groups response status', { status: groupsResponse.status })
        
        const groupsData = await groupsResponse.json()
        
        let normalizedGroups: unknown[]
        if (Array.isArray(groupsData)) {
          normalizedGroups = groupsData
        } else if (groupsData?.groups && Array.isArray(groupsData.groups)) {
          normalizedGroups = groupsData.groups
        } else if (groupsData?.data && Array.isArray(groupsData.data)) {
          normalizedGroups = groupsData.data
        } else {
          log.warn('Unexpected groups format', { preview: JSON.stringify(groupsData).substring(0, 200) })
          normalizedGroups = []
        }
        
        const groupsStatus = groupsResponse.ok ? 200 : groupsResponse.status
        return new Response(
          JSON.stringify(normalizedGroups),
          { 
            status: groupsStatus, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'group-info': {
        if (!instanceToken || !groupjid) {
          return new Response(
            JSON.stringify({ error: 'Instance and group JID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        response = await fetchWithTimeout(`${uazapiUrl}/group/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({ groupjid }),
        })
        break
      }

      case 'send-message': {
        if (!instanceToken || !groupjid || !body.message) {
          return new Response(
            JSON.stringify({ error: 'Instance, groupjid and message required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const message = String(body.message).trim()
        if (message.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Message cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (message.length > 4096) {
          return new Response(
            JSON.stringify({ error: 'Message too long (max 4096 characters)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const sendUrl = `${uazapiUrl}/send/text`
        const sendBody = {
          number: groupjid,
          text: message,
        }
        
        const sendResponse = await fetchWithTimeout(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify(sendBody),
        })
        
        log.info('Send response status', { status: sendResponse.status })
        
        const rawText = await sendResponse.text()
        let sendData: unknown
        try {
          sendData = JSON.parse(rawText)
        } catch {
          sendData = { raw: rawText }
        }
        
        return new Response(
          JSON.stringify(sendData),
          { 
            status: sendResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'send-media': {
        const mediaDestination = groupjid || body.jid
        if (!instanceToken || !mediaDestination || !body.mediaUrl || !body.mediaType) {
          return new Response(
            JSON.stringify({ error: 'Instance, groupjid/jid, mediaUrl and mediaType required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const mediaEndpoint = `${uazapiUrl}/send/media`
        
        const isBase64 = body.mediaUrl.startsWith('data:')
        const fileValue = isBase64 
          ? body.mediaUrl.split(',')[1] || body.mediaUrl
          : body.mediaUrl
        
        const mediaBody: Record<string, unknown> = {
          number: mediaDestination,
          type: body.mediaType,
          file: fileValue,
          text: body.caption || '',
        }
        
        if (body.mediaType === 'document' && body.filename) {
          mediaBody.docName = body.filename
        }
        
        const mediaResponse = await fetchWithTimeout(mediaEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify(mediaBody),
        })
        
        log.info('Media response status', { status: mediaResponse.status })
        
        const mediaRawText = await mediaResponse.text()
        
        let mediaData: unknown
        try {
          mediaData = JSON.parse(mediaRawText)
        } catch {
          mediaData = { raw: mediaRawText }
        }
        
        return new Response(
          JSON.stringify(mediaData),
          { 
            status: mediaResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'send-carousel': {
        if (!instanceToken || !groupjid || !body.carousel) {
          return new Response(
            JSON.stringify({ error: 'Instance, groupjid and carousel required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!Array.isArray(body.carousel) || body.carousel.length > 10) {
          return new Response(
            JSON.stringify({ error: 'Carousel must be an array with max 10 cards' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const carouselEndpoint = `${uazapiUrl}/send/carousel`
        
        const isGroup = groupjid.endsWith('@g.us')
        
        let normalizedDestination = groupjid
        if (!groupjid.includes('@') && !isGroup) {
          normalizedDestination = `${groupjid}@s.whatsapp.net`
        }
        
        const isUuidLike = (str: string | undefined | null): boolean => {
          if (!str) return false;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        };

        const processedCards = body.carousel.map((card: { text: string; image: string; buttons: Array<{ id?: string; text?: string; label?: string; type: string; url?: string; phone?: string }> }, idx: number) => {
          let imageValue = card.image
          if (card.image && card.image.startsWith('data:')) {
            imageValue = card.image.split(',')[1] || card.image
          }
          
          const processedButtons = card.buttons?.map((btn, btnIdx) => {
            const buttonText = btn.text ?? btn.label ?? '';
            
            let buttonId: string;
            switch (btn.type) {
              case 'URL':
                buttonId = btn.url ?? btn.id ?? '';
                break;
              case 'CALL':
                buttonId = btn.phone ?? btn.id ?? '';
                break;
              case 'COPY':
                buttonId = btn.id ?? buttonText;
                break;
              case 'REPLY':
              default:
                buttonId = isUuidLike(btn.id) ? buttonText : (btn.id ?? buttonText);
                break;
            }
            
            return {
              id: buttonId,
              text: buttonText,
              type: btn.type,
            };
          }) || []
          
          return {
            text: card.text,
            image: imageValue,
            buttons: processedButtons,
          }
        })
        
        const messageText = String(body.message ?? '').trim()

        const payloadCandidates: Array<Record<string, unknown>> = []
        
        if (isGroup) {
          payloadCandidates.push(
            { groupjid: groupjid, message: messageText, carousel: processedCards },
            { chatId: groupjid, message: messageText, carousel: processedCards },
            { phone: groupjid, message: messageText, carousel: processedCards },
            { number: groupjid, text: messageText, carousel: processedCards },
          )
        } else {
          payloadCandidates.push(
            { phone: normalizedDestination, message: messageText, carousel: processedCards },
            { number: normalizedDestination, text: messageText, carousel: processedCards },
            { phone: groupjid, message: messageText, carousel: processedCards },
            { number: groupjid, text: messageText, carousel: processedCards },
          )
        }

        let lastStatus = 500
        let lastRawText = ''

        for (let attempt = 0; attempt < payloadCandidates.length; attempt++) {
          const candidate = payloadCandidates[attempt]
          log.info(`Carousel attempt #${attempt + 1}`, { payloadKeys: Object.keys(candidate).join(', ') })

          const resp = await fetchWithTimeout(carouselEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': instanceToken,
            },
            body: JSON.stringify(candidate),
          })

          lastStatus = resp.status
          lastRawText = await resp.text()
          log.info(`Carousel attempt #${attempt + 1} status`, { status: lastStatus })

          if (resp.ok) {
            log.info(`Carousel SUCCESS with attempt #${attempt + 1}`)
            break
          }

          const lowered = lastRawText.toLowerCase()
          const shouldRetry = lowered.includes('missing required fields') || lowered.includes('missing')
          if (!shouldRetry) break
        }

        let carouselData: unknown
        try {
          carouselData = JSON.parse(lastRawText)
        } catch {
          carouselData = { raw: lastRawText }
        }

        return new Response(
          JSON.stringify(carouselData),
          {
            status: lastStatus,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // M17 F4: Enquetes nativas do WhatsApp
      case 'send-poll': {
        if (!instanceToken || !groupjid || !body.question || !body.options) {
          return new Response(
            JSON.stringify({ error: 'Instance, groupjid, question and options required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 12) {
          return new Response(
            JSON.stringify({ error: 'Options must be an array with 2-12 items' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (String(body.question).length > 255) {
          return new Response(
            JSON.stringify({ error: 'Question too long (max 255 characters)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (body.options.some((o: string) => String(o).length > 100)) {
          return new Response(
            JSON.stringify({ error: 'Each option max 100 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const pollBody = {
          number: groupjid,
          type: 'poll',
          text: String(body.question).trim(),
          choices: body.options.map((o: string) => String(o).trim()),
          selectableCount: body.selectableCount ?? 1,
        }

        const pollResponse = await fetchWithTimeout(`${uazapiUrl}/send/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: instanceToken },
          body: JSON.stringify(pollBody),
        })

        const pollText = await pollResponse.text()
        let pollResult: unknown
        try { pollResult = JSON.parse(pollText) } catch { pollResult = { raw: pollText } }

        return new Response(
          JSON.stringify(pollResult),
          { status: pollResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'check-numbers': {
        if (!instanceToken || !body.phones || !Array.isArray(body.phones)) {
          return new Response(
            JSON.stringify({ error: 'Instance and phones array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (body.phones.length > 500) {
          return new Response(
            JSON.stringify({ error: 'Maximum 500 phones per request' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const checkResponse = await fetchWithTimeout(`${uazapiUrl}/chat/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({ numbers: body.phones }),
        })
        
        const checkRawText = await checkResponse.text()
        
        let checkData: unknown
        try {
          checkData = JSON.parse(checkRawText)
        } catch {
          checkData = { raw: checkRawText }
        }
        
        let users: unknown[]
        if (Array.isArray(checkData)) {
          users = checkData
        } else {
          users = (checkData as Record<string, unknown>)?.Users as unknown[] || 
                  (checkData as Record<string, unknown>)?.users as unknown[] || 
                  (checkData as Record<string, unknown>)?.data as unknown[] || 
                  []
        }
        
        return new Response(
          JSON.stringify({ users }),
          { status: checkResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'resolve-lids': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const groupJids: string[] = body.groupJids || []
        if (groupJids.length === 0) {
          return new Response(
            JSON.stringify({ error: 'groupJids array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (groupJids.length > 50) {
          return new Response(
            JSON.stringify({ error: 'Maximum 50 groups per request' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const groupParticipants: Record<string, Array<{ jid: string; phone: string; name: string; isAdmin: boolean; isSuperAdmin: boolean }>> = {}
        
        for (const gjid of groupJids) {
          try {
            const infoResp = await fetchWithTimeout(`${uazapiUrl}/group/info`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'token': instanceToken,
              },
              body: JSON.stringify({ groupjid: gjid }),
            })
            
            if (!infoResp.ok) continue
            
            const infoData = await infoResp.json()
            const participants = infoData?.Participants || infoData?.participants || []
            
            groupParticipants[gjid] = (participants as Array<Record<string, unknown>>)
              .map(p => {
                const rawPhone = String(p.PhoneNumber || p.phoneNumber || '')
                const cleanPhone = rawPhone.replace(/\D/g, '')
                const hasValidPhone = cleanPhone.length >= 10 && !rawPhone.includes('·')
                const jid = String(p.JID || p.jid || '')
                
                return {
                  jid,
                  phone: hasValidPhone ? cleanPhone : '',
                  name: String(p.PushName || p.pushName || p.DisplayName || p.Name || p.name || ''),
                  isAdmin: Boolean(p.IsAdmin || p.isAdmin),
                  isSuperAdmin: Boolean(p.IsSuperAdmin || p.isSuperAdmin),
                  isLid: !hasValidPhone,
                }
              })
          } catch (err) {
            log.error('Error fetching group/info', { groupJid: gjid, error: (err as Error).message })
          }
        }
        
        return new Response(
          JSON.stringify({ groupParticipants }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'download-media': {
        if (!body.fileUrl || !body.instanceId) {
          return new Response(
            JSON.stringify({ error: 'fileUrl and instanceId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const serviceSupabase = createServiceClient()

        const { data: inst, error: instError } = await serviceSupabase
          .from('instances')
          .select('token')
          .eq('id', body.instanceId)
          .single()

        if (instError || !inst) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        log.info('Proxying file download', { urlPreview: body.fileUrl.substring(0, 80) })
        const fileResp = await fetchWithTimeout(body.fileUrl, {
          headers: { 'token': inst.token },
        })

        if (!fileResp.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to download file', status: fileResp.status }),
            { status: fileResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(fileResp.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': fileResp.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition': fileResp.headers.get('Content-Disposition') || 'inline',
          },
        })
      }

      case 'send-audio': {
        if (!instanceToken || !body.jid || !body.audio) {
          return new Response(
            JSON.stringify({ error: 'Instance, jid and audio (base64) required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const rawAudio = String(body.audio)

        // Limit audio to ~16MB base64 (~12MB decoded)
        if (rawAudio.length > 16 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: 'Audio too large (max 12MB)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const audioFile = rawAudio.includes(',') && rawAudio.startsWith('data:')
          ? rawAudio.split(',')[1]
          : rawAudio

        const audioEndpoint = `${uazapiUrl}/send/media`
        const audioBody = {
          number: body.jid,
          type: 'ptt',
          file: audioFile,
        }

        const audioResponse = await fetchWithTimeout(audioEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify(audioBody),
        })

        const audioRawText = await audioResponse.text()
        let audioData: unknown
        try {
          audioData = JSON.parse(audioRawText)
        } catch {
          audioData = { raw: audioRawText }
        }

        return new Response(
          JSON.stringify(audioData),
          { status: audioResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-chat': {
        if (!instanceToken || !body.jid || !body.message) {
          return new Response(
            JSON.stringify({ error: 'Instance, jid and message required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const chatEndpoint = `${uazapiUrl}/send/text`
        const chatBody = {
          number: body.jid,
          text: String(body.message).trim(),
        }

        const chatResponse = await fetchWithTimeout(chatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify(chatBody),
        })

        const chatRawText = await chatResponse.text()
        let chatData: unknown
        try {
          chatData = JSON.parse(chatRawText)
        } catch {
          chatData = { raw: chatRawText }
        }

        return new Response(
          JSON.stringify(chatData),
          { status: chatResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create-instance': {
        if (!body.instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        log.info('Creating new instance', { instanceName: body.instanceName })
        const createResponse = await fetchWithTimeout(`${uazapiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': adminToken,
            'token': adminToken,
          },
          body: JSON.stringify({
            instanceName: body.instanceName,
            token: body.token || undefined,
          }),
        })

        const createRawText = await createResponse.text()
        log.info('Create instance response', { status: createResponse.status, preview: createRawText.substring(0, 300) })

        let createData: unknown
        try {
          createData = JSON.parse(createRawText)
        } catch {
          createData = { raw: createRawText }
        }

        return new Response(
          JSON.stringify(createData),
          { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete-instance': {
        const deleteInstanceId = body.deleteInstanceId
        if (!deleteInstanceId) {
          return new Response(
            JSON.stringify({ error: 'deleteInstanceId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        log.info('Deleting instance from UAZAPI', { deleteInstanceId })

        // Try /instance/delete endpoint
        const deleteResponse = await fetchWithTimeout(`${uazapiUrl}/instance/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': adminToken,
            'token': instanceToken || adminToken,
          },
          body: JSON.stringify({
            instanceId: deleteInstanceId,
            instanceName: body.instanceName || deleteInstanceId,
          }),
        })

        const deleteRawText = await deleteResponse.text()
        log.info('Delete instance response', { status: deleteResponse.status, preview: deleteRawText.substring(0, 300) })

        let deleteData: unknown
        try {
          deleteData = JSON.parse(deleteRawText)
        } catch {
          deleteData = { raw: deleteRawText }
        }

        return new Response(
          JSON.stringify(deleteData),
          { status: deleteResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'disconnect': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        log.info('Disconnecting instance')
        const disconnectResponse = await fetchWithTimeout(`${uazapiUrl}/instance/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({}),
        })

        const disconnectRawText = await disconnectResponse.text()
        let disconnectData: unknown
        try {
          disconnectData = JSON.parse(disconnectRawText)
        } catch {
          disconnectData = { raw: disconnectRawText }
        }

        return new Response(
          JSON.stringify(disconnectData),
          { status: disconnectResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'getProfilePic': {
        if (!instanceToken) {
          return new Response(
            JSON.stringify({ error: 'Instance token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const jid = body.jid || body.id || ''
        if (!jid) {
          return new Response(
            JSON.stringify({ error: 'jid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const picResponse = await fetchWithTimeout(`${uazapiUrl}/contact/getProfilePic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({ id: jid }),
        })
        const picData = await picResponse.json()
        return new Response(
          JSON.stringify(picData),
          { status: picResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Parse response with resilience
    const rawText = await response.text()
    let data: unknown
    try {
      data = JSON.parse(rawText)
    } catch {
      data = { raw: rawText }
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    log.error('Error', { error: errorMessage })
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
