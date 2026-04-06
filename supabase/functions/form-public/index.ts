/**
 * form-public — Public endpoint to load form definition + submit form data.
 * No JWT required (public landing page access).
 *
 * GET  ?slug=sorteio&instance_id=xxx  → returns form + fields
 * POST { slug, instance_id, ref_code, data: { field_key: value } } → creates lead + submission
 */
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const log = createLogger('form-public')

// Standard field_key → lead_profiles column mapping
const FIELD_MAP: Record<string, string> = {
  nome: 'full_name', nome_completo: 'full_name', full_name: 'full_name',
  email: 'email', cpf: 'cpf',
  cidade: 'city', city: 'city',
  estado: 'state', state: 'state',
  empresa: 'company', company: 'company',
  cargo: 'role', role: 'role',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const supabase = createServiceClient()

  // ── GET: load form definition ─────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      const slug = url.searchParams.get('slug')
      const instanceId = url.searchParams.get('instance_id')

      if (!slug) {
        return Response.json({ error: 'Missing slug' }, { status: 400, headers: cors })
      }

      // Find form by slug (scoped to instance via agent)
      let query = supabase.from('whatsapp_forms').select('id, name, slug, welcome_message, completion_message, status')
      if (instanceId) {
        const { data: agents } = await supabase.from('ai_agents').select('id').eq('instance_id', instanceId).limit(1)
        const agentId = agents?.[0]?.id
        if (agentId) query = query.eq('agent_id', agentId)
      }
      const { data: form, error } = await query.eq('slug', slug).eq('status', 'active').maybeSingle()

      if (error || !form) {
        return Response.json({ error: 'Form not found' }, { status: 404, headers: cors })
      }

      // Load fields
      const { data: fields } = await supabase
        .from('form_fields')
        .select('id, position, field_type, label, required, validation_rules, error_message, field_key')
        .eq('form_id', form.id)
        .order('position')

      return Response.json({ form, fields: fields || [] }, { headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (err) {
      log.error('GET error', { error: (err as Error).message })
      return Response.json({ error: 'Internal error' }, { status: 500, headers: cors })
    }
  }

  // ── POST: submit form + create lead ───────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { slug, ref_code, data, phone } = body

      if (!slug || !data || !phone) {
        return Response.json({ error: 'Missing slug, data, or phone' }, { status: 400, headers: cors })
      }

      // Find form
      const { data: form } = await supabase
        .from('whatsapp_forms')
        .select('id, name, agent_id, completion_message')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (!form) {
        return Response.json({ error: 'Form not found' }, { status: 404, headers: cors })
      }

      // Normalize phone
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return Response.json({ error: 'Invalid phone number' }, { status: 400, headers: cors })
      }
      const jid = `${cleanPhone}@s.whatsapp.net`

      // Atomic find-or-create contact (upsert avoids race condition on concurrent submissions)
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .upsert(
          { jid, phone: cleanPhone, name: data.nome || data.nome_completo || null },
          { onConflict: 'jid', ignoreDuplicates: false },
        )
        .select('id')
        .single()

      if (contactErr || !contact) {
        log.error('Failed to upsert contact', { error: contactErr?.message })
        return Response.json({ error: 'Failed to create contact' }, { status: 500, headers: cors })
      }

      // Create form_submission
      const { data: submission } = await supabase
        .from('form_submissions')
        .insert({
          form_id: form.id,
          contact_id: contact.id,
          data,
        })
        .select('id')
        .single()

      // Upsert lead_profile from form data
      const leadData: Record<string, unknown> = { contact_id: contact.id }
      const customFields: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(data)) {
        const col = FIELD_MAP[key.toLowerCase()]
        if (col) {
          leadData[col] = value
        } else if (key !== 'telefone' && key !== 'phone' && key !== 'whatsapp') {
          customFields[key] = value
        }
      }

      if (Object.keys(customFields).length > 0) {
        leadData.custom_fields = customFields
      }
      leadData.first_contact_at = new Date().toISOString()

      await supabase.from('lead_profiles').upsert(leadData, { onConflict: 'contact_id' })

      // Match utm_visit if ref_code provided
      let campaignName: string | null = null
      if (ref_code) {
        const { data: visit } = await supabase
          .from('utm_visits')
          .select('id, campaign_id')
          .eq('ref_code', ref_code)
          .eq('status', 'visited')
          .maybeSingle()

        if (visit) {
          await supabase.from('utm_visits').update({
            contact_id: contact.id,
            matched_at: new Date().toISOString(),
            status: 'matched',
          }).eq('id', visit.id)

          const { data: campaign } = await supabase
            .from('utm_campaigns')
            .select('name, kanban_board_id')
            .eq('id', visit.campaign_id)
            .maybeSingle()

          campaignName = campaign?.name || null

          // Auto-create kanban card if board configured
          if (campaign?.kanban_board_id) {
            const { data: cols } = await supabase
              .from('kanban_columns')
              .select('id')
              .eq('board_id', campaign.kanban_board_id)
              .order('position')
              .limit(1)

            if (cols?.[0]) {
              const { data: existing } = await supabase
                .from('kanban_cards')
                .select('id')
                .eq('board_id', campaign.kanban_board_id)
                .eq('contact_id', contact.id)
                .maybeSingle()

              if (!existing) {
                await supabase.from('kanban_cards').insert({
                  board_id: campaign.kanban_board_id,
                  column_id: cols[0].id,
                  contact_id: contact.id,
                  title: (data.nome || data.nome_completo || cleanPhone) as string,
                  tags: ['auto-criado', `campanha:${campaignName}`, `formulario:${slug}`],
                  position: 0,
                })
              }
            }
          }
        }
      }

      log.info('Form submitted', {
        form_id: form.id,
        contact_id: contact.id,
        submission_id: submission?.id,
        campaign: campaignName,
        ref_code,
      })

      return Response.json({
        ok: true,
        submission_id: submission?.id,
        contact_id: contact.id,
        campaign_name: campaignName,
      }, { headers: { ...cors, 'Content-Type': 'application/json' } })

    } catch (err) {
      log.error('POST error', { error: (err as Error).message })
      return Response.json({ error: 'Internal error' }, { status: 500, headers: cors })
    }
  }

  return new Response('Method not allowed', { status: 405, headers: cors })
})
