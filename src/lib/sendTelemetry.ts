/**
 * Telemetria de FALHA de envio de mídia (auditoria 2026-06-09).
 *
 * Problema que isto resolve: falha client-side no envio de foto era 100%
 * INVISÍVEL — nenhum rastro no DB (a bolha de erro é estado local). A auditoria
 * "vendedores não conseguem enviar foto" teve que ser feita às cegas. Este
 * módulo grava cada falha com o ESTÁGIO onde morreu (normalize/upload/proxy/
 * confirm/insert), o erro cru, o build do app e o user-agent — o suficiente pra
 * diagnosticar qualquer caso futuro com 1 SELECT.
 *
 * Decisões de design:
 * - fetch CRU (não supabase-js): a própria telemetria não pode pendurar em
 *   sessão zumbi (o cenário nº1 que ela monitora).
 * - `text/plain` no Content-Type: simple request (sem preflight CORS) e
 *   compatível com keepalive — o beacon sai mesmo se a página descarregar.
 * - fire-and-forget com teto de 5s: NUNCA atrasa nem quebra o envio real.
 * - PROD-only: dev não polui a tabela.
 */

export type SendStage = 'validate' | 'normalize' | 'upload' | 'proxy' | 'confirm' | 'insert' | 'unknown';

export interface SendFailureEvent {
  stage: SendStage;
  outcome: 'fail' | 'hang_timeout';
  conversation_id?: string | null;
  instance_id?: string | null;
  user_id?: string | null;
  detected_kind?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  raw_error?: string | null;
}

export function logSendFailure(event: SendFailureEvent): void {
  try {
    if (!import.meta.env.PROD) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-send-failure`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5_000);
    const payload = {
      ...event,
      raw_error: (event.raw_error || '').slice(0, 500),
      app_build: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : null,
      user_agent: navigator.userAgent.slice(0, 300),
    };
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => { /* telemetria nunca propaga erro */ });
  } catch {
    /* telemetria nunca quebra o envio */
  }
}
