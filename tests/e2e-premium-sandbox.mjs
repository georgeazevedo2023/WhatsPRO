#!/usr/bin/env node
/**
 * E2E real sandbox -> Eletropiso v2 for premium product qualification flows.
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  service role for DB polling/cleanup
 *   UAZAPI_TOKEN               sandbox instance token
 *
 * Optional:
 *   SUPABASE_URL, UAZAPI_URL, TARGET_PHONE, SANDBOX_PHONE, TARGET_INBOX
 *
 * Usage:
 *   node tests/e2e-premium-sandbox.mjs
 *   node tests/e2e-premium-sandbox.mjs --only 21.36 --verbose
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://prfcbfumyrrycsrcrvms.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const UAZAPI_URL = process.env.UAZAPI_URL || 'https://wsmart.uazapi.com'
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN
const SANDBOX_PHONE = process.env.SANDBOX_PHONE || '558185749970'
const TARGET_PHONE = process.env.TARGET_PHONE || '558781592373'
const TARGET_INBOX = process.env.TARGET_INBOX || '01a9c21d-98c8-4225-805a-18e79e7df719'

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(2)
}

if (!UAZAPI_TOKEN) {
  console.error('Missing UAZAPI_TOKEN env var')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const VERBOSE = process.argv.includes('--verbose')
const ONLY_IDX = process.argv.indexOf('--only')
const ONLY = ONLY_IDX > -1 ? String(process.argv[ONLY_IDX + 1]) : ''
const OUTGOING_WAIT_SECS = Number(process.env.OUTGOING_WAIT_SECS || 120)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (...args) => VERBOSE && console.log(...args)

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options)
    } catch (err) {
      lastError = err
      await sleep(900 * (i + 1))
    }
  }
  throw lastError
}

const FORBIDDEN_LEAD_PATTERNS = [
  /\bn[aã]o temos\b/i,
  /\bn[aã]o encontrei\b/i,
  /\bn[aã]o localizei\b/i,
  /\bsem resultado\b/i,
  /\bcat[aá]logo\b/i,
  /\btemos sim\b/i,
  /\btrabalhamos com\b/i,
  /\banotei\b/i,
  /\banotado\b/i,
]

const SCENARIOS = [
  {
    id: '21.36-porcelanato-ausente',
    name: 'Produto nao encontrado: porcelanato marmorizado',
    turns: [
      'Boa tarde, vocês têm porcelanato marmorizado?',
      'Pra piso',
      'Minha casa',
      '120x120',
      'Brilhante',
      'Bege claro',
      'Sala e cozinha integradas',
      'Uns 90 metros',
    ],
    requiredTags: [
      /^catalog_result:empty$/,
      /^physical_stock_required:true$/,
      /^followups_paused:true$/,
      /^formato:120x120$/,
      /^acabamento:brilhante$/,
      /^cor:bege/,
      /^local_aplicacao:sala[ _]e[ _]cozinha[ _]integradas$/,
      /^area:90m2$/,
    ],
    requiredNote: [
      /Resultado catalogo:\s*Nenhum produto localizado no catalogo digital/i,
      /Local de aplicacao:\s*sala e cozinha integradas/i,
      /Area:\s*90m2/i,
    ],
  },
  {
    id: '21.37-torneira-gourmet-ausente',
    name: 'Produto nao encontrado: torneira gourmet',
    turns: [
      'Boa tarde, voces tem torneira gourmet?',
      'Cozinha',
      'Na bancada',
      'Isso, com ducha flexivel',
      'Preto fosco',
      'Cuba dupla',
      'Mais sofisticada',
    ],
    requiredTags: [
      /^catalog_result:empty$/,
      /^physical_stock_required:true$/,
      /^followups_paused:true$/,
      /^ambiente_torneira:cozinha$/,
      /^tipo_torneira:bancada$/,
      /^modelo_torneira:ducha[ _]flex[ií]vel$/,
      /^acabamento_torneira:preto[ _]fosco$/,
      /^tipo_cuba:dupla$/,
      /^perfil:premium$/,
    ],
    requiredNote: [
      /Resultado catalogo:\s*Nenhum produto localizado no catalogo digital/i,
      /Acabamento:\s*preto fosco/i,
      /Tipo de cuba:\s*dupla/i,
      /Perfil:\s*premium/i,
    ],
  },
  {
    id: '21.33-tinta-completa',
    name: 'Produto encontrado: tinta + carrossel + venda cruzada + entrega',
    turns: [
      'Boa tarde, voces tem tinta?',
      'E pra uma reforma',
      'Ambiente interno',
      'So as paredes mesmo',
      'Pode me explicar a diferenca',
      'Entao quero acrilica',
      'Branca',
      'Prefiro a de melhor cobertura',
      'Gostei da primeira, a Coral premium',
      'Vou precisar de rolo e bandeja tambem',
      'Receber em casa',
      'Boa Viagem',
      'Por enquanto e so isso',
    ],
    requiredTags: [
      /^followups_paused:true$/,
      /^interesse:tintas$/,
      /^objetivo:reforma$/,
      /^ambiente:interno$/,
      /^aplicacao:parede$/,
      /^tipo_tinta:acr[ií]lica$/,
      /^cor:branco$/,
      /^perfil:premium$/,
      /^entrega_modo:(delivery|entrega)$/,
      /^bairro:Boa Viagem$/,
    ],
    requiredNote: [
      /Categoria:\s*tintas/i,
      /Tipo de tinta:\s*acr/i,
      /Cor:\s*branco/i,
      /Perfil:\s*premium/i,
      /Bairro:\s*Boa Viagem/i,
      /Pedido \(/i,
      /rolo/i,
      /bandeja/i,
    ],
    requiredCart: [/coral|tinta/i, /rolo/i, /bandeja/i],
    requiredMediaTypes: ['carousel'],
  },
]

async function sendText(text) {
  const res = await fetchWithRetry(`${UAZAPI_URL}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: UAZAPI_TOKEN },
    body: JSON.stringify({ number: TARGET_PHONE, text }),
  })
  if (!res.ok) throw new Error(`UAZAPI send failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function findConversation() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, contact_id, tags, status_ia, assigned_to, last_message_at, contact:contacts(phone, name)')
    .eq('inbox_id', TARGET_INBOX)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(30)

  if (error) throw error
  return (data || []).find((conversation) => conversation.contact?.phone === SANDBOX_PHONE) || null
}

async function waitForConversation(maxSecs = 35) {
  const start = Date.now()
  while ((Date.now() - start) / 1000 < maxSecs) {
    const conversation = await findConversation()
    if (conversation?.id) return conversation
    await sleep(1500)
  }
  throw new Error(`conversation for ${SANDBOX_PHONE} not found in inbox ${TARGET_INBOX}`)
}

async function clearContext(conversationId) {
  const { data: conversation, error: findError } = await supabase
    .from('conversations')
    .select('contact_id')
    .eq('id', conversationId)
    .single()

  if (findError) throw findError

  const { error: msgError } = await supabase
    .from('conversation_messages')
    .delete()
    .eq('conversation_id', conversationId)

  if (msgError) throw msgError

  if (conversation?.contact_id) {
    const { error: contactError } = await supabase
      .from('contacts')
      .update({ name: null })
      .eq('id', conversation.contact_id)

    if (contactError) throw contactError

    const { error: leadError } = await supabase
      .from('lead_profiles')
      .update({ full_name: null })
      .eq('contact_id', conversation.contact_id)

    if (leadError) throw leadError
  }

  const { error: convError } = await supabase
    .from('conversations')
    .update({
      tags: [`ia_cleared:${new Date().toISOString()}`],
      status: 'aberta',
      status_ia: 'ligada',
      assigned_to: null,
      department_id: null,
      lead_msg_count: 0,
      cart_items: [],
      shown_product_ids: [],
      ai_summary: null,
      last_message: null,
    })
    .eq('id', conversationId)

  if (convError) throw convError
  log(`cleared conversation ${conversationId}`)
}

async function readMessages(conversationId, sinceIso) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('created_at, direction, content, media_type')
    .eq('conversation_id', conversationId)
    .gte('created_at', sinceIso)
    .in('direction', ['outgoing', 'private_note'])
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

async function waitForNewOutgoing(conversationId, sinceIso, previousCount, maxSecs = OUTGOING_WAIT_SECS) {
  const start = Date.now()
  while ((Date.now() - start) / 1000 < maxSecs) {
    const messages = await readMessages(conversationId, sinceIso)
    const outgoing = messages.filter((message) => message.direction === 'outgoing')
    if (outgoing.length > previousCount) {
      await sleep(2500)
      return readMessages(conversationId, sinceIso)
    }
    await sleep(1500)
  }
  throw new Error(`timeout waiting outgoing ${previousCount + 1}`)
}

async function finalState(conversationId) {
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('tags, status_ia, assigned_to, cart_items')
    .eq('id', conversationId)
    .single()

  if (convError) throw convError

  const { data: notes, error: noteError } = await supabase
    .from('conversation_messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('direction', 'private_note')
    .order('created_at', { ascending: true })

  if (noteError) throw noteError

  return {
    ...conversation,
    lead_score: readLeadScore(conversation?.tags || []),
    notes: (notes || []).map((note) => note.content || ''),
  }
}

function readLeadScore(tags) {
  let score = 0
  for (const tag of tags || []) {
    const match = /^lead_score:(-?\d+)$/.exec(String(tag))
    if (match) score = Number(match[1])
  }
  return score
}

function assertNoForbiddenLeadText(messages) {
  const leadFacing = messages.filter((message) => message.direction === 'outgoing')
  for (const message of leadFacing) {
    const text = message.content || ''
    const forbidden = FORBIDDEN_LEAD_PATTERNS.find((pattern) => pattern.test(text))
    if (forbidden) throw new Error(`forbidden lead text matched ${forbidden}: ${text}`)
  }
}

function assertTags(tags, requiredTags) {
  const missing = requiredTags.filter((pattern) => !tags.some((tag) => pattern.test(tag)))
  if (missing.length) {
    throw new Error(`missing tags: ${missing.map((pattern) => pattern.source).join(', ')}`)
  }
}

function assertNote(notes, requiredNote) {
  const text = notes.join('\n\n')
  const missing = requiredNote.filter((pattern) => !pattern.test(text))
  if (missing.length) {
    throw new Error(`private note missing: ${missing.map((pattern) => pattern.source).join(', ')}`)
  }
}

function assertCart(cartItems, requiredCart = []) {
  if (!requiredCart.length) return
  const text = JSON.stringify(cartItems || [])
  const missing = requiredCart.filter((pattern) => !pattern.test(text))
  if (missing.length) {
    throw new Error(`cart missing: ${missing.map((pattern) => pattern.source).join(', ')}`)
  }
}

function assertMediaTypes(messages, requiredMediaTypes = []) {
  if (!requiredMediaTypes.length) return
  const missing = requiredMediaTypes.filter((mediaType) =>
    !messages.some((message) => message.media_type === mediaType),
  )
  if (missing.length) throw new Error(`media types missing: ${missing.join(', ')}`)
}

async function runScenario(scenario) {
  console.log(`\n${'='.repeat(72)}\n${scenario.id} - ${scenario.name}\n${'='.repeat(72)}`)

  let conversation = await findConversation()
  if (!conversation?.id) {
    await sendText(`[e2e-flow ${scenario.id} ${Date.now()}]`)
    conversation = await waitForConversation()
  }
  await clearContext(conversation.id)
  const sinceIso = new Date().toISOString()

  let observed = []
  for (const [idx, turn] of scenario.turns.entries()) {
    console.log(`lead ${idx + 1}/${scenario.turns.length}: ${turn}`)
    await sendText(turn)
    observed = await waitForNewOutgoing(
      conversation.id,
      sinceIso,
      observed.filter((message) => message.direction === 'outgoing').length,
    )

    const latest = observed[observed.length - 1]
    if (latest?.direction === 'outgoing') {
      console.log(`  ia: ${(latest.content || `[${latest.media_type}]`).replace(/\s+/g, ' ').slice(0, 180)}`)
    } else {
      console.log(`  ${latest?.direction || 'msg'}: ${(latest?.content || '').replace(/\s+/g, ' ').slice(0, 180)}`)
    }
  }

  assertNoForbiddenLeadText(observed)
  const state = await finalState(conversation.id)

  if (state.status_ia !== 'shadow') throw new Error(`expected status_ia shadow, got ${state.status_ia}`)
  if (!state.assigned_to) throw new Error('expected assigned_to after handoff')
  assertTags(state.tags || [], scenario.requiredTags)
  assertNote(state.notes || [], scenario.requiredNote)
  assertCart(state.cart_items || [], scenario.requiredCart || [])
  assertMediaTypes(observed, scenario.requiredMediaTypes || [])

  console.log(`PASS conv=${conversation.id} status=${state.status_ia} assigned=${state.assigned_to} score=${state.lead_score}`)
  return { id: scenario.id, conversationId: conversation.id, status: state.status_ia, assignedTo: state.assigned_to, score: state.lead_score }
}

async function main() {
  const selected = ONLY ? SCENARIOS.filter((scenario) => scenario.id.includes(ONLY)) : SCENARIOS
  if (!selected.length) throw new Error(`no scenario matched ${ONLY}`)

  const results = []
  for (const scenario of selected) {
    results.push(await runScenario(scenario))
    await sleep(3000)
  }

  console.log(`\n${'#'.repeat(72)}\nSUMMARY\n${'#'.repeat(72)}`)
  console.log(JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2))
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`)
  process.exit(1)
})
