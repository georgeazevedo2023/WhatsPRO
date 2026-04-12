// =============================================================================
// Intent Detector — 3 Camadas (S7)
// L1 Normalização (~5ms, R$0) → L2 Fuzzy Match (~12ms, R$0)
// → L3 LLM Semântico (~200ms, só se L2 confidence < 70)
//
// 13 intents por prioridade. Bypasses: cancelamento, pessoa, reclamação, produto.
// Wiki: [[wiki/fluxos-detector-intents]]
// =============================================================================

import { callLLM } from '../../_shared/llmProvider.ts'
import type { DetectedIntent, IntentDetectorResult } from '../types.ts'

// ── Configuração ─────────────────────────────────────────────────────────────

const L3_CONFIDENCE_THRESHOLD = 70  // L2 abaixo disso → aciona L3
const L3_TIMEOUT_MS = 3000

/** Prioridade dos intents (maior índice = menor prioridade) */
const INTENT_PRIORITY: string[] = [
  'cancelamento', 'pessoa', 'reclamacao', 'suporte', 'produto',
  'orcamento', 'status', 'agendamento', 'faq', 'promocao',
  'b2b', 'continuacao', 'generico',
]

const BYPASS_INTENTS = new Set(['cancelamento', 'pessoa', 'reclamacao', 'produto'])

// ── L1: Abreviações WhatsApp BR (50+) ───────────────────────────────────────

const ABBREVIATIONS: Record<string, string> = {
  vc: 'voce', vcs: 'voces', qro: 'quero', qr: 'quero', qer: 'quero',
  tb: 'tambem', tbm: 'tambem', tmb: 'tambem',
  pq: 'porque', pqe: 'porque', pke: 'porque',
  qnt: 'quanto', qnto: 'quanto', qts: 'quantos',
  blz: 'beleza', pfv: 'por favor', pf: 'por favor', pfvr: 'por favor',
  hj: 'hoje', amnh: 'amanha', amh: 'amanha',
  mt: 'muito', mto: 'muito', mts: 'muitos',
  msm: 'mesmo', dps: 'depois', dp: 'depois',
  ngm: 'ninguem', cmg: 'comigo', ctg: 'contigo',
  td: 'tudo', tds: 'todos', fds: 'fim de semana',
  msg: 'mensagem', msgs: 'mensagens',
  obg: 'obrigado', obgd: 'obrigado', obgda: 'obrigada',
  qnd: 'quando', qdo: 'quando',
  vdd: 'verdade', vlw: 'valeu', flw: 'falou',
  abs: 'abracos', bjs: 'beijos',
  pra: 'para', pro: 'para o', num: 'nao',
  neh: 'ne', ne: 'ne', n: 'nao', s: 'sim',
  oq: 'o que', aq: 'aqui', dnv: 'de novo',
  ctz: 'certeza', slk: 'se liga', tmj: 'tamo junto',
  d: 'de', q: 'que', p: 'para', c: 'com', t: 'te',
  eh: 'e', ja: 'ja', ta: 'esta', to: 'estou',
  vou: 'vou', vo: 'vou',
  agr: 'agora', hr: 'hora', hrs: 'horas', min: 'minutos',
  seg: 'segunda', ter: 'terca', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sabado', dom: 'domingo',
}

// ── L1: Emoji → Sinal ───────────────────────────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  '😡': '[negativo]', '🤬': '[negativo]', '😤': '[negativo]', '😠': '[negativo]',
  '😢': '[negativo]', '😭': '[negativo]', '💢': '[negativo]',
  '😊': '[positivo]', '😁': '[positivo]', '🥰': '[positivo]', '😍': '[positivo]',
  '👍': '[confirmacao]', '✅': '[confirmacao]', '👌': '[confirmacao]',
  '👎': '[negacao]', '❌': '[negacao]', '🚫': '[negacao]',
  '🛒': '[compra]', '💰': '[compra]', '💵': '[compra]', '💳': '[compra]',
  '📦': '[entrega]', '🚚': '[entrega]',
  '👋': '[saudacao]', '✋': '[saudacao]',
  '❓': '[duvida]', '🤔': '[duvida]',
}

// ── L2: Dicionário de Sinônimos por Intent ──────────────────────────────────

const INTENT_SYNONYMS: Record<string, string[]> = {
  cancelamento: [
    'cancelar', 'cancela', 'parar', 'para', 'sair', 'desinscrever',
    'nao quero mais', 'nao mande mais', 'para de mandar', 'remover',
    'tirar meu numero', 'opt out', 'descadastrar', 'bloquear',
  ],
  pessoa: [
    'falar com', 'quero falar', 'atendente', 'humano', 'alguem',
    'vendedor', 'gerente', 'responsavel', 'pessoa real',
    'nao quero robo', 'nao quero bot', 'gente de verdade',
    'quem me atendeu', 'falar com alguem',
  ],
  reclamacao: [
    'pessimo', 'horrivel', 'lixo', 'absurdo', 'vergonha',
    'indignado', 'revoltado', 'descaso', 'falta de respeito',
    'procon', 'processo', 'reclame aqui', 'denunciar',
    'nunca mais', 'pior atendimento',
  ],
  suporte: [
    'problema', 'erro', 'defeito', 'quebrou', 'nao funciona',
    'ajuda', 'suporte', 'assistencia', 'reclamacao', 'trocar',
    'devolver', 'garantia', 'veio errado', 'danificado', 'conserto',
    'pedido veio errado', 'veio diferente', 'veio trocado', 'nao era isso',
    'produto errado', 'defeituoso', 'estragado', 'nao funciona',
  ],
  produto: [
    'tem', 'produto', 'preco', 'quanto custa', 'tinta', 'piso',
    'porcelanato', 'catalogo', 'disponivel', 'estoque', 'comprar',
    'marca', 'modelo', 'tamanho', 'cor', 'foto',
  ],
  orcamento: [
    'orcamento', 'orca', 'quanto fica', 'faz um preco', 'me faz um preco',
    'quanto sai', 'levanta o custo', 'valor', 'custo',
    'cotacao', 'proposta', 'ponta do lapis', 'tabela',
  ],
  status: [
    'pedido', 'rastreio', 'rastrear', 'cade', 'onde esta',
    'entrega', 'status', 'quando chega', 'prazo', 'nao chegou',
    'meu pedido', 'numero do pedido', 'acompanhar', 'tracking',
  ],
  agendamento: [
    'agendar', 'agenda', 'marcar', 'visita', 'horario', 'data',
    'disponibilidade', 'consulta', 'reserva', 'reservar',
    'dia disponivel', 'que horas pode', 'reuniao',
  ],
  faq: [
    'horario', 'funciona', 'aberto', 'fecha', 'endereco',
    'como funciona', 'duvida', 'informacao', 'localizacao',
    'telefone', 'site', 'como chegar', 'formas de pagamento',
    'parcela', 'cartao', 'pix', 'boleto',
  ],
  promocao: [
    'promocao', 'desconto', 'oferta', 'barato', 'em conta',
    'liquidacao', 'black friday', 'cupom', 'cashback',
    'mais barato', 'melhor preco', 'pechincha',
  ],
  b2b: [
    'fornecedor', 'parceiro', 'revenda', 'distribuidora',
    'representante', 'atacado', 'cnpj', 'empresa',
    'nota fiscal', 'contrato', 'licitacao', 'institucional',
  ],
  continuacao: [
    'sobre ontem', 'voltando', 'continuando', 'lembra',
    'falamos', 'retomando', 'aquele assunto', 'como combinamos',
    'da ultima vez', 'a conversa', 'sobre aquilo',
  ],
  generico: [
    'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite',
    'eai', 'salve', 'fala', 'hey', 'hello', 'opa',
    'e ai', 'beleza', 'tudo bem',
  ],
}

// =============================================================================
// L1 — Normalização (~5ms)
// =============================================================================

export function normalizeMessage(text: string): string {
  let normalized = text.toLowerCase().trim()

  // Emoji → sinais
  for (const [emoji, signal] of Object.entries(EMOJI_MAP)) {
    if (normalized.includes(emoji)) {
      normalized = normalized.replaceAll(emoji, ` ${signal} `)
    }
  }

  // Remove acentos
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Dedup letras repetidas: oiiii→oi, siiiim→sim, socorrooo→socorro
  normalized = normalized.replace(/(.)\1{2,}/g, '$1')

  // Abreviações: tokeniza, substitui, re-junta
  const tokens = normalized.split(/\s+/)
  const expanded = tokens.map((t) => ABBREVIATIONS[t] ?? t)
  normalized = expanded.join(' ')

  // Limpa espaços extras
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

// =============================================================================
// L2 — Fuzzy Match (~12ms)
// =============================================================================

/** Levenshtein distance — implementação DP O(n*m) */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  // Otimização: single-row DP
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost, // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]
}

/** Soundex adaptado para português */
function soundexPT(word: string): string {
  if (!word) return ''

  let s = word.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Dígrafos PT
  s = s.replace(/ch/g, 'x').replace(/lh/g, 'l').replace(/nh/g, 'n')
    .replace(/rr/g, 'r').replace(/ss/g, 's').replace(/qu/g, 'k')
    .replace(/gu/g, 'g').replace(/ç/g, 's')

  // Remove H inicial
  if (s[0] === 'h') s = s.slice(1)
  if (!s) return ''

  const first = s[0].toUpperCase()

  // Mapa fonético
  const map: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  }

  let code = first
  let lastCode = map[s[0]] ?? '0'

  for (let i = 1; i < s.length && code.length < 4; i++) {
    const c = map[s[i]]
    if (c && c !== lastCode) {
      code += c
      lastCode = c
    } else if (!c) {
      lastCode = '0' // vogal reseta
    }
  }

  return code.padEnd(4, '0')
}

/** Verifica se texto contém frase completa (multi-word) */
function containsPhrase(text: string, phrase: string): boolean {
  return text.includes(phrase)
}

/**
 * Fuzzy match: testa cada palavra do input contra cada sinônimo de cada intent.
 * Retorna intents detectados com confidence.
 */
function fuzzyMatch(normalizedText: string): DetectedIntent[] {
  const results: DetectedIntent[] = []
  const inputTokens = normalizedText.split(/\s+/)

  for (const intent of INTENT_PRIORITY) {
    const synonyms = INTENT_SYNONYMS[intent] ?? []
    let bestConfidence = 0
    const matchedTokens: string[] = []

    for (const synonym of synonyms) {
      // Multi-word phrase: match exato na string inteira
      // Frases longas (3+ palavras) = 100, curtas (2 palavras) = 95
      if (synonym.includes(' ')) {
        if (containsPhrase(normalizedText, synonym)) {
          const wordCount = synonym.split(' ').length
          const conf = wordCount >= 3 ? 100 : 95
          if (conf > bestConfidence) {
            bestConfidence = conf
            matchedTokens.length = 0
            matchedTokens.push(synonym)
          }
        }
        continue
      }

      // Single-word: testa contra cada token do input
      for (const token of inputTokens) {
        if (!token || token.startsWith('[')) continue // pula sinais de emoji

        // Match exato
        if (token === synonym) {
          const conf = 100
          if (conf > bestConfidence) {
            bestConfidence = conf
            matchedTokens.length = 0
            matchedTokens.push(token)
          }
          continue
        }

        // Fuzzy (Levenshtein)
        const maxDist = token.length >= 5 ? 2 : 1
        const dist = levenshteinDistance(token, synonym)
        if (dist <= maxDist && dist > 0) {
          const conf = 85 - (dist * 5) // dist 1 → 80, dist 2 → 75
          if (conf > bestConfidence) {
            bestConfidence = conf
            matchedTokens.length = 0
            matchedTokens.push(`${token}~${synonym}`)
          }
          continue
        }

        // Soundex PT
        if (token.length >= 3 && synonym.length >= 3) {
          if (soundexPT(token) === soundexPT(synonym)) {
            const conf = 70
            if (conf > bestConfidence) {
              bestConfidence = conf
              matchedTokens.length = 0
              matchedTokens.push(`${token}≈${synonym}`)
            }
          }
        }
      }
    }

    // Boost: sinais de emoji reforçam intents
    if (intent === 'reclamacao' && normalizedText.includes('[negativo]')) {
      bestConfidence = Math.min(100, bestConfidence + 15)
      matchedTokens.push('[negativo]')
    }
    if (intent === 'produto' && normalizedText.includes('[compra]')) {
      bestConfidence = Math.min(100, bestConfidence + 10)
      matchedTokens.push('[compra]')
    }
    if (intent === 'generico' && normalizedText.includes('[saudacao]')) {
      bestConfidence = Math.min(100, bestConfidence + 10)
      matchedTokens.push('[saudacao]')
    }

    // CAPS LOCK no texto original = raiva → boost reclamação/pessoa
    if ((intent === 'reclamacao' || intent === 'pessoa') && /[A-Z]{3,}/.test(normalizedText)) {
      bestConfidence = Math.min(100, bestConfidence + 10)
    }

    if (bestConfidence > 0) {
      results.push({
        intent,
        confidence: bestConfidence,
        layer: 2,
        matched_tokens: matchedTokens,
      })
    }
  }

  // Ordena por confidence DESC, depois por prioridade do intent
  results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent)
  })

  return results
}

// =============================================================================
// L3 — Semântico LLM (~200ms, só se L2 confidence < 70)
// =============================================================================

const CLASSIFY_PROMPT = `Classifique a mensagem de WhatsApp em UMA das 13 categorias abaixo.
Responda APENAS com JSON: {"intent":"<categoria>","confidence":<0-100>}

Categorias (por prioridade):
cancelamento — quer parar de receber mensagens, opt-out, LGPD
pessoa — quer falar com humano, atendente, vendedor específico
reclamacao — insatisfação forte, xingamento, ameaça
suporte — problema técnico, defeito, troca, devolução
produto — pergunta sobre produto específico, preço, disponibilidade
orcamento — quer cotação, proposta, valor de projeto
status — rastreio de pedido, prazo de entrega
agendamento — quer marcar visita, horário, consulta
faq — dúvida geral (horário, endereço, formas de pagamento)
promocao — pergunta sobre desconto, oferta, cupom
b2b — fornecedor, parceiro, revenda, atacado
continuacao — retomando conversa anterior
generico — saudação simples, sem intenção clara`

async function semanticClassify(
  normalizedText: string,
  l2Results: DetectedIntent[],
): Promise<DetectedIntent | null> {
  try {
    const result = await callLLM({
      systemPrompt: CLASSIFY_PROMPT,
      messages: [{ role: 'user', content: normalizedText }],
      tools: [],
      temperature: 0.1,
      maxTokens: 60,
      model: 'gpt-4.1-mini',
    })

    // Parse JSON da resposta
    const text = result.text.trim()
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const intent = String(parsed.intent ?? '').toLowerCase()
    const confidence = Number(parsed.confidence ?? 0)

    if (!INTENT_PRIORITY.includes(intent) || confidence <= 0) return null

    return {
      intent,
      confidence: Math.min(100, confidence),
      layer: 3,
      matched_tokens: l2Results.length > 0
        ? [`l2:${l2Results[0].intent}(${l2Results[0].confidence})`, `l3:${intent}(${confidence})`]
        : [`l3:${intent}(${confidence})`],
    }
  } catch (err) {
    console.warn('[intentDetector] L3 LLM failed, using L2 result:', (err as Error).message)
    return null
  }
}

// =============================================================================
// API Pública
// =============================================================================

export async function detectIntents(messageText: string): Promise<IntentDetectorResult> {
  const startMs = performance.now()

  // Texto vazio → genérico
  if (!messageText || !messageText.trim()) {
    return {
      intents: [{ intent: 'generico', confidence: 100, layer: 1, matched_tokens: ['[vazio]'] }],
      primary: { intent: 'generico', confidence: 100, layer: 1, matched_tokens: ['[vazio]'] },
      normalized_text: '',
      processing_time_ms: 0,
    }
  }

  // ── L1: Normalização ──────────────────────────────────────────────────────
  const normalized = normalizeMessage(messageText)

  // ── L2: Fuzzy Match ───────────────────────────────────────────────────────
  let intents = fuzzyMatch(normalized)

  // Se L2 encontrou com confiança alta → retorna sem LLM
  const primary = intents[0] ?? null
  if (primary && primary.confidence >= L3_CONFIDENCE_THRESHOLD) {
    const bypass = primary && BYPASS_INTENTS.has(primary.intent)
      ? primary.intent as IntentDetectorResult['bypass']
      : undefined

    return {
      intents,
      primary,
      bypass,
      normalized_text: normalized,
      processing_time_ms: Math.round(performance.now() - startMs),
    }
  }

  // ── L3: LLM Semântico (só se L2 confidence < 70) ──────────────────────────
  const l3Promise = semanticClassify(normalized, intents)
  const l3Result = await Promise.race([
    l3Promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), L3_TIMEOUT_MS)),
  ])

  if (l3Result) {
    // L3 prevalece se confidence maior que L2
    if (!primary || l3Result.confidence > primary.confidence) {
      intents = [l3Result, ...intents.filter((i) => i.intent !== l3Result.intent)]
    }
  }

  // Fallback: se nenhum intent detectado → genérico
  if (intents.length === 0) {
    intents = [{ intent: 'generico', confidence: 50, layer: 1, matched_tokens: ['[fallback]'] }]
  }

  const finalPrimary = intents[0]
  const bypass = finalPrimary && BYPASS_INTENTS.has(finalPrimary.intent)
    ? finalPrimary.intent as IntentDetectorResult['bypass']
    : undefined

  return {
    intents,
    primary: finalPrimary,
    bypass,
    normalized_text: normalized,
    processing_time_ms: Math.round(performance.now() - startMs),
  }
}
