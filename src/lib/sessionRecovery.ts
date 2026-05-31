import { supabase } from '@/integrations/supabase/client';

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
