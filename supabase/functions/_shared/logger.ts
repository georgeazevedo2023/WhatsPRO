/**
 * Structured logger for Edge Functions.
 * Outputs JSON logs for easy parsing by log aggregators.
 *
 * Usage:
 *   import { createLogger } from '../_shared/logger.ts'
 *   const log = createLogger('whatsapp-webhook', reqId)
 *   log.info('Message processed', { conversation_id, direction, latency_ms: 150 })
 *   log.error('Failed to save', { error: err.message })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// `object` (não Record<string, unknown>): metadados de log podem ser interfaces
// tipadas (HopGuardResult, LogEventPayload, etc.), que não têm index signature e
// portanto não são atribuíveis a Record<string, unknown>. `object` aceita qualquer
// não-primitivo e o spread `...data` continua válido.
interface Logger {
  debug: (msg: string, data?: object) => void
  info: (msg: string, data?: object) => void
  warn: (msg: string, data?: object) => void
  error: (msg: string, data?: object) => void
}

function log(level: LogLevel, fn: string, reqId: string, msg: string, data?: object) {
  const entry = {
    level,
    fn,
    req: reqId,
    msg,
    ts: new Date().toISOString(),
    ...data,
  }

  switch (level) {
    case 'debug': console.debug(JSON.stringify(entry)); break
    case 'info': console.log(JSON.stringify(entry)); break
    case 'warn': console.warn(JSON.stringify(entry)); break
    case 'error': console.error(JSON.stringify(entry)); break
  }
}

export function createLogger(functionName: string, requestId = ''): Logger {
  const rid = requestId || crypto.randomUUID().substring(0, 8)
  return {
    debug: (msg, data) => log('debug', functionName, rid, msg, data),
    info: (msg, data) => log('info', functionName, rid, msg, data),
    warn: (msg, data) => log('warn', functionName, rid, msg, data),
    error: (msg, data) => log('error', functionName, rid, msg, data),
  }
}
