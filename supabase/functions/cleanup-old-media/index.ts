import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyCronOrService, verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('cleanup-old-media')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Allow cron/service calls OR super_admin manual calls
  if (!verifyCronOrService(req)) {
    const admin = await verifySuperAdmin(req)
    if (!admin) return unauthorizedResponse(corsHeaders)
  }

  try {
    const supabase = createServiceClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toISOString()

    log.info('Cleaning up media older than cutoff', { cutoff })

    const buckets = ['audio-messages', 'helpdesk-media']
    let totalDeleted = 0

    for (const bucket of buckets) {
      // List all folders (conversation IDs)
      const { data: folders, error: listErr } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1000 })

      if (listErr) {
        log.error(`Error listing bucket`, { bucket, error: listErr.message })
        continue
      }

      for (const folder of folders || []) {
        if (!folder.name) continue

        // List files in each folder
        const { data: files, error: filesErr } = await supabase.storage
          .from(bucket)
          .list(folder.name, { limit: 1000 })

        if (filesErr || !files) continue

        const oldFiles = files.filter(f => {
          if (!f.created_at) return false
          return new Date(f.created_at) < thirtyDaysAgo
        })

        if (oldFiles.length > 0) {
          const paths = oldFiles.map(f => `${folder.name}/${f.name}`)
          const { error: delErr } = await supabase.storage
            .from(bucket)
            .remove(paths)

          if (delErr) {
            log.error(`Error deleting from bucket`, { bucket, folder: folder.name, error: delErr.message })
          } else {
            totalDeleted += paths.length
            log.info(`Deleted files`, { count: paths.length, bucket, folder: folder.name })
          }
        }
      }
    }

    log.info('Cleanup complete', { total_deleted: totalDeleted })

    return successResponse(corsHeaders, { deleted: totalDeleted })
  } catch (error) {
    log.error('Cleanup error', { error: (error as Error).message })
    return errorResponse(corsHeaders, 'Internal server error', 500)
  }
})
