import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

/**
 * Batch Product Scraper
 *
 * POST: Start a scraping job — finds product links on a page and scrapes each one
 * GET:  Check job status (polling)
 *
 * Uses scrape-product edge function internally for each product URL.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const auth = await verifyAuth(req)
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    // GET: Check job status
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const jobId = url.searchParams.get('job_id')
      if (!jobId) return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

      const { data: job } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST: Start scraping job
    const { url: pageUrl, agent_id } = await req.json()
    if (!pageUrl || !agent_id) return new Response(JSON.stringify({ error: 'url and agent_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Create job record
    const { data: job } = await supabase.from('scrape_jobs').insert({
      agent_id, url: pageUrl, status: 'scanning', progress: 0, total: 0,
      imported: 0, duplicates: 0, errors: 0, user_id: auth.userId,
    }).select('id').single()

    if (!job) return new Response(JSON.stringify({ error: 'Failed to create job' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Process in background (non-blocking)
    processJob(job.id, pageUrl, agent_id).catch(err =>
      console.error('[scrape-batch] Background job error:', err)
    )

    return new Response(JSON.stringify({ ok: true, job_id: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[scrape-batch] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Background Processing ──

async function processJob(jobId: string, pageUrl: string, agentId: string) {
  try {
    // Step 1: Fetch page and find product links
    await updateJob(jobId, { status: 'scanning' })
    console.log(`[scrape-batch] Job ${jobId}: scanning ${pageUrl}`)

    const pageRes = await fetchWithTimeout(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsPRO/1.0)' },
    }, 20000)

    if (!pageRes.ok) {
      await updateJob(jobId, { status: 'failed', error_message: `HTTP ${pageRes.status}` })
      return
    }

    const html = await pageRes.text()
    const baseUrl = new URL(pageUrl).origin
    const productLinks = extractProductLinks(html, baseUrl, pageUrl)

    if (productLinks.length === 0) {
      await updateJob(jobId, { status: 'completed', total: 0, error_message: 'Nenhum link de produto encontrado' })
      return
    }

    // Save found links and start processing
    const total = Math.min(productLinks.length, 100) // Max 100
    await updateJob(jobId, { status: 'processing', total, found_links: productLinks.slice(0, total) })
    console.log(`[scrape-batch] Job ${jobId}: found ${productLinks.length} links, processing ${total}`)

    // Step 2: Load existing products for dedup
    const { data: existing } = await supabase
      .from('ai_agent_products')
      .select('title, sku')
      .eq('agent_id', agentId)
    const existingTitles = new Set((existing || []).map(p => p.title.toLowerCase()))

    // Step 3: Scrape each product link
    let imported = 0, duplicates = 0, errors = 0

    for (let i = 0; i < total; i++) {
      const link = productLinks[i]
      try {
        const product = await scrapeProductUrl(link)
        if (!product || !product.title) { errors++; continue }

        // Dedup
        if (existingTitles.has(product.title.toLowerCase())) { duplicates++; continue }
        existingTitles.add(product.title.toLowerCase())

        // Insert
        await supabase.from('ai_agent_products').insert({
          agent_id: agentId,
          title: product.title,
          price: product.price || 0,
          description: product.description || '',
          category: product.category || '',
          sku: product.sku || '',
          images: product.images || [],
          in_stock: true,
          enabled: true,
          position: (existing?.length || 0) + imported,
        })
        imported++
      } catch (err) {
        errors++
        console.warn(`[scrape-batch] Failed to scrape ${link}:`, err)
      }

      // Update progress every 5 products
      if ((i + 1) % 5 === 0 || i === total - 1) {
        await updateJob(jobId, { progress: i + 1, imported, duplicates, errors })
      }
    }

    await updateJob(jobId, { status: 'completed', progress: total, imported, duplicates, errors })
    console.log(`[scrape-batch] Job ${jobId}: done. Imported: ${imported}, Dupes: ${duplicates}, Errors: ${errors}`)

  } catch (err) {
    console.error(`[scrape-batch] Job ${jobId} failed:`, err)
    await updateJob(jobId, { status: 'failed', error_message: err instanceof Error ? err.message : String(err) })
  }
}

async function updateJob(jobId: string, data: Record<string, any>) {
  await supabase.from('scrape_jobs').update({ ...data, updated_at: new Date().toISOString() }).eq('id', jobId)
}

// ── Link Extraction ──

function extractProductLinks(html: string, baseUrl: string, pageUrl: string): string[] {
  const links = new Set<string>()
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null

  // Product URL patterns
  const productPatterns = [
    /\/produto\//i, /\/product\//i, /\/item\//i, /\/p\//i,
    /\/produtos\//i, /\/products\//i, /\/catalog\//i,
    /-p-\d+/i, /\/dp\//i, /\.html$/i,
  ]

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1]
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue

    // Resolve relative URLs
    if (href.startsWith('/')) href = baseUrl + href
    else if (!href.startsWith('http')) href = new URL(href, pageUrl).href

    // Must be same domain
    try { if (new URL(href).origin !== baseUrl) continue } catch { continue }

    // Check if looks like a product page
    if (productPatterns.some(p => p.test(href))) {
      links.add(href)
    }
  }

  return [...links]
}

// ── Single Product Scraper (reuses scrape-product logic) ──

interface ProductData {
  title: string; price: number | null; description: string
  images: string[]; category: string; sku: string
}

async function scrapeProductUrl(url: string): Promise<ProductData | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsPRO/1.0)' },
    }, 15000)
    if (!res.ok) return null
    const html = await res.text()
    return extractProductData(html, new URL(url).origin)
  } catch { return null }
}

function extractProductData(html: string, origin: string): ProductData {
  const product: ProductData = { title: '', price: null, description: '', images: [], category: '', sku: '' }

  // JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const m of jsonLdMatches) {
    try {
      const json = JSON.parse(m.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim())
      const items = Array.isArray(json) ? json : [json]
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
          product.title = product.title || item.name || ''
          product.description = product.description || item.description || ''
          product.sku = product.sku || item.sku || item.gtin13 || ''
          product.category = product.category || item.category || ''
          const offers = item.offers || item.Offers
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers
            const p = parseFloat(offer?.price || offer?.lowPrice || '0')
            if (p > 0) product.price = p
          }
          if (item.image) {
            const imgs = Array.isArray(item.image) ? item.image : [item.image]
            product.images = imgs.filter((i: any) => typeof i === 'string' && i.startsWith('http')).slice(0, 10)
          }
        }
      }
    } catch {}
  }

  // OG tags fallback
  if (!product.title) {
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    product.title = ogTitle?.[1] || ''
  }
  if (!product.description) {
    const ogDesc = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i)
    product.description = ogDesc?.[1] || ''
  }
  if (!product.title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    product.title = titleTag?.[1]?.split(/\s*[-|]\s*/)[0]?.trim() || ''
  }

  // Price from HTML
  if (!product.price) {
    const priceMatch = html.match(/R\$\s*([\d.,]+)/i)
    if (priceMatch) {
      const p = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'))
      if (p > 0 && p < 1000000) product.price = p
    }
  }

  // Images from OG + img tags
  if (product.images.length === 0) {
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    if (ogImg?.[1]) product.images.push(ogImg[1])
  }
  if (product.images.length < 5) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
    let imgMatch: RegExpExecArray | null
    while ((imgMatch = imgRegex.exec(html)) !== null && product.images.length < 10) {
      const src = imgMatch[1]
      if (/product|catalog|upload|media|cdn/i.test(src) && src.startsWith('http')) {
        if (!product.images.includes(src)) product.images.push(src)
      }
    }
  }

  return product
}
