/**
 * CORS headers for Supabase Edge Functions.
 *
 * - browserCorsHeaders: static fallback (uses first ALLOWED_ORIGIN or '*')
 * - getDynamicCorsHeaders(req): per-request CORS — checks Origin against whitelist + localhost
 * - webhookCorsHeaders: wildcard '*' for external servers (UAZAPI, n8n)
 */

const CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
const CORS_ALLOW_METHODS = 'POST, GET, OPTIONS'

const envOrigin = Deno.env.get('ALLOWED_ORIGIN')
const isProduction = !!Deno.env.get('SUPABASE_URL')?.includes('.supabase.co')

if (!envOrigin && isProduction) {
  console.error('[cors] FATAL: ALLOWED_ORIGIN not set in production! Refusing to use wildcard "*".')
}

// Parse comma-separated origins (e.g. "https://crm.wsmart.com.br,https://app.whatspro.com.br")
const allowedOrigins = envOrigin ? envOrigin.split(',').map(o => o.trim()) : []
const fallbackOrigin = allowedOrigins[0] || (isProduction ? 'https://app.whatspro.com.br' : '*')

/**
 * Dynamic CORS headers — checks the request Origin against ALLOWED_ORIGIN whitelist.
 * Allows localhost automatically for development.
 */
export function getDynamicCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''

  let responseOrigin: string
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    responseOrigin = origin // Always allow localhost for development
  } else if (allowedOrigins.includes(origin)) {
    responseOrigin = origin
  } else {
    responseOrigin = fallbackOrigin
  }

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
  }
}

/** Static CORS headers (backward-compatible) — uses first allowed origin or fallback */
export const browserCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': fallbackOrigin,
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
}

export const webhookCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
}
