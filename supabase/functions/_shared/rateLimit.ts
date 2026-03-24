import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Simple per-user rate limiter using Supabase cache table.
 * Creates a table `rate_limit_log` on first use (via migration).
 *
 * Usage:
 *   import { checkRateLimit } from '../_shared/rateLimit.ts'
 *   const limited = await checkRateLimit(userId, 'transcribe-audio', 10, 60)
 *   if (limited) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetAt: string
}

/**
 * Check if user has exceeded rate limit for a given action.
 *
 * @param userId - The user's UUID
 * @param action - Action identifier (e.g., 'transcribe-audio')
 * @param maxRequests - Max requests allowed in the window
 * @param windowSeconds - Time window in seconds (default 60)
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // Count recent requests
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (error) {
    // If table doesn't exist or query fails, allow the request (fail open)
    console.warn('[rateLimit] Query error (allowing request):', error.message)
    return { limited: false, remaining: maxRequests, resetAt: '' }
  }

  const used = count ?? 0
  const remaining = Math.max(0, maxRequests - used)
  const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString()

  if (used >= maxRequests) {
    return { limited: true, remaining: 0, resetAt }
  }

  // Log this request
  await supabase
    .from('rate_limit_log')
    .insert({ user_id: userId, action })
    .then(({ error: insertErr }) => {
      if (insertErr) console.warn('[rateLimit] Insert error:', insertErr.message)
    })

  return { limited: false, remaining: remaining - 1, resetAt }
}

/**
 * Returns rate limit headers for the response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt,
  }
}
