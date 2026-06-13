/**
 * Onda 2 da auditoria (2026-06-12) — sanitizer de resposta FONTE ÚNICA.
 *
 * Crítico #1 da auditoria: a validação DIVERGIA entre os 2 caminhos —
 * o router (prod) usava o enforcement determinístico do specialistBase
 * (sanitizeSpecialistResponse, v7.55.0) enquanto o monolith (fallback)
 * usava o validator LLM (validatorAgent.validateResponse) com verdicts
 * BLOCK→handoff próprios. Mesma resposta podia passar num caminho e ser
 * bloqueada no outro.
 *
 * Este módulo extrai a lógica do specialistBase pra um contrato NEUTRO
 * (SanitizerCtx) consumido pelos DOIS caminhos:
 *   - specialistBase.runSpecialist (router) — adapta geminiContents
 *   - ai-agent/index.ts (monolith fallback) — adapta contextMessages
 *
 * O validator LLM foi APOSENTADO do hot path do monolith (decisão da
 * auditoria): validatorAgent.ts permanece no repo (countMsgsSinceNameUse
 * continua em uso; validateResponse fica disponível pra auditoria offline),
 * mas nenhum turno de produção paga a latência/custo dele.
 *
 * Política de enforcement (inalterada desde v7.55.0/v7.57.3):
 *   - SAFE_TEXT_RULES (negação/confirmação de estoque/erro interno/leak):
 *     substitui o texto INTEIRO por ponte propositiva segura, preservando
 *     handoff já disparado no loop.
 *   - AUTO_FIX_RULES (eco do lead/parafraseio de jargão/"anotei"): reescrita
 *     CIRÚRGICA via autoFixHumanizationViolations (remove a frase ofensora).
 *   - Regras só-cosméticas (echo opener, recumprimento, name overuse, preço):
 *     telemetria-only — reescrever arriscaria distorcer a resposta.
 */

import { validateLLMResponse, autoFixHumanizationViolations, countMsgsSinceNameUse } from '../responseValidator.ts'
import { evaluateProductQualificationFlow } from './productQualificationFlow.ts'
import { readProductQualificationState } from './productQualificationState.ts'

// SAFE_TEXT_RULES: violações graves que justificam SUBSTITUIR o texto inteiro por
// ponte propositiva segura (preservando handoff). Ex.: negação proibida, erro vazado.
export const SAFE_TEXT_RULES = new Set(['anti_negative_phrases', 'anti_stock_confirmation', 'anti_internal_error', 'anti_internal_leak'])
// AUTO_FIX_RULES: violações de humanização (cosméticas/comportamentais) que devem
// ser CIRURGICAMENTE reescritas via autoFixHumanizationViolations (remove a frase
// ofensora, mantém o resto). Ex.: eco do lead, parafraseio de jargão, "anotei".
// Promovidas a block→auto_fix em v7.57.3 (palavra-veneno que delata IA).
export const AUTO_FIX_RULES = new Set(['anti_lead_echo', 'anti_jargon_paraphrase', 'anti_anotei'])
// ENFORCED_BLOCK_RULES = união dos 2 (compat com chamadas antigas — toda regra block é tratada).
export const ENFORCED_BLOCK_RULES = new Set([...SAFE_TEXT_RULES, ...AUTO_FIX_RULES])

export interface SanitizerCtx {
  /** Textos das mensagens do BOT já enviadas (cronológicos). */
  outgoingTexts: string[]
  /** Nome do lead (lead_profiles.full_name) — null se desconhecido. */
  leadName: string | null
  /** Tool calls do turno (search_products alimenta catalogPrices; handoff preserva ponte). */
  toolCallsLog: Array<{ name: string; result?: string | null }>
  /** Última mensagem incoming do lead (anti_jargon_paraphrase). */
  incomingText: string | null
  /** Tags atuais da conversa (verdict premium de qualificação). */
  tags: string[]
  /** Agent (service_categories pro flow premium). */
  agent: Record<string, any> | null | undefined
  log: {
    warn: (m: string, d?: object) => void
    error?: (m: string, d?: object) => void
  }
}

export interface SanitizeResult {
  text: string
  enforced: boolean
  rules: string[]
}

function getPremiumQualificationVerdict(ctx: SanitizerCtx) {
  const state = readProductQualificationState(ctx.tags || [])
  return evaluateProductQualificationFlow({
    tags: ctx.tags || [],
    agent: ctx.agent,
    incomingText: ctx.incomingText,
    catalogResult: state.catalogResult,
  })
}

function buildSafeQualificationFallback(ctx: SanitizerCtx): string | null {
  const verdict = getPremiumQualificationVerdict(ctx)
  const field = verdict.nextRequiredField
  if (!field) return null

  const leadName = (ctx.leadName || '').trim().split(/\s+/)[0] || ''
  const prefix = leadName ? `Prazer, ${leadName}. ` : ''

  if (field.key === 'ambiente_torneira') return `${prefix}A torneira é para cozinha ou área gourmet?`
  if (field.key === 'tipo_torneira') return 'Você pretende instalar na bancada ou na parede?'
  if (field.key === 'modelo_torneira') return 'Você procura o modelo com ducha flexível ou bica alta?'
  if (field.key === 'acabamento_torneira') return 'Qual acabamento você prefere: cromado, preto fosco, dourado ou escovado?'
  if (field.key === 'tipo_cuba') return 'Sua cuba é simples ou dupla?'
  if (field.key === 'perfil') return 'Você procura algo mais sofisticado ou uma opção com melhor custo-benefício?'
  if (field.key === 'aplicacao_revestimento') return `${prefix}Esse revestimento será para piso ou parede?`
  if (field.key === 'ambiente_revestimento') return 'É para sua casa ou para algum ambiente comercial?'
  if (field.key === 'formato') return 'Você já tem alguma medida em mente, como 60x60, 90x90 ou 120x120?'
  if (field.key === 'acabamento') return 'Você prefere acabamento brilhante, acetinado ou fosco?'
  if (field.key === 'cor') return 'Qual tonalidade você imagina para o ambiente?'
  if (field.key === 'local_aplicacao') return 'Vai utilizar em qual ambiente?'
  if (field.key === 'area') return 'Qual a metragem aproximada?'

  return field.examples
    ? `Qual ${field.label}? ${field.examples}.`
    : `Qual ${field.label}?`
}

function responseMentionsPremiumField(fieldKey: string, text: string): boolean {
  const norm = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  switch (fieldKey) {
    case 'ambiente_torneira':
      return /\b(cozinha|area gourmet|gourmet|aplicacao)\b/.test(norm)
    case 'tipo_torneira':
      return /\b(bancada|parede|instalacao|instalar)\b/.test(norm)
    case 'modelo_torneira':
      return /\b(ducha|flexivel|bica alta|modelo)\b/.test(norm)
    case 'acabamento_torneira':
      return /\b(acabamento|cromado|preto fosco|dourado|escovado)\b/.test(norm)
    case 'tipo_cuba':
      return /\b(cuba|simples|dupla)\b/.test(norm)
    case 'perfil':
      return /\b(premium|sofisticad|custo-beneficio|custo beneficio|melhor)\b/.test(norm)
    case 'aplicacao_revestimento':
      return /\b(piso|parede|aplicacao|aplicar)\b/.test(norm)
    case 'ambiente_revestimento':
      return /\b(residencial|comercial|casa|empresa|loja|ambiente)\b/.test(norm)
    case 'formato':
      return /\b(formato|medida|tamanho|60x60|80x80|90x90|120x120)\b/.test(norm)
    case 'acabamento':
      return /\b(acabamento|brilhante|acetinado|fosco|polido)\b/.test(norm)
    case 'cor':
      return /\b(cor|tom|tonalidade|bege|cinza|branco|off)\b/.test(norm)
    case 'local_aplicacao':
      return /\b(ambiente|sala|cozinha|quarto|banheiro|area integrada)\b/.test(norm)
    case 'area':
      return /\b(metragem|metros|m2|area|quantos m)\b/.test(norm)
    default:
      return true
  }
}

export function keepLastQuestionWhenStacked(text: string): string {
  const questionCount = (text.match(/\?/g) || []).length
  if (questionCount > 1) {
    const questionSentences = text.match(/[^.!?\n]*\?/g)
      ?.map((part) => part.trim())
      .filter(Boolean)
    if (questionSentences && questionSentences.length > 1) {
      return questionSentences[questionSentences.length - 1]
    }
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return text
  const questionLines = lines.filter((line) => line.includes('?'))
  if (questionLines.length < 2) return text
  return questionLines[questionLines.length - 1]
}

/**
 * Roda o validador determinístico e, se houver violação de segurança (block),
 * substitui o texto por uma ponte propositiva segura — preservando handoff.
 * NUNCA lança: em erro interno devolve o texto original (degrade gracioso).
 */
export function sanitizeAgentResponse(
  responseText: string,
  ctx: SanitizerCtx,
): SanitizeResult {
  const text = keepLastQuestionWhenStacked((responseText || '').trim())
  if (text.length < 15) return { text: responseText, enforced: false, rules: [] }

  const leadName = (ctx.leadName || '').trim() || null
  const outgoing = ctx.outgoingTexts || []
  const catalogPrices = (ctx.toolCallsLog || [])
    .filter((t) => t.name === 'search_products' && t.result)
    .flatMap((t) => String(t.result).match(/R\$\s*[\d.,]+/g) || [])
  const validatorCtx = {
    messageCount: outgoing.length,
    leadName,
    msgsSinceLastNameUse: countMsgsSinceNameUse(leadName, outgoing.slice(-6).reverse()),
    catalogPrices,
    lastIncomingText: ctx.incomingText || null,
  }

  let result
  try {
    result = validateLLMResponse(text, validatorCtx)
  } catch (e) {
    ctx.log.error?.('sanitizeAgentResponse: validateLLMResponse failed (non-fatal)', { error: (e as Error).message })
    return { text: responseText, enforced: false, rules: [] }
  }

  if (result.valid) {
    const premiumVerdict = getPremiumQualificationVerdict(ctx)
    const premiumSafeText = premiumVerdict.nextRequiredField ? buildSafeQualificationFallback(ctx) : null
    const looksPrematureHandoff = /\b(consultor|vendedor|vou verificar|vou passar|encaminh)/i.test(text)
    if (
      premiumSafeText &&
      premiumVerdict.nextRequiredField &&
      (looksPrematureHandoff || (text.includes('?') && !responseMentionsPremiumField(premiumVerdict.nextRequiredField.key, text)))
    ) {
      return { text: premiumSafeText, enforced: true, rules: ['premium_next_question'] }
    }
    const compacted = text !== (responseText || '').trim()
    return { text: compacted ? text : responseText, enforced: compacted, rules: compacted ? ['single_question'] : [] }
  }

  // Telemetria de TODAS as violações (mantém o sinal que existia no monolith).
  ctx.log.warn('responseSanitizer caught violations', {
    violations: result.violations.map((v) => `${v.rule}:${v.severity}`),
  })

  let currentText = text
  const fixedRules: string[] = []

  // (1) Auto-fix cirúrgico das violações de humanização (anti_lead_echo, anti_jargon_paraphrase, anti_anotei).
  //     Remove fragmento ofensor, mantém o resto. Re-valida pra ver se sobrou algo nocivo.
  const hasAutoFix = result.violations.some((v) => AUTO_FIX_RULES.has(v.rule))
  if (hasAutoFix) {
    try {
      const fix = autoFixHumanizationViolations(currentText, validatorCtx)
      if (fix.fixed.length > 0) {
        currentText = fix.text
        fixedRules.push(...fix.fixed)
        // Re-valida — pode ter sobrado SAFE_TEXT_RULE
        result = validateLLMResponse(currentText, validatorCtx)
      }
    } catch (e) {
      ctx.log.warn?.('autoFixHumanizationViolations failed (non-fatal)', { error: (e as Error).message })
    }
  }

  // (2) Se ainda há violação SAFE_TEXT (negação proibida/erro vazado), substitui texto inteiro.
  const safeTextHarmful = result.violations.filter((v) => v.severity === 'block' && SAFE_TEXT_RULES.has(v.rule))
  if (safeTextHarmful.length > 0) {
    const handoffCalled = (ctx.toolCallsLog || []).some((t) => t.name === 'handoff_to_human')
    const safeText = handoffCalled
      ? 'Vou te conectar com nosso vendedor pra confirmar a melhor opção e o valor pra você. Só um instante! 🙌'
      : 'Deixa eu confirmar essa informação certinho pra você. Você tem preferência de marca ou alguma especificação do produto?'
    const premiumSafeText = handoffCalled ? null : buildSafeQualificationFallback(ctx)
    return { text: premiumSafeText || safeText, enforced: true, rules: [...fixedRules, ...safeTextHarmful.map((v) => v.rule)] }
  }

  // (3) Só houve auto-fix (sem SAFE_TEXT) — retorna o texto reescrito.
  if (fixedRules.length > 0) {
    const premiumSafeText = buildSafeQualificationFallback(ctx)
    if (premiumSafeText && (fixedRules.includes('anti_anotei') || !currentText.includes('?'))) {
      return { text: premiumSafeText, enforced: true, rules: [...fixedRules, 'premium_next_question'] }
    }
    return { text: currentText, enforced: true, rules: fixedRules }
  }

  // (4) Tinha violações mas nenhuma enforced (ex.: só rewrite cosmético sem auto-fix) — passa.
  const compacted = text !== (responseText || '').trim()
  return { text: compacted ? text : responseText, enforced: compacted, rules: compacted ? ['single_question'] : [] }
}
