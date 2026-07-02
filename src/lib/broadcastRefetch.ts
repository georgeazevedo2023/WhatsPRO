/**
 * broadcastRefetch — gate de visibilidade + coalescing pra refetches disparados
 * por broadcast do realtime (dieta de egress, v7.102.0).
 *
 * Problema medido (2026-07-02): os painéis (Fila) refazem RPCs a CADA broadcast
 * `new-message`/`queue-update`, e o canal realtime fica vivo mesmo com a aba em
 * SEGUNDO PLANO (só o refetchInterval do react-query pausa fora de foco) — um
 * painel esquecido aberto gera 1 RPC por mensagem do sistema o dia inteiro.
 *
 * Este helper:
 *  (a) ignora eventos com a aba oculta — o `refetchOnWindowFocus` (default do
 *      react-query) ressincroniza sozinho quando o gestor volta;
 *  (b) colapsa rajadas: o 1º evento agenda UM refetch após `delayMs`; eventos
 *      seguintes dentro da janela são absorvidos (máx. 1 refetch por janela).
 */
export function createVisibleDebouncedRefetch(
  refetch: () => void,
  delayMs = 10_000,
  isVisible: () => boolean = () =>
    typeof document === 'undefined' || document.visibilityState === 'visible',
): { trigger: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (!isVisible()) return;
      if (timer) return; // já há refetch agendado nesta janela — colapsa a rajada
      timer = setTimeout(() => {
        timer = null;
        if (isVisible()) refetch();
      }, delayMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
