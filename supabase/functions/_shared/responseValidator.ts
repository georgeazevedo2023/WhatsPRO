// WHY: substitui parte do hardcodedRules pré-Sprint B (auditoria 2026-05-21).
// Roda ANTES do validatorAgent LLM — economiza ~$0.0005/turno quando detecta determinístico.

export interface ResponseValidatorContext {
  messageCount: number
  leadName: string | null
  msgsSinceLastNameUse: number | null
  catalogPrices: string[]
  /**
   * Texto da ÚLTIMA mensagem incoming do lead (para anti_jargon_paraphrase).
   * Quando presente, se o lead usou termos técnicos ("interno"/"externo"/"fosco"),
   * o bot NÃO pode parafrasear ("dentro de casa"/"fora de casa"/"sem brilho").
   * Optional: omitido = pular regra.
   */
  lastIncomingText?: string | null
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

const STOCK_CONFIRMATION_PATTERNS: RegExp[] = [
  /^\s*sim\b.{0,80}\btrabalhamos\s+com\b/i,
  /^\s*sim\b.{0,80}\b(?:modelo|modelos|op[cç][aã]o|op[cç][oõ]es|produto|produtos)\b/i,
  /\btem\s+sim\b/i,
  /\btemos\s+sim\b/i,
  /\btrabalhamos\s+com\b.{0,80}\b(?:modelo|modelos|op[cç][aã]o|op[cç][oõ]es|esse|essa|produto)\b/i,
  /\btemos\b.{0,60}\b(?:dispon[ií]vel|dispon[ií]veis|em\s+estoque)\b/i,
  /\b(?:est[aá]|esta)\s+dispon[ií]vel\b/i,
  /\bproduto\s+dispon[ií]vel\b/i,
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

function checkStockConfirmation(text: string): ResponseViolation | null {
  for (const re of STOCK_CONFIRMATION_PATTERNS) {
    if (re.test(text)) {
      return {
        rule: 'anti_stock_confirmation',
        severity: 'block',
        detail: 'confirmacao positiva de estoque/disponibilidade detectada',
      }
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

/**
 * (2026-05-28) anti_lead_echo — bot começa eco do que o lead acabou de dizer.
 * Detecta padrões "Entendi, você quer X" / "Pelo que você falou" / "Você procura X"
 * que viraram clichê de IA assistant. NÃO pega "Entendi." sozinho (curto, humano).
 */
const LEAD_ECHO_PATTERNS: RegExp[] = [
  /^\s*entendi[,!]?\s+(?:voc[êe]|q[uê]e?\s+voc[êe]|o\s+que\s+voc[êe])/i,
  /^\s*pelo\s+que\s+voc[êe]\s+(?:disse|falou|me\s+(?:disse|falou))/i,
  /^\s*voc[êe]\s+(?:me\s+)?disse\s+que/i,
  /^\s*ent[ãa]o\s+voc[êe]\s+(?:quer|procura|busca)/i,
  /^\s*voc[êe]\s+(?:quer|procura|busca)\s+(?:uma?|um|os|as)\s+/i,
]

function checkLeadEcho(text: string): ResponseViolation | null {
  for (const re of LEAD_ECHO_PATTERNS) {
    if (re.test(text)) {
      return { rule: 'anti_lead_echo', severity: 'block', detail: `abertura ecoa o lead: "${text.slice(0, 60)}…"` }
    }
  }
  return null
}

/**
 * (2026-05-28) anti_jargon_paraphrase — bot trocou o termo técnico que o lead usou
 * por uma "tradução" humanizada que vira robótica. Se o lead disse "interno", manter
 * "interno". Se lead NÃO usou o termo técnico, paraphrase é permitido (não é eco).
 * Tabela conservadora: só os 2 piores ofensores (testados em E2E real).
 */
const JARGON_MAP: { lead: RegExp; bot: RegExp; original: string }[] = [
  { lead: /\binterno?\b/i, bot: /\b(?:dentro\s+de\s+casa|ambiente\s+fechado|em\s+casa)\b/i, original: 'interno' },
  { lead: /\bexterno?\b/i, bot: /\b(?:fora\s+de\s+casa|ao\s+ar\s+livre|do\s+lado\s+de\s+fora)\b/i, original: 'externo' },
]

function checkJargonParaphrase(text: string, ctx: ResponseValidatorContext): ResponseViolation | null {
  const lastIn = (ctx.lastIncomingText || '').toLowerCase()
  if (!lastIn) return null
  for (const m of JARGON_MAP) {
    if (m.lead.test(lastIn) && m.bot.test(text)) {
      return {
        rule: 'anti_jargon_paraphrase',
        severity: 'block',
        detail: `parafraseou "${m.original}" do lead — soa robótico`,
      }
    }
  }
  return null
}

/**
 * (2026-05-28) anti_anotei — palavra-veneno: pessoa real NÃO fala "anotei"/"já anotei"
 * em atendimento. Cobre "anotei", "já anotei", "anotei aqui", "anotei seu pedido",
 * "vou anotar", "deixa eu anotar", "estou anotando".
 */
const ANOTEI_RE = /\b(?:j[áa]\s+)?(?:anotei(?:\s+(?:aqui|tudo(?:\s+aqui)?|seu\s+pedido))?|anotado|vou\s+anotar|deixa\s+eu\s+anotar|estou\s+anotando)\b/i

const SELF_REGISTRATION_RE = /\b(?:vou\s+registrar|vou\s+salvar|vou\s+marcar|registrar\s+(?:seu|o)\s+nome|salvar\s+(?:seu|o)\s+nome)\b/i

function checkAnotei(text: string): ResponseViolation | null {
  if (ANOTEI_RE.test(text) || SELF_REGISTRATION_RE.test(text)) {
    return { rule: 'anti_anotei', severity: 'block', detail: 'usou "anotei" (palavra-veneno — delata IA)' }
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
  if (rules.has('anti_stock_confirmation')) tips.push('nao confirmar estoque/disponibilidade; usar resposta neutra e consultiva')
  if (rules.has('anti_internal_error')) tips.push('remover desculpa/erro interno — silenciar ou redirecionar')
  if (rules.has('anti_internal_leak')) tips.push('remover tags [INTERNO]/[INTERNAL] vazadas')
  if (rules.has('anti_echo_opener')) tips.push('remover abertura eco e iniciar direto com a pergunta')
  if (rules.has('anti_recumprimento')) tips.push('remover saudacao repetida (conversa ja em andamento)')
  if (rules.has('name_overuse')) tips.push('remover nome do lead (uso recente demais)')
  if (rules.has('hallucinated_price')) tips.push('preco fora do catalogo — usar somente precos retornados pelo search')
  if (rules.has('anti_lead_echo')) tips.push('NAO comecar a resposta ecoando "Entendi, voce quer X" — ir direto pra proxima pergunta')
  if (rules.has('anti_jargon_paraphrase')) tips.push('USAR exatamente o termo que o lead usou (ex: "interno" se o lead disse "interno") — nao traduzir/parafrasear')
  if (rules.has('anti_anotei')) tips.push('NUNCA usar "anotei"/"ja anotei"/"vou anotar" — palavra-veneno que delata IA')
  return tips.join('; ')
}

/**
 * (2026-05-28) Auto-fix determinístico das violações de humanização (anti_lead_echo,
 * anti_jargon_paraphrase, anti_anotei). Aplica reescrita cirúrgica no texto antes do
 * envio: remove fragmento ofensor, troca jargão parafraseado pelo termo original,
 * remove menções de "anotei". Conservador: só atua se há violação detectada.
 *
 * Retorna { text, fixed: string[] }. Quando nada foi reescrito, fixed=[].
 */
export function autoFixHumanizationViolations(
  text: string,
  ctx: ResponseValidatorContext,
): { text: string; fixed: string[] } {
  let out = text
  const fixed: string[] = []

  // anti_lead_echo: remove a primeira frase quando ela é puro eco. Conservador:
  // trunca da abertura até o 1º . ! ? ou \n; preserva o resto da resposta.
  for (const re of LEAD_ECHO_PATTERNS) {
    if (re.test(out)) {
      const after = out.replace(/^[^.!?\n]*[.!?\n]\s*/, '').trim()
      if (after && after.length >= 8) {
        out = after.charAt(0).toUpperCase() + after.slice(1)
        fixed.push('anti_lead_echo')
        break
      }
    }
  }

  // anti_jargon_paraphrase: substitui "dentro de casa"/"fora de casa" pelo termo
  // original do lead. Só atua se realmente o lead usou o termo técnico.
  const lastIn = (ctx.lastIncomingText || '').toLowerCase()
  for (const m of JARGON_MAP) {
    if (lastIn && m.lead.test(lastIn) && m.bot.test(out)) {
      out = out.replace(m.bot, m.original)
      fixed.push('anti_jargon_paraphrase')
    }
  }

  // anti_anotei: remove a frase inteira que contém "anotei". Conservador: pega a
  // sentença mais próxima e descarta. Se sobrar string vazia, devolve fallback humano.
  if (ANOTEI_RE.test(out) || SELF_REGISTRATION_RE.test(out)) {
    // Split por sentença mantendo separadores
    const sentences = out.split(/(?<=[.!?\n])\s+/)
    const kept = sentences.filter((s) => !ANOTEI_RE.test(s) && !SELF_REGISTRATION_RE.test(s))
    const rebuilt = kept.join(' ').replace(/\s+/g, ' ').trim()
    if (rebuilt.length >= 10) {
      out = rebuilt.charAt(0).toUpperCase() + rebuilt.slice(1)
      fixed.push('anti_anotei')
    } else {
      // Frase inteira virou "anotei...": substitui por ponte neutra
      out = 'Tudo certo. Vou seguir.'
      fixed.push('anti_anotei')
    }
  }

  return { text: out, fixed }
}

export function validateLLMResponse(
  text: string,
  ctx: ResponseValidatorContext,
): ResponseValidatorResult {
  const norm = normalize(text)
  const violations: ResponseViolation[] = []

  const checks = [
    checkNegativePhrases(norm),
    checkStockConfirmation(text),
    checkInternalError(norm),
    checkInternalLeak(text),
    checkEchoOpener(norm),
    checkRecumprimento(norm, ctx),
    checkNameOveruse(text, ctx),
    checkHallucinatedPrice(text, ctx),
    checkLeadEcho(text),
    checkJargonParaphrase(text, ctx),
    checkAnotei(text),
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
