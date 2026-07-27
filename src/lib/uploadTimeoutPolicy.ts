import type { SessionProbe } from './sessionRecovery';

/**
 * Decisão no TIMEOUT de upload de mídia (auditoria 2026-07-26, caso Alberto):
 * o timeout de 120s disparava `recoverStuckSession()` → `window.location.reload()`
 * INCONDICIONAL — upload apenas LENTO (rede móvel, foto grande) recarregava a
 * página, matando o File e a bolha de retry ("a tela piscou, não enviou").
 *
 * Upload lento ≠ sessão zumbi. A decisão agora exige EVIDÊNCIA da sonda:
 * - 'valid'   → sessão OK, o gargalo é rede/arquivo → falha LIMPA, retry vivo.
 * - 'unknown' → getSession pendurado = client envenenado (o cenário que o
 *               reload existe pra curar) → recoverStuckSession (reload).
 * - 'dead'    → refresh token morto → clearDeadSession (redirect declarativo
 *               pro login, sem reload — respeita o v7.61.0).
 *
 * Função PURA pra ser testável fora do hook.
 */
export interface UploadTimeoutDecision {
  /** Chamar recoverStuckSession() (reload condicional com guarda anti-loop). */
  recoverStuck: boolean;
  /** Chamar clearDeadSession() (signOut local → redirect declarativo). */
  clearDead: boolean;
  /** Mensagem de erro crua (o humanizeSendError traduz pro atendente). */
  errorMessage: string;
}

export function decideUploadTimeout(probe: SessionProbe): UploadTimeoutDecision {
  if (probe === 'valid') {
    return {
      recoverStuck: false,
      clearDead: false,
      errorMessage: 'upload timeout: a conexão está lenta demais para esse arquivo',
    };
  }
  if (probe === 'dead') {
    return {
      recoverStuck: false,
      clearDead: true,
      errorMessage: 'upload timeout: sessão expirada durante o envio',
    };
  }
  return {
    recoverStuck: true,
    clearDead: false,
    errorMessage: 'upload timeout: o envio demorou demais (conexão ou sessão)',
  };
}
