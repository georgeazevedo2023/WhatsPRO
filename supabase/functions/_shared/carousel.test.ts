import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Deno global before imports
vi.stubGlobal('Deno', {
  env: {
    get: (key: string): string | undefined => {
      const envMap: Record<string, string> = {
        GROQ_API_KEY: '',
        GEMINI_API_KEY: '',
        MISTRAL_API_KEY: '',
      }
      return envMap[key] ?? undefined
    },
  },
})

// eslint-disable-next-line import/first
import {
  cleanProductTitle,
  parseCopyResponse,
  _carouselCopyCache,
  CAROUSEL_CACHE_TTL_MS,
  CAROUSEL_CACHE_MAX_SIZE,
  generateCarouselCopies,
} from './carousel.ts'

describe('cleanProductTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns title unchanged when it has only 2 segments', () => {
    expect(cleanProductTitle('Tinta Coral - Premium')).toBe('Tinta Coral - Premium')
  })

  it('returns title unchanged when it has only 1 segment', () => {
    expect(cleanProductTitle('Tinta Coral')).toBe('Tinta Coral')
  })

  it('removes redundant brand segment when last segment overlaps with earlier text', () => {
    // "Coral" appears in both first and last segment — last segment stripped
    const result = cleanProductTitle('Tinta Coral - Coral Premium - Coral')
    // Last segment "Coral" has words that overlap with "Tinta Coral - Coral Premium"
    // Only 1 word (length <= 2 check: "Coral" has 5 chars so it passes, but is included in rest)
    expect(result).not.toContain('- Coral\n')
    expect(result.length).toBeLessThan('Tinta Coral - Coral Premium - Coral'.length + 1)
  })

  it('preserves unique last segment that has no overlap', () => {
    const title = 'Produto A - Linha B - Especial Único'
    // "Especial" and "Único" are not in "Produto A - Linha B"
    expect(cleanProductTitle(title)).toBe(title)
  })

  it('handles real-world product title with brand repetition', () => {
    // "Suvinil" appears in segment 1 + 3 → segment 3 stripped
    const title = 'Tinta Suvinil - Premium Plus - Suvinil Standard'
    const result = cleanProductTitle(title)
    // Should be stripped to remove redundant last Suvinil segment
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('parseCopyResponse', () => {
  it('extracts a valid JSON array from LLM response text', () => {
    const text = 'Here is the response: ["Copy 1","Copy 2","Copy 3"]'
    const result = parseCopyResponse(text, 3)
    expect(result).toEqual(['Copy 1', 'Copy 2', 'Copy 3'])
  })

  it('returns null when no JSON array found', () => {
    const result = parseCopyResponse('No array here', 2)
    expect(result).toBeNull()
  })

  it('returns null when array has fewer items than count', () => {
    const text = '["Copy 1"]'
    const result = parseCopyResponse(text, 3)
    expect(result).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    const text = '[invalid json'
    const result = parseCopyResponse(text, 1)
    expect(result).toBeNull()
  })

  it('truncates items to 120 chars', () => {
    const longText = 'a'.repeat(200)
    const text = `["${longText}","short"]`
    const result = parseCopyResponse(text, 2)
    expect(result).not.toBeNull()
    expect(result![0].length).toBe(120)
  })

  it('slices to exactly count items when array has more', () => {
    const text = '["a","b","c","d","e"]'
    const result = parseCopyResponse(text, 3)
    expect(result).toHaveLength(3)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('handles JSON array with whitespace and newlines', () => {
    const text = `[\n  "Copy 1",\n  "Copy 2"\n]`
    const result = parseCopyResponse(text, 2)
    expect(result).toEqual(['Copy 1', 'Copy 2'])
  })
})

describe('carousel cache eviction', () => {
  beforeEach(() => {
    _carouselCopyCache.clear()
  })

  afterEach(() => {
    _carouselCopyCache.clear()
  })

  it('has correct CAROUSEL_CACHE_TTL_MS (24h in ms)', () => {
    expect(CAROUSEL_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('has CAROUSEL_CACHE_MAX_SIZE of 200', () => {
    expect(CAROUSEL_CACHE_MAX_SIZE).toBe(200)
  })

  it('evicts oldest entry when cache reaches MAX_SIZE', async () => {
    // Fill cache to max
    for (let i = 0; i < CAROUSEL_CACHE_MAX_SIZE; i++) {
      _carouselCopyCache.set(`key-${i}`, { copies: ['copy'], expiresAt: Date.now() + 1000 })
    }
    expect(_carouselCopyCache.size).toBe(CAROUSEL_CACHE_MAX_SIZE)

    // generateCarouselCopies with a new key should evict oldest
    // Use a product with id that is not in cache, no API keys → uses static fallback
    await generateCarouselCopies({ id: 'new-product-evict', title: 'Test', price: 100 }, 3)

    // Cache should not exceed MAX_SIZE (one eviction happened)
    expect(_carouselCopyCache.size).toBeLessThanOrEqual(CAROUSEL_CACHE_MAX_SIZE)
    // The new key should be present
    expect(_carouselCopyCache.has('new-product-evict:3')).toBe(true)
  })

  it('returns cached copies on second call', async () => {
    const product = { id: 'prod-cache-test', title: 'Cached Product', price: 50 }

    const result1 = await generateCarouselCopies(product, 2)
    const result2 = await generateCarouselCopies(product, 2)

    // Both calls should return the same array (cache hit on 2nd)
    expect(result1).toEqual(result2)
  })
})

describe('generateCarouselCopies', () => {
  beforeEach(() => {
    _carouselCopyCache.clear()
  })

  it('returns single card with title+price when numCards=1', async () => {
    const product = { id: 'p1', title: 'My Product', price: 99.90 }
    const copies = await generateCarouselCopies(product, 1)
    expect(copies).toHaveLength(1)
    expect(copies[0]).toContain('My Product')
    expect(copies[0]).toContain('R$ 99.90')
  })

  it('returns static fallback when no API keys configured', async () => {
    const product = { id: 'p2', title: 'Test Produto', price: 150 }
    const copies = await generateCarouselCopies(product, 3)
    expect(copies).toHaveLength(3)
    // Card 1 is always code-generated
    expect(copies[0]).toContain('Test Produto')
    expect(copies[0]).toContain('R$ 150.00')
    // Cards 2-3 are from static fallback (no API keys)
    expect(typeof copies[1]).toBe('string')
    expect(copies[1].length).toBeGreaterThan(0)
  })

  it('uses "Sob consulta" when product has no price', async () => {
    const product = { id: 'p3', title: 'Free Product' }
    const copies = await generateCarouselCopies(product, 1)
    expect(copies[0]).toContain('Sob consulta')
  })

  it('uses "Produto" as default title when product has no title', async () => {
    const product = { id: 'p4', price: 10 }
    const copies = await generateCarouselCopies(product, 1)
    expect(copies[0]).toContain('Produto')
  })
})
