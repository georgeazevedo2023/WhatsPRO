import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { verifyCronOrService, verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
const SEND_DELAY_MS = 350

const log = createLogger('process-scheduled-messages')

interface ScheduledMessage {
  id: string
  user_id: string
  instance_id: string
  group_jid: string
  group_name: string | null
  exclude_admins: boolean
  recipients: { jid: string }[] | null
  message_type: string
  content: string | null
  media_url: string | null
  filename: string | null
  scheduled_at: string
  next_run_at: string
  is_recurring: boolean
  recurrence_type: string | null
  recurrence_interval: number
  recurrence_days: number[] | null
  recurrence_end_at: string | null
  recurrence_count: number | null
  random_delay: 'none' | '5-10' | '10-20' | null
  status: string
  executions_count: number
  instances: { token: string }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRandomDelay(randomDelaySetting: string | null): number {
  if (!randomDelaySetting || randomDelaySetting === 'none') {
    return SEND_DELAY_MS
  }

  const [min, max] = randomDelaySetting === '5-10'
    ? [5000, 10000]
    : [10000, 20000]

  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function sendTextMessage(token: string, number: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${UAZAPI_SERVER_URL}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({ number, text: content }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    await response.json()
    return { success: true }
  } catch (err: unknown) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

async function sendMediaMessage(
  token: string,
  number: string,
  messageType: string,
  mediaUrl: string,
  caption?: string,
  filename?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      number,
      type: messageType === 'ptt' ? 'ptt' : messageType,
      file: mediaUrl,
      text: caption || '',
    }

    if (messageType === 'document' && filename) {
      body.docName = filename
    }

    const response = await fetchWithTimeout(`${UAZAPI_SERVER_URL}/send/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    await response.json()
    return { success: true }
  } catch (err: unknown) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

function calculateNextRun(message: ScheduledMessage): string {
  const current = new Date(message.next_run_at)

  switch (message.recurrence_type) {
    case 'daily':
      current.setDate(current.getDate() + message.recurrence_interval)
      break
    case 'weekly':
      if (message.recurrence_days && message.recurrence_days.length > 0) {
        const currentDay = current.getDay()
        const sortedDays = [...message.recurrence_days].sort((a, b) => a - b)

        const nextDay = sortedDays.find(d => d > currentDay)

        if (nextDay !== undefined) {
          current.setDate(current.getDate() + (nextDay - currentDay))
        } else {
          const daysUntilNextWeek = 7 - currentDay + sortedDays[0]
          current.setDate(current.getDate() + daysUntilNextWeek + (7 * (message.recurrence_interval - 1)))
        }
      } else {
        current.setDate(current.getDate() + (7 * message.recurrence_interval))
      }
      break
    case 'monthly':
      current.setMonth(current.getMonth() + message.recurrence_interval)
      break
    case 'custom':
      current.setDate(current.getDate() + message.recurrence_interval)
      break
    default:
      current.setDate(current.getDate() + 1)
  }

  return current.toISOString()
}

function shouldContinueRecurrence(message: ScheduledMessage, nextRun: string): boolean {
  if (message.recurrence_end_at) {
    const endDate = new Date(message.recurrence_end_at)
    const nextRunDate = new Date(nextRun)
    if (nextRunDate > endDate) {
      return false
    }
  }

  if (message.recurrence_count !== null && message.recurrence_count > 0) {
    if (message.executions_count + 1 >= message.recurrence_count) {
      return false
    }
  }

  return true
}

async function processMessage(
  supabaseUrl: string,
  supabaseKey: string,
  message: ScheduledMessage
): Promise<void> {
  log.info('Processing scheduled message', { id: message.id, scheduledAt: message.scheduled_at })

  // Mark as processing
  await fetchWithTimeout(`${supabaseUrl}/rest/v1/scheduled_messages?id=eq.${message.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ status: 'processing' })
  })

  let recipientsTotal = 1
  let recipientsSuccess = 0
  let recipientsFailed = 0
  let lastError: string | null = null

  try {
    const token = message.instances.token

    if (message.exclude_admins && message.recipients && message.recipients.length > 0) {
      recipientsTotal = message.recipients.length

      for (let i = 0; i < message.recipients.length; i++) {
        const recipient = message.recipients[i]
        let result: { success: boolean; error?: string }

        if (message.message_type === 'text') {
          result = await sendTextMessage(token, recipient.jid, message.content || '')
        } else {
          result = await sendMediaMessage(
            token,
            recipient.jid,
            message.message_type,
            message.media_url || '',
            message.content || undefined,
            message.filename || undefined
          )
        }

        if (result.success) {
          recipientsSuccess++
        } else {
          recipientsFailed++
          lastError = result.error || 'Unknown error'
        }

        if (i < message.recipients.length - 1) {
          const delayMs = getRandomDelay(message.random_delay)
          await delay(delayMs)
        }
      }
    } else {
      let result: { success: boolean; error?: string }

      if (message.message_type === 'text') {
        result = await sendTextMessage(token, message.group_jid, message.content || '')
      } else {
        result = await sendMediaMessage(
          token,
          message.group_jid,
          message.message_type,
          message.media_url || '',
          message.content || undefined,
          message.filename || undefined
        )
      }

      if (result.success) {
        recipientsSuccess = 1
      } else {
        recipientsFailed = 1
        lastError = result.error || 'Unknown error'
      }
    }

    const logStatus = recipientsFailed === 0 ? 'success' :
                      recipientsSuccess === 0 ? 'failed' : 'partial'

    // Create execution log
    await fetchWithTimeout(`${supabaseUrl}/rest/v1/scheduled_message_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        scheduled_message_id: message.id,
        status: logStatus,
        recipients_total: recipientsTotal,
        recipients_success: recipientsSuccess,
        recipients_failed: recipientsFailed,
        error_message: lastError,
      })
    })

    // Update message status
    const updateData: Record<string, unknown> = {
      executions_count: message.executions_count + 1,
      last_executed_at: new Date().toISOString(),
      last_error: lastError,
    }

    if (message.is_recurring) {
      const nextRun = calculateNextRun(message)
      const shouldContinue = shouldContinueRecurrence(message, nextRun)
      updateData.status = shouldContinue ? 'pending' : 'completed'
      if (shouldContinue) {
        updateData.next_run_at = nextRun
      }
    } else {
      updateData.status = recipientsFailed === recipientsTotal ? 'failed' : 'completed'
    }

    await fetchWithTimeout(`${supabaseUrl}/rest/v1/scheduled_messages?id=eq.${message.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updateData)
    })

    log.info('Message processed', { id: message.id, success: recipientsSuccess, total: recipientsTotal })
  } catch (err: unknown) {
    const error = err as Error
    log.error('Error processing message', { id: message.id, error: error.message })

    await fetchWithTimeout(`${supabaseUrl}/rest/v1/scheduled_message_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        scheduled_message_id: message.id,
        status: 'failed',
        recipients_total: recipientsTotal,
        recipients_success: 0,
        recipients_failed: recipientsTotal,
        error_message: error.message,
      })
    })

    await fetchWithTimeout(`${supabaseUrl}/rest/v1/scheduled_messages?id=eq.${message.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'failed',
        last_error: error.message,
        last_executed_at: new Date().toISOString(),
      })
    })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Allow cron/service calls OR super_admin manual calls
  if (!verifyCronOrService(req)) {
    const admin = await verifySuperAdmin(req)
    if (!admin) return unauthorizedResponse(corsHeaders)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    // Fetch pending messages where next_run_at <= now()
    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/scheduled_messages?status=eq.pending&next_run_at=lte.${new Date().toISOString()}&select=*,instances(token)&limit=50`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${await response.text()}`)
    }

    const pendingMessages = await response.json() as ScheduledMessage[]

    log.info('Found pending messages to process', { count: pendingMessages?.length || 0 })

    for (const message of pendingMessages || []) {
      await processMessage(supabaseUrl, supabaseKey, message)
    }

    return successResponse(corsHeaders, {
      success: true,
      processed: pendingMessages?.length || 0,
      timestamp: new Date().toISOString()
    })
  } catch (err: unknown) {
    const error = err as Error
    log.error('Error in process-scheduled-messages', { error: error.message })
    return errorResponse(corsHeaders, error.message)
  }
})
