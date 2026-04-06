/**
 * Carousel building + AI copy generation — D-03.
 *
 * Extracted from ai-agent/index.ts so all edge functions can reuse
 * the LRU-cached AI copy chain (Groq → Gemini → Mistral → static fallback).
 *
 * Usage:
 *   import { generateCarouselCopies, buildCarousel, cleanProductTitle } from '../_shared/carousel.ts'
 */

import { fetchWithTimeout } from './fetchWithTimeout.ts'
import { createLogger } from './logger.ts'

const log = createLogger('carousel')

// ─── Cache ────────────────────────────────────────────────────────────────────

/** In-memory LRU cache for carousel copies — persists within the same Deno isolate */
export const _carouselCopyCache = new Map<string, { copies: string[]; expiresAt: number }>()

/** TTL for cached carousel copies (24 hours) */
export const CAROUSEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Maximum number of entries in the carousel copy cache */
export const CAROUSEL_CACHE_MAX_SIZE = 200

// ─── Title cleaning ──────────────────────────────────────────────────────────

/**
 * Remove redundant brand/name from the last segment of a product title.
 *
 * Example: "Tinta Coral - Coral Premium - Coral" → "Tinta Coral - Coral Premium"
 */
export function cleanProductTitle(title: string): string {
  const parts = title.split(' - ')
  if (parts.length <= 2) return title
  const lastPart = parts[parts.length - 1].trim()
  const rest = parts.slice(0, -1).join(' - ')
  const lastWords = lastPart.split(/\s+/)
  // Check for 3-consecutive-word overlap between last segment and earlier text
  for (let i = 0; i <= lastWords.length - 3; i++) {
    const subseq = lastWords.slice(i, i + 3).join(' ')
    if (rest.toLowerCase().includes(subseq.toLowerCase())) {
      const restLower = rest.toLowerCase()
      const uniqueWords = lastWords.filter(w => w.length > 2 && !restLower.includes(w.toLowerCase()))
      return uniqueWords.length > 0 ? `${rest} - ${uniqueWords.join(' ')}` : rest
    }
  }
  return title
}

// ─── Copy prompt ─────────────────────────────────────────────────────────────

// LLM prompt only generates cards 2-N (card 1 is code-generated)
export const COPY_PROMPT = (title: string, price: string, desc: string, count: number) =>
  `Gere ${count} textos curtos e persuasivos para cards de carrossel WhatsApp.\n` +
  `Produto: ${title} | ${price}\nDescrição: ${desc.substring(0, 200)}\n\n` +
  `Responda APENAS um JSON array de ${count} strings. Exemplo: ["texto1","texto2",...]\n` +
  `- Texto 1: Copy de vendas — benefício principal\n` +
  `- Texto 2: Detalhes técnicos ou especificações\n` +
  `- Texto 3: Diferencial de qualidade\n` +
  `- Texto 4: Urgência + call-to-action\n\n` +
  `Regras: máx 80 chars por texto, sem emojis, português BR, persuasivo. NÃO mencione o nome completo do produto.`

// ─── Copy parsing ─────────────────────────────────────────────────────────────

/**
 * Extract string array from LLM response text.
 * Returns null if the response does not contain a valid JSON array with `count` items.
 */
export function parseCopyResponse(text: string, count: number): string[] | null {
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return null
  try {
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr) || arr.length < count) return null
    return arr.slice(0, count).map((c: unknown) => String(c).substring(0, 120))
  } catch { return null }
}

// ─── Copy generation ──────────────────────────────────────────────────────────

/**
 * Generate sales copy for carousel cards using an AI chain.
 *
 * Card 1 = code-generated (deterministic: title + price).
 * Cards 2-N = Groq → Gemini → Mistral → static fallback (max 2s per provider).
 *
 * Results are cached in-memory by `product.id:numCards` for CAROUSEL_CACHE_TTL_MS.
 *
 * NOTE: API keys are read inside the function body (not module-level) to avoid
 * stale closure issues when Deno isolate env changes between requests.
 */
export async function generateCarouselCopies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any,
  numCards: number
): Promise<string[]> {
  // Read API keys inside function body — avoids closure issue when env changes
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

  const title = product.title || 'Produto'
  const price = product.price ? `R$ ${(product.price as number).toFixed(2)}` : 'Sob consulta'
  const desc = product.description || ''

  // Card 1 is ALWAYS code-generated (deterministic, clean title + price)
  const card1 = `${cleanProductTitle(title)}\n${price}`

  if (numCards <= 1) return [card1]

  // Check cache by product id + numCards
  const cacheKey = `${product.id || title}:${numCards}`
  const cached = _carouselCopyCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    log.info('Carousel copies: cache HIT', { cacheKey })
    return cached.copies
  }

  const copyCount = numCards - 1 // How many cards the LLM needs to generate
  const prompt = COPY_PROMPT(title, price, desc, copyCount)

  // Static fallback for cards 2-5
  const fallbackCopies = [
    `Qualidade garantida!\nO melhor para sua obra`,
    `Alto desempenho e durabilidade\nResultado profissional`,
    `Marca de confiança!\nEscolha dos especialistas`,
    `Aproveite agora!\nUnidades limitadas`,
  ].slice(0, copyCount)

  // Try LLM chain for cards 2-N: Groq → Gemini → static (max 2 providers, 2s timeout each)
  const providers: Array<{ name: string; call: () => Promise<string | null> }> = []

  if (GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      call: async () => {
        const res = await fetchWithTimeout(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.8,
              max_tokens: 300,
            }),
          },
          2000
        )
        if (!res.ok) return null
        const data = await res.json()
        return (data.choices?.[0]?.message?.content as string) || null
      },
    })
  }

  if (GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      call: async () => {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
            }),
          },
          2000
        )
        if (!res.ok) return null
        const data = await res.json()
        return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) || null
      },
    })
  }

  let result: string[] | null = null
  for (const provider of providers) {
    try {
      const text = await provider.call()
      if (text) {
        const copies = parseCopyResponse(text, copyCount)
        if (copies) {
          log.info('Carousel copies: provider succeeded', { provider: provider.name })
          result = [card1, ...copies]
          break
        }
      }
      log.warn('Carousel copies: bad response from provider', { provider: provider.name })
    } catch (e) {
      log.warn('Carousel copies: provider error', { provider: provider.name, error: (e as Error).message })
    }
  }

  if (!result) {
    log.warn('Carousel copies: all LLMs failed, using static fallback')
    result = [card1, ...fallbackCopies]
  }

  // Cache result (evict oldest if cache is full — LRU approximation)
  if (_carouselCopyCache.size >= CAROUSEL_CACHE_MAX_SIZE) {
    const oldestKey = _carouselCopyCache.keys().next().value
    if (oldestKey) _carouselCopyCache.delete(oldestKey)
  }
  _carouselCopyCache.set(cacheKey, { copies: result, expiresAt: Date.now() + CAROUSEL_CACHE_TTL_MS })

  return result
}

// ─── Carousel building ────────────────────────────────────────────────────────

export interface CarouselCard {
  /** Card body text (≤ 80 chars) */
  body: string
  /** Image URL for this card (JPG/PNG) */
  imageUrl?: string
  /** Optional CTA button */
  button?: { displayText: string; url?: string }
}

/**
 * Build a UAZAPI-formatted carousel payload from cards + copies.
 *
 * @param cards  Media+button configuration per card
 * @param copies AI-generated copy strings (one per card)
 */
export function buildCarousel(cards: CarouselCard[], copies: string[]) {
  return cards.map((card, i) => ({
    body: copies[i] || card.body,
    ...(card.imageUrl ? { image: { url: card.imageUrl } } : {}),
    ...(card.button ? { buttons: [{ type: 'url', displayText: card.button.displayText, url: card.button.url }] } : {}),
  }))
}
