// WHY: substitui parte do hardcodedRules pré-Sprint B (auditoria 2026-05-21).
// Roda ANTES do validatorAgent LLM — economiza ~$0.0005/turno quando detecta determinístico.

export interface ResponseValidatorContext {
  messageCount: number
  leadName: string | null
  msgsSinceLastNameUse: number | null
  catalogPrices: string[]
}

export interface ResponseViolation {
  rule: string
  severity: 'block' | 'rewrite'
  detail: string
}

export interface ResponseValidatorResult {
  valid: boolean
  violations: ResponseViolation[]
  blockSend: boolean
  rewriteSuggestion: string | null
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase())
}

const NEGATIVE_PHRASES = [
  'nao temos',
  'nao encontrei',
  'sem estoque',
  'em falta',
  'indisponivel',
  'nao trabalhamos com',
  'nao disponivel',
  'nao encontrei opcoes',
  'nao temos esse produto',
]

const INTERNAL_ERROR_PHRASES = [
  'desculpe',
  'desculpa',
  'nao consegui processar',
  'houve um erro',
  'ocorreu um erro',
  'falha ao',
  'tive um problema',
]

const ECHO_OPENERS = [
  'anotado',
  'entendi',
  'perfeito',
  'certo',
  'ok',
  'show',
  'beleza',
  'para confirmar',
  'so pra confirmar',
  'so para confirmar',
  'so confirmando',
  'confirmando',
  'para esclarecer',
  'so esclarecendo',
  'voce esta interessado em',
  'voce quer dizer',
  'entendi corretamente que',
  'vc se refere a',
  'voce se refere a',
]

const GREETINGS = ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'bem-vindo', 'bem vindo']

function checkNegativePhrases(norm: string): ResponseViolation | null {
  for (const p of NEGATIVE_PHRASES) {
    if (norm.includes(p)) {
      return { rule: 'anti_negative_phrases', severity: 'block', detail: `frase negativa detectada: "${p}"` }
    }
  }
  return null
}

function checkInternalError(norm: string): ResponseViolation | null {
  for (const p of INTERNAL_ERROR_PHRASES) {
    if (norm.includes(p)) {
      return { rule: 'anti_internal_error', severity: 'block', detail: `expoe erro interno: "${p}"` }
    }
  }
  return null
}

function checkInternalLeak(text: string): ResponseViolation | null {
  if (/\[INTERNO\]|\[INTERNAL\]/i.test(text)) {
    return { rule: 'anti_internal_leak', severity: 'block', detail: 'tag interna vazou no texto' }
  }
  return null
}

function checkEchoOpener(norm: string): ResponseViolation | null {
  const trimmed = norm.replace(/^\s+/, '')
  for (const opener of ECHO_OPENERS) {
    const re = new RegExp('^' + opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[,.!\\s]|$)')
    if (re.test(trimmed)) {
      return { rule: 'anti_echo_opener', severity: 'rewrite', detail: `abertura eco: "${opener}"` }
    }
  }
  return null
}

function checkRecumprimento(norm: string, ctx: ResponseValidatorContext): ResponseViolation | null {
  if (ctx.messageCount <= 1) return null
  const trimmed = norm.replace(/^\s+/, '')
  for (const g of GREETINGS) {
    const re = new RegExp('^' + g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[,.!\\s]|$)')
    if (re.test(trimmed)) {
      return { rule: 'anti_recumprimento', severity: 'rewrite', detail: `recumprimentou (msg #${ctx.messageCount}) com "${g}"` }
    }
  }
  return null
}

function checkNameOveruse(text: string, ctx: ResponseValidatorContext): ResponseViolation | null {
  if (!ctx.leadName) return null
  if (ctx.msgsSinceLastNameUse === null) return null
  if (ctx.msgsSinceLastNameUse >= 3) return null
  const nameNorm = normalize(ctx.leadName)
  const textNorm = normalize(text)
  const re = new RegExp('\\b' + nameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
  if (re.test(textNorm)) {
    return {
      rule: 'name_overuse',
      severity: 'rewrite',
      detail: `nome "${ctx.leadName}" repetido (${ctx.msgsSinceLastNameUse} msgs desde último uso, min 3)`,
    }
  }
  return null
}

function normalizePrice(p: string): string {
  // remove "R$", whitespace, ponto e vírgula — sobra só dígitos
  return p.replace(/r\$/i, '').replace(/[\s.,]/g, '').trim()
}

function checkHallucinatedPrice(text: string, ctx: ResponseValidatorContext): ResponseViolation | null {
  if (!ctx.catalogPrices.length) return null
  const priceRe = /R\$\s*\d[\d.,]*/gi
  const found = text.match(priceRe)
  if (!found || found.length === 0) return null
  const catalogNorm = new Set(ctx.catalogPrices.map(normalizePrice))
  for (const price of found) {
    const norm = normalizePrice(price)
    if (!catalogNorm.has(norm)) {
      return {
        rule: 'hallucinated_price',
        severity: 'block',
        detail: `preco "${price}" nao bate com catalogo (${ctx.catalogPrices.join(', ')})`,
      }
    }
  }
  return null
}

function buildSuggestion(violations: ResponseViolation[]): string | null {
  if (!violations.length) return null
  const tips: string[] = []
  const rules = new Set(violations.map((v) => v.rule))
  if (rules.has('anti_negative_phrases')) tips.push('substituir negativa direta por alternativa propositiva')
  if (rules.has('anti_internal_error')) tips.push('remover desculpa/erro interno — silenciar ou redirecionar')
  if (rules.has('anti_internal_leak')) tips.push('remover tags [INTERNO]/[INTERNAL] vazadas')
  if (rules.has('anti_echo_opener')) tips.push('remover abertura eco e iniciar direto com a pergunta')
  if (rules.has('anti_recumprimento')) tips.push('remover saudacao repetida (conversa ja em andamento)')
  if (rules.has('name_overuse')) tips.push('remover nome do lead (uso recente demais)')
  if (rules.has('hallucinated_price')) tips.push('preco fora do catalogo — usar somente precos retornados pelo search')
  return tips.join('; ')
}

export function validateLLMResponse(
  text: string,
  ctx: ResponseValidatorContext,
): ResponseValidatorResult {
  const norm = normalize(text)
  const violations: ResponseViolation[] = []

  const checks = [
    checkNegativePhrases(norm),
    checkInternalError(norm),
    checkInternalLeak(text),
    checkEchoOpener(norm),
    checkRecumprimento(norm, ctx),
    checkNameOveruse(text, ctx),
    checkHallucinatedPrice(text, ctx),
  ]
  for (const v of checks) if (v) violations.push(v)

  const blockSend = violations.some((v) => v.severity === 'block')
  return {
    valid: violations.length === 0,
    violations,
    blockSend,
    rewriteSuggestion: buildSuggestion(violations),
  }
}
