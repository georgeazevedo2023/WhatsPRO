#!/usr/bin/env node
/**
 * Runner E2E do router + specialists (Sprint C — C6).
 *
 * Dispara cenários reais lead→IA: envia mensagens via UAZAPI a partir de uma
 * instância "lead" (Testador) pro número de um agent em routing_mode='router',
 * lê as respostas e os hops de ai_agent_runs no Supabase, valida o roteamento
 * (intent/path esperados) e emite um relatório JSON. Opcionalmente envia uma
 * cópia de cada transcript pro número de um revisor humano (que dá a nota).
 *
 * NÃO roda no CI — exige instâncias WhatsApp conectadas + LLM real. É gated por
 * variáveis de ambiente; sem elas, aborta com instruções.
 *
 *   UAZAPI_SERVER       ex: https://wsmart.uazapi.com
 *   UAZAPI_TOKEN        token da instância LEAD (emissora)
 *   TARGET_NUMBER       número do agent sob teste (ex: 558181696546)
 *   SUPABASE_URL        ex: https://prfcbfumyrrycsrcrvms.supabase.co
 *   SUPABASE_SERVICE_KEY service_role (lê conversation_messages/ai_agent_runs)
 *   CONVERSATION_ID     conversa de teste (lead↔agent)
 *   CONTACT_ID          contato do lead de teste (p/ reset frio do lead_profiles)
 *   COPY_TO_NUMBER      (opcional) envia transcript+metadados pra esse número
 *   SCENARIO            (opcional) id de um único cenário (ex: S3-produto)
 *   QUIET_MS            (opcional) janela de silêncio p/ considerar resposta
 *                       completa após debounce (default 7000)
 *   TURN_TIMEOUT_MS     (opcional) timeout por turno (default 45000)
 *
 * Uso: node scripts/e2e-router-runner.mjs
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const env = (k, def) => process.env[k] ?? def
const required = ['UAZAPI_SERVER', 'UAZAPI_TOKEN', 'TARGET_NUMBER', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'CONVERSATION_ID']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`[e2e] faltam variáveis de ambiente: ${missing.join(', ')}`)
  console.error('[e2e] esse runner usa infra LIVE (WhatsApp + LLM); não roda no CI.')
  process.exit(2)
}

const UAZAPI_SERVER = env('UAZAPI_SERVER').replace(/\/$/, '')
const UAZAPI_TOKEN = env('UAZAPI_TOKEN')
const TARGET_NUMBER = env('TARGET_NUMBER')
const SUPABASE_URL = env('SUPABASE_URL').replace(/\/$/, '')
const SERVICE_KEY = env('SUPABASE_SERVICE_KEY')
const CONVERSATION_ID = env('CONVERSATION_ID')
const CONTACT_ID = env('CONTACT_ID', '')
const COPY_TO_NUMBER = env('COPY_TO_NUMBER', '')
const ONLY_SCENARIO = env('SCENARIO', '')
const QUIET_MS = Number(env('QUIET_MS', '7000'))
const TURN_TIMEOUT_MS = Number(env('TURN_TIMEOUT_MS', '45000'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()

async function sendText(number, text) {
  const res = await fetch(`${UAZAPI_SERVER}/send/text`, {
    method: 'POST',
    headers: { token: UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, text }),
  })
  if (!res.ok) throw new Error(`UAZAPI send/text ${res.status}: ${await res.text()}`)
  return res.json()
}

// Lê linhas de uma tabela via PostgREST com service_role (bypassa RLS).
async function pgGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`PostgREST ${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

async function pgWrite(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`PostgREST ${method} ${path} ${res.status}: ${await res.text()}`)
}

// Reset FRIO entre cenários — lead vira 100% novo, p/ isolar cada intent.
// Aprendizado operacional 2026-05-23 (3 fontes de contaminação, descobertas em ordem):
//   1. status_ia='shadow' após handoff → IA observa e não responde. Religar.
//   2. lead_profiles.conversation_summaries/notes → memória persistente do lead;
//      a IA recorda produtos de turnos antigos ("você perguntou antes sobre...").
//   3. ai_agent_logs (24h) → fonte de hasInteracted; com logs recentes a IA acha
//      que o lead já interagiu e PULA a saudação configurada. Limpar p/ saudação fria.
// Nunca tags=[] (regra de ouro) — sempre marca ia_cleared:TIMESTAMP.
async function resetConversation() {
  await pgWrite('DELETE', `ai_agent_logs?conversation_id=eq.${CONVERSATION_ID}`)
  await pgWrite('PATCH', `conversations?id=eq.${CONVERSATION_ID}`, {
    status_ia: 'ligada',
    assigned_to: null,
    ai_summary: null,
    ai_summary_expires_at: null,
    tags: [`ia_cleared:${nowIso()}`],
  })
  if (CONTACT_ID) {
    await pgWrite('PATCH', `lead_profiles?contact_id=eq.${CONTACT_ID}`, {
      interests: [], objections: [], tags: {},
      conversation_summaries: [], sentiment_history: [],
      current_score: 50, notes: null, total_interactions: 0, full_name: null,
    })
  }
}

async function fetchMessagesSince(sinceIso) {
  const q = `conversation_messages?conversation_id=eq.${CONVERSATION_ID}` +
    `&created_at=gt.${encodeURIComponent(sinceIso)}` +
    `&order=created_at.asc&select=direction,content,media_type,transcription,created_at`
  return pgGet(q)
}

async function fetchRunsSince(sinceIso) {
  const q = `ai_agent_runs?conversation_id=eq.${CONVERSATION_ID}` +
    `&created_at=gt.${encodeURIComponent(sinceIso)}` +
    `&order=created_at.asc&select=hop_n,specialist,intent,confidence,model,input_tokens,output_tokens,latency_ms,tools_called,prompt_chars,created_at`
  return pgGet(q)
}

// Espera as respostas outgoing estabilizarem (debounce + LLM + múltiplas msgs).
async function waitForReply(sinceIso) {
  const start = Date.now()
  let lastCount = -1
  let stableSince = 0
  while (Date.now() - start < TURN_TIMEOUT_MS) {
    const msgs = await fetchMessagesSince(sinceIso)
    const outgoing = msgs.filter((m) => m.direction === 'outgoing')
    if (outgoing.length !== lastCount) {
      lastCount = outgoing.length
      stableSince = Date.now()
    } else if (outgoing.length > 0 && Date.now() - stableSince >= QUIET_MS) {
      return msgs
    }
    await sleep(2500)
  }
  return fetchMessagesSince(sinceIso)
}

function fmtTranscript(scenario, msgs) {
  const lines = [`*${scenario.id}* — intent esperado: ${scenario.intent} (${scenario.expected_path})`, '']
  for (const m of msgs) {
    const who = m.direction === 'incoming' ? '🧑 Lead' : '🤖 IA'
    const body = m.content || (m.media_type ? `[${m.media_type}]` : '(vazio)')
    lines.push(`${who}: ${body}`)
  }
  return lines.join('\n')
}

async function runScenario(scenario) {
  console.error(`\n[e2e] ▶ ${scenario.id}`)
  await resetConversation()
  await sleep(1500)
  const baseline = nowIso()

  for (const turn of scenario.turns) {
    const before = nowIso()
    await sendText(TARGET_NUMBER, turn)
    await sleep(3000)
    await waitForReply(before)
  }

  const msgs = await fetchMessagesSince(baseline)
  const runs = await fetchRunsSince(baseline)
  const routerRun = runs.find((r) => r.specialist === 'router')
  const specialistRun = runs.find((r) => r.specialist && r.specialist !== 'router')
  const observedIntent = routerRun?.intent ?? null
  const observedPath = specialistRun ? 'specialist' : 'monolith'

  const routingOk = observedIntent === scenario.intent && observedPath === scenario.expected_path
  const result = {
    id: scenario.id,
    expected_intent: scenario.intent,
    observed_intent: observedIntent,
    confidence: routerRun?.confidence ?? null,
    expected_path: scenario.expected_path,
    observed_path: observedPath,
    routing_ok: routingOk,
    models: runs.map((r) => `${r.specialist}:${r.model}`),
    latency_ms: runs.map((r) => r.latency_ms),
    tools: specialistRun?.tools_called ?? null,
    tokens: runs.reduce((a, r) => a + (r.input_tokens || 0) + (r.output_tokens || 0), 0),
    expect: scenario.expect,
    transcript: msgs.map((m) => ({ dir: m.direction, content: m.content, media: m.media_type })),
  }

  const pretty = fmtTranscript(scenario, msgs)
  console.error(pretty)
  console.error(`[e2e] routing_ok=${routingOk} intent=${observedIntent} path=${observedPath}`)

  if (COPY_TO_NUMBER) {
    const head = `📋 *Teste E2E ${scenario.id}*\nRoteamento: ${routingOk ? '✅' : '⚠️'} ` +
      `(esperado ${scenario.intent}/${scenario.expected_path} · obtido ${observedIntent}/${observedPath})\n` +
      `Modelos: ${result.models.join(', ')}\n\n`
    await sendText(COPY_TO_NUMBER, head + pretty)
  }
  return result
}

async function main() {
  const raw = JSON.parse(await readFile(join(__dirname, 'e2e-scenarios.json'), 'utf8'))
  let scenarios = raw.scenarios
  if (ONLY_SCENARIO) scenarios = scenarios.filter((s) => s.id === ONLY_SCENARIO)
  if (!scenarios.length) { console.error('[e2e] nenhum cenário'); process.exit(1) }

  const results = []
  for (const s of scenarios) {
    try {
      results.push(await runScenario(s))
    } catch (err) {
      console.error(`[e2e] ✖ ${s.id}: ${err.message}`)
      results.push({ id: s.id, error: err.message })
    }
  }

  const ok = results.filter((r) => r.routing_ok).length
  console.error(`\n[e2e] roteamento OK: ${ok}/${results.length}`)
  console.log(JSON.stringify({ ran_at: nowIso(), conversation_id: CONVERSATION_ID, results }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
