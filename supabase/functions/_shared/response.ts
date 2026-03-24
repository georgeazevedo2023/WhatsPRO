/**
 * Standardized response format for all Edge Functions.
 *
 * Usage:
 *   import { successResponse, errorResponse } from '../_shared/response.ts'
 *   return successResponse(corsHeaders, { user: data })
 *   return errorResponse(corsHeaders, 'Not found', 404)
 */

type CorsHeaders = Record<string, string>;

/** Standard success response: { ok: true, data: T } */
export function successResponse<T>(
  corsHeaders: CorsHeaders,
  data: T,
  status = 200
): Response {
  return new Response(
    JSON.stringify({ ok: true, ...data as object }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/** Standard error response: { ok: false, error: string } */
export function errorResponse(
  corsHeaders: CorsHeaders,
  error: string,
  status = 500,
  details?: string
): Response {
  const body: Record<string, unknown> = { ok: false, error };
  if (details) body.details = details;
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
