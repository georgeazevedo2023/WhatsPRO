/**
 * REST (PostgREST) por fetch CRU — mesma técnica do directStorageUpload.
 *
 * CONTEXTO (2026-08-12, envio de foto mobile): o picker de foto/câmera joga a
 * página pra background; na VOLTA, o GoTrueClient fica travado por um período e
 * TODA operação via supabase-js pendura (upload, functions, REST). A v7.118
 * libertou o upload; os testes seguintes provaram o resto da cadeia presa: as
 * fotos subiram pro Storage e o fluxo morreu SEM rastro entre o proxy e o
 * INSERT — spinner infinito, sem telemetria, risco de foto entregue no
 * WhatsApp sem bolha no app.
 *
 * Este módulo dá ao fluxo de envio INSERT/UPDATE independentes do auth client:
 * token lido do localStorage + AbortController com teto. As RLS policies são as
 * mesmas — o servidor vê exatamente o request que o supabase-js mandaria.
 *
 * Uso restrito ao caminho de ENVIO DE MÍDIA (chamador decide o fallback pro
 * client quando não há token utilizável). Não é um substituto geral do client.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '') as string;
const PUB_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string;

const DEFAULT_TIMEOUT_MS = 15_000;

interface RawRestOpts {
  accessToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

async function rawRestFetch(
  path: string,
  init: RequestInit & { headers: Record<string, string> },
  opts: RawRestOpts,
): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!SUPABASE_URL || !PUB_KEY) throw new Error('env do Supabase ausente');
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('rest_request_timeout', 'TimeoutError')),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    return await fetchImpl(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: {
        apikey: PUB_KEY,
        authorization: `Bearer ${opts.accessToken}`,
        ...init.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** INSERT com retorno da linha criada (Prefer: return=representation). */
export async function rawRestInsert<T>(
  table: string,
  row: Record<string, unknown>,
  opts: RawRestOpts,
): Promise<T> {
  const res = await rawRestFetch(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify(row),
  }, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`insert ${table} falhou (${res.status}): ${body.slice(0, 200)}`);
  }
  const rows = (await res.json()) as T[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`insert ${table}: resposta sem a linha criada`);
  return rows[0];
}

/** UPDATE por igualdade de colunas (filters → `?col=eq.valor`). */
export async function rawRestUpdate(
  table: string,
  patch: Record<string, unknown>,
  filters: Record<string, string>,
  opts: RawRestOpts,
): Promise<void> {
  const qs = Object.entries(filters)
    .map(([col, val]) => `${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`)
    .join('&');
  const res = await rawRestFetch(`/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  }, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`update ${table} falhou (${res.status}): ${body.slice(0, 200)}`);
  }
}
