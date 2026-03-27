import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createLogger } from '../_shared/logger.ts'

/**
 * Background job processor — claims and processes queued jobs.
 * Called by cron (every minute) or manually by other functions.
 *
 * Supported job types:
 *   - lead_auto_add: Auto-add contact to lead database
 *   - profile_pic_fetch: Fetch and update profile picture
 *   - utm_attribution: Match UTM campaign from message
 *
 * Uses SELECT ... FOR UPDATE SKIP LOCKED for safe concurrent processing.
 */

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const UAZAPI_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'

interface Job {
  id: string
  job_type: string
  payload: Record<string, unknown>
  attempts: number
}

async function processLeadAutoAdd(job: Job): Promise<void> {
  const { instance_id, contact_phone, contact_jid, contact_name } = job.payload as Record<string, string>

  let { data: leadDb } = await supabase
    .from('lead_databases')
    .select('id')
    .eq('instance_id', instance_id)
    .maybeSingle()

  if (!leadDb) {
    const { data: inst } = await supabase.from('instances').select('user_id, name').eq('id', instance_id).single()
    if (!inst) return
    const { data: newDb } = await supabase
      .from('lead_databases')
      .upsert({ name: `Helpdesk - ${inst.name}`, user_id: inst.user_id, instance_id, leads_count: 0 }, { onConflict: 'instance_id' })
      .select('id')
      .single()
    leadDb = newDb
  }

  if (leadDb) {
    await supabase.from('lead_database_entries').upsert({
      database_id: leadDb.id, phone: contact_phone, jid: contact_jid,
      name: contact_name || null, source: 'helpdesk', is_verified: true, verification_status: 'valid',
    }, { onConflict: 'database_id,phone', ignoreDuplicates: false })

    await supabase.rpc('update_lead_count_from_entries', { p_database_id: leadDb.id })
  }
}

async function processProfilePicFetch(job: Job): Promise<void> {
  const { contact_jid, instance_token } = job.payload as Record<string, string>
  if (!contact_jid || !instance_token) return

  const resp = await fetch(`${UAZAPI_URL}/contact/getProfilePic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': instance_token },
    body: JSON.stringify({ id: contact_jid }),
  })

  if (resp.ok) {
    const data = await resp.json()
    const picUrl = data.profilePicUrl || data.imgUrl || data.url || data.eurl || null
    if (picUrl && typeof picUrl === 'string' && picUrl.startsWith('http')) {
      await supabase.from('contacts').update({ profile_pic_url: picUrl }).eq('jid', contact_jid)
    }
  }
}

const handlers: Record<string, (job: Job) => Promise<void>> = {
  lead_auto_add: processLeadAutoAdd,
  profile_pic_fetch: processProfilePicFetch,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (!verifyCronOrService(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const log = createLogger('process-jobs')
  const body = await req.json().catch(() => ({}))
  const jobType = (body as Record<string, string>).job_type || 'all'
  const batchSize = (body as Record<string, number>).batch_size || 20

  const jobTypes = jobType === 'all' ? Object.keys(handlers) : [jobType]
  let totalProcessed = 0
  let totalFailed = 0

  for (const jt of jobTypes) {
    const handler = handlers[jt]
    if (!handler) continue

    const { data: jobs } = await supabase.rpc('claim_jobs', { p_job_type: jt, p_batch_size: batchSize })
    if (!jobs || !Array.isArray(jobs)) continue

    for (const job of jobs as Job[]) {
      try {
        await handler(job)
        await supabase.rpc('complete_job', { p_job_id: job.id, p_status: 'completed' })
        totalProcessed++
      } catch (err) {
        const errMsg = (err as Error).message || 'Unknown error'
        log.error('Job failed', { job_id: job.id, job_type: jt, error: errMsg, attempt: job.attempts })
        await supabase.rpc('complete_job', {
          p_job_id: job.id,
          p_status: job.attempts >= 3 ? 'failed' : 'pending',
          p_error: errMsg,
        })
        totalFailed++
      }
    }
  }

  log.info('Batch complete', { processed: totalProcessed, failed: totalFailed })

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, failed: totalFailed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
