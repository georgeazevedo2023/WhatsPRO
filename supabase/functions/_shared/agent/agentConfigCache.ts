// =============================================================================
// agentConfigCache — cache por-isolate de config do agente (dieta de egress,
// v7.102.0). O ai-agent recarregava a row COMPLETA do agente (~20 kB) + a base
// de conhecimento (~4 kB) do PostgREST a CADA turno; cada byte dessas respostas
// conta na cota de "Database egress" da Supabase (breakdown 2026-07-02:
// PostgREST = 73% do egress num dia normal).
//
// v7.103.0: TTL 48h + SONDA por turno (pedido do dono "limpar a cada 48h").
// O turno NÃO confia cegamente no cache: busca só o `updated_at` (~100 bytes,
// trigger `*_updated_at` no DB) e compara com o fingerprint cacheado — mudou,
// re-baixa a row completa. Edição de config propaga no turno SEGUINTE, e o
// payload de 20 kB só trafega quando algo realmente mudou. Isolates do edge
// runtime são efêmeros, então o cache é best-effort: cold start = 1 fetch.
//
// ⚠️ Os valores cacheados são tratados como READ-ONLY pelo pipeline (verificado
// 2026-07-02: nenhuma escrita em `agent.x`/knowledge no ai-agent nem em
// _shared/agent). Se algum caminho novo precisar mutar, clone antes.
// =============================================================================

export const AGENT_CONFIG_TTL_MS = 48 * 60 * 60 * 1000

type CacheEntry = { value: unknown; expiresAt: number }

const store = new Map<string, CacheEntry>()

export function cacheGet<T>(key: string, now: number = Date.now()): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (now >= hit.expiresAt) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function cacheSet(
  key: string,
  value: unknown,
  ttlMs: number = AGENT_CONFIG_TTL_MS,
  now: number = Date.now(),
): void {
  store.set(key, { value, expiresAt: now + ttlMs })
}

/** Só para testes. */
export function cacheClear(): void {
  store.clear()
}
