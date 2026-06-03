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

// Teto de tempo p/ QUALQUER chamada a edge function. Sem isso, uma oscilação de
// rede (DNS que não resolve, conexão que estola) deixa o `fetch` pendurado e a
// UI presa pra sempre (ex.: "Criando..." eterno no cadastro de membro). O default
// é generoso para não cortar operações legítimas mais lentas — o objetivo é só
// garantir que a chamada NUNCA seja infinita.
const DEFAULT_EDGE_TIMEOUT_MS = 60_000;

/** Roda o fetch com AbortController; traduz o abort num erro claro e acionável. */
async function fetchWithTimeout(
  fnName: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL()}/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
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

    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const err = new Error('A conexão demorou demais (rede instável). Tente novamente.') as EdgeFunctionError;
      err.status = 0;
      err.data = {};
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generic authenticated fetch to a Supabase Edge Function.
 *
 * - Automatically injects the current session token.
 * - Returns the parsed JSON body.
 * - Throws an `EdgeFunctionError` with `.status` and `.data` on non-2xx responses.
 * - Never hangs forever: aborts after `timeoutMs` (default 60s).
 *
 * @example
 * const result = await edgeFunctionFetch('admin-create-user', { email, password });
 * const data   = await edgeFunctionFetch<{ synced: number }>('sync-conversations', { inbox_id });
 */
export async function edgeFunctionFetch<T = unknown>(
  fnName: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_EDGE_TIMEOUT_MS,
): Promise<T> {
  const token = await getAccessToken();
  return await fetchWithTimeout(fnName, token, body, timeoutMs) as T;
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
