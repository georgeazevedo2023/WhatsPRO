import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { shouldTriggerAiAgentFromWebhook } from '../_shared/aiRuntime.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

// Module-level singleton: reuse connection pool across requests in same Deno isolate
const supabase = createServiceClient()

function normalizeMediaType(raw: string): string {
  if (!raw || raw === '') return 'text'
  const lower = raw.toLowerCase()
  if (lower.includes('image')) return 'image'
  if (lower.includes('video')) return 'video'
  if (lower.includes('audio') || lower.includes('ptt')) return 'audio'
  if (lower.includes('document') || lower.includes('pdf')) return 'document'
  if (lower.includes('sticker')) return 'sticker'
  if (lower.includes('contact')) return 'contact'
  return 'text'
}

const webhookModuleLog = createLogger('whatsapp-webhook')

async function getMediaLink(messageId: string, instanceToken: string, isAudio: boolean = false): Promise<{ url: string; mimetype?: string } | null> {
  try {
    webhookModuleLog.info('Calling /message/download', { messageId, isAudio })
    const body: Record<string, unknown> = {
      id: messageId,
      return_base64: false,
      return_link: true,
    }
    // For audio: request both raw link AND mp3 conversion.
    // Gemini accepts ogg/opus natively, so we prefer the raw link (faster — no conversion).
    // mp3Link is kept as fallback for frontend playback compatibility.
    if (isAudio) {
      body.generate_mp3 = true
    }
    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
    const response = await fetchWithTimeout(`${uazapiUrl}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      webhookModuleLog.error('Download link request failed', { status: response.status, body: await response.text() })
      return null
    }

    const data = await response.json()
    webhookModuleLog.info('UAZAPI /message/download response keys', { keys: Object.keys(data).join(',') })
    // For audio: prefer raw link (ogg/opus — faster, no conversion wait).
    // mp3Link is the converted version — use it only if raw link is missing.
    const rawUrl = data.link || data.url || data.fileUrl || data.fileURL || null
    if (isAudio) {
      const audioUrl = rawUrl || data.mp3Link || null
      const mimetype = data.mimetype || data.mimeType || (data.mp3Link && !rawUrl ? 'audio/mp3' : 'audio/ogg')
      return audioUrl ? { url: audioUrl, mimetype } : null
    }
    return rawUrl ? { url: rawUrl, mimetype: data.mimetype || data.mimeType } : null
  } catch (err) {
    webhookModuleLog.error('Error getting media link', { error: (err as Error).message })
    return null
  }
}

function extractPhone(jid: string): string {
  return jid.split('@')[0].replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Generate unique request ID for tracing across logs
  const reqId = crypto.randomUUID().substring(0, 8)
  const startMs = Date.now()
  const log = createLogger('whatsapp-webhook', reqId)

  try {
    // Validate webhook secret token (if configured — STRONGLY recommended for production)
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (!webhookSecret) {
      log.warn('WEBHOOK_SECRET not set — webhook is unprotected. Configure it in Admin > Secrets.')
    }
    if (webhookSecret) {
      const incomingToken = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
      if (incomingToken !== webhookSecret) {
        log.warn('Invalid webhook secret')
        return unauthorizedResponse(corsHeaders)
      }
    }

    const rawPayload = await req.json()
    log.info('Webhook raw received', { preview: JSON.stringify(rawPayload).substring(0, 500) })

    // Unwrap: n8n pode enviar como array e/ou encapsular em body/Body
    let unwrapped = rawPayload
    if (Array.isArray(unwrapped)) {
      unwrapped = unwrapped[0]
    }
    const inner = unwrapped?.body || unwrapped?.Body
    let payload = (inner?.EventType || inner?.eventType) ? inner : unwrapped
    log.info('Webhook unwrapped', { eventType: payload.EventType || payload.eventType || 'none' })

    // Variables to propagate resolved inbox/conversation from status_ia block
    let resolvedInboxIdForMessage = ''
    let resolvedConversationId = ''

    // 1. Check status_ia FIRST (before isRawMessage) — status_ia payloads must never be treated as messages
    const statusIaPayload = payload.status_ia || unwrapped?.status_ia || inner?.status_ia
    if (!payload.EventType && !payload.eventType && statusIaPayload) {
      log.info('Detected status_ia payload', { statusIaPayload })

      const chatid = payload.chatid || payload.sender || payload.remotejid ||
        unwrapped?.chatid || unwrapped?.sender || unwrapped?.remotejid ||
        inner?.chatid || inner?.sender || inner?.remotejid || ''
      if (!chatid) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_no_chatid' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Use inbox_id directly if provided (skips instance lookup)
      const directInboxId = payload.inbox_id || unwrapped?.inbox_id || inner?.inbox_id || ''
      let resolvedInboxId = directInboxId

      if (!resolvedInboxId) {
        // Fallback: find instance then inbox
        const iaInstanceName = payload.instanceName || payload.instance || payload.instance_name ||
          unwrapped?.instanceName || unwrapped?.instance || unwrapped?.instance_name || ''
        const iaInstanceId = payload.instance_id || unwrapped?.instance_id || ''
        let iaInstanceQuery = supabase.from('instances').select('id, name, token')
        if (iaInstanceId) {
          iaInstanceQuery = iaInstanceQuery.eq('id', iaInstanceId)
        } else if (iaInstanceName) {
          const iaOwnerJid = `${iaInstanceName}@s.whatsapp.net`
          iaInstanceQuery = iaInstanceQuery.or(`id.eq.${iaInstanceName},name.eq.${iaInstanceName},owner_jid.eq.${iaOwnerJid}`)
        } else {
          const ownerField = payload.owner || unwrapped?.owner || ''
          if (ownerField) {
            const ownerClean = ownerField.replace('@s.whatsapp.net', '')
            const ownerWithSuffix = `${ownerClean}@s.whatsapp.net`
            iaInstanceQuery = iaInstanceQuery.or(`owner_jid.eq.${ownerClean},owner_jid.eq.${ownerWithSuffix}`)
          }
        }
        const { data: iaInstance } = await iaInstanceQuery.maybeSingle()
        if (!iaInstance) {
          log.info('status_ia: instance not found')
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_instance_not_found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: iaInbox } = await supabase.from('inboxes').select('id').eq('instance_id', iaInstance.id).maybeSingle()
        if (!iaInbox) {
          log.info('status_ia: no inbox for instance', { instanceId: iaInstance.id })
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_no_inbox' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        resolvedInboxId = iaInbox.id
      }

      // Find contact by JID
      const { data: iaContact } = await supabase.from('contacts').select('id').eq('jid', chatid).maybeSingle()
      if (!iaContact) {
        log.info('status_ia: contact not found', { jid: chatid })
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_contact_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find open/pending conversation
      const { data: iaConv } = await supabase
        .from('conversations')
        .select('id, status_ia')
        .eq('inbox_id', resolvedInboxId)
        .eq('contact_id', iaContact.id)
        .in('status', ['aberta', 'pendente'])
        .order('created_at', { ascending: false })
        .maybeSingle()
      if (!iaConv) {
        // No open conversation found - check if payload also contains message content
        const hasMessageContentNoConv = payload.content?.text || unwrapped?.content?.text
        if (!hasMessageContentNoConv) {
          log.info('status_ia: no open conversation found and no message content')
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_no_conversation' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // Has message content - fall through to message processing which will create the conversation
        log.info('status_ia: no open conversation but has message content, falling through to message processing')
        resolvedInboxIdForMessage = resolvedInboxId
      } else {
        // Conversation found - update status_ia
        await supabase.from('conversations').update({ status_ia: statusIaPayload }).eq('id', iaConv.id)
        log.info('status_ia updated', { statusIaPayload, conversationId: iaConv.id })

        // Broadcast via REST API
        const SB_URL = Deno.env.get('SUPABASE_URL')!
        const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
        const iaBroadcast = { conversation_id: iaConv.id, status_ia: statusIaPayload }
        await Promise.all(
          ['helpdesk-realtime', 'helpdesk-conversations'].map(topic =>
            fetch(`${SB_URL}/realtime/v1/api/broadcast`, {
              method: 'POST',
              headers: { 'apikey': SB_ANON, 'Content-Type': 'application/json', 'Authorization': `Bearer ${SB_ANON}` },
              body: JSON.stringify({ messages: [{ topic, event: 'new-message', payload: iaBroadcast }] }),
            })
          )
        )

        // Check if payload ALSO contains a message to save (e.g. agent IA response)
        const hasMessageContent = payload.content?.text || unwrapped?.content?.text
        if (!hasMessageContent) {
          // Pure status_ia update - return early
          return new Response(JSON.stringify({ ok: true, status_ia: statusIaPayload, conversation_id: iaConv.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Has message content alongside status_ia - fall through to message processing
        resolvedInboxIdForMessage = resolvedInboxId
        resolvedConversationId = iaConv.id
        log.info('status_ia updated, continuing to process message', { contentPreview: hasMessageContent.substring(0, 80), resolvedInboxId: resolvedInboxIdForMessage })
      }
    }

    // 2. Detect raw UAZAPI message format (e.g. from n8n agent output)
    const isRawMessage = !payload.EventType && !payload.eventType && (payload.chatid || payload.content)
    if (isRawMessage) {
      log.info('Detected raw UAZAPI message format (agent output), synthesizing payload')
      if (payload.fromMe === undefined && payload.content?.text) {
        payload.fromMe = true
      }
      const rawPayloadRef = payload
      payload = {
        EventType: 'messages',
        instanceName: payload.owner || '',
        message: rawPayloadRef,
        chat: null,
        inbox_id: rawPayloadRef.inbox_id || '',
      }
    }

    // UAZAPI sends EventType field
    const eventType = payload.EventType || payload.eventType || payload.event || ''

    // Only process message events
    if (eventType !== 'messages') {
      log.info('Ignoring event type', { eventType })
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'not_message_event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = payload.message
    const chat = payload.chat

    if (!message) {
      log.error('No message object in payload')
      return new Response(JSON.stringify({ error: 'No message data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Skip group messages
    if (message.isGroup === true) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract instance name
    const instanceName = payload.instanceName || payload.instance || ''

    // If inbox_id was already resolved from status_ia block, skip instance/inbox lookup
    let instance: { id: string; name: string; token: string } | null = null
    let inbox: { id: string } | null = null

    // Check for inbox_id from payload (propagated from isRawMessage) or from status_ia resolution
    const payloadInboxId = payload.inbox_id || resolvedInboxIdForMessage

    if (payloadInboxId) {
      log.info('Using pre-resolved inbox_id', { inboxId: payloadInboxId })
      inbox = { id: payloadInboxId }

      // Still need instance for token (media download etc)
      const { data: inboxData } = await supabase.from('inboxes').select('id, instance_id').eq('id', payloadInboxId).maybeSingle()
      if (inboxData) {
        const { data: inst } = await supabase.from('instances').select('id, name, token, user_id').eq('id', inboxData.instance_id).maybeSingle()
        instance = inst
      }
      if (!instance) {
        log.warn('Could not find instance for pre-resolved inbox, proceeding with null token')
        instance = { id: '', name: '', token: '' }
      }
    } else {
      if (!instanceName) {
        log.error('No instance identifier in payload')
        return new Response(JSON.stringify({ error: 'No instance identifier' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find instance by name, id, or owner_jid (with AND without suffix)
      // Also check payload.owner field as fallback (UAZAPI sends owner phone number)
      const ownerField = payload.owner || message?.owner || ''
      // Sanitize instance identifiers to prevent PostgREST filter injection
      const sanitize = (s: string) => s.replace(/[,()]/g, '')
      const ownerClean = sanitize(instanceName.replace('@s.whatsapp.net', ''))
      const ownerWithSuffix = `${ownerClean}@s.whatsapp.net`

      let orConditions = `id.eq.${ownerClean},name.eq.${ownerClean},owner_jid.eq.${ownerClean},owner_jid.eq.${ownerWithSuffix}`

      // Add owner field as additional lookup (phone number of the instance)
      if (ownerField && ownerField !== instanceName) {
        const ownerFieldClean = sanitize(ownerField.replace('@s.whatsapp.net', ''))
        const ownerFieldWithSuffix = `${ownerFieldClean}@s.whatsapp.net`
        orConditions += `,owner_jid.eq.${ownerFieldClean},owner_jid.eq.${ownerFieldWithSuffix}`
      }

      const { data: foundInstance } = await supabase
        .from('instances')
        .select('id, name, token, user_id')
        .or(orConditions)
        .maybeSingle()

      if (!foundInstance) {
        log.error('Instance not found', { instanceName, ownerField, ownerClean })
        return new Response(JSON.stringify({ error: 'Instance not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      instance = foundInstance

      // Find inbox for this instance
      const { data: foundInbox } = await supabase
        .from('inboxes')
        .select('id')
        .eq('instance_id', instance.id)
        .maybeSingle()

      if (!foundInbox) {
        log.info('No inbox configured for instance', { instanceId: instance.id })
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_inbox' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      inbox = foundInbox
    }

    // Extract message fields from UAZAPI format
    const chatId = message.chatid || message.sender || ''
    const fromMe = message.fromMe === true
    const direction = fromMe ? 'outgoing' : 'incoming'
    const rawExternalId = message.messageid || message.id || ''
    const externalId = rawExternalId.includes(':') ? rawExternalId.split(':').pop()! : rawExternalId
    const owner = payload.owner || chatId.split('@')[0] || ''

    // Extract content and media
    let mediaType = normalizeMediaType(message.mediaType || message.messageType || message.type || '')
    let mediaUrl = message.fileURL || message.mediaUrl || ''
    if (!mediaUrl && message.content && typeof message.content === 'object') {
      mediaUrl = message.content.URL || message.content.url || ''
    }
    const rawContent = message.text || message.caption || ''
    let content = typeof rawContent === 'string' ? rawContent : ''
    if (!content && typeof message.content === 'string') {
      content = message.content
    }
    // Capture button reply clicks (carousel "Gostei" / quick reply)
    if (!content && message.selectedButtonId) {
      content = message.selectedButtonText || message.selectedButtonId || ''
    }
    if (!content && message.listResponse?.id) {
      content = message.listResponse.title || message.listResponse.id || ''
    }
    // Agent output: content can be { text: "..." }
    if (!content && typeof message.content === 'object' && message.content?.text) {
      content = message.content.text
    }

    // Contact message: store vcard data in media_url as JSON
    if (mediaType === 'contact' && typeof message.content === 'object' && message.content?.vcard) {
      mediaUrl = JSON.stringify({
        displayName: message.content.displayName || '',
        vcard: message.content.vcard,
      })
      if (!content) {
        content = message.content.displayName || message.text || 'Contato'
      }
    }

    // Fallback content for media without caption
    if (mediaType !== 'text' && mediaType !== 'contact' && !content && message.fileName) {
      content = message.fileName
    }

    // Log ALL media-related fields for debugging
    log.info('Full message keys', { keys: Object.keys(message).join(',') })
    log.info('Message media fields', {
      fileURL: message.fileURL,
      fileUrl: message.fileUrl,
      file_url: message.file_url,
      mediaUrl: message.mediaUrl,
      media_url: message.media_url,
      contentURL: message.content?.URL,
      contentUrl: message.content?.url,
      mediaType: message.mediaType,
      fileName: message.fileName,
      resolvedMediaUrl: mediaUrl?.substring(0, 100),
    })

    // Media: obter link persistente da UAZAPI antes de salvar
    const mimeExtMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-matroska': 'mkv',
      'video/webm': 'webm',
      'video/3gpp': '3gp',
    }

    // ── Parallel: media link + deduplication + contact lookup ──────────
    // These 3 operations are independent — run them concurrently to reduce latency.
    const needsMedia = mediaType !== 'text' && mediaType !== 'contact' && externalId && instance.token
    const contactJid = fromMe ? chatId : (message.sender_pn || message.sender || chatId)

    const [mediaResult, dupResult, contactResult] = await Promise.all([
      // 1. Media link resolution (500ms+ UAZAPI call → now parallel)
      needsMedia
        ? getMediaLink(externalId, instance.token, mediaType === 'audio')
        : Promise.resolve(null),
      // 2. Deduplication check
      externalId
        ? supabase.from('conversation_messages').select('id')
            .or(`external_id.eq.${externalId},external_id.eq.${owner}:${externalId}`)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // 3. Contact lookup
      supabase.from('contacts').select('id, name, profile_pic_url').eq('jid', contactJid).maybeSingle(),
    ])

    // Process media result
    let mediaMimetype = ''
    if (mediaResult) {
      mediaUrl = mediaResult.url
      mediaMimetype = mediaResult.mimetype || ''
      const mime = mediaMimetype
      if (mime.startsWith('video/') && mediaType !== 'video') mediaType = 'video'
      if (mime.startsWith('image/') && mediaType !== 'image') mediaType = 'image'
      if (mediaType === 'document' && !mime.startsWith('video/') && !content) {
        const ext = mimeExtMap[mime] || mime.split('/').pop() || 'pdf'
        content = `Documento.${ext}`
      }
      log.info('Media resolved', { mediaType, urlPreview: mediaUrl?.substring(0, 80) })
    }

    log.info('Processing message', { direction, mediaType, externalId, chatId, hasMediaUrl: !!mediaUrl })

    // Deduplication: skip if message already exists
    if (dupResult.data) {
      log.info('Duplicate message skipped', { externalId })
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract contact info
    const contactPhone = extractPhone(contactJid)
    const contactName = fromMe
      ? (chat?.wa_contactName || chat?.name || contactPhone)
      : (chat?.wa_contactName || chat?.name || message.senderName || contactPhone)
    const contactProfilePic = chat?.imagePreview || chat?.image || message.profilePicUrl || message.profilePic || null

    // Resolve profile picture: prefer payload data, then fetch from UAZAPI in background
    let resolvedProfilePic = contactProfilePic ? String(contactProfilePic) : null
    let { data: contact } = contactResult

    // Profile pic fetch: moved to non-blocking background (doesn't delay message processing)
    if (!resolvedProfilePic && (!contact || !contact.profile_pic_url) && instance?.token && contactJid) {
      // Fire-and-forget: fetch profile pic and update contact later
      const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
      fetchWithTimeout(`${uazapiUrl}/contact/getProfilePic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ id: contactJid }),
      }, 5000).then(async (picResp) => {
        if (picResp.ok) {
          const picData = await picResp.json()
          const picUrl = picData.profilePicUrl || picData.imgUrl || picData.url || picData.eurl || null
          if (picUrl && typeof picUrl === 'string' && picUrl.startsWith('http')) {
            await supabase.from('contacts').update({ profile_pic_url: picUrl }).eq('jid', contactJid)
            log.info('Profile pic updated async', { jid: contactJid })
          }
        }
      }).catch(() => {}) // Non-critical
    }

    if (!contact) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({ jid: contactJid, phone: contactPhone, name: contactName, profile_pic_url: resolvedProfilePic })
        .select('id, name, profile_pic_url')
        .single()
      contact = newContact
    } else {
      // Update contact info if changed (pushname, profile pic)
      const updates: Record<string, string> = {}
      if (resolvedProfilePic && !contact.profile_pic_url) updates.profile_pic_url = resolvedProfilePic
      if (contactName && contactName !== contactPhone && contactName !== (contact as any).name) updates.name = contactName
      if (Object.keys(updates).length > 0) {
        await supabase.from('contacts').update(updates).eq('id', contact.id)
      }
    }

    if (!contact) {
      log.error('Failed to upsert contact')
      return new Response(JSON.stringify({ error: 'Failed to upsert contact' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert timestamp (UAZAPI sends ms)
    const msgTimestamp = message.messageTimestamp
      ? new Date(Number(message.messageTimestamp)).toISOString()
      : new Date().toISOString()

    // Find or create conversation (use pre-resolved if available from status_ia)
    let conversation: { id: string; status_ia?: string | null } | null = resolvedConversationId
      ? { id: resolvedConversationId, status_ia: statusIaPayload ?? null }
      : null

    if (!conversation) {
      const { data: foundConv } = await supabase
        .from('conversations')
        .select('id, status_ia')
        .eq('inbox_id', inbox.id)
        .eq('contact_id', contact.id)
        .in('status', ['aberta', 'pendente'])
        .order('created_at', { ascending: false })
        .maybeSingle()
      conversation = foundConv
    }

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          inbox_id: inbox.id,
          contact_id: contact.id,
          status: 'aberta',
          priority: 'media',
          is_read: false,
          last_message_at: msgTimestamp,
        })
        .select('id, status_ia')
        .single()
      conversation = newConv
    }

    if (!conversation) {
      log.error('Failed to create conversation')
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert message
    const { data: insertedMsg, error: insertError } = await supabase.from('conversation_messages').insert({
      conversation_id: conversation.id,
      direction,
      content,
      media_type: mediaType,
      media_url: mediaUrl || null,
      external_id: externalId || null,
      created_at: msgTimestamp,
    }).select('id').maybeSingle()

    if (insertError) {
      if (insertError.code === '23505') {
        log.info('Duplicate detected by unique index, skipping', { externalId })
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate_index' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      log.error('Failed to insert message', { error: insertError.message })
      return new Response(JSON.stringify({ error: 'Failed to insert message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!insertedMsg) {
      log.info('No row inserted (possible duplicate)', { externalId })
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_insert' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update conversation
    const lastMessagePreview = content || (mediaType === 'image' ? '📷 Foto' : mediaType === 'video' ? '🎥 Vídeo' : mediaType === 'audio' ? '🎵 Áudio' : mediaType === 'document' ? '📎 Documento' : '')
    const updateData: Record<string, unknown> = { last_message_at: msgTimestamp, last_message: lastMessagePreview }
    if (direction === 'incoming') {
      updateData.is_read = false
    }
    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation.id)

    // Auto-add contact to instance lead database (fire-and-forget, atomic upsert)
    if (direction === 'incoming' && contactPhone && contactJid) {
      (async () => {
        try {
          // Find lead database for this instance (indexed by instance_id UNIQUE)
          let { data: leadDb } = await supabase
            .from('lead_databases')
            .select('id')
            .eq('instance_id', instance.id)
            .maybeSingle()

          if (!leadDb) {
            // Reuse instance data already loaded (includes user_id, name) — avoids redundant query
            if (instance?.user_id && instance?.name) {
              const { data: newDb } = await supabase
                .from('lead_databases')
                .upsert({
                  name: `Helpdesk - ${instance.name}`,
                  user_id: instance.user_id,
                  instance_id: instance.id,
                  leads_count: 0,
                }, { onConflict: 'instance_id' })
                .select('id')
                .single()
              leadDb = newDb
            }
          }

          if (leadDb && contactPhone && contactPhone.length >= 10) {
            // Atomic upsert: insert or update name — eliminates check-then-insert race
            const { error: upsertErr } = await supabase
              .from('lead_database_entries')
              .upsert({
                database_id: leadDb.id,
                phone: contactPhone,
                jid: contactJid,
                name: contactName || null,
                source: 'helpdesk',
                is_verified: true,
                verification_status: 'valid',
              }, {
                onConflict: 'database_id,phone',
                ignoreDuplicates: false,
              })

            if (!upsertErr) {
              // Atomic count via RPC — no lost updates
              const { error: rpcErr } = await supabase.rpc('update_lead_count_from_entries', { p_database_id: leadDb.id })
              if (rpcErr) {
                // Fallback: count entries directly
                const { count } = await supabase.from('lead_database_entries')
                  .select('*', { count: 'exact', head: true })
                  .eq('database_id', leadDb.id)
                if (count !== null) {
                  await supabase.from('lead_databases').update({ leads_count: count }).eq('id', leadDb.id)
                }
              }
            }
          }
        } catch (err) {
          log.error('Error auto-adding to lead database', { error: (err as Error).message })
        }
      })()
    }

    // Extract status_ia from original message payload
    const statusIa = message.status_ia || rawPayload?.status_ia || (Array.isArray(rawPayload) ? rawPayload[0]?.status_ia : null) || null
    if (statusIa) {
      log.info('status_ia detected — persisting', { statusIa, conversationId: conversation.id })
      await supabase
        .from('conversations')
        .update({ status_ia: statusIa })
        .eq('id', conversation.id)
      conversation.status_ia = statusIa
    }

    // ── UTM Campaign Attribution ──────────────────────────────────────
    if (direction === 'incoming' && content) {
      const refMatch = content.match(/ref_([A-Za-z0-9]{6,12})/)
      if (refMatch) {
        const refCode = refMatch[1]
        try {
          const { data: visit } = await supabase
            .from('utm_visits')
            .select('id, campaign_id, status')
            .eq('ref_code', refCode)
            .eq('status', 'visited')
            .maybeSingle()

          if (visit) {
            await supabase.from('utm_visits').update({
              contact_id: contact.id,
              conversation_id: conversation.id,
              matched_at: new Date().toISOString(),
              status: 'matched',
            }).eq('id', visit.id)

            const { data: campaign } = await supabase
              .from('utm_campaigns')
              .select('id, name, status, expires_at, utm_source, utm_medium, campaign_type')
              .eq('id', visit.campaign_id)
              .eq('status', 'active')
              .maybeSingle()

            const campaignExpired = campaign?.expires_at && new Date(campaign.expires_at) < new Date()
            if (campaignExpired) {
              log.info('UTM skip: campaign expired', { expires_at: campaign!.expires_at, refCode })
            }

            if (campaign && !campaignExpired) {
              const campaignTags = [
                `campanha:${campaign.name}`,
                `utm_source:${campaign.utm_source}`,
                `origem:campanha`,
              ].filter(t => !t.endsWith(':'))

              const { data: convData } = await supabase
                .from('conversations')
                .select('tags')
                .eq('id', conversation.id)
                .single()

              const existing: string[] = convData?.tags || []
              const tagMap = new Map<string, string>()
              for (const t of existing) tagMap.set(t.split(':')[0], t)
              for (const t of campaignTags) tagMap.set(t.split(':')[0], t)

              await supabase.from('conversations')
                .update({ tags: Array.from(tagMap.values()) })
                .eq('id', conversation.id)

              log.info('UTM campaign matched', { campaignName: campaign.name, refCode })
            }
          }
        } catch (err) {
          log.error('UTM attribution error (non-critical)', { error: (err as Error).message })
        }
      }
    }

    // Broadcast via REST API
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const broadcastPayload: Record<string, unknown> = {
      conversation_id: conversation.id,
      inbox_id: inbox.id,
      message_id: insertedMsg.id,
      direction,
      content,
      media_type: mediaType,
      media_url: mediaUrl || null,
      created_at: msgTimestamp,
    }
    if (statusIa) {
      broadcastPayload.status_ia = statusIa
    }
    // Broadcast via Realtime REST — with timeout and error resilience
    // If Realtime API is slow/down, don't block the webhook response
    const topics = ['helpdesk-realtime', 'helpdesk-conversations']
    const broadcastWithTimeout = async (topic: string) => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 3000) // 3s timeout
      try {
        const resp = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            messages: [{ topic, event: 'new-message', payload: broadcastPayload }],
          }),
        })
        return resp.status
      } catch {
        return 0 // timeout or network error
      } finally {
        clearTimeout(timer)
      }
    }
    const broadcastStatuses = await Promise.all(topics.map(broadcastWithTimeout))

    log.info('Message processed', { latency_ms: Date.now() - startMs, broadcastStatuses: broadcastStatuses.join(','), conversationId: conversation.id, direction, mediaType })

    // Wrapper to ensure background fetches survive response return in Edge Functions
    const backgroundFetch = (promise: Promise<any>) => {
      // @ts-ignore: EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        // @ts-ignore
        EdgeRuntime.waitUntil(promise)
      }
    }

    // Enqueue audio transcription via job_queue (D-01: primary mechanism, not fallback)
    if (mediaType === 'audio' && mediaUrl && insertedMsg && direction === 'incoming') {
      log.info('Enqueueing audio transcription job', { messageId: insertedMsg.id })
      const { error: jobErr } = await supabase.from('job_queue').insert({
        job_type: 'transcribe_audio',
        payload: {
          messageId: insertedMsg.id,
          audioUrl: mediaUrl,
          mimeType: mediaMimetype || null,
          conversationId: conversation.id,
        },
        status: 'pending',
        attempts: 0,
        max_retries: 1,
      })
      if (jobErr) {
        log.error('Failed to enqueue transcription job', { error: jobErr.message })
      }
    }

    // Mark pending follow-ups as "replied" when lead sends a message (fire-and-forget)
    if (direction === 'incoming' && !fromMe && conversation?.id) {
      supabase.from('follow_up_executions')
        .update({ status: 'replied', replied_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('status', 'sent')
        .then(() => {})
    }

    // ── Form-bot interception: handle FORM: trigger or active form session ────
    if (direction === 'incoming' && !fromMe && conversation?.id) {
      const isFormInit = content?.startsWith('FORM:') || content?.toUpperCase().startsWith('FORM:')
      let hasActiveSession = false

      if (!isFormInit) {
        const { data: activeSession } = await supabase
          .from('form_sessions')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('status', 'in_progress')
          .maybeSingle()
        hasActiveSession = !!activeSession
      }

      if (isFormInit || hasActiveSession) {
        log.info('Routing to form-bot', { conversationId: conversation.id, isFormInit })
        backgroundFetch(fetch(`${SUPABASE_URL}/functions/v1/form-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_text: content ?? '',
            instance_id: instance.id,
          }),
        }).catch(err => log.error('Form-bot call failed', { error: (err as Error).message })))

        return new Response(JSON.stringify({ ok: true, processed: 'form_bot', conversation_id: conversation.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    // ── End form-bot interception ─────────────────────────────────────────────

    // Trigger AI Agent for incoming messages (if enabled for this instance)
    // Skip audio messages — transcribe-audio will trigger the agent after transcription
    if (shouldTriggerAiAgentFromWebhook({
      direction,
      fromMe,
      mediaType,
      statusIa: conversation.status_ia,
    })) {
      // Check if instance has ai_agent enabled
      const { data: aiAgent } = await supabase
        .from('ai_agents')
        .select('id, enabled')
        .eq('instance_id', instance.id)
        .eq('enabled', true)
        .maybeSingle()

      if (aiAgent) {
        log.info('AI Agent active, triggering debounce', { conversationId: conversation.id })
        backgroundFetch(fetch(`${SUPABASE_URL}/functions/v1/ai-agent-debounce`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            instance_id: instance.id,
            contact_jid: contactJid,
            message: {
              content,
              media_type: mediaType,
              media_url: mediaUrl || null,
              direction: 'incoming',
            },
          }),
        }).catch(err => log.error('AI Agent debounce call failed', { error: (err as Error).message })))
      }
    }

    return new Response(JSON.stringify({ ok: true, conversation_id: conversation.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    log.error('Webhook error', { latency_ms: Date.now() - startMs, error: (error as Error).message })
    return new Response(JSON.stringify({ error: 'Internal server error', request_id: reqId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
