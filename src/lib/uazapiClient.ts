import { getAccessToken } from '@/hooks/useAuthSession';

// ── UAZAPI Proxy Client ─────────────────────────────────────────────

const PROXY_URL = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uazapi-proxy`;

/**
 * Low-level fetch to the UAZAPI proxy using a pre-obtained access token.
 * Use this when the caller already holds a token (e.g. batch send loops).
 */
export async function uazapiProxyRaw(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(PROXY_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg =
      (errorData as Record<string, string>).error ||
      (errorData as Record<string, string>).message ||
      'Erro na requisição UAZAPI';
    throw new Error(msg);
  }

  return response.json();
}

/**
 * High-level fetch to the UAZAPI proxy.
 * Automatically retrieves the current session token.
 *
 * @example
 * const groups = await uazapiProxy({ action: 'groups', instance_id: id });
 */
export async function uazapiProxy(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const accessToken = await getAccessToken();
  return uazapiProxyRaw(accessToken, payload);
}
