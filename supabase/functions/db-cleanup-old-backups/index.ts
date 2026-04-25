// M19 S8.1: Cleanup mensal de backups JSONL >365 dias do bucket db-backups
// Triggered por pg_cron mensal

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('db-cleanup-old-backups')

const BUCKET = 'db-backups'
const RETENTION_DAYS = 365

function getJwtRole(req: Request): string | null {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const parts = auth.replace('Bearer ', '').split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1])).role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const role = getJwtRole(req)
  if (role !== 'service_role' && role !== 'anon') {
    const admin = await verifySuperAdmin(req)
    if (!admin) return unauthorizedResponse(corsHeaders)
  }

  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000)

    // Lista TODOS os arquivos do bucket recursivamente (anos/meses)
    // Como Storage list é por prefixo, fazemos por ano/mês conhecidos
    // Simplificação: pegar todos files e filtrar por created_at no metadata
    const { data: files, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } })

    if (listErr) {
      log.error('list root failed', { err: listErr.message })
      return errorResponse(corsHeaders, listErr.message, 500)
    }

    // Storage retorna folders como entries — precisamos descer 2 níveis (YYYY/MM/)
    const allOldPaths: string[] = []

    for (const yearEntry of files ?? []) {
      if (!yearEntry.name || yearEntry.id !== null) continue // pula arquivos no root
      // É uma "pasta" (year)
      const year = yearEntry.name
      const { data: monthFolders } = await supabase.storage.from(BUCKET).list(year, { limit: 1000 })
      for (const monthEntry of monthFolders ?? []) {
        if (!monthEntry.name || monthEntry.id !== null) continue
        const month = monthEntry.name
        const prefix = `${year}/${month}`
        const { data: monthFiles } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
        for (const f of monthFiles ?? []) {
          if (!f.created_at) continue
          if (new Date(f.created_at) < cutoff) {
            allOldPaths.push(`${prefix}/${f.name}`)
          }
        }
      }
    }

    log.info('found old backups', { count: allOldPaths.length, cutoff: cutoff.toISOString() })

    let deleted = 0
    if (allOldPaths.length > 0) {
      // Batch delete (storage API aceita até 1000 por call)
      for (let i = 0; i < allOldPaths.length; i += 100) {
        const chunk = allOldPaths.slice(i, i + 100)
        const { error: delErr } = await supabase.storage.from(BUCKET).remove(chunk)
        if (delErr) {
          log.error('batch delete failed', { i, err: delErr.message })
        } else {
          deleted += chunk.length
        }
      }
    }

    // Log no db_cleanup_log com policy_id NULL (não é uma policy específica)
    await supabase.from('db_cleanup_log').insert({
      policy_id: null,
      table_name: '__backup_cleanup__',
      was_dry_run: false,
      candidate_count: allOldPaths.length,
      deleted_count: deleted,
    })

    return successResponse(corsHeaders, {
      candidate_count: allOldPaths.length,
      deleted_count: deleted,
      cutoff: cutoff.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error('unhandled error', { err: msg })
    return errorResponse(corsHeaders, msg, 500)
  }
})
