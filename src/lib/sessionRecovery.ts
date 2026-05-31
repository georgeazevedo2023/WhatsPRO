import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '') as string;
const PUB_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string;
const PROJECT_REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] || '';
const AUTH_TOKEN_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : '';
const RECOVERY_FLAG = '__wp_session_recovery_at';

/**
 * Revalidação NÃO-destrutiva da sessão de auth, com guarda de wall-clock.
 *
 * Contexto (bug `fetch_messages_timeout`, 2026-05-31): quando a aba do atendente
 * fica horas suspensa, o access token JWT (TTL 1h do Supabase) expira E o timer
 * do `autoRefreshToken` do supabase-js é congelado pelo throttling de aba oculta
 * do Chrome — nenhum refresh proativo acontece. No retorno da aba, cada query
 * PostgREST resolve o token de forma ASSÍNCRONA antes do fetch de rede; com o
 * token expirado/zumbi esse await PENDURA e a query nunca sai (o `AbortController`
 * não cobre esse await). No ChatPanel isso estoura o `Promise.race` de 12s →
 * "Falha ao carregar mensagens". A correção de raiz é garantir um token válido
 * ANTES de qualquer refetch no resume (ver App.useTabFocusRefresh).
 *
 * `getSession()` renova internamente um token expirado e faz dedupe do refresh
 * in-flight da própria lib (não cria corrida nova DENTRO da aba). Raceamos com um
 * timeout pra nunca pendurar no chamador.
 *
 * IMPORTANTE: o supabase-js sinaliza um refresh token MORTO resolvendo com
 * `data.session === null` (NÃO lança exceção). Por isso decidimos "morta" só com
 * essa evidência POSITIVA — nunca por timeout (que é ambíguo: rede lenta/offline
 * no resume ou refresh travado). Deslogar por timeout trocaria um "skeleton
 * preso" por um "logout espúrio" — pior, pois destrói a conversa aberta que o
 * v7.61.0 passou a preservar.
 */
export type SessionProbe = 'valid' | 'dead' | 'unknown';

export async function probeSession(timeoutMs = 5000): Promise<SessionProbe> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const res = await Promise.race([supabase.auth.getSession(), timeout]);
    if (res === 'timeout') return 'unknown';
    return res.data?.session ? 'valid' : 'dead';
  } catch {
    // getSession lançou (estado inesperado) — ambíguo, não destrói nada.
    return 'unknown';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Limpa uma sessão COMPROVADAMENTE morta (chamar só após `probeSession() === 'dead'`,
 * isto é, após getSession resolver — logo o refresh NÃO está travado e o signOut
 * não pendura). `scope: 'local'` purga o token do localStorage SEM a revogação
 * global cross-device (que faz chamada de rede e pode pendurar). O
 * `onAuthStateChange` do AuthContext recebe `SIGNED_OUT` → `ProtectedRoute`
 * redireciona pro /login: redirect DECLARATIVO de SPA, NUNCA `window.location.reload`
 * (respeita o fix do v7.61.0). O race de 3s é só rede de segurança.
 */
export async function clearDeadSession(timeoutMs = 3000): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    /* best-effort — o estado de auth já reflete a sessão morta */
  }
}

/**
 * Refresca o access token via fetch CRU direto ao endpoint de auth, BYPASSANDO o
 * supabase client (que pode estar com o GoTrueClient envenenado — getSession/
 * setSession penduram). Preserva o objeto de sessão do localStorage e só atualiza
 * os campos do token, pra o client FRESCO pós-reload já encontrar sessão válida e
 * NÃO precisar refrescar no boot (evita o hang em cascata). Best-effort.
 */
async function refreshTokenIntoStorage(timeoutMs = 6000): Promise<boolean> {
  if (!AUTH_TOKEN_KEY || !SUPABASE_URL || !PUB_KEY) return false;
  let current: Record<string, unknown> | null = null;
  try {
    current = JSON.parse(localStorage.getItem(AUTH_TOKEN_KEY) || 'null');
  } catch {
    return false;
  }
  const refreshToken = current?.refresh_token as string | undefined;
  if (!current || !refreshToken) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUB_KEY, Authorization: `Bearer ${PUB_KEY}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.access_token || !data?.refresh_token) return false;
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({
      ...current,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      token_type: data.token_type ?? current.token_type,
      user: data.user ?? current.user,
    }));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recupera de uma sessão supabase-js ENVENENADA. Confirmado em PROD/Playwright: após
 * um refresh de token abortado/travado, o GoTrueClient deixa `getSession()`,
 * `setSession()` e TODA query REST penduradas indefinidamente — não há reset do
 * estado em memória (nem fetch-timeout, nem lock, nem setSession destravam). A única
 * recuperação confiável é REINICIALIZAR o client via reload.
 *
 * Diferente do reload removido no v7.61.0 (que reloadava a CADA foco de aba): aqui o
 * reload é CONDICIONAL (só quando a sessão está comprovadamente travada) e:
 *  - PRESERVA a conversa aberta — ela está na URL `?conv=` e é restaurada no mount;
 *  - refresca o token ANTES (fetch cru, bypassa o envenenamento) → o client fresco
 *    sobe com sessão válida e a lista+conversa carregam sem novo hang;
 *  - tem GUARDA anti-loop (sessionStorage, 1 reload/30s) — exceto `force` (clique
 *    explícito em "Tentar novamente", que sempre recupera).
 *
 * @returns true se vai reinicializar (reload disparado); false se a guarda bloqueou.
 */
export async function recoverStuckSession(
  opts?: { force?: boolean; reload?: () => void },
): Promise<boolean> {
  const reload = opts?.reload ?? (() => window.location.reload());
  if (!opts?.force) {
    try {
      const last = Number(sessionStorage.getItem(RECOVERY_FLAG) || '0');
      if (Date.now() - last < 30_000) return false; // já recuperou há < 30s → não entra em loop
    } catch { /* sessionStorage indisponível → segue */ }
  }
  try { sessionStorage.setItem(RECOVERY_FLAG, String(Date.now())); } catch { /* noop */ }
  await refreshTokenIntoStorage();
  reload();
  return true;
}
