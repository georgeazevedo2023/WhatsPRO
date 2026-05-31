import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Clean up stale auth tokens from other Supabase projects in localStorage
const currentRef = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] || '';
if (currentRef) {
  const staleKeys = Object.keys(localStorage).filter(
    k => k.startsWith('sb-') && k.endsWith('-auth-token') && !k.includes(currentRef)
  );
  staleKeys.forEach(k => localStorage.removeItem(k));
}

/**
 * Fetch com TETO de wall-clock SÓ para requests de auth (`/auth/v1/`).
 *
 * Raiz do `fetch_messages_timeout` (2026-05-31): quando a aba volta de uma
 * suspensão longa, a rede fica brevemente indisponível e o refresh de token do
 * supabase-js (a auth-js NÃO põe timeout/AbortController no fetch de
 * `/auth/v1/token`) PENDURA. Enquanto pendura, o `refreshingDeferred` interno fica
 * preso e TODO `getSession()` subsequente devolve esse promise morto → toda query
 * REST trava no await interno do token → o `Promise.race` de 12s do ChatPanel
 * estoura. Limitar o fetch de auth garante que um refresh travado ABORTA (rejeita
 * limpo) em vez de pendurar pra sempre — o `refreshingDeferred` libera e o próximo
 * refresh (rede já de volta) recompõe a sessão.
 *
 * Aplica-se SÓ a `/auth/v1/` — REST/Storage (inclusive uploads grandes de
 * carrossel/mídia) ficam SEM teto, pra não abortar operações legítimas lentas.
 */
const AUTH_FETCH_TIMEOUT_MS = 8000;

function authAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/auth/v1/')) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('auth_request_timeout', 'TimeoutError')),
    AUTH_FETCH_TIMEOUT_MS,
  );
  // Respeita um signal do chamador (encadeia o abort).
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Navigator.locks trava 10s em aba stale/service worker (commit 264a1b6) → no-op.
    // A serialização cross-tab é abdicada de propósito; o teto no fetch de auth
    // (authAwareFetch) é o que impede o hang do refresh, não o lock.
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
  global: { fetch: authAwareFetch },
});
