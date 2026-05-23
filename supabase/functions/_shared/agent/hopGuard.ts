/**
 * Sprint C5 (2026-05-23) — Hop guard anti-loop
 *
 * Garante que o pipeline router→specialist nunca passe de 2 hops por turn_id.
 * Pattern de safety pra evitar A→B→A loops (specialist chama router de novo).
 *
 * Regras:
 *   - hop 0 = router (classifyIntent)
 *   - hop 1 = specialist (product/qualification/handoff/etc.)
 *   - hop 2+ = loop detectado → fallback monolith + alerta + log
 *
 * O guard consulta `ai_agent_runs` por turn_id antes de iniciar próximo hop.
 * Se >= 2 rows existem, dispara fallback.
 *
 * Em produção, com a arquitetura atual (router→1 specialist→done), hop 2
 * NUNCA deve ser atingido. Atingir = bug do specialist (tentou chamar outro
 * specialist diretamente em vez de retornar pro orquestrador).
 */

import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface HopGuardResult {
  /** Pode prosseguir com próximo hop */
  allow: boolean
  /** Número de hops já registrados pro turn_id */
  hopsSoFar: number
  /** Razão da decisão (debug) */
  reason: string
}

export interface HopGuardCtx {
  supabase: any
  turn_id: string
  agent_id: string
  conversation_id: string
  /** Máximo de hops permitidos. Default: 2 (router + specialist). */
  maxHops?: number
  log: Logger
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Consulta ai_agent_runs por turn_id e retorna se pode iniciar próximo hop.
 *
 * Defensivo: em caso de DB failure, devolve allow=true (não bloqueia pipeline
 * por causa de monitoring offline). Mas loga o erro.
 */
export async function checkHopLimit(ctx: HopGuardCtx): Promise<HopGuardResult> {
  const max = ctx.maxHops ?? 2
  try {
    const { data, error } = await ctx.supabase
      .from('ai_agent_runs')
      .select('hop_n')
      .eq('turn_id', ctx.turn_id)
    if (error) {
      ctx.log.warn?.('hopGuard: query failed (allowing — defensive)', { error: error.message })
      return { allow: true, hopsSoFar: 0, reason: 'db_error_default_allow' }
    }
    const hopsSoFar = (data || []).length
    if (hopsSoFar >= max) {
      ctx.log.error?.('hopGuard: loop detected (max hops exceeded)', {
        turn_id: ctx.turn_id,
        hops: hopsSoFar,
        max,
      })
      // Persistir alerta pra dashboard / gestor
      try {
        await ctx.supabase.from('ai_agent_runs').insert({
          conversation_id: ctx.conversation_id,
          agent_id: ctx.agent_id,
          turn_id: ctx.turn_id,
          hop_n: hopsSoFar,
          specialist: 'router', // categoria do log (não é nova hop, é alerta)
          metadata: {
            event: 'loop_detected',
            hops_so_far: hopsSoFar,
            max_hops: max,
          },
        })
      } catch {
        /* não-fatal */
      }
      return { allow: false, hopsSoFar, reason: `loop_detected (${hopsSoFar} >= ${max})` }
    }
    return { allow: true, hopsSoFar, reason: 'ok' }
  } catch (err) {
    ctx.log.warn?.('hopGuard: unexpected error (allowing)', { error: (err as Error).message })
    return { allow: true, hopsSoFar: 0, reason: 'unexpected_default_allow' }
  }
}

/**
 * Gera turn_id UUID v4 pra agrupar hops do mesmo turno.
 * Usa crypto.randomUUID nativo (disponível em Deno + Node 14.17+).
 */
export function generateTurnId(): string {
  return crypto.randomUUID()
}
