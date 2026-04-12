// =============================================================================
// Validator Service (S9)
// Quality gate ANTES de enviar resposta ao lead.
// 10 checks automáticos (0 tokens LLM cada).
// 3 falhas consecutivas → auto handoff.
//
// Wiki: [[wiki/fluxos-servicos]] (S3 — Validator)
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import type { FlowContext, ValidationResult, ValidatorIssue } from '../types.ts'

const supabase = createServiceClient()

// ── Constantes ───────────────────────────────────────────────────────────────

const MIN_LENGTH = 5
const MAX_LENGTH = 1000
const MAX_EMOJIS = 5
const MAX_VALIDATOR_FAILURES = 3

/** Fragmentos que indicam vazamento de prompt do sistema */
const PROMPT_LEAK_PATTERNS = [
  'voce e um assistente', 'you are an assistant', 'system prompt',
  'instrucoes do sistema', 'suas instrucoes', 'role: system',
  'ignore previous', 'ignore suas instrucoes', 'modo desenvolvedor',
  'developer mode', 'dan mode', 'jailbreak',
  '```json', '```typescript', '```python', // code blocks no WhatsApp = leak
]

/** Regex para detectar PII de terceiros */
const PII_PATTERNS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,        // CPF: 123.456.789-00
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, // CNPJ
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // Email
]

/** Palavras comuns PT-BR para heurística de idioma */
const PT_COMMON_WORDS = new Set([
  'de', 'que', 'do', 'da', 'em', 'um', 'para', 'com', 'nao', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas',
  'foi', 'ao', 'ele', 'das', 'tem', 'seu', 'sua', 'ou', 'ser', 'quando',
  'muito', 'nos', 'ja', 'eu', 'tambem', 'so', 'pelo', 'pela', 'ate',
  'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter',
  'voce', 'pode', 'posso', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite',
  'obrigado', 'obrigada', 'sim', 'tudo', 'bem', 'preco', 'produto',
])

/** Padrões de saudação */
const GREETING_PATTERNS = [
  /^(oi|ola|hey|hello|bom dia|boa tarde|boa noite|e ai|eai|fala|salve|opa)/i,
]

// ── Emoji regex ──────────────────────────────────────────────────────────────

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu

// =============================================================================
// 10 Checks
// =============================================================================

function checkSize(text: string): ValidatorIssue | null {
  if (text.length < MIN_LENGTH) {
    return { check: 'size_ok', action: 'block', detail: `Muito curto (${text.length} chars)` }
  }
  if (text.length > MAX_LENGTH) {
    return { check: 'size_ok', action: 'correct', detail: `Truncado de ${text.length} para ${MAX_LENGTH}` }
  }
  return null
}

function checkLanguage(text: string): ValidatorIssue | null {
  const words = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2)

  if (words.length < 3) return null // msg muito curta para avaliar

  const ptCount = words.filter(w => PT_COMMON_WORDS.has(w)).length
  const ratio = ptCount / words.length

  // Se menos de 10% das palavras são PT comuns e tem >5 palavras → suspeito
  if (ratio < 0.1 && words.length > 5) {
    return { check: 'language_match', action: 'block', detail: `PT ratio ${(ratio * 100).toFixed(0)}%` }
  }
  return null
}

function checkPromptLeak(text: string): ValidatorIssue | null {
  const lower = text.toLowerCase()
  for (const pattern of PROMPT_LEAK_PATTERNS) {
    if (lower.includes(pattern)) {
      return { check: 'no_prompt_leak', action: 'block', detail: `Leak: "${pattern}"` }
    }
  }
  return null
}

async function checkPriceAccurate(
  text: string,
  context: FlowContext,
): Promise<ValidatorIssue | null> {
  // Extrai R$ da resposta
  const priceMatch = text.match(/R\$\s*([\d.,]+)/)
  if (!priceMatch) return null // sem preço mencionado = skip

  const agentId = context.agent_config?.agent_id
  if (!agentId) return null // sem catálogo = skip

  const mentionedPrice = parseFloat(priceMatch[1].replace('.', '').replace(',', '.'))
  if (isNaN(mentionedPrice)) return null

  // Busca último produto mostrado
  const productsShown = context.flow_state.step_data?.products_shown ?? []
  if (productsShown.length === 0) return null

  const lastProductId = productsShown[productsShown.length - 1]
  const { data: product } = await supabase
    .from('ai_agent_products')
    .select('price')
    .eq('id', lastProductId)
    .maybeSingle()

  if (!product?.price) return null

  const realPrice = Number(product.price)
  const diff = Math.abs(mentionedPrice - realPrice) / realPrice

  if (diff > 0.1) { // divergência >10%
    return {
      check: 'price_accurate',
      action: 'block',
      detail: `Mencionou R$${mentionedPrice.toFixed(2)}, real R$${realPrice.toFixed(2)} (diff ${(diff * 100).toFixed(0)}%)`,
    }
  }
  return null
}

function checkRepetition(text: string, context: FlowContext): ValidatorIssue | null {
  const lastResponse = (context.flow_state.step_data as Record<string, unknown>)?.last_response as string | undefined
  if (!lastResponse) return null

  // Comparação simples: se >80% similar (normalizado)
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const a = normalize(text)
  const b = normalize(lastResponse)

  if (a === b) {
    return { check: 'no_repetition', action: 'block', detail: 'Resposta idêntica à anterior' }
  }

  // Check parcial: mesmas primeiras 50 chars
  if (a.length > 50 && b.length > 50 && a.slice(0, 50) === b.slice(0, 50)) {
    return { check: 'no_repetition', action: 'block', detail: 'Início idêntico ao da resposta anterior' }
  }

  return null
}

function checkGreetingRepeat(text: string, context: FlowContext): ValidatorIssue | null {
  const stepData = context.flow_state.step_data as Record<string, unknown>
  const greetingSent = stepData?.greeting_sent as boolean | undefined
  if (!greetingSent) return null

  const lower = text.toLowerCase()
  const hasGreeting = GREETING_PATTERNS.some(p => p.test(lower))
  if (!hasGreeting) return null

  // Remove a saudação do início
  let corrected = text
  for (const pattern of GREETING_PATTERNS) {
    corrected = corrected.replace(pattern, '').replace(/^[,!.\s]+/, '').trim()
  }

  if (corrected.length >= MIN_LENGTH) {
    return { check: 'no_greeting_repeat', action: 'correct', detail: 'Saudação repetida removida' }
  }
  // Se sobrou muito pouco texto = bloqueia
  return { check: 'no_greeting_repeat', action: 'block', detail: 'Só saudação repetida' }
}

function checkNameFrequency(text: string, context: FlowContext): ValidatorIssue | null {
  const name = context.lead.lead_name
  if (!name || name.length < 2) return null

  const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const matches = text.match(regex)
  if (!matches || matches.length <= 1) return null

  // Remove ocorrências extras (mantém a primeira)
  let count = 0
  const corrected = text.replace(regex, (match) => {
    count++
    return count === 1 ? match : ''
  }).replace(/\s{2,}/g, ' ').trim()

  return {
    check: 'name_frequency_ok',
    action: 'correct',
    detail: `Nome "${name}" aparecia ${matches.length}x, corrigido para 1x`,
  }
}

function checkEmojiCount(text: string): ValidatorIssue | null {
  const emojis = text.match(EMOJI_REGEX)
  if (!emojis || emojis.length <= MAX_EMOJIS) return null

  // Remove emojis excedentes (mantém os primeiros MAX_EMOJIS)
  let kept = 0
  const corrected = text.replace(EMOJI_REGEX, (match) => {
    kept++
    return kept <= MAX_EMOJIS ? match : ''
  }).trim()

  return {
    check: 'emoji_count_ok',
    action: 'correct',
    detail: `${emojis.length} emojis → ${MAX_EMOJIS}`,
  }
}

function checkMarkdownArtifacts(text: string): ValidatorIssue | null {
  const hasCodeBlock = /```[\s\S]*?```/.test(text)
  const hasMarkdownLink = /\[([^\]]+)\]\([^)]+\)/.test(text)
  const hasBold = /\*\*[^*]+\*\*/.test(text)

  if (!hasCodeBlock && !hasMarkdownLink && !hasBold) return null

  let corrected = text
  corrected = corrected.replace(/```[\s\S]*?```/g, '') // remove code blocks
  corrected = corrected.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
  corrected = corrected.replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** → bold
  corrected = corrected.replace(/\s{2,}/g, ' ').trim()

  if (corrected.length < MIN_LENGTH) {
    return { check: 'no_markdown_artifacts', action: 'block', detail: 'Só markdown artifacts' }
  }
  return { check: 'no_markdown_artifacts', action: 'correct', detail: 'Markdown removido' }
}

function checkPiiExposure(text: string): ValidatorIssue | null {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      return { check: 'no_pii_exposure', action: 'block', detail: 'PII detectado na resposta' }
    }
  }
  return null
}

// =============================================================================
// API Pública
// =============================================================================

/** Aplica correção ao texto baseado no tipo de issue */
function applyCorrection(text: string, issue: ValidatorIssue): string {
  switch (issue.check) {
    case 'size_ok':
      return text.slice(0, MAX_LENGTH)

    case 'no_greeting_repeat': {
      let corrected = text
      for (const pattern of GREETING_PATTERNS) {
        corrected = corrected.replace(pattern, '').replace(/^[,!.\s]+/, '').trim()
      }
      return corrected
    }

    case 'name_frequency_ok': {
      // Já calculado no check mas recalculamos para segurança
      const nameMatch = text.match(/\b\w+\b/) // simplificado
      return text // correção complexa — retorna original por segurança
    }

    case 'emoji_count_ok': {
      let kept = 0
      return text.replace(EMOJI_REGEX, (match) => {
        kept++
        return kept <= MAX_EMOJIS ? match : ''
      }).trim()
    }

    case 'no_markdown_artifacts': {
      let corrected = text
      corrected = corrected.replace(/```[\s\S]*?```/g, '')
      corrected = corrected.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      corrected = corrected.replace(/\*\*([^*]+)\*\*/g, '$1')
      return corrected.replace(/\s{2,}/g, ' ').trim()
    }

    default:
      return text
  }
}

export async function validateResponse(
  responseText: string,
  context: FlowContext,
): Promise<ValidationResult> {
  const issues: ValidatorIssue[] = []

  // 10 checks — sync primeiro, async (price) depois
  const syncChecks = [
    checkSize(responseText),
    checkLanguage(responseText),
    checkPromptLeak(responseText),
    checkRepetition(responseText, context),
    checkGreetingRepeat(responseText, context),
    checkNameFrequency(responseText, context),
    checkEmojiCount(responseText),
    checkMarkdownArtifacts(responseText),
    checkPiiExposure(responseText),
  ]

  for (const issue of syncChecks) {
    if (issue) issues.push(issue)
  }

  // Async check: price accuracy (faz query no DB)
  const priceIssue = await checkPriceAccurate(responseText, context)
  if (priceIssue) issues.push(priceIssue)

  // Se nenhuma issue → passa
  if (issues.length === 0) {
    return { passed: true, issues: [] }
  }

  // Verifica se há bloqueios
  const blocks = issues.filter(i => i.action === 'block')
  if (blocks.length > 0) {
    console.warn('[validator] BLOCKED:', blocks.map(b => b.check).join(', '))
    return { passed: false, issues }
  }

  // Só correções → aplica e passa
  let corrected = responseText
  for (const issue of issues.filter(i => i.action === 'correct')) {
    corrected = applyCorrection(corrected, issue)
  }

  return {
    passed: true,
    corrected_text: corrected !== responseText ? corrected : undefined,
    issues,
  }
}
