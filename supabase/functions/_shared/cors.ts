/**
 * CORS headers for Supabase Edge Functions.
 *
 * - browserCorsHeaders: used by functions called from the browser (uazapi-proxy, admin-*, etc.)
 *   Restricts origin to ALLOWED_ORIGIN env var (set in Supabase project secrets).
 *   Falls back to '*' if not set (dev mode).
 *
 * - webhookCorsHeaders: used by webhook receivers (whatsapp-webhook, fire-outgoing-webhook).
 *   Keeps '*' because they are called by external servers (UAZAPI, n8n) — not browsers.
 */

const envOrigin = Deno.env.get('ALLOWED_ORIGIN')
const isProduction = !!Deno.env.get('SUPABASE_URL')?.includes('.supabase.co')

if (!envOrigin && isProduction) {
  console.error('[cors] FATAL: ALLOWED_ORIGIN not set in production! Refusing to use wildcard "*".')
}

// In production, require ALLOWED_ORIGIN. In dev, allow wildcard.
const allowedOrigin = envOrigin || (isProduction ? 'https://app.whatspro.com.br' : '*')
if (!envOrigin && !isProduction) console.warn('[cors] ALLOWED_ORIGIN not set — using wildcard "*" (dev mode)')

export const browserCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export const webhookCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
