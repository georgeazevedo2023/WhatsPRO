import { getAccessToken } from '@/hooks/useAuthSession';

// ── Edge Function Client ─────────────────────────────────────────────

const BASE_URL = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const ANON_KEY = () =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface EdgeFunctionError extends Error {
  status: number;
  data: Record<string, unknown>;
}

/**
 * Generic authenticated fetch to a Supabase Edge Function.
 *
 * - Automatically injects the current session token.
 * - Returns the parsed JSON body.
 * - Throws an `EdgeFunctionError` with `.status` and `.data` on non-2xx responses.
 *
 * @example
 * const result = await edgeFunctionFetch('admin-create-user', { email, password });
 * const data   = await edgeFunctionFetch<{ synced: number }>('sync-conversations', { inbox_id });
 */
export async function edgeFunctionFetch<T = unknown>(
  fnName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL()}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': ANON_KEY(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      (data as Record<string, string>).error ||
      (data as Record<string, string>).message ||
      `Edge function "${fnName}" returned ${response.status}`,
    ) as EdgeFunctionError;
    err.status = response.status;
    err.data = data as Record<string, unknown>;
    throw err;
  }

  return data as T;
}

/**
 * Low-level variant that accepts a pre-obtained token.
 * Useful for batch loops where `getAccessToken` is called once upfront.
 */
export async function edgeFunctionFetchRaw<T = unknown>(
  token: string,
  fnName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${BASE_URL()}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': ANON_KEY(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      (data as Record<string, string>).error ||
      (data as Record<string, string>).message ||
      `Edge function "${fnName}" returned ${response.status}`,
    ) as EdgeFunctionError;
    err.status = response.status;
    err.data = data as Record<string, unknown>;
    throw err;
  }

  return data as T;
}
