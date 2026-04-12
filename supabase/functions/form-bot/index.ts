import { webhookCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { createLogger } from '../_shared/logger.ts'
import { upsertLeadFromFormData } from '../_shared/leadHelper.ts'
import { executeAutomationRules } from '../_shared/automationEngine.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'

const supabase = createServiceClient()
const log = createLogger('form-bot')

// ── Validation helpers ────────────────────────────────────────────────────────

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let check = (sum * 10) % 11
  if (check === 10 || check === 11) check = 0
  if (check !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  check = (sum * 10) % 11
  if (check === 10 || check === 11) check = 0
  return check === parseInt(digits[10])
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateDate(date: string): boolean {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date.trim())
}

function validateTime(time: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(time.trim())
}

function validateAnswer(fieldType: string, value: string, rules: Record<string, unknown> | null): boolean {
  const v = value.trim()
  if (!v) return false
  switch (fieldType) {
    case 'email': return validateEmail(v)
    case 'cpf': return validateCpf(v)
    case 'cep': return /^\d{8}$/.test(v.replace(/\D/g, ''))
    case 'phone': return v.replace(/\D/g, '').length >= 10
    case 'date': return validateDate(v)
    case 'time': return validateTime(v)
    case 'number': {
      const n = parseFloat(v)
      if (isNaN(n)) return false
      if (rules?.min !== undefined && n < (rules.min as number)) return false
      if (rules?.max !== undefined && n > (rules.max as number)) return false
      return true
    }
    case 'scale': {
      const n = parseInt(v)
      if (isNaN(n)) return false
      const min = (rules?.scale_min as number) ?? 0
      const max = (rules?.scale_max as number) ?? 10
      return n >= min && n <= max
    }
    case 'select': {
      const options = (rules?.options as string[]) ?? []
      const idx = parseInt(v)
      if (!isNaN(idx) && idx >= 1 && idx <= options.length) return true
      return options.some(o => o.toLowerCase() === v.toLowerCase())
    }
    case 'multi_select': {
      const options = (rules?.options as string[]) ?? []
      const parts = v.split(/[,\s]+/).map(p => p.trim()).filter(Boolean)
      return parts.every(p => {
        const idx = parseInt(p)
        if (!isNaN(idx) && idx >= 1 && idx <= options.length) return true
        return options.some(o => o.toLowerCase() === p.toLowerCase())
      })
    }
    case 'yes_no': return /^(sim|não|nao|s|n)$/i.test(v)
    // M17 F4: Poll field — validate that response matches one of the options
    case 'poll': {
      const options = (rules?.options as string[]) ?? []
      return options.some(o => o.toLowerCase() === v.toLowerCase())
    }
    case 'signature': {
      const expected = (rules?.expected_value as string) ?? 'ACEITO'
      return v === expected
    }
    default: return v.length > 0
  }
}

function normalizeAnswer(fieldType: string, value: string, rules: Record<string, unknown> | null): unknown {
  const v = value.trim()
  switch (fieldType) {
    case 'number': return parseFloat(v)
    case 'scale': return parseInt(v)
    case 'yes_no': return /^(sim|s)$/i.test(v)
    case 'select': {
      const options = (rules?.options as string[]) ?? []
      const idx = parseInt(v)
      if (!isNaN(idx) && idx >= 1 && idx <= options.length) return options[idx - 1]
      return v
    }
    case 'multi_select': {
      const options = (rules?.options as string[]) ?? []
      return v.split(/[,\s]+/).map(p => {
        const idx = parseInt(p.trim())
        if (!isNaN(idx) && idx >= 1 && idx <= options.length) return options[idx - 1]
        return p.trim()
      })
    }
    // M17 F4: Poll field — return exact option text (case-insensitive match)
    case 'poll': {
      const options = (rules?.options as string[]) ?? []
      return options.find(o => o.toLowerCase() === v.toLowerCase()) || v
    }
    default: return v
  }
}

// ── Send message helper ───────────────────────────────────────────────────────

async function sendWhatsAppMessage(instanceId: string, chatId: string, text: string) {
  // Get instance token from DB
  const { data: instance } = await supabase
    .from('instances')
    .select('token, base_url')
    .eq('id', instanceId)
    .maybeSingle()

  if (!instance?.token) {
    log.error('Instance token not found', { instanceId })
    return
  }

  const baseUrl = instance.base_url ?? 'https://api.uazapi.com'
  const url = `${baseUrl}/message/text`

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance.token,
      },
      body: JSON.stringify({ chatId, text }),
    })
  } catch (err) {
    log.error('Failed to send WhatsApp message', { error: (err as Error).message })
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversation_id, message_text, instance_id } = await req.json() as {
      conversation_id: string
      message_text: string
      instance_id: string
    }

    if (!conversation_id || !instance_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const msgText = (message_text ?? '').trim()

    // Get conversation to know the chatId (contact JID)
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, contact_id, contacts(phone)')
      .eq('id', conversation_id)
      .maybeSingle()

    if (!conversation) {
      log.error('Conversation not found', { conversation_id })
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contactPhone = (conversation as { contacts: { phone: string } | null }).contacts?.phone
    if (!contactPhone) {
      log.error('Contact phone not found', { conversation_id })
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const chatId = contactPhone.includes('@') ? contactPhone : `${contactPhone}@s.whatsapp.net`

    // ── INITIATION: message starts with FORM: ─────────────────────────────────
    if (msgText.toUpperCase().startsWith('FORM:')) {
      const slug = msgText.slice(5).trim().toLowerCase()

      // Find form by slug and instance (via ai_agents)
      const { data: form } = await supabase
        .from('whatsapp_forms')
        .select('*, form_fields(*), ai_agents!inner(instance_id)')
        .eq('slug', slug)
        .eq('status', 'active')
        .eq('ai_agents.instance_id', instance_id)
        .order('position', { referencedTable: 'form_fields', ascending: true })
        .maybeSingle()

      if (!form) {
        log.warn('Form not found for slug', { slug, instance_id })
        return new Response(JSON.stringify({ ok: false, reason: 'form_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check max_submissions
      if (form.max_submissions) {
        const { count } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('form_id', form.id)
        if ((count ?? 0) >= form.max_submissions) {
          await sendWhatsAppMessage(instance_id, chatId, 'Este formulário atingiu o limite de respostas. Obrigado pelo interesse!')
          return new Response(JSON.stringify({ ok: false, reason: 'max_submissions_reached' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Check expiration
      if (form.expires_at && new Date(form.expires_at) < new Date()) {
        await sendWhatsAppMessage(instance_id, chatId, 'Este formulário já expirou. Obrigado pelo interesse!')
        return new Response(JSON.stringify({ ok: false, reason: 'form_expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Create session
      const { data: session, error: sessionErr } = await supabase
        .from('form_sessions')
        .insert({
          form_id: form.id,
          conversation_id,
          contact_id: conversation.contact_id ?? null,
          current_field_index: 0,
          collected_data: {},
          status: 'in_progress',
          retries: 0,
        })
        .select()
        .maybeSingle()

      if (sessionErr) throw sessionErr

      // Send welcome message + first question
      await sendWhatsAppMessage(instance_id, chatId, form.welcome_message)

      const fields = (form as { form_fields: Array<{ field_type: string; label: string; required: boolean; position: number }> }).form_fields ?? []
      const firstField = fields.sort((a, b) => a.position - b.position)[0]
      if (firstField) {
        // M17 F4: Poll field — send native poll for first question too
        if (firstField.field_type === 'poll' && (firstField as any).validation_rules?.options?.length >= 2) {
          try {
            const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
            const { data: inst } = await supabase.from('instances').select('token').eq('id', instance_id).maybeSingle()
            if (inst?.token) {
              await fetchWithTimeout(`${uazapiUrl}/send/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': inst.token },
                body: JSON.stringify({
                  number: chatId,
                  type: 'poll',
                  text: firstField.label,
                  choices: (firstField as any).validation_rules.options,
                  selectableCount: (firstField as any).validation_rules?.multi ? 0 : 1,
                }),
              })
            }
          } catch {
            await sendWhatsAppMessage(instance_id, chatId, firstField.label)
          }
        } else {
          await sendWhatsAppMessage(instance_id, chatId, firstField.label)
        }
      }

      log.info('Form session created', { formId: form.id, sessionId: session.id })
      return new Response(JSON.stringify({ ok: true, session_id: session.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── CONTINUATION: find active session ────────────────────────────────────
    const { data: session } = await supabase
      .from('form_sessions')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (!session) {
      return new Response(JSON.stringify({ ok: false, reason: 'no_active_session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── TTL check: abandon sessions older than 24h ────────────────────────────
    const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
    const sessionAge = Date.now() - new Date(session.created_at).getTime()
    if (sessionAge > SESSION_TTL_MS) {
      await supabase
        .from('form_sessions')
        .update({ status: 'abandoned' })
        .eq('id', session.id)
      log.info('Session expired by TTL', { sessionId: session.id, ageMs: sessionAge })
      await sendWhatsAppMessage(
        instance_id,
        chatId,
        'Sua sessão de formulário expirou. Por favor, inicie novamente.',
      )
      return new Response(JSON.stringify({ ok: false, reason: 'session_expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get form + fields
    const { data: form } = await supabase
      .from('whatsapp_forms')
      .select('*, form_fields(*)')
      .eq('id', session.form_id)
      .order('position', { referencedTable: 'form_fields', ascending: true })
      .maybeSingle()

    if (!form) throw new Error('Form not found for active session')

    const fields = ((form as { form_fields: unknown[] }).form_fields as Array<{
      position: number; field_type: string; label: string; required: boolean;
      validation_rules: Record<string, unknown> | null; error_message: string | null;
      field_key: string
    }>).sort((a, b) => a.position - b.position)

    const currentField = fields[session.current_field_index]

    // Handle optional field skip
    if (!currentField.required && /^(pular|skip|–|-)$/i.test(msgText)) {
      // Skip optional field
    } else {
      // Validate answer
      const isValid = validateAnswer(currentField.field_type, msgText, currentField.validation_rules)
      if (!isValid) {
        const maxRetries = 3
        const newRetries = (session.retries ?? 0) + 1

        if (newRetries >= maxRetries) {
          // Abandon session after too many retries
          await supabase.from('form_sessions').update({ status: 'abandoned' }).eq('id', session.id)
          await sendWhatsAppMessage(instance_id, chatId, 'Formulário encerrado por excesso de erros. Você pode tentar novamente quando quiser.')
          return new Response(JSON.stringify({ ok: false, reason: 'max_retries' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        await supabase.from('form_sessions').update({ retries: newRetries, last_activity_at: new Date().toISOString() }).eq('id', session.id)
        const errorMsg = currentField.error_message ?? 'Resposta inválida. Por favor, tente novamente.'
        await sendWhatsAppMessage(instance_id, chatId, errorMsg)
        return new Response(JSON.stringify({ ok: false, reason: 'validation_error' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Save valid answer
      const normalizedValue = normalizeAnswer(currentField.field_type, msgText, currentField.validation_rules)
      const newData = { ...(session.collected_data as Record<string, unknown>), [currentField.field_key]: normalizedValue }
      const nextIndex = session.current_field_index + 1

      if (nextIndex >= fields.length) {
        // All fields answered — complete the form
        await supabase.from('form_sessions').update({
          collected_data: newData,
          current_field_index: nextIndex,
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }).eq('id', session.id)

        // Save submission
        const { data: submission } = await supabase.from('form_submissions').insert({
          form_id: session.form_id,
          session_id: session.id,
          contact_id: session.contact_id,
          data: newData,
        }).select().maybeSingle()

        // Send completion message
        await sendWhatsAppMessage(instance_id, chatId, (form as { completion_message: string }).completion_message)

        // Call webhook if configured
        const webhookUrl = (form as { webhook_url: string | null }).webhook_url
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ form_id: session.form_id, submission_id: (submission as { id: string } | null)?.id, data: newData }),
          }).catch(() => {})
        }

        // ── Auto-tag conversation with formulario:SLUG ──────────────
        try {
          const formSlug = (form as { slug: string }).slug
          const { data: convData } = await supabase
            .from('conversations')
            .select('tags')
            .eq('id', conversation_id)
            .maybeSingle()
          const existing: string[] = convData?.tags || []
          const tagMap = new Map<string, string>()
          for (const t of existing) tagMap.set(t.split(':')[0], t)
          tagMap.set('formulario', `formulario:${formSlug}`)
          tagMap.set('origem', 'origem:formulario')
          await supabase.from('conversations')
            .update({ tags: Array.from(tagMap.values()) })
            .eq('id', conversation_id)
        } catch (err) {
          log.error('Auto-tag error (non-critical)', { error: (err as Error).message })
        }

        // ── Auto-upsert lead_profile from form data (shared helper) ──
        if (session.contact_id) {
          try {
            await upsertLeadFromFormData(supabase, session.contact_id, newData, 'formulario')
            log.info('Lead profile upserted from form', { contact_id: session.contact_id })
          } catch (err) {
            log.error('Lead upsert error (non-critical)', { error: (err as Error).message })
          }
        }

        // ── Trigger automation engine (form_completed) ──────────────
        try {
          const formSlugForEngine = (form as { slug: string }).slug
          const { data: linkedFunnel } = await supabase
            .from('funnels')
            .select('id')
            .eq('form_id', session.form_id)
            .maybeSingle()

          if (linkedFunnel?.id) {
            await executeAutomationRules(
              linkedFunnel.id,
              'form_completed',
              { form_slug: formSlugForEngine },
              conversation_id ?? null,
              supabase,
            ).catch(() => {}) // fire-and-forget, don't block
          }
        } catch (err) {
          log.error('Automation engine error (non-critical)', { error: (err as Error).message })
        }

        log.info('Form completed', { formId: session.form_id, sessionId: session.id })
        return new Response(JSON.stringify({ ok: true, completed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Advance to next field
      await supabase.from('form_sessions').update({
        collected_data: newData,
        current_field_index: nextIndex,
        retries: 0,
        last_activity_at: new Date().toISOString(),
      }).eq('id', session.id)

      // Send next question
      const nextField = fields[nextIndex]
      // M17 F4: Poll field — send native WhatsApp poll instead of text
      if (nextField.field_type === 'poll' && nextField.validation_rules?.options) {
        const pollOptions = (nextField.validation_rules.options as string[]) || []
        if (pollOptions.length >= 2) {
          try {
            const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL') || 'https://wsmart.uazapi.com'
            const { data: inst } = await supabase.from('instances').select('token').eq('id', instance_id).maybeSingle()
            if (inst?.token) {
              await fetchWithTimeout(`${uazapiUrl}/send/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': inst.token },
                body: JSON.stringify({
                  number: chatId,
                  type: 'poll',
                  text: nextField.label,
                  choices: pollOptions, // D7: NEVER numbered — clean names only
                  selectableCount: nextField.validation_rules?.multi ? 0 : 1,
                }),
              })
            }
          } catch (err) {
            // Fallback: send as text question if poll fails
            const questionText = nextField.label + '\n' + pollOptions.join('\n')
            await sendWhatsAppMessage(instance_id, chatId, questionText)
          }
        } else {
          await sendWhatsAppMessage(instance_id, chatId, nextField.label)
        }
      } else {
        const questionText = nextField.label + (nextField.required ? '' : '\n_(opcional — você pode pular digitando "pular")_')
        await sendWhatsAppMessage(instance_id, chatId, questionText)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    log.error('Form-bot error', { error: (error as Error).message })
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
