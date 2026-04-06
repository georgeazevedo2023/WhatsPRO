/**
 * bio-public — Public endpoint for Bio Link pages.
 * No JWT required (public page access).
 *
 * GET  ?slug=minha-loja          → returns bio page + buttons (increments view_count)
 * POST { button_id: uuid }       → increments click_count for a button
 */
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const log = createLogger('bio-public')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const supabase = createServiceClient()

  // ── POST: track button click ──────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { button_id } = body

      if (!button_id) {
        return Response.json({ error: 'Missing button_id' }, { status: 400, headers: cors })
      }

      const { error } = await supabase.rpc('increment_bio_click', { p_button_id: button_id })
      if (error) {
        log.warn('Failed to increment click', { button_id, error: error.message })
      }

      return Response.json({ ok: true }, { headers: cors })
    } catch (e) {
      log.error('POST error', { error: (e as Error).message })
      return Response.json({ error: 'Internal error' }, { status: 500, headers: cors })
    }
  }

  // ── GET: load bio page ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')

    if (!slug) {
      return Response.json({ error: 'Missing slug' }, { status: 400, headers: cors })
    }

    // Load active bio page by slug
    const { data: page, error: pageError } = await supabase
      .from('bio_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()

    if (pageError) {
      log.error('DB error loading bio page', { slug, error: pageError.message })
      return Response.json({ error: 'Database error' }, { status: 500, headers: cors })
    }

    if (!page) {
      log.info('Bio page not found', { slug })
      return Response.json({ error: 'Not found' }, { status: 404, headers: cors })
    }

    // Load buttons ordered by position
    const { data: buttons, error: buttonsError } = await supabase
      .from('bio_buttons')
      .select('*')
      .eq('bio_page_id', page.id)
      .order('position', { ascending: true })

    if (buttonsError) {
      log.error('DB error loading bio buttons', { pageId: page.id, error: buttonsError.message })
      return Response.json({ error: 'Database error' }, { status: 500, headers: cors })
    }

    // Increment view count (fire-and-forget — don't block response)
    supabase.rpc('increment_bio_view', { p_bio_page_id: page.id }).then(({ error }) => {
      if (error) log.warn('Failed to increment view', { pageId: page.id, error: error.message })
    })

    log.info('Bio page loaded', { slug, buttonCount: (buttons ?? []).length })

    return Response.json({ page, buttons: buttons ?? [] }, { headers: cors })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
})
