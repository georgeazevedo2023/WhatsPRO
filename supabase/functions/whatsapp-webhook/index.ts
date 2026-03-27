import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { shouldTriggerAiAgentFromWebhook } from '../_shared/aiRuntime.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

// Module-level singleton: reuse connection pool across requests in same Deno isolate
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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

async function getMediaLink(messageId: string, instanceToken: string, isAudio: boolean = false): Promise<{ url: string; mimetype?: string } | null> {
  try {
    console.log('Calling /message/download for messageId:', messageId, 'isAudio:', isAudio)
    const body: Record<string, unknown> = {
      id: messageId,
      return_base64: false,
      return_link: true,
    }
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
      console.error('Download link request failed:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    console.log('UAZAPI /message/download full response:', JSON.stringify(data))
    // For audio with generate_mp3, prefer mp3Link
    if (isAudio && data.mp3Link) {
      return { url: data.mp3Link, mimetype: data.mimetype || data.mimeType }
    }
    const url = data.link || data.url || data.fileUrl || data.fileURL || null
    return url ? { url, mimetype: data.mimetype || data.mimeType } : null
  } catch (err) {
    console.error('Error getting media link:', err)
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

  try {
    // Validate webhook secret token (if configured)
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (webhookSecret) {
      const incomingToken = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
      if (incomingToken !== webhookSecret) {
        console.warn(`[${reqId}] Invalid webhook secret`)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const rawPayload = await req.json()
    console.log('Webhook raw received:', JSON.stringify(rawPayload).substring(0, 500))

    // Unwrap: n8n pode enviar como array e/ou encapsular em body/Body
    let unwrapped = rawPayload
    if (Array.isArray(unwrapped)) {
      unwrapped = unwrapped[0]
    }
    const inner = unwrapped?.body || unwrapped?.Body
    let payload = (inner?.EventType || inner?.eventType) ? inner : unwrapped
    console.log('Webhook unwrapped EventType:', payload.EventType || payload.eventType || 'none')

    // Variables to propagate resolved inbox/conversation from status_ia block
    let resolvedInboxIdForMessage = ''
    let resolvedConversationId = ''

    // 1. Check status_ia FIRST (before isRawMessage) — status_ia payloads must never be treated as messages
    const statusIaPayload = payload.status_ia || unwrapped?.status_ia || inner?.status_ia
    if (!payload.EventType && !payload.eventType && statusIaPayload) {
      console.log('Detected status_ia payload:', statusIaPayload)

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
          console.log('status_ia: instance not found')
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_instance_not_found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: iaInbox } = await supabase.from('inboxes').select('id').eq('instance_id', iaInstance.id).maybeSingle()
        if (!iaInbox) {
          console.log('status_ia: no inbox for instance', iaInstance.id)
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_no_inbox' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        resolvedInboxId = iaInbox.id
      }

      // Find contact by JID
      const { data: iaContact } = await supabase.from('contacts').select('id').eq('jid', chatid).maybeSingle()
      if (!iaContact) {
        console.log('status_ia: contact not found for jid', chatid)
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
          console.log('status_ia: no open conversation found and no message content')
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'status_ia_no_conversation' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // Has message content - fall through to message processing which will create the conversation
        console.log('status_ia: no open conversation but has message content, falling through to message processing')
        resolvedInboxIdForMessage = resolvedInboxId
      } else {
        // Conversation found - update status_ia
        await supabase.from('conversations').update({ status_ia: statusIaPayload }).eq('id', iaConv.id)
        console.log('status_ia updated to', statusIaPayload, 'for conversation', iaConv.id)

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
        console.log('status_ia updated, continuing to process message content:', hasMessageContent.substring(0, 80), 'resolvedInboxId:', resolvedInboxIdForMessage)
      }
    }

    // 2. Detect raw UAZAPI message format (e.g. from n8n agent output)
    const isRawMessage = !payload.EventType && !payload.eventType && (payload.chatid || payload.content)
    if (isRawMessage) {
      console.log('Detected raw UAZAPI message format (agent output), synthesizing payload')
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
      console.log('Ignoring event type:', eventType)
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'not_message_event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = payload.message
    const chat = payload.chat

    if (!message) {
      console.error('No message object in payload')
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
      console.log('Using pre-resolved inbox_id:', payloadInboxId)
      inbox = { id: payloadInboxId }

      // Still need instance for token (media download etc)
      const { data: inboxData } = await supabase.from('inboxes').select('id, instance_id').eq('id', payloadInboxId).maybeSingle()
      if (inboxData) {
        const { data: inst } = await supabase.from('instances').select('id, name, token').eq('id', inboxData.instance_id).maybeSingle()
        instance = inst
      }
      if (!instance) {
        console.log('Could not find instance for pre-resolved inbox, proceeding with null token')
        instance = { id: '', name: '', token: '' }
      }
    } else {
      if (!instanceName) {
        console.error('No instance identifier in payload')
        return new Response(JSON.stringify({ error: 'No instance identifier' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find instance by name, id, or owner_jid (with AND without suffix)
      // Also check payload.owner field as fallback (UAZAPI sends owner phone number)
      const ownerField = payload.owner || message?.owner || ''
      const ownerClean = instanceName.replace('@s.whatsapp.net', '')
      const ownerWithSuffix = `${ownerClean}@s.whatsapp.net`

      let orConditions = `id.eq.${instanceName},name.eq.${instanceName},owner_jid.eq.${ownerClean},owner_jid.eq.${ownerWithSuffix}`

      // Add owner field as additional lookup (phone number of the instance)
      if (ownerField && ownerField !== instanceName) {
        const ownerFieldClean = ownerField.replace('@s.whatsapp.net', '')
        const ownerFieldWithSuffix = `${ownerFieldClean}@s.whatsapp.net`
        orConditions += `,owner_jid.eq.${ownerFieldClean},owner_jid.eq.${ownerFieldWithSuffix}`
      }

      const { data: foundInstance } = await supabase
        .from('instances')
        .select('id, name, token')
        .or(orConditions)
        .maybeSingle()

      if (!foundInstance) {
        console.error('Instance not found:', instanceName, 'owner:', ownerField, 'ownerClean:', ownerClean)
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
        console.log('No inbox configured for instance:', instance.id)
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
    console.log('Full message keys:', Object.keys(message).join(','))
    console.log('Message media fields:', JSON.stringify({
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
    }))

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
    if (mediaResult) {
      mediaUrl = mediaResult.url
      const mime = mediaResult.mimetype || ''
      if (mime.startsWith('video/') && mediaType !== 'video') mediaType = 'video'
      if (mime.startsWith('image/') && mediaType !== 'image') mediaType = 'image'
      if (mediaType === 'document' && !mime.startsWith('video/') && !content) {
        const ext = mimeExtMap[mime] || mime.split('/').pop() || 'pdf'
        content = `Documento.${ext}`
      }
      console.log('Media resolved:', mediaType, mediaUrl?.substring(0, 80))
    }

    console.log(`Processing: direction=${direction}, mediaType=${mediaType}, externalId=${externalId}, chatId=${chatId}, mediaUrl=${mediaUrl ? 'YES' : 'NO'}`)

    // Deduplication: skip if message already exists
    if (dupResult.data) {
      console.log('Duplicate message skipped:', externalId)
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
            console.log('Profile pic updated async for', contactJid)
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
      console.error('Failed to upsert contact')
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
      console.error('Failed to create conversation')
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
        console.log('Duplicate detected by unique index, skipping:', externalId)
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate_index' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('Failed to insert message:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to insert message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!insertedMsg) {
      console.log('No row inserted (possible duplicate):', externalId)
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
            const { data: instanceData } = await supabase
              .from('instances')
              .select('user_id, name')
              .eq('id', instance.id)
              .single()

            if (instanceData) {
              const { data: newDb } = await supabase
                .from('lead_databases')
                .upsert({
                  name: `Helpdesk - ${instanceData.name}`,
                  user_id: instanceData.user_id,
                  instance_id: instance.id,
                  leads_count: 0,
                }, { onConflict: 'instance_id' })
                .select('id')
                .single()
              leadDb = newDb
            }
          }

          if (leadDb) {
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
          console.error('Error auto-adding to lead database:', err)
        }
      })()
    }

    // Extract status_ia from original message payload
    const statusIa = message.status_ia || rawPayload?.status_ia || (Array.isArray(rawPayload) ? rawPayload[0]?.status_ia : null) || null
    if (statusIa) {
      console.log('status_ia detected:', statusIa, '— persisting to conversation', conversation.id)
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
              .select('id, name, utm_source, utm_medium, campaign_type')
              .eq('id', visit.campaign_id)
              .maybeSingle()

            if (campaign) {
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

              console.log('UTM campaign matched:', campaign.name, 'ref:', refCode)
            }
          }
        } catch (err) {
          console.error('UTM attribution error (non-critical):', err)
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

    console.log(`[${reqId}] Message processed (${Date.now() - startMs}ms) broadcast:${broadcastStatuses.join(',')}`, conversation.id, direction, mediaType)

    // Trigger async transcription for incoming audio messages
    if (mediaType === 'audio' && mediaUrl && insertedMsg && direction === 'incoming') {
      console.log('Triggering audio transcription for message:', insertedMsg.id)
      const SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SVC_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: insertedMsg.id,
          audioUrl: mediaUrl,
          conversationId: conversation.id,
        }),
      }).catch(err => console.error('Transcription call failed:', err))
    }

    // Mark pending follow-ups as "replied" when lead sends a message (fire-and-forget)
    if (direction === 'incoming' && !fromMe && conversation?.id) {
      supabase.from('follow_up_executions')
        .update({ status: 'replied', replied_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('status', 'sent')
        .then(() => {})
    }

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
        console.log('AI Agent active, triggering debounce for conversation:', conversation.id)
        fetch(`${SUPABASE_URL}/functions/v1/ai-agent-debounce`, {
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
        }).catch(err => console.error('AI Agent debounce call failed:', err))
      }
    }

    return new Response(JSON.stringify({ ok: true, conversation_id: conversation.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(`[${reqId}] Webhook error (${Date.now() - startMs}ms):`, error)
    return new Response(JSON.stringify({ error: 'Internal server error', request_id: reqId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
