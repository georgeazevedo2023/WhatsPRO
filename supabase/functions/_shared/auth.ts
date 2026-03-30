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
 * Checks for the service_role key in the Authorization header.
 * This is used for functions called by pg_cron or scheduled jobs.
 */
export function verifyCronOrService(req: Request): boolean {
  const log = createLogger('auth')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    log.error('Invalid auth header format or missing')
    return false
  }

  const token = authHeader.replace('Bearer ', '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const internalKey = Deno.env.get('INTERNAL_FUNCTION_KEY')

  const isService = serviceKey && token === serviceKey
  const isAnon = anonKey && token === anonKey
  const isInternal = internalKey && token === internalKey

  if (!isService && !isAnon && !isInternal) {
    log.error('Token mismatch', { tokenLength: token.length, hasService: !!serviceKey, hasAnon: !!anonKey, hasInternal: !!internalKey })
    return false
  }

  const mode = isInternal ? 'internal' : (isService ? 'service' : 'anon')
  log.info('verifyCronOrService successful', { mode })
  return true
}

/** Standard 401 response */
export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
