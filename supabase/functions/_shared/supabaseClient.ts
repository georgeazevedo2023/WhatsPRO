/**
 * Centralized Supabase client factory — D-01.
 *
 * Eliminates repeated `createClient(url, key)` calls scattered across 20+ edge functions.
 *
 * Usage (service role):
 *   import { createServiceClient } from '../_shared/supabaseClient.ts'
 *   const supabase = createServiceClient()
 *
 * Usage (user-scoped):
 *   import { createUserClient } from '../_shared/supabaseClient.ts'
 *   const supabase = createUserClient(req)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Returns a Supabase client authenticated with the SERVICE_ROLE_KEY.
 * Use for admin operations that bypass RLS.
 */
export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

/**
 * Returns a Supabase client scoped to the user's JWT from the request's Authorization header.
 * Use when RLS should apply (user-visible data fetching).
 */
export function createUserClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') || ''
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}
