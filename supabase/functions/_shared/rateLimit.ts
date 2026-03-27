import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Atomic per-user + optional global rate limiter using Supabase RPC.
 * Eliminates read-then-insert race condition from previous implementation.
 *
 * Usage:
 *   import { checkRateLimit } from '../_shared/rateLimit.ts'
 *   const result = await checkRateLimit(userId, 'transcribe-audio', 10, 60)
 *   if (result.limited) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Reuse client across requests in same isolate
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetAt: string
}

/**
 * Check if user has exceeded rate limit for a given action.
 * Uses atomic RPC — count + insert in single transaction (no race condition).
 *
 * @param userId - The user's UUID
 * @param action - Action identifier (e.g., 'transcribe-audio')
 * @param maxRequests - Max requests allowed per user in the window
 * @param windowSeconds - Time window in seconds (default 60)
 * @param globalMax - Optional global max across ALL users (0 = disabled)
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds = 60,
  globalMax = 0
): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString()

  try {
    const { data, error } = await supabase
      .rpc('check_rate_limit', {
        p_user_id: userId,
        p_action: action,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
        p_global_max: globalMax,
      })
      .single()

    if (error) {
      // Fail open on RPC unavailable — but log it
      console.warn('[rateLimit] RPC error (allowing request):', error.message)
      return { limited: false, remaining: maxRequests, resetAt }
    }

    const row = data as { is_limited: boolean; remaining: number; used: number; global_used: number }
    return {
      limited: row.is_limited,
      remaining: row.remaining ?? 0,
      resetAt,
    }
  } catch (err) {
    console.warn('[rateLimit] Unexpected error (allowing request):', err)
    return { limited: false, remaining: maxRequests, resetAt }
  }
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
