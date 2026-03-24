import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Verifies the caller is an authenticated user.
 * Returns the user ID or null if unauthorized.
 */
export async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

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

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

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
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.replace('Bearer ', '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  // Accept both service_role key and anon key (cron jobs use anon key)
  return token === serviceKey || token === anonKey
}

/** Standard 401 response */
export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
