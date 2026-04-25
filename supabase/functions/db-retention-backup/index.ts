// M19 S8.1: Backup JSONL antes de DELETE para retention policies com backup_before_delete=true
//
// Fluxo:
//   1. Lê policy por ID
//   2. Valida (enabled, backup required, table não protegida)
//   3. SELECT candidatos (LIMIT MAX_ROWS)
//   4. Gera JSONL → gzip → upload para bucket db-backups
//   5. Chama RPC apply_retention_after_backup → DELETE + log
//   6. Retorna sumário
//
// Triggered por:
//   - pg_cron weekly via net.http_post (com service_role JWT)
//   - Manual via UI AdminRetention (com user JWT, super_admin)

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const log = createLogger('db-retention-backup')

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

const MAX_ROWS = 50000 // safeguard contra OOM em tabelas grandes
const BUCKET = 'db-backups'

interface Policy {
  id: number
  table_name: string
  days_to_keep: number
  condition_sql: string | null
  enabled: boolean
  dry_run: boolean
  backup_before_delete: boolean
}

async function gzipString(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value as Uint8Array)
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.length }
  return out
}

function buildBackupPath(table: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ts = now.toISOString().replace(/[:.]/g, '-')
  return `${yyyy}/${mm}/${table}_${ts}.jsonl.gz`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth: gateway verify_jwt=true already validated the JWT.
  // Service role / anon (cron) → trust. User JWT → exigir super_admin.
  const role = getJwtRole(req)
  if (role !== 'service_role' && role !== 'anon') {
    const admin = await verifySuperAdmin(req)
    if (!admin) return unauthorizedResponse(corsHeaders)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const policyId = body.policy_id as number | undefined

    if (!policyId) {
      return errorResponse(corsHeaders, 'policy_id required', 400)
    }

    const supabase = createServiceClient()

    // 1) Carrega policy
    const { data: policy, error: pErr } = await supabase
      .from('db_retention_policies')
      .select('*')
      .eq('id', policyId)
      .maybeSingle()

    if (pErr) {
      log.error('failed to load policy', { policyId, err: pErr.message })
      return errorResponse(corsHeaders, `failed to load policy: ${pErr.message}`, 500)
    }
    if (!policy) {
      return errorResponse(corsHeaders, 'policy not found', 404)
    }

    const p = policy as Policy

    // 2) Validações
    if (!p.backup_before_delete) {
      return errorResponse(corsHeaders, 'policy does not require backup; use apply_retention_policy directly', 400)
    }
    if (!p.enabled) {
      return errorResponse(corsHeaders, 'policy is disabled', 400)
    }

    // Whitelist check (defense in depth — RPC também valida)
    const { data: protectedCheck } = await supabase.rpc('is_table_protected', { _table_name: p.table_name } as never)
    if (protectedCheck === true) {
      return errorResponse(corsHeaders, `table ${p.table_name} is protected`, 403)
    }

    // 3) SELECT candidatos
    // Build WHERE clause dynamically — pode ser string custom + condition
    // Para segurança, usamos service client e RPC; mas para SELECT precisamos query crua
    // Usamos uma RPC SECURITY DEFINER para evitar SQL injection no condition_sql
    // Por enquanto: RPC dinâmica via raw SQL (assumindo condition_sql é confiável — vem do admin UI)
    const interval = `${p.days_to_keep} days`
    const whereParts = [`created_at < now() - interval '${interval}'`]
    if (p.condition_sql && p.condition_sql.trim().length > 0) {
      whereParts.push(`(${p.condition_sql})`)
    }
    const whereClause = whereParts.join(' AND ')

    // Conta candidatos (com LIMIT para nunca explodir memória)
    const { data: countRow, error: cErr } = await supabase.rpc('exec_sql_count' as never, {
      _table: p.table_name,
      _where: whereClause,
    } as never).single()
    // FALLBACK: se RPC não existir, usa SELECT direto via from()
    let candidateCount: number
    if (cErr) {
      // Tenta via from + filter manual (limita ao que dá pra expressar via PostgREST)
      log.info('exec_sql_count not available, falling back to from()', { policyId })
      const { count, error: countErr } = await supabase
        .from(p.table_name)
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - p.days_to_keep * 86400000).toISOString())
      if (countErr) {
        log.error('count failed', { err: countErr.message })
        return errorResponse(corsHeaders, `count failed: ${countErr.message}`, 500)
      }
      candidateCount = count ?? 0
    } else {
      candidateCount = (countRow as { count?: number })?.count ?? 0
    }

    if (candidateCount === 0) {
      // Nada a fazer
      const { error: logErr } = await supabase.from('db_cleanup_log').insert({
        policy_id: p.id,
        table_name: p.table_name,
        was_dry_run: false,
        candidate_count: 0,
        deleted_count: 0,
      })
      if (logErr) log.error('log insert failed', { err: logErr.message })
      return successResponse(corsHeaders, {
        deleted_count: 0,
        candidate_count: 0,
        backup_path: null,
        message: 'no candidates to backup/delete',
      })
    }

    if (candidateCount > MAX_ROWS) {
      log.error('too many candidates', { policyId, candidateCount, MAX_ROWS })
      return errorResponse(corsHeaders, `too many candidates (${candidateCount} > ${MAX_ROWS}); reduce days_to_keep gradually`, 413)
    }

    // SELECT real (sem LIMIT — já validamos count <= MAX_ROWS)
    const { data: rows, error: sErr } = await supabase
      .from(p.table_name)
      .select('*')
      .lt('created_at', new Date(Date.now() - p.days_to_keep * 86400000).toISOString())
      .limit(MAX_ROWS)

    if (sErr) {
      log.error('select failed', { err: sErr.message })
      return errorResponse(corsHeaders, `select failed: ${sErr.message}`, 500)
    }

    const candidates = (rows ?? []) as Record<string, unknown>[]
    log.info('candidates loaded', { policyId, table: p.table_name, count: candidates.length })

    // 4) JSONL → gzip
    const jsonl = candidates.map((r) => JSON.stringify(r)).join('\n')
    const gzipped = await gzipString(jsonl)

    // Upload
    const path = buildBackupPath(p.table_name)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, gzipped, {
        contentType: 'application/gzip',
        upsert: false,
      })

    if (upErr) {
      log.error('upload failed', { err: upErr.message, path })
      return errorResponse(corsHeaders, `upload failed: ${upErr.message}`, 500)
    }

    log.info('backup uploaded', { path, sizeBytes: gzipped.length, rows: candidates.length })

    // 5) DELETE via RPC
    const { data: deleteResult, error: dErr } = await supabase.rpc('apply_retention_after_backup' as never, {
      _policy_id: p.id,
      _backup_path: path,
      _ran_by: null,
    } as never)

    if (dErr) {
      log.error('delete RPC failed', { err: dErr.message, path })
      // Backup ficou no bucket; admin pode revisar
      return errorResponse(corsHeaders, `delete failed (backup retained at ${path}): ${dErr.message}`, 500)
    }

    const result = deleteResult as { deleted_count?: number; error?: string; message?: string }
    if (result?.error) {
      log.error('delete returned error', result)
      return errorResponse(corsHeaders, `delete error: ${result.message || result.error}`, 500)
    }

    return successResponse(corsHeaders, {
      deleted_count: result?.deleted_count ?? 0,
      candidate_count: candidateCount,
      backup_path: path,
      backup_size_bytes: gzipped.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error('unhandled error', { err: msg })
    return errorResponse(corsHeaders, msg, 500)
  }
})
