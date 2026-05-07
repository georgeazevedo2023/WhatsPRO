import { createServiceClient, createUserClient } from './supabaseClient.ts'
import { createLogger } from './logger.ts'

/**
 * Verifies the caller is an authenticated user.
 * Returns the user ID or null if unauthorized.
 */
export async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = createUserClient(req)

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null

  return { userId: data.user.id }
}

/**
 * Verifies the caller is a super_admin.
 * Returns userId or null if unauthorized.
 */
export async function verifySuperAdmin(req: Request): Promise<{ userId: string } | null> {
  const auth = await verifyAuth(req)
  if (!auth) return null

  const serviceClient = createServiceClient()

  const { data: roles, error } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.userId)
    .eq('role', 'super_admin')
    .maybeSingle()

  if (error || !roles) return null

  return auth
}

/**
 * Verifies the request comes from a cron job or internal service.
 * Accepts multiple key formats to survive Supabase key rotations:
 *   - Legacy JWT anon (auto-injected as SUPABASE_ANON_KEY)
 *   - JWT service role (auto-injected as SUPABASE_SERVICE_ROLE_KEY)
 *   - Modern publishable (sb_publishable_*) — set SUPABASE_PUBLISHABLE_KEY secret
 *   - Modern secret (sb_secret_*) — set SUPABASE_SECRET_KEY secret
 *   - Custom shared INTERNAL_FUNCTION_KEY
 *
 * Why multi-format: vault.decrypted_secrets may store either old JWT or new
 * sb_publishable_* depending on when project was provisioned. Comparing only
 * to one format breaks crons after migrations.
 */
export function verifyCronOrService(req: Request): boolean {
  const log = createLogger('auth')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    log.error('Invalid auth header format or missing')
    return false
  }

  const token = authHeader.replace('Bearer ', '')

  const candidates: Array<[string, string | undefined]> = [
    ['service', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')],
    ['anon_jwt', Deno.env.get('SUPABASE_ANON_KEY')],
    ['publishable', Deno.env.get('SUPABASE_PUBLISHABLE_KEY')],
    ['secret', Deno.env.get('SUPABASE_SECRET_KEY')],
    ['internal', Deno.env.get('INTERNAL_FUNCTION_KEY')],
  ]

  for (const [mode, key] of candidates) {
    if (key && token === key) {
      log.info('verifyCronOrService successful', { mode })
      return true
    }
  }

  log.error('Token mismatch', {
    tokenLength: token.length,
    available: candidates.filter(([, v]) => !!v).map(([m]) => m),
  })
  return false
}

/** Standard 401 response */
export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
