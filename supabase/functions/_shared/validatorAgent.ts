/**
 * Validator Agent — Audits AI responses before sending to lead.
 *
 * Scores 0-10, detects violations, rewrites if needed.
 * Called inline by ai-agent (not a separate edge function) to minimize latency.
 *
 * Scoring:
 *   10 = PASS (send as-is)
 *   5-9 = REWRITE (correct and send)
 *   1-4 = REWRITE (must fix grave violations)
 *   0 = BLOCK (discard, send handoff)
 */

import { callLLM, type LLMMessage } from './llmProvider.ts'
import { createLogger } from './logger.ts'
import { createServiceClient } from './supabaseClient.ts'

const log = createLogger('validator-agent')

export interface ValidatorConfig {
  enabled: boolean
  model: string
  rigor: 'moderado' | 'rigoroso' | 'maximo'
  personality: string
  systemPrompt: string
  blockedTopics: string[]
  blockedPhrases: string[]
  maxDiscountPercent: number | null
  businessInfo: Record<string, string> | null
  leadName: string | null
  msgsSinceLastNameUse: number
  leadQuestions?: string[]      // questions the lead asked in this turn
  catalogPrices?: string[]      // known prices from catalog (e.g. ["R$56,90", "R$427,90"])
}

export interface ValidatorResult {
  score: number
  verdict: 'PASS' | 'REWRITE' | 'BLOCK'
  violations: { rule: string; severity: string; detail: string; deduction: number }[]
  bonuses: { reason: string; points: number }[]
  rewritten: string | null
  suggestion: string | null
  blockAction: 'handoff' | null
  latencyMs: number
}

const SCORE_THRESHOLD: Record<string, number> = {
  moderado: 8,   // score >= 8 = PASS
  rigoroso: 9,   // score >= 9 = PASS
  maximo: 10,    // only 10 = PASS
}

function buildValidatorPrompt(config: ValidatorConfig): string {
  const businessFields = config.businessInfo || {}
  const filledFields = Object.entries(businessFields)
    .filter(([_, v]) => v && String(v).trim())
    .map(([k]) => k)

  const discountRule = config.maxDiscountPercent && config.maxDiscountPercent > 0
    ? `Desconto máximo permitido: ${config.maxDiscountPercent}%. Acima disso = GRAVE.`
    : 'NUNCA oferecer desconto. Qualquer menção a desconto = GRAVE.'

  return `Você é o auditor de qualidade de um agente de vendas WhatsApp.
Avalie a resposta do agente e atribua uma NOTA de 0 a 10.

CONTEXTO DA EMPRESA:
- Personalidade esperada: ${config.personality || 'Profissional, simpático e objetivo'}
- Instruções do admin: ${config.systemPrompt ? config.systemPrompt.substring(0, 500) : '(nenhuma)'}
- Campos da empresa preenchidos: ${filledFields.length > 0 ? filledFields.join(', ') : 'nenhum'}

CRITÉRIOS DE AVALIAÇÃO:

CRÍTICO (-10 pontos, score vai a 0):
- Inventar preço, prazo ou informação não cadastrada
- Conteúdo ofensivo, discriminatório ou ilegal
- Revelar que é IA/robô quando não perguntado

GRAVE (-3 pontos cada):
- Dizer "não temos", "não encontrei", "em falta", "indisponível", "não trabalhamos com"
- Mencionar concorrente por nome ou comparar marcas
- ${discountRule}
${config.blockedTopics.length > 0 ? `- Abordar tópico bloqueado: ${config.blockedTopics.join(', ')}` : ''}
${config.blockedPhrases.length > 0 ? `- Usar frase proibida: ${config.blockedPhrases.join(', ')}` : ''}
- Inventar horário/endereço/pagamento/entrega não cadastrado (cadastrados: ${filledFields.join(', ') || 'nenhum'})

MODERADO (-2 pontos cada):
- Mais de 1 pergunta na mensagem (conte interrogações reais, ignore retóricas)
- Pedir permissão para transferir ("posso te transferir?", "quer que eu encaminhe?")
- Resposta longa demais (mais de 4 frases)
- Tom inconsistente com: ${config.personality || 'profissional'}

LEVE (-1 ponto cada):
- Nome "${config.leadName || '(desconhecido)'}" usado com menos de 3 msgs de intervalo (msgs desde último uso: ${config.msgsSinceLastNameUse})
- Emoji excessivo (mais de 2)
- Repetir informação já dita na conversa
- Resposta genérica sem personalização

REGRAS ADICIONAIS CRÍTICAS:
${config.leadName ? `- Nome do lead é "${config.leadName}" (completo). Se a resposta usa versão encurtada (ex: "${config.leadName.split(' ')[0]}" quando deveria ser "${config.leadName}"), isso é GRAVE (-3 pontos). O nome DEVE ser usado EXATAMENTE como informado.` : ''}
${config.leadQuestions?.length ? `- O lead perguntou: ${config.leadQuestions.map(q => `"${q}"`).join(', ')}. Se a resposta NÃO aborda alguma dessas perguntas, é GRAVE (-3 pontos por pergunta ignorada). TODA pergunta do lead DEVE ser respondida.` : ''}
${config.catalogPrices?.length ? `- Preços reais do catálogo: ${config.catalogPrices.join(', ')}. Se a resposta menciona um desses preços, NÃO é "inventar preço" — é dado REAL do catálogo. Só marque "inventar preço" para valores que NÃO estão nesta lista.` : ''}

BÔNUS (+1 ponto cada, max 10):
- Pergunta de qualificação precisa e contextual
- Uso natural do nome no momento certo
- Copy persuasiva com gatilho de urgência/escassez
- Empatia genuína em objeção do lead

RESPONDA APENAS com JSON válido (sem markdown, sem backticks):
{"score":N,"violations":[{"rule":"nome","severity":"critico|grave|moderado|leve","detail":"o que violou","deduction":-N}],"bonuses":[{"reason":"o que fez bem","points":1}],"verdict":"PASS|REWRITE|BLOCK","rewritten":"texto corrigido se REWRITE","suggestion":"sugestão para o admin","block_action":"handoff ou null"}`
}

export async function validateResponse(
  responseText: string,
  config: ValidatorConfig,
  agentId: string,
  conversationId: string,
): Promise<ValidatorResult> {
  const startMs = Date.now()

  // Skip validation for short/trivial responses
  if (!config.enabled || responseText.trim().length < 15) {
    return {
      score: 10, verdict: 'PASS', violations: [], bonuses: [],
      rewritten: null, suggestion: null, blockAction: null, latencyMs: 0,
    }
  }

  const prompt = buildValidatorPrompt(config)
  const messages: LLMMessage[] = [
    { role: 'user', content: `Resposta do agente para avaliar:\n\n"${responseText}"` },
  ]

  let result: ValidatorResult
  try {
    const llmResult = await callLLM({
      systemPrompt: prompt,
      messages,
      tools: [],
      temperature: 0.1, // deterministic for consistent scoring
      maxTokens: 512,
      model: config.model || 'gpt-4.1-nano',
    })

    const parsed = parseValidatorResponse(llmResult.text)
    const latencyMs = Date.now() - startMs

    // Apply rigor threshold
    const threshold = SCORE_THRESHOLD[config.rigor] || 8
    if (parsed.score >= threshold) {
      parsed.verdict = 'PASS'
    } else if (parsed.score > 0) {
      parsed.verdict = 'REWRITE'
    } else {
      parsed.verdict = 'BLOCK'
    }

    result = { ...parsed, latencyMs }
  } catch (err) {
    log.error('Validator LLM call failed', { error: (err as Error).message })
    // On failure, let the response through (don't block on validator errors)
    return {
      score: 10, verdict: 'PASS', violations: [], bonuses: [],
      rewritten: null, suggestion: null, blockAction: null,
      latencyMs: Date.now() - startMs,
    }
  }

  // Persist to ai_agent_validations (fire-and-forget)
  try {
    const supabase = createServiceClient()
    supabase.from('ai_agent_validations').insert({
      agent_id: agentId,
      conversation_id: conversationId,
      original_text: responseText,
      score: result.score,
      verdict: result.verdict,
      violations: result.violations,
      bonuses: result.bonuses,
      rewritten_text: result.rewritten,
      suggestion: result.suggestion,
      block_action: result.blockAction,
      model: config.model || 'gpt-4.1-nano',
      latency_ms: result.latencyMs,
    }).then(({ error }) => {
      if (error) log.warn('Failed to persist validation', { error: error.message })
    })
  } catch { /* fire-and-forget */ }

  log.info('Validation result', {
    score: result.score,
    verdict: result.verdict,
    violations: result.violations.length,
    latencyMs: result.latencyMs,
  })

  return result
}

function parseValidatorResponse(text: string): Omit<ValidatorResult, 'latencyMs'> {
  const defaults: Omit<ValidatorResult, 'latencyMs'> = {
    score: 10, verdict: 'PASS', violations: [], bonuses: [],
    rewritten: null, suggestion: null, blockAction: null,
  }

  try {
    // Extract JSON from possible markdown wrapper
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    const parsed = JSON.parse(jsonStr)

    return {
      score: Math.min(10, Math.max(0, Math.round(parsed.score ?? 10))),
      verdict: ['PASS', 'REWRITE', 'BLOCK'].includes(parsed.verdict) ? parsed.verdict : 'PASS',
      violations: Array.isArray(parsed.violations) ? parsed.violations : [],
      bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [],
      rewritten: parsed.rewritten || parsed.rewritten_text || null,
      suggestion: parsed.suggestion || null,
      blockAction: parsed.block_action === 'handoff' ? 'handoff' : null,
    }
  } catch (err) {
    log.warn('Failed to parse validator JSON', { error: (err as Error).message, text: text.substring(0, 200) })
    return defaults
  }
}

/**
 * Count messages since the agent last used the lead's name.
 * Returns a number: 0 = used in last message, 3+ = safe to use again.
 */
export function countMsgsSinceNameUse(
  leadName: string | null,
  recentOutgoingMessages: string[],
): number {
  if (!leadName || leadName.length < 2) return 99 // no name = always safe
  const nameLower = leadName.toLowerCase()
  for (let i = 0; i < recentOutgoingMessages.length; i++) {
    if (recentOutgoingMessages[i].toLowerCase().includes(nameLower)) {
      return i // 0 = last msg had name, 1 = 1 msg ago, etc
    }
  }
  return 99 // name never used = safe
}
