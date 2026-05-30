#!/usr/bin/env node
/**
 * Runner E2E dinâmico por INVOCAÇÃO DIRETA do ai-agent (v7.58).
 *
 * Diferente do e2e-router-runner (WhatsApp real via UAZAPI), este invoca o
 * ai-agent diretamente (verify_jwt=false + anon key), inserindo a mensagem
 * incoming no DB e lendo as respostas outgoing — rápido o suficiente pra iterar
 * a LÓGICA de conversa (qualificação profunda, handoff, resumo) sem round-trip
 * de WhatsApp. O envio UAZAPI pra JID de teste falha (non-fatal: sendTextMsg
 * nunca lança e os inserts são independentes), então as respostas ficam legíveis
 * no conversation_messages.
 *
 * Cada cenário roda numa conversa FRESCA (contato novo + cold profile) pra isolar.
 *
 * Env: SUPABASE_URL SERVICE_KEY ANON_KEY AGENT_ID INSTANCE_ID INBOX_ID SCENARIO_FILE
 * Uso: node scripts/e2e-deep-qualify.mjs [scenarioId]
 */
import { readFile } from 'node:fs/promises'

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SERVICE_KEY
const ANON_KEY = process.env.ANON_KEY
const AGENT_ID = process.env.AGENT_ID
const INSTANCE_ID = process.env.INSTANCE_ID
const INBOX_ID = process.env.INBOX_ID
const SCENARIO_FILE = process.env.SCENARIO_FILE || 'scripts/e2e-deep-scenarios.json'
const ONLY = process.argv[2] || ''

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, ANON_KEY, AGENT_ID, INSTANCE_ID, INBOX_ID })) {
  if (!v) { console.error(`[e2e] falta env ${k}`); process.exit(2) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()

async function fetchWithRetry(url, options, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options)
    } catch (err) {
      lastErr = err
      await sleep(800 * (i + 1))
    }
  }
  throw lastErr
}

async function pg(method, path, body, prefer) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`PostgREST ${method} ${path} ${res.status}: ${await res.text()}`)
  const txt = await res.text()
  return txt ? JSON.parse(txt) : null
}

async function freshConversation(idx) {
  const suffix = String(Date.now()).slice(-7) + idx
  const jid = `5511${suffix}@s.whatsapp.net`
  const phone = `5511${suffix}`
  const [contact] = await pg('POST', 'contacts', {
    jid, phone, name: null,
  }, 'return=representation')
  const [conv] = await pg('POST', 'conversations', {
    inbox_id: INBOX_ID, contact_id: contact.id,
    status_ia: 'ligada', tags: [`ia_cleared:${nowIso()}`], lead_msg_count: 0,
  }, 'return=representation')
  return { contactId: contact.id, convId: conv.id, jid }
}

async function readNew(convId, sinceIso) {
  const q = `conversation_messages?conversation_id=eq.${convId}` +
    `&created_at=gt.${encodeURIComponent(sinceIso)}` +
    `&order=created_at.asc&select=direction,content,media_type,created_at`
  return pg('GET', q)
}

async function invoke(convId) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/functions/v1/ai-agent`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: convId, instance_id: INSTANCE_ID, agent_id: AGENT_ID,
      request_id: 'e2e-' + Math.random().toString(36).slice(2, 8),
      messages: [],
    }),
  })
  return { status: res.status, body: await res.text() }
}

async function sendTurn(convId, text) {
  const ts = nowIso()
  await pg('POST', 'conversation_messages', {
    conversation_id: convId, direction: 'incoming', content: text,
    media_type: 'text', created_at: ts,
  }, 'return=minimal')
  const before = ts
  const inv = await invoke(convId)
  // Poll até as outgoing estabilizarem (quiet 2.5s, máx 25s)
  let last = -1, stableAt = Date.now(), out = []
  const start = Date.now()
  while (Date.now() - start < 25000) {
    const msgs = await readNew(convId, before)
    out = msgs.filter((m) => m.direction === 'outgoing' || m.direction === 'private_note')
    if (out.length !== last) { last = out.length; stableAt = Date.now() }
    else if (out.length > 0 && Date.now() - stableAt >= 2500) break
    await sleep(1500)
  }
  return { invStatus: inv.status, invBody: inv.body, out }
}

async function finalState(convId) {
  const [conv] = await pg('GET', `conversations?id=eq.${convId}&select=tags,cart_items,status_ia,assigned_to`)
  const notes = await pg('GET', `conversation_messages?conversation_id=eq.${convId}&direction=eq.private_note&order=created_at.asc&select=content`)
  return { tags: conv?.tags || [], cart: conv?.cart_items || [], status_ia: conv?.status_ia, assigned_to: conv?.assigned_to, notes: (notes || []).map((n) => n.content) }
}

async function runScenario(s, idx) {
  console.log(`\n${'='.repeat(70)}\n▶ ${s.id}\n${'='.repeat(70)}`)
  const { convId, jid } = await freshConversation(idx)
  console.log(`conv=${convId} jid=${jid}`)
  const transcript = []
  for (const [i, turn] of s.turns.entries()) {
    process.stdout.write(`\n[turn ${i + 1}/${s.turns.length}] 🧑 ${turn}\n`)
    const { invStatus, out } = await sendTurn(convId, turn)
    transcript.push({ lead: turn })
    for (const m of out) {
      const tag = m.direction === 'private_note' ? '📋 NOTA' : '🤖 IA'
      const body = (m.content || `[${m.media_type}]`).replace(/\n/g, '\n        ')
      console.log(`        ${tag}: ${body}`)
      transcript.push({ [m.direction]: m.content, media: m.media_type })
    }
    if (invStatus !== 200) console.log(`        ⚠ invoke status=${invStatus}`)
    await sleep(1200)
  }
  const fs = await finalState(convId)
  console.log(`\n— ESTADO FINAL —`)
  console.log(`status_ia: ${fs.status_ia}  assigned_to: ${fs.assigned_to || 'null'}`)
  console.log(`tags: ${JSON.stringify(fs.tags)}`)
  console.log(`cart: ${JSON.stringify(fs.cart)}`)
  for (const n of fs.notes) console.log(`nota_interna:\n${n}`)
  return { id: s.id, convId, transcript, final: fs }
}

async function main() {
  const raw = JSON.parse(await readFile(SCENARIO_FILE, 'utf8'))
  let scenarios = raw.scenarios
  if (ONLY) scenarios = scenarios.filter((s) => s.id === ONLY || s.id.includes(ONLY))
  const results = []
  for (const [i, s] of scenarios.entries()) {
    try { results.push(await runScenario(s, i)) }
    catch (e) { console.error(`✖ ${s.id}: ${e.message}`); results.push({ id: s.id, error: e.message }) }
  }
  console.log(`\n${'#'.repeat(70)}\nRESUMO JSON\n${'#'.repeat(70)}`)
  console.log(JSON.stringify({ ran_at: nowIso(), results }, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
