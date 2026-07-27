/**
 * R152 (2026-07-26) — classifica a falha do LLM ANTES do fallback gracioso do D6.
 *
 * Contexto: com o monolito aposentado (v7.109.0), falha catastrófica de specialist
 * cai no transbordo gracioso do index.ts, que sela `status_ia=shadow` (durável —
 * só Finalizar/Ativar IA destrava). Para falha TRANSITÓRIA do provedor (429/5xx/
 * timeout/breaker aberto) isso converteria leads em massa pra humano durante um
 * incidente de minutos. Este módulo separa "não consegui AGORA" (transitório) de
 * "não consigo" (permanente: modelo inválido, auth, schema — falha determinística
 * que se repetiria em todo turno).
 *
 * Formatos de erro reconhecidos (fonte única: _shared/llmProvider.ts +
 * _shared/fetchWithTimeout.ts — se o formato lá mudar, atualizar aqui):
 *   - `OpenAI_CLIENT_ERROR <4xx>: ...`  → permanente, EXCETO 408/429 (timeout/rate)
 *   - `OpenAI <5xx>: ...` / `Gemini <status>: ...`
 *   - `Request to <url> timed out after <n>ms`  (fetchWithTimeout)
 *   - `No LLM available (both circuit breakers may be OPEN)`  (breaker aberto)
 *   - erros de rede do fetch (`error sending request`, `connection reset`, ...)
 *
 * Módulo PURO (zero imports) — testável no vitest.
 */

/** Status HTTP embutido na mensagem pelo llmProvider (`OpenAI 502: ...`). */
const PROVIDER_STATUS_RE = /\b(?:OpenAI_CLIENT_ERROR|OpenAI|Gemini)\s+(\d{3})\b/

/** Sinais de indisponibilidade sem status HTTP (timeout, rede, breaker). */
const NETWORK_TRANSIENT_RE =
  /timed out|timeout|aborted|error sending request|connection (?:refused|reset|closed|error)|network|fetch failed|No LLM available/i

/**
 * true = falha transitória do provedor (retry na próxima mensagem tem chance real);
 * false = falha permanente/de lógica (repetiria em todo turno → transbordo já).
 *
 * Quando a mensagem traz um status HTTP do provedor, o status DECIDE (mesmo que o
 * corpo mencione "timeout"): 408/429/5xx = transitório; demais 4xx = permanente
 * (modelo inexistente, auth, schema strict). Sem status, palavras de rede decidem.
 * Mensagem vazia/desconhecida = permanente (conservador: melhor transbordar do que
 * silenciar o lead por engano).
 */
export function isTransientLlmError(errMsg: string | null | undefined): boolean {
  if (!errMsg) return false
  const statusMatch = PROVIDER_STATUS_RE.exec(errMsg)
  if (statusMatch) {
    const status = Number(statusMatch[1])
    return status === 408 || status === 429 || status >= 500
  }
  return NETWORK_TRANSIENT_RE.test(errMsg)
}
