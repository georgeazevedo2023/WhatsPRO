import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Resolução de sessão RESILIENTE ───────────────────────────────────
//
// `supabase.auth.getSession()` pode TRAVAR indefinidamente em sessão zumbi
// (token perto de expirar + aba aberta há muito tempo → o refreshingDeferred
// interno do auth-js fica preso; ver client.ts/authAwareFetch e
// project_tab_resume_session_zombie v7.62.1). Quando isso acontece dentro do
// `getAccessToken`, TODA chamada a edge function (criar membro, sync, etc.)
// pendura "para sempre" antes mesmo do fetch sair — o servidor nunca é chamado.
//
// Fix: correr o getSession() contra um timeout curto e, se travar/expirar, cair
// no token JÁ persistido pelo supabase-js no localStorage (válido enquanto não
// expirou). Assim a sessão nunca segura a UI refém.

const GETSESSION_TIMEOUT_MS = 3000;

interface MinimalSession {
  access_token: string;
  expires_at?: number;
  user?: { id: string };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('getSession_timeout')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Lê a sessão persistida pelo supabase-js no localStorage, sem passar pelo getSession() (que pode travar). */
function readPersistedSession(): MinimalSession | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const ref = url?.match(/\/\/([^.]+)\./)?.[1];
    if (!ref) return null;
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // supabase-js v2 persiste o session object direto; versões antigas usavam { currentSession }.
    const session = (parsed && typeof parsed === 'object' && 'access_token' in parsed)
      ? parsed
      : (parsed?.currentSession as Record<string, unknown> | undefined) ?? null;
    if (!session || typeof (session as MinimalSession).access_token !== 'string') return null;
    return session as unknown as MinimalSession;
  } catch {
    return null;
  }
}

/**
 * Resolve a sessão atual de forma resiliente: tenta `getSession()` com teto de
 * tempo e, se travar (ou devolver vazio), usa o token persistido no localStorage.
 * Retorna null se nada utilizável (sem token ou token já expirado).
 */
async function resolveSession(): Promise<MinimalSession | null> {
  let session: MinimalSession | null = null;
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT_MS);
    session = (data?.session as MinimalSession | null) ?? null;
  } catch {
    // getSession travou ou rejeitou — cai no token persistido abaixo.
  }
  if (!session?.access_token) {
    session = readPersistedSession();
  }
  // Token já expirado é inútil (daria 401 na edge function) → trata como sem sessão.
  if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
    return null;
  }
  return session?.access_token ? session : null;
}

/**
 * Get the current access token from Supabase session.
 * Shows a toast and throws on expired/missing session.
 */
export const getAccessToken = async (): Promise<string> => {
  const session = await resolveSession();
  if (!session) {
    toast.error('Sessão expirada');
    throw new Error('Sessão expirada');
  }
  return session.access_token;
};

/**
 * Get the current user ID from Supabase session.
 * Shows a toast and throws on expired/missing session.
 */
export const getSessionUserId = async (): Promise<string> => {
  const session = await resolveSession();
  const userId = session?.user?.id;
  if (!userId) {
    toast.error('Sessão expirada');
    throw new Error('Sessão expirada');
  }
  return userId;
};
