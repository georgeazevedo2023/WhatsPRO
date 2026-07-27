/**
 * Telemetria de envio de mídia (auditoria 2026-06-09; sucesso em 2026-07-26).
 *
 * Problema que isto resolve: falha client-side no envio de foto era 100%
 * INVISÍVEL — nenhum rastro no DB (a bolha de erro é estado local). A auditoria
 * "vendedores não conseguem enviar foto" teve que ser feita às cegas. Este
 * módulo grava cada falha com o ESTÁGIO onde morreu (normalize/upload/proxy/
 * confirm/insert), o erro cru, o build do app e o user-agent — o suficiente pra
 * diagnosticar qualquer caso futuro com 1 SELECT.
 *
 * 2026-07-26: também grava SUCESSO (stage='done', outcome='success') — sem ele
 * não dava pra medir taxa de falha por plataforma/dispositivo.
 *
 * Decisões de design:
 * - `navigator.sendBeacon` como transporte primário: entra na fila do NAVEGADOR
 *   e sobrevive a unload/reload — o cenário hang_timeout→recoverStuckSession
 *   recarrega a página e podia matar o fetch da própria falha que monitorava.
 *   Fallback: fetch cru com keepalive (não supabase-js: a telemetria não pode
 *   pendurar em sessão zumbi, o cenário nº1 que ela monitora).
 * - `text/plain` no Content-Type: simple request (sem preflight CORS) e
 *   compatível com sendBeacon/keepalive.
 * - fire-and-forget com teto de 5s: NUNCA atrasa nem quebra o envio real.
 * - PROD-only: dev não polui a tabela.
 */

export type SendStage = 'validate' | 'normalize' | 'upload' | 'proxy' | 'confirm' | 'insert' | 'done' | 'unknown';

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

export interface SendSuccessEvent {
  conversation_id?: string | null;
  instance_id?: string | null;
  user_id?: string | null;
  detected_kind?: string | null;
  /** Tamanho ORIGINAL do arquivo escolhido pelo atendente. */
  file_size?: number | null;
  file_type?: string | null;
  /** Diagnóstico compacto (duração, tamanho pós-normalização) — vai em raw_error. */
  info?: string | null;
}

function postTelemetry(payload: Record<string, unknown>): void {
  try {
    if (!import.meta.env.PROD) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-send-failure`;
    const body = JSON.stringify({
      ...payload,
      app_build: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : null,
      user_agent: navigator.userAgent.slice(0, 300),
    });
    if (typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      if (queued) return;
    }
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5_000);
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      signal: controller.signal,
      keepalive: true,
    }).catch(() => { /* telemetria nunca propaga erro */ });
  } catch {
    /* telemetria nunca quebra o envio */
  }
}

export function logSendFailure(event: SendFailureEvent): void {
  postTelemetry({
    ...event,
    raw_error: (event.raw_error || '').slice(0, 500),
  });
}

export function logSendSuccess(event: SendSuccessEvent): void {
  const { info, ...rest } = event;
  postTelemetry({
    ...rest,
    stage: 'done',
    outcome: 'success',
    raw_error: (info || '').slice(0, 500) || null,
  });
}
