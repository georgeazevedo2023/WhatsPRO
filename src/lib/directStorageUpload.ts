/**
 * Upload ao Storage por fetch CRU — desacoplado do supabase-js.
 *
 * CONTEXTO (incidentes 2026-08-11/12, envio de foto mobile): todo upload do
 * storage-js resolve o token via `auth.getSession()` ANTES do fetch; quando o
 * GoTrueClient trava (aba/WebView retomada do background — o próprio picker de
 * foto põe a página em background), o upload pendura em 0 bytes até o teto de
 * 120s, a sonda devolve 'unknown' e o recover recarrega a página — matando o
 * File e a bolha de retry. Em paralelo, socket morto em rede móvel instável
 * pendura um fetch sem AbortController pra sempre (os beacons de 1KB chegavam
 * enquanto o upload de 350KB nunca completava).
 *
 * Fix na FONTE, cobrindo as duas causas:
 *  - token lido DIRETO do localStorage (mesma técnica do refreshTokenIntoStorage)
 *    → upload nunca mais espera getSession;
 *  - AbortController REAL por tentativa + retry com conexão NOVA (path novo por
 *    tentativa — sem corrida com upload-zumbi que complete depois);
 *  - teto por tentativa proporcional ao tamanho (arquivo pequeno falha rápido e
 *    re-tenta; arquivo grande mantém os 120s de sempre em tentativa única).
 *
 * Contrato "nunca pior": token ausente/expirado/perto de expirar → devolve
 * 'unavailable' e o chamador usa o caminho storage-js de sempre (que refresca
 * o token CORRETAMENTE — refrescar por fora sem sincronizar o client arriscaria
 * refresh-token reuse/revogação). 401/403 no cru idem. Erro de payload (4xx
 * não-auth) não é problema de sessão → 'error' limpo, sem retry.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '') as string;
const PUB_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string;
const PROJECT_REF = SUPABASE_URL.match(/\/\/([^.]+)\./)?.[1] || '';
const AUTH_TOKEN_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : '';

/** Margem de validade: token a <60s do fim não inicia upload (expiraria no meio). */
const TOKEN_MIN_TTL_S = 60;
const TOTAL_BUDGET_MS = 120_000; // paridade com o teto histórico do upload
const MIN_ATTEMPT_MS = 30_000;
const MAX_ATTEMPTS = 3;
/** Throughput de referência p/ dimensionar o teto por tentativa (uplink móvel ruim). */
const REF_UPLOAD_BYTES_PER_S = 25_000;

/** Access token utilizável AGORA, direto do localStorage — sem passar pelo client. */
export function getStoredAccessToken(nowMs = Date.now()): string | null {
  if (!AUTH_TOKEN_KEY) return null;
  try {
    const raw = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number } | null;
    if (!parsed?.access_token || typeof parsed.expires_at !== 'number') return null;
    if (parsed.expires_at - nowMs / 1000 < TOKEN_MIN_TTL_S) return null;
    return parsed.access_token;
  } catch {
    return null;
  }
}

/**
 * Tetos das tentativas (pura, testável): quanto menor o arquivo, mais cedo uma
 * tentativa pendurada é abortada e re-tentada em conexão nova — sempre dentro
 * do orçamento total de 120s. Arquivo grande = 1 tentativa de 120s (paridade
 * com o comportamento antigo; retry do zero não ajudaria).
 */
export function uploadAttemptTimeouts(sizeBytes: number): number[] {
  const byThroughput = Math.ceil(sizeBytes / REF_UPLOAD_BYTES_PER_S) * 1000;
  const perAttempt = Math.min(TOTAL_BUDGET_MS, Math.max(MIN_ATTEMPT_MS, byThroughput));
  const attempts = Math.max(1, Math.min(MAX_ATTEMPTS, Math.floor(TOTAL_BUDGET_MS / perAttempt)));
  return Array.from({ length: attempts }, () => perAttempt);
}

export type DirectUploadResult =
  | { ok: true; path: string; attempts: number }
  /** Sem token utilizável ou o Storage recusou o token → usar o caminho storage-js. */
  | { ok: false; kind: 'unavailable'; reason: string }
  /** Rede/timeout em TODAS as tentativas → o chamador roda a sonda de sessão. */
  | { ok: false; kind: 'exhausted'; attempts: number; lastError: string }
  /** Erro definitivo do Storage (payload, tamanho…) → falha limpa, sem retry. */
  | { ok: false; kind: 'error'; message: string };

interface DirectUploadParams {
  bucket: string;
  /** Gera o path da tentativa N (path NOVO por tentativa evita corrida com zumbi). */
  pathFor: (attempt: number) => string;
  file: Blob;
  contentType: string;
  /** Injetáveis nos testes. */
  fetchImpl?: typeof fetch;
  tokenProvider?: () => string | null;
  timeoutsOverride?: number[];
}

export async function directUploadWithRetry(params: DirectUploadParams): Promise<DirectUploadResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const getToken = params.tokenProvider ?? getStoredAccessToken;
  if (!SUPABASE_URL || !PUB_KEY) return { ok: false, kind: 'unavailable', reason: 'env ausente' };

  const timeouts = params.timeoutsOverride ?? uploadAttemptTimeouts(params.file.size);
  let lastError = '';
  for (let attempt = 0; attempt < timeouts.length; attempt++) {
    // Token relido a CADA tentativa: pode ter sido renovado (ou morrido) no meio.
    const token = getToken();
    if (!token) return { ok: false, kind: 'unavailable', reason: 'sem token utilizável no storage local' };

    const path = params.pathFor(attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('upload attempt timeout', 'TimeoutError')), timeouts[attempt]);
    try {
      const res = await fetchImpl(
        `${SUPABASE_URL}/storage/v1/object/${params.bucket}/${path}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            apikey: PUB_KEY,
            'content-type': params.contentType,
            'cache-control': '3600', // paridade com o default do storage-js
            'x-upsert': 'false',
          },
          body: params.file,
          signal: controller.signal,
        },
      );
      if (res.ok) return { ok: true, path, attempts: attempt + 1 };
      if (res.status === 401 || res.status === 403) {
        // Token recusado apesar de não-expirado (revogação, RLS) — o storage-js
        // sabe refrescar/decidir; não insistimos no cru.
        return { ok: false, kind: 'unavailable', reason: `storage recusou o token (${res.status})` };
      }
      const body = await res.text().catch(() => '');
      // 5xx pode ser transitório → vale re-tentar; 4xx de payload é definitivo.
      if (res.status < 500) {
        return { ok: false, kind: 'error', message: `upload falhou (${res.status}): ${body.slice(0, 200)}` };
      }
      lastError = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    } catch (err) {
      // AbortError (teto da tentativa) ou TypeError (rede caiu) → re-tenta.
      lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, kind: 'exhausted', attempts: timeouts.length, lastError };
}
