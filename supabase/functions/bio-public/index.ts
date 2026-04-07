/**
 * bio-public — Public endpoint for Bio Link pages.
 * No JWT required (public page access).
 *
 * GET  ?slug=minha-loja          → returns bio page + buttons (increments view_count)
 * POST { button_id: uuid }       → increments click_count for a button (backward compat)
 * POST { action: 'click', button_id: uuid }   → increments click_count for a button
 * POST { action: 'capture', bio_page_id, bio_button_id?, name?, phone?, email?, extra_data? }
 *                                → saves lead capture to bio_lead_captures
 */
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { upsertContactFromPhone, upsertLeadFromFormData } from '../_shared/leadHelper.ts'

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

  // ── POST: track button click or capture lead ─────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json() as {
        action?: string
        button_id?: string
        bio_page_id?: string
        bio_button_id?: string
        name?: string
        phone?: string
        email?: string
        extra_data?: Record<string, string>
      }

      // Determine action: explicit field or backward-compat (button_id present = click)
      const action = body.action ?? (body.button_id ? 'click' : undefined)

      if (!action) {
        return Response.json({ error: 'Missing action or button_id' }, { status: 400, headers: cors })
      }

      // ── action: click ──────────────────────────────────────────────────────
      if (action === 'click') {
        const { button_id } = body
        if (!button_id) {
          return Response.json({ error: 'Missing button_id' }, { status: 400, headers: cors })
        }

        const { error } = await supabase.rpc('increment_bio_click', { p_button_id: button_id })
        if (error) {
          log.warn('Failed to increment click', { button_id, error: error.message })
        }

        return Response.json({ ok: true }, { headers: cors })
      }

      // ── action: capture ────────────────────────────────────────────────────
      if (action === 'capture') {
        const { bio_page_id, bio_button_id, name, phone, email, extra_data } = body

        if (!bio_page_id) {
          return Response.json({ error: 'Missing bio_page_id' }, { status: 400, headers: cors })
        }

        if (!name && !phone) {
          return Response.json({ error: 'At least name or phone is required' }, { status: 400, headers: cors })
        }

        // Create real contact + lead_profile if phone provided
        let contactId: string | null = null
        if (phone) {
          const contact = await upsertContactFromPhone(supabase, phone, name)
          if (contact) {
            contactId = contact.id
            const formData: Record<string, unknown> = {}
            if (name) formData.nome = name
            if (email) formData.email = email
            if (extra_data) {
              for (const [k, v] of Object.entries(extra_data)) {
                formData[k] = v
              }
            }
            await upsertLeadFromFormData(supabase, contactId, formData, 'bio')
          }
        }

        const { error } = await supabase
          .from('bio_lead_captures')
          .insert({
            bio_page_id,
            bio_button_id: bio_button_id ?? null,
            contact_id: contactId,
            name: name ?? null,
            phone: phone ?? null,
            email: email ?? null,
            extra_data: extra_data ?? null,
          })

        if (error) {
          log.error('Failed to insert lead capture', { bio_page_id, error: error.message })
          return Response.json({ error: 'Database error' }, { status: 500, headers: cors })
        }

        // #M16: If this bio page belongs to a funnel, tag future conversations with funil:SLUG
        let funnelSlug: string | null = null
        if (contactId) {
          try {
            const { data: funnel } = await supabase
              .from('funnels')
              .select('slug')
              .eq('bio_page_id', bio_page_id)
              .eq('status', 'active')
              .maybeSingle()
            if (funnel) {
              funnelSlug = funnel.slug
              // Tag the most recent conversation for this contact
              const { data: convs } = await supabase
                .from('conversations')
                .select('id, tags')
                .eq('contact_id', contactId)
                .order('created_at', { ascending: false })
                .limit(1)
              if (convs?.[0]) {
                const tags: string[] = convs[0].tags || []
                if (!tags.some((t: string) => t.startsWith('funil:'))) {
                  await supabase.from('conversations').update({
                    tags: [...tags, `funil:${funnelSlug}`],
                  }).eq('id', convs[0].id)
                }
              }
            }
          } catch { /* non-critical */ }
        }

        log.info('Lead captured', { bio_page_id, hasName: !!name, hasPhone: !!phone, contactId, funnel: funnelSlug })
        return Response.json({ ok: true, contact_id: contactId, funnel_slug: funnelSlug }, { headers: cors })
      }

      return Response.json({ error: 'Invalid action' }, { status: 400, headers: cors })
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

    // Filter buttons by scheduling window
    const now = new Date().toISOString()
    const activeButtons = (buttons ?? []).filter(btn => {
      if (btn.starts_at && btn.starts_at > now) return false
      if (btn.ends_at && btn.ends_at < now) return false
      return true
    })

    // Resolve catalog products for buttons of type 'catalog'
    const catalogIds = activeButtons
      .filter(b => b.type === 'catalog' && b.catalog_product_id)
      .map(b => b.catalog_product_id as string)

    let catalogMap: Record<string, { id: string; title: string; price: number | null; currency: string | null; image_url: string | null }> = {}

    if (catalogIds.length > 0) {
      const { data: products } = await supabase
        .from('ai_agent_products')
        .select('id, title, price, currency, images')
        .in('id', catalogIds)

      for (const p of (products ?? [])) {
        catalogMap[p.id] = {
          id: p.id,
          title: p.title,
          price: p.price ?? null,
          currency: p.currency ?? null,
          image_url: (p.images as string[])?.[0] ?? null,
        }
      }
    }

    const buttonsWithCatalog = activeButtons.map(btn => ({
      ...btn,
      catalog_product: btn.catalog_product_id ? (catalogMap[btn.catalog_product_id] ?? null) : null,
    }))

    // Increment view count (fire-and-forget — don't block response)
    supabase.rpc('increment_bio_view', { p_bio_page_id: page.id }).then(({ error }) => {
      if (error) log.warn('Failed to increment view', { pageId: page.id, error: error.message })
    })

    log.info('Bio page loaded', { slug, buttonCount: buttonsWithCatalog.length })

    return Response.json({ page, buttons: buttonsWithCatalog }, { headers: cors })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
})
