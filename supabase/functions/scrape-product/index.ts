import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

/**
 * scrape-product: Extracts product data (title, price, description, images)
 * from a given URL. Uses HTML meta tags, JSON-LD, and Open Graph as primary
 * sources, falling back to heuristic HTML parsing.
 *
 * This runs server-side to avoid CORS issues and keeps scraping logic
 * away from the frontend.
 */

const log = createLogger('scrape-product')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await verifyAuth(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return errorResponse(corsHeaders, 'URL is required', 400)
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol')
    } catch {
      return errorResponse(corsHeaders, 'URL inválida', 400)
    }

    // Fetch the page
    const pageResponse = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    }, 20000)

    if (!pageResponse.ok) {
      return errorResponse(corsHeaders, `Erro ao acessar URL: ${pageResponse.status}`, 422)
    }

    const html = await pageResponse.text()
    const product = extractProductData(html, parsedUrl.origin)

    log.info('Product scraped', { url, title: product.title })

    return successResponse(corsHeaders, { product })
  } catch (err) {
    log.error('Error', { error: (err as Error).message })
    return errorResponse(corsHeaders, err instanceof Error ? err.message : 'Erro ao importar produto', 500)
  }
})

// ─── Extraction Logic ────────────────────────────────────────────────

interface ProductData {
  title: string
  price: number | null
  description: string
  images: string[]
  category: string
  sku: string
  brand: string
}

function extractProductData(html: string, origin: string): ProductData {
  const product: ProductData = {
    title: '', price: null, description: '', images: [], category: '', sku: '', brand: '',
  }

  // 1. Try JSON-LD (most reliable structured data)
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const match of jsonLdMatches) {
    try {
      const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()
      const data = JSON.parse(jsonStr)
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
          product.title = product.title || item.name || ''
          product.description = product.description || item.description || ''
          product.brand = product.brand || item.brand?.name || item.brand || ''
          product.sku = product.sku || item.sku || item.gtin13 || item.gtin || ''
          product.category = product.category || item.category || ''

          // Price from offers
          const offers = item.offers || item.Offers
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers
            const p = parseFloat(offer?.price || offer?.lowPrice || '0')
            if (p > 0) product.price = p
          }

          // Images
          const imgs = item.image
          if (typeof imgs === 'string') product.images.push(imgs)
          else if (Array.isArray(imgs)) product.images.push(...imgs.filter((i: unknown) => typeof i === 'string'))
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  // 2. Open Graph tags (fallback)
  if (!product.title) product.title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || ''
  if (!product.description) product.description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || ''
  if (product.images.length === 0) {
    const ogImage = extractMeta(html, 'og:image')
    if (ogImage) product.images.push(ogImage)
  }

  // 3. Price from meta tags
  if (!product.price) {
    const priceMeta = extractMeta(html, 'product:price:amount') || extractMeta(html, 'og:price:amount')
    if (priceMeta) product.price = parseFloat(priceMeta) || null
  }

  // 4. HTML <title> fallback
  if (!product.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) product.title = titleMatch[1].trim().split(' - ')[0].split(' | ')[0].trim()
  }

  // 5. Price from common HTML patterns
  if (!product.price) {
    const pricePatterns = [
      /data-price=["']?([\d.,]+)/i,
      /itemprop=["']price["'][^>]*content=["']?([\d.,]+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?R\$\s*([\d.,]+)/i,
      /R\$\s*([\d]+[.,]\d{2})/,
    ]
    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match) {
        const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
        if (val > 0 && val < 1_000_000) { product.price = val; break }
      }
    }
  }

  // 6. Additional images from common patterns
  if (product.images.length < 3) {
    const imgMatches = html.match(/<img[^>]+src=["']([^"']+(?:product|catalog|upload|media|cdn)[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)/gi) || []
    for (const img of imgMatches.slice(0, 10)) {
      const srcMatch = img.match(/src=["']([^"']+)/)
      if (srcMatch) {
        let src = srcMatch[1]
        if (src.startsWith('//')) src = 'https:' + src
        else if (src.startsWith('/')) src = origin + src
        if (!product.images.includes(src)) product.images.push(src)
      }
    }
  }

  // 7. SKU from common patterns
  if (!product.sku) {
    const skuMatch = html.match(/(?:sku|SKU|ref|REF|codigo|código)[^>]*>[\s:]*([A-Z0-9-]+)/i)
      || html.match(/data-sku=["']([^"']+)/i)
      || html.match(/itemprop=["']sku["'][^>]*content=["']([^"']+)/i)
    if (skuMatch) product.sku = skuMatch[1].trim()
  }

  // Deduplicate images
  product.images = [...new Set(product.images)].slice(0, 10)

  // Clean up
  product.title = cleanText(product.title)
  product.description = cleanText(product.description)
  product.brand = cleanText(product.brand)

  return product
}

function extractMeta(html: string, name: string): string {
  // Match both name="" and property="" attributes
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1].trim()
  }
  return ''
}

function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
