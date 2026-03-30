import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const serviceClient = createServiceClient()
const log = createLogger('sync-conversations')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(corsHeaders, 'Unauthorized', 401)
    }

    const supabase = createUserClient(req)

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData?.user) {
      return errorResponse(corsHeaders, 'Unauthorized', 401)
    }

    const { inbox_id } = await req.json()
    if (!inbox_id) {
      return errorResponse(corsHeaders, 'inbox_id required', 400)
    }

    // Verify user has access to this inbox (via RLS on user's client)
    const { data: inbox, error: inboxError } = await supabase
      .from('inboxes')
      .select('id, name, instance_id')
      .eq('id', inbox_id)
      .single()

    if (inboxError || !inbox) {
      return errorResponse(corsHeaders, 'Inbox not found or access denied', 403)
    }

    // Use service client to get instance token (user client can't access tokens)
    const { data: instance, error: instanceError } = await serviceClient
      .from('instances')
      .select('id, name, token')
      .eq('id', inbox.instance_id)
      .single()

    if (instanceError || !instance) {
      return errorResponse(corsHeaders, 'Instance not found for this inbox', 404)
    }

    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
    const instanceToken = instance.token

    log.info('Syncing conversations', { inbox: inbox.name, instance: instance.name })

    // 2. Fetch chats from UAZAPI
    const chatsRes = await fetchWithTimeout(`${uazapiUrl}/chat/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instanceToken },
      body: JSON.stringify({ wa_isGroup: false, limit: 200, sort: '-wa_lastMsgTimestamp' }),
    })

    const chatsText = await chatsRes.text()
    if (!chatsRes.ok) {
      return errorResponse(corsHeaders, `UAZAPI /chat/find returned ${chatsRes.status}`, 502)
    }

    let chatsParsed: unknown
    try { chatsParsed = JSON.parse(chatsText) } catch {
      return errorResponse(corsHeaders, 'Failed to parse /chat/find response', 502)
    }

    let chats: Array<Record<string, unknown>> = []
    if (Array.isArray(chatsParsed)) {
      chats = chatsParsed
    } else if (chatsParsed && typeof chatsParsed === 'object') {
      const obj = chatsParsed as Record<string, unknown>
      const candidate = obj.chats || obj.data || obj.Data || obj.results
      if (Array.isArray(candidate)) chats = candidate
    }

    // Filter individual chats (exclude groups and status broadcast)
    const individualChats = chats.filter((chat) => {
      const jid = String(chat.wa_chatid || chat.wa_fastid || chat.jid || chat.id || '')
      return jid.endsWith('@s.whatsapp.net') && !jid.includes('status')
    })

    log.info('Chats fetched', { total: chats.length, individual: individualChats.length })

    // 3. Fetch ALL messages ONCE with high limit
    log.info('Fetching all messages in a single batch')
    const msgsRes = await fetchWithTimeout(`${uazapiUrl}/message/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instanceToken },
      body: JSON.stringify({ limit: 500, sort: '-wa_timestamp' }),
    })

    const msgsText = await msgsRes.text()
    log.info('Message batch fetched', { status: msgsRes.status, length: msgsText.length })

    let allMessages: Array<Record<string, unknown>> = []
    if (msgsRes.ok) {
      let msgsData: unknown
      try { msgsData = JSON.parse(msgsText) } catch { msgsData = null }

      if (Array.isArray(msgsData)) {
        allMessages = msgsData
      } else if (msgsData && typeof msgsData === 'object') {
        const obj = msgsData as Record<string, unknown>
        const candidate = obj.messages || obj.Messages || obj.data || obj.Data || obj.results
        if (Array.isArray(candidate)) allMessages = candidate
      }
    }

    log.info('Total messages fetched', { count: allMessages.length })

    // 4. Group messages by chatid (the REAL field in the response)
    const messagesByChat = new Map<string, Array<Record<string, unknown>>>()
    for (const msg of allMessages) {
      // Use chatid (V2 actual field), fallback to wa_chatid, remoteJid
      const chatid = String(msg.chatid || msg.wa_chatid || msg.remoteJid || (msg.key as Record<string,unknown>)?.remoteJid || '')
      if (!chatid) continue
      if (!messagesByChat.has(chatid)) {
        messagesByChat.set(chatid, [])
      }
      messagesByChat.get(chatid)!.push(msg)
    }

    // Log distribution for debugging
    const distribution: Record<string, number> = {}
    for (const [chatid, msgs] of messagesByChat) {
      distribution[chatid] = msgs.length
    }
    log.info('Message distribution by chatid', { distribution: JSON.stringify(distribution) })

    // 5. Process each chat - upsert contact, conversation, and insert ONLY matching messages
    let synced = 0
    let errors = 0
    let messagesImported = 0

    for (const chat of individualChats) {
      try {
        const jid = String(chat.wa_chatid || chat.wa_fastid || chat.jid || chat.id || '')
        const chatName = String(chat.wa_contactName || chat.wa_name || chat.name || chat.pushName || '')
        const phone = jid.split('@')[0]
        let profilePic: string | null = (chat.imagePreview || chat.image || null) as string | null

        // If no profile pic from chat data, try fetching via UAZAPI API
        if (!profilePic && jid) {
          try {
            const picRes = await fetchWithTimeout(`${uazapiUrl}/contact/getProfilePic`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instanceToken },
              body: JSON.stringify({ id: jid }),
            })
            if (picRes.ok) {
              const picData = await picRes.json()
              const picUrl = picData?.profilePicUrl || picData?.imgUrl || picData?.url || picData?.eurl || null
              if (picUrl && typeof picUrl === 'string' && picUrl.startsWith('http')) {
                profilePic = picUrl
              }
            }
          } catch (picErr) {
            log.info('Failed to fetch profile pic', { jid, error: picErr instanceof Error ? picErr.message : String(picErr) })
          }
        }

        if (!jid || !phone) continue

        // 5a. Upsert contact
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, profile_pic_url')
          .eq('jid', jid)
          .maybeSingle()

        let contactId: string

        if (existingContact) {
          contactId = existingContact.id
          const updateData: Record<string, unknown> = {}
          if (chatName) updateData.name = chatName
          if (profilePic) updateData.profile_pic_url = String(profilePic)
          // Always try to update profile pic if contact doesn't have one
          if (!existingContact.profile_pic_url && profilePic) {
            updateData.profile_pic_url = String(profilePic)
          }
          if (Object.keys(updateData).length > 0) {
            await supabase.from('contacts').update(updateData).eq('id', contactId)
          }
        } else {
          const { data: newContact, error: insertErr } = await supabase
            .from('contacts')
            .insert({ jid, phone, name: chatName || null, profile_pic_url: profilePic ? String(profilePic) : null })
            .select('id')
            .single()

          if (insertErr || !newContact) {
            log.error('Failed to insert contact', { jid, error: insertErr?.message })
            errors++
            continue
          }
          contactId = newContact.id
        }

        // 5b. Upsert conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('inbox_id', inbox_id)
          .eq('contact_id', contactId)
          .maybeSingle()

        let conversationId: string

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const lastMsgTimestamp = chat.wa_lastMsgTimestamp || chat.lastMessageTimestamp || chat.timestamp || null
          const lastMsgAt = lastMsgTimestamp
            ? new Date(typeof lastMsgTimestamp === 'number'
                ? (lastMsgTimestamp as number) > 9999999999 ? (lastMsgTimestamp as number) : (lastMsgTimestamp as number) * 1000
                : lastMsgTimestamp as string
              ).toISOString()
            : new Date().toISOString()

          const { data: newConv, error: convErr } = await supabase
            .from('conversations')
            .insert({
              inbox_id,
              contact_id: contactId,
              status: 'aberta',
              priority: 'media',
              is_read: false,
              last_message_at: lastMsgAt,
            })
            .select('id')
            .single()

          if (convErr || !newConv) {
            log.error('Failed to create conversation', { jid, error: convErr?.message })
            errors++
            continue
          }
          conversationId = newConv.id
        }

        // 5c. Get messages ONLY for this specific chatid from our grouped map
        const chatMessages = messagesByChat.get(jid) || []
        log.info('Chat messages matched', { phone, jid, count: chatMessages.length })

        if (chatMessages.length > 0) {
          const messagesToInsert = []

          for (const msg of chatMessages) {
            // Extract message ID - try multiple fields
            const msgId = String(msg.id || msg._id || msg.wa_id || (msg.key as Record<string,unknown>)?.id || '')
            if (!msgId) continue

            // Check if already exists
            const { data: existing } = await supabase
              .from('conversation_messages')
              .select('id')
              .eq('external_id', msgId)
              .maybeSingle()

            if (existing) continue

            // Map V2 fields correctly
            const fromMe = msg.fromMe ?? msg.wa_fromMe ?? false

            // Content: V2 uses content.text, fallback to other fields
            let msgContent = ''
            if (msg.content && typeof msg.content === 'object') {
              msgContent = String((msg.content as Record<string, unknown>).text || '')
            } else {
              msgContent = String(msg.content || msg.wa_body || msg.wa_text || msg.body || msg.text || '')
            }

            // Timestamp
            const msgTimestamp = msg.timestamp || msg.wa_timestamp || msg.messageTimestamp || Date.now() / 1000
            const createdAt = new Date(
              typeof msgTimestamp === 'number'
                ? (msgTimestamp as number) > 9999999999 ? (msgTimestamp as number) : (msgTimestamp as number) * 1000
                : msgTimestamp as string
            ).toISOString()

            // Media detection
            let mediaType = 'text'
            let mediaUrl: string | null = null
            const msgType = String(msg.type || msg.wa_type || '').toLowerCase()
            if (msgType === 'image') mediaType = 'image'
            else if (msgType === 'video') mediaType = 'video'
            else if (msgType === 'audio' || msgType === 'ptt') mediaType = 'audio'
            else if (msgType === 'document') mediaType = 'document'

            if (msg.fileURL || msg.wa_mediaUrl || msg.mediaUrl) {
              mediaUrl = String(msg.fileURL || msg.wa_mediaUrl || msg.mediaUrl)
            }

            messagesToInsert.push({
              conversation_id: conversationId,
              direction: fromMe ? 'outgoing' : 'incoming',
              content: msgContent || null,
              media_type: mediaType,
              media_url: mediaUrl,
              external_id: msgId,
              created_at: createdAt,
            })
          }

          if (messagesToInsert.length > 0) {
            const { error: insertMsgErr } = await supabase
              .from('conversation_messages')
              .insert(messagesToInsert)

            if (insertMsgErr) {
              log.error('Failed to insert messages', { jid, error: insertMsgErr.message })
            } else {
              messagesImported += messagesToInsert.length
              log.info('Inserted messages', { phone, count: messagesToInsert.length })
            }
          }

          // Update last_message_at on conversation
          const sorted = [...messagesToInsert].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          if (sorted.length > 0) {
            const lastMsg = sorted[0]
            const lastPreview = lastMsg.content || (lastMsg.media_type === 'image' ? '📷 Foto' : lastMsg.media_type === 'video' ? '🎥 Vídeo' : lastMsg.media_type === 'audio' ? '🎵 Áudio' : lastMsg.media_type === 'document' ? '📎 Documento' : '')
            await supabase.from('conversations').update({
              last_message_at: sorted[0].created_at,
              last_message: lastPreview,
            }).eq('id', conversationId)
          }
        }

        synced++
      } catch (chatErr) {
        log.error('Error processing chat', { error: chatErr instanceof Error ? chatErr.message : String(chatErr) })
        errors++
      }
    }

    log.info('Sync complete', { synced, messagesImported, errors, total: individualChats.length })

    return successResponse(corsHeaders, { synced, errors, messagesImported, total: individualChats.length })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    log.error('Sync error', { error: msg })
    return errorResponse(corsHeaders, msg)
  }
})
