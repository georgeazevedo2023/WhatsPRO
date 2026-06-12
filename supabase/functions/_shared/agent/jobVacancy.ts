/**
 * Vaga de emprego — short-circuit determinístico (v7.86.0, 2026-06-12).
 *
 * PROBLEMA: lead que chega perguntando sobre vaga/currículo não é venda — o
 * funil de qualificação/produto só atrapalha (router classificaria como ruído
 * e o monolith tentaria qualificar). Pedido do dono: classificar como vaga de
 * emprego, pedir pra enviar o currículo pro e-mail de RH e perguntar se pode
 * ajudar em algo mais.
 *
 * DESIGN:
 *  - MODE-AGNOSTIC: roda ANTES do gate `routing_mode='router'` que pula os
 *    short-circuits R129/R136 (v7.43.10) — nenhum specialist trata RH, então
 *    aqui não existe "caminho paralelo conflitante".
 *  - CONFIG-DRIVEN: só ativa se `business_info.jobs_email` estiver preenchido
 *    no agente (multi-tenant: sem e-mail cadastrado, a feature é inerte).
 *  - Classificação dupla: tag durável `motivo:vaga_emprego` na conversa (guard
 *    anti-loop — "vou mandar o currículo" não re-dispara) + o summarizer já
 *    tem a categoria `vaga_emprego` na taxonomia (v7.82) pro dashboard Motivos.
 */

import {
  jsonResponse,
  persistAndBroadcastReply,
  type PreLLMShortCircuitsCtx,
} from './preLLMShortCircuits.ts'
import type { Logger } from './context.ts'

export const JOB_VACANCY_TAG = 'motivo:vaga_emprego'

// Sinais FORTES: disparam sozinhos (contexto de emprego inequívoco).
const STRONG_JOB_PATTERNS = [
  /\bcurr[ií]culo\b/i,
  /\bcurriculum\b/i,
  /\bvagas? de (emprego|trabalho|servi[çc]o)\b/i,
  /\bempregos?\b/i,
  /\bprocesso seletivo\b/i,
  /\bcontratando\b/i,
  /\boportunidade de (trabalho|emprego)\b/i,
  /\btrabalhar (com voc[êe]s|a[íi]|na loja|na empresa|com a loja|com a empresa)\b/i,
  /\b(precisa(m|ndo)?|necessita(m|ndo)?) de funcion[áa]rios?\b/i,
]

// Sinal FRACO: "vaga(s)" solto — só vale se a msg não for sobre vaga FÍSICA
// (garagem/estacionamento/demarcação), que é assunto de produto na loja.
const WEAK_JOB_PATTERN = /\bvagas?\b/i
const WEAK_BLOCKERS = /\b(garagem|estacionamento|estacionar|carros?|ve[íi]culos?|motos?|demarcar|demarca[çc][ãa]o|pintar)\b/i

/** Detector puro: a mensagem é sobre vaga de emprego? */
export function detectJobVacancy(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false
  if (STRONG_JOB_PATTERNS.some((r) => r.test(text))) return true
  return WEAK_JOB_PATTERN.test(text) && !WEAK_BLOCKERS.test(text)
}

/** Resposta pronta: pede o currículo pro e-mail de RH + oferece ajuda extra. */
export function buildJobVacancyReply(jobsEmail: string, leadName?: string | null): string {
  const first = (leadName || '').trim().split(/\s+/)[0]
  const prefix = first ? `${first}, que` : 'Que'
  return `${prefix} bom seu interesse em trabalhar com a gente! 😊 Envie seu currículo para ${jobsEmail} que nosso time vai analisar. Posso te ajudar em algo mais?`
}

export interface JobVacancyResult {
  handled: boolean
  response: Response | null
}

/**
 * Short-circuit completo: detecta → tagueia `motivo:vaga_emprego` → envia a
 * resposta pronta → persiste/broadcast → Response. Inerte sem jobs_email.
 * Se o send falhar, a tag já persistida evita loop e o LLM assume (o prompt
 * tem o e-mail via buildBusinessSection).
 */
export async function tryJobVacancyShortCircuit(
  ctx: PreLLMShortCircuitsCtx,
  log: Logger,
): Promise<JobVacancyResult> {
  const jobsEmail = String(ctx.agent?.business_info?.jobs_email || '').trim()
  if (!jobsEmail || !jobsEmail.includes('@')) return { handled: false, response: null }

  const tags: string[] = ctx.conversation.tags || []
  if (tags.includes(JOB_VACANCY_TAG)) return { handled: false, response: null }

  if (!detectJobVacancy(ctx.incomingText)) return { handled: false, response: null }

  const merged = [...tags, JOB_VACANCY_TAG]
  ctx.conversation.tags = merged
  await ctx.supabase
    .from('conversations')
    .update({ tags: merged })
    .eq('id', ctx.conversation_id)

  const reply = buildJobVacancyReply(jobsEmail, ctx.leadName)
  log.info('Vaga de emprego detectada — resposta determinística + tag', {
    jobs_email: jobsEmail,
    incoming_preview: ctx.incomingText.substring(0, 80),
  })

  try {
    await ctx.sendTextMsg(reply)
    await persistAndBroadcastReply(ctx, reply, 'job_vacancy_ask', { jobs_email: jobsEmail })
    return {
      handled: true,
      response: jsonResponse(
        { ok: true, response: reply, reason: 'job_vacancy_ask' },
        ctx.corsHeaders,
      ),
    }
  } catch (e) {
    log.warn('job_vacancy: send falhou — tag persistida, LLM assume', {
      error: (e as Error).message,
    })
    return { handled: false, response: null }
  }
}
