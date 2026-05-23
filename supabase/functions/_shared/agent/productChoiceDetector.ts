/**
 * Sprint C Fix Bug 2 (2026-05-23 v7.43.1) — Detector de escolha de produto via clique.
 *
 * Quando lead clica "Eu quero!" no carrossel, UAZAPI envia o título do produto como
 * texto. O sistema antes tratava como msg comum — IA pedia qualif genérica em vez de
 * confirmar a escolha e continuar a venda.
 *
 * Esta detecção pré-LLM identifica:
 *   - Incoming text que bate EXATAMENTE com título de produto do catálogo
 *   - Sinaliza pro LLM que lead JÁ ESCOLHEU e quer continuar a venda
 *
 * Caso real (Eletropiso V1, 2026-05-23 14:41-44):
 *   - Carrossel enviado com 3 tintas
 *   - Lead clicou "Eu quero!" no Dialine Iquine 750ml
 *   - UAZAPI converteu em texto: "Tinta Esmalte Acetinada Dialine Branco Neve 750ml - Iquine"
 *   - IA respondeu "qual ambiente?" (ignorou a escolha)
 *
 * Após este fix: detecção produz instrução LLM → "Ótima escolha! O Dialine... Quer fechar o pedido?"
 */

import type { Logger } from './context.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface ProductChoiceMatch {
  /** Produto que o lead escolheu (título do catálogo) */
  productTitle: string
  /** Preço do produto (formatado pra hint) */
  price: string
  /** Razão da detecção (debug) */
  reason: 'exact_title' | 'fuzzy_title' | 'with_id'
}

export interface DetectProductChoiceArgs {
  /** Texto da última msg do lead (já decodificado pelo webhook) */
  incomingText: string
  /** Produtos do catálogo do agent (já carregados upstream) */
  catalogProducts: Array<{ title: string; price?: number | string | null }>
  /**
   * Última msg outgoing — se for `media_type='carousel'` ou `'image'`, isso aumenta
   * a confidence (lead acabou de ver os produtos)
   */
  lastOutgoingMediaType?: string | null
  log: Logger
}

// =============================================================================
// Helpers privados
// =============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatPrice(price: number | string | null | undefined): string {
  if (price == null) return 'preço sob consulta'
  const n = typeof price === 'number' ? price : parseFloat(String(price))
  if (isNaN(n)) return 'preço sob consulta'
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

/**
 * Tenta extrair título da forma "Titulo (id)" — formato que tryButtonReply usa
 * em webhook quando button display text + id são diferentes.
 */
function stripButtonIdSuffix(text: string): string {
  const m = text.match(/^(.+?)\s*\([^)]+\)$/)
  if (m && m[1]) return m[1].trim()
  return text.trim()
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Verifica se incomingText é um clique de produto do catálogo.
 *
 * Match strategy (em ordem):
 *   1. Exact (after strip "id" suffix + normalize)
 *   2. Fuzzy: catalog title contém >=80% das palavras do incoming
 *
 * Retorna null se nenhum produto bate.
 */
export function detectProductChoice(args: DetectProductChoiceArgs): ProductChoiceMatch | null {
  const { incomingText, catalogProducts, lastOutgoingMediaType, log } = args
  if (!incomingText || incomingText.length < 5) return null
  if (!catalogProducts || catalogProducts.length === 0) return null

  // Strip " (botão_id)" suffix se webhook anexou
  const cleaned = stripButtonIdSuffix(incomingText)
  const normIncoming = normalize(cleaned)
  if (normIncoming.length < 5) return null

  // 1. Exact match
  for (const p of catalogProducts) {
    if (!p.title) continue
    if (normalize(p.title) === normIncoming) {
      log.info('detectProductChoice: exact match', { product: p.title })
      return {
        productTitle: p.title,
        price: formatPrice(p.price),
        reason: 'exact_title',
      }
    }
  }

  // 2. Fuzzy match (>=80% das palavras do incoming presentes no título)
  // Só dispara se última outgoing foi mídia (carousel/image) — evita falso positivo
  // em msgs longas do lead que casualmente compartilham palavras com produtos.
  if (lastOutgoingMediaType === 'carousel' || lastOutgoingMediaType === 'image') {
    const incomingWords = normIncoming.split(' ').filter((w) => w.length >= 3)
    if (incomingWords.length < 2) return null

    for (const p of catalogProducts) {
      if (!p.title) continue
      const titleWords = normalize(p.title).split(' ').filter((w) => w.length >= 3)
      if (titleWords.length < 2) continue
      const matched = incomingWords.filter((w) => titleWords.includes(w)).length
      const ratio = matched / incomingWords.length
      if (ratio >= 0.8) {
        log.info('detectProductChoice: fuzzy match', {
          product: p.title,
          ratio: ratio.toFixed(2),
        })
        return {
          productTitle: p.title,
          price: formatPrice(p.price),
          reason: 'fuzzy_title',
        }
      }
    }
  }

  return null
}

/**
 * Monta hint pro LLM quando lead escolheu produto. Injetar no system prompt
 * ou como msg user de contexto antes da chamada LLM.
 *
 * O hint instrui claramente o LLM a:
 *   - Confirmar a escolha com entusiasmo ("Ótima escolha!")
 *   - Não pedir qualificação adicional (lead já decidiu)
 *   - Perguntar próximo passo: mais itens? finalizar? transbordo pra humano?
 */
export function buildProductChoiceHint(match: ProductChoiceMatch): string {
  return [
    `[CONTEXTO INTERNO — não repita ao lead]`,
    `Lead acabou de escolher o produto: "${match.productTitle}" (${match.price}).`,
    `Ele clicou em "Eu quero!" no carrossel — JÁ DECIDIU, não pergunte mais qualificação.`,
    `Sua resposta DEVE:`,
    `1. Confirmar com entusiasmo curto ("Ótima escolha!" ou similar)`,
    `2. Pergunte se quer adicionar mais itens ao pedido OU finalizar agora`,
    `3. Se ele quiser finalizar, faça handoff_to_human pra fechar com vendedor`,
    `NÃO pergunte ambiente, cor, marca — lead já viu opções e escolheu uma.`,
  ].join('\n')
}
