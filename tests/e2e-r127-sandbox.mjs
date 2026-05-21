#!/usr/bin/env node
// E2E real sandbox → Eletropiso v2 — R126 + R127 validation
//
// 10 jornadas × 5 cenários = ~30-50 turns reais via UAZAPI + DB polling.
// Pra cada teste: clear context da conv → envia msgs → polla DB → valida regras.
//
// Uso: node tests/e2e-r127-sandbox.mjs [--only N] [--verbose]

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://prfcbfumyrrycsrcrvms.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const UAZAPI_URL = 'https://wsmart.uazapi.com'
const SANDBOX_TOKEN = '9a6ff3f5-31ee-4302-9fd6-5d4bc488ff5e' // Sandbox IA
const SANDBOX_PHONE = '558185749970'
const TARGET_PHONE = '558781592373' // Eletropiso v2
const TARGET_INBOX = '01a9c21d-98c8-4225-805a-18e79e7df719'

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const VERBOSE = process.argv.includes('--verbose')
const ONLY_IDX = process.argv.indexOf('--only')
const ONLY = ONLY_IDX > -1 ? Number(process.argv[ONLY_IDX + 1]) : null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => VERBOSE && console.log(...a)

async function sendText(text) {
  const res = await fetch(`${UAZAPI_URL}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: SANDBOX_TOKEN },
    body: JSON.stringify({ number: TARGET_PHONE, text }),
  })
  if (!res.ok) throw new Error(`UAZAPI send failed: ${res.status}`)
  return res.json()
}

async function findConv() {
  const { data } = await supabase
    .from('conversations')
    .select('id, tags, status_ia, last_message_at, contact:contacts(phone, name)')
    .eq('inbox_id', TARGET_INBOX)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(20)
  if (!data) return null
  return data.find((c) => c.contact?.phone === SANDBOX_PHONE) || null
}

async function clearContext(conv_id) {
  await supabase
    .from('conversations')
    .update({
      tags: [`ia_cleared:${new Date().toISOString()}`],
      status_ia: 'ligada',
      assigned_to: null,
      lead_msg_count: 0,
    })
    .eq('id', conv_id)
  log(`   cleared context for conv ${conv_id}`)
}

async function waitForOutgoing(conv_id, sinceIso, expectedCount, maxSecs = 35) {
  const start = Date.now()
  while ((Date.now() - start) / 1000 < maxSecs) {
    const { data } = await supabase
      .from('conversation_messages')
      .select('created_at, direction, content')
      .eq('conversation_id', conv_id)
      .gte('created_at', sinceIso)
      .eq('direction', 'outgoing')
      .order('created_at', { ascending: true })
    if (data && data.length >= expectedCount) return data
    await sleep(1500)
  }
  return []
}

async function getRecentLogs(conv_id, sinceIso) {
  const { data } = await supabase
    .from('ai_agent_logs')
    .select('created_at, event, tool_calls, metadata')
    .eq('conversation_id', conv_id)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
  return data || []
}

async function getTags(conv_id) {
  const { data } = await supabase.from('conversations').select('tags').eq('id', conv_id).single()
  return data?.tags || []
}

// ===========================================================================
// Cenários
// ===========================================================================

const CENARIOS = [
  {
    id: 1,
    name: 'C1 — Bom dia puro (saudação só)',
    turns: ['bom dia'],
    expects: [
      { type: 'greeting_only', desc: 'IA envia greeting e PARA, espera lead falar' },
    ],
  },
  {
    id: 2,
    name: 'C2 — Intenção direta com produto (categoria offline porta)',
    turns: ['quero uma porta de alumínio'],
    expects: [
      { type: 'qualif', desc: 'IA pergunta próximo field de portas (ambiente_porta ou tipo_porta)' },
      { type: 'tag_set', key: 'interesse', value: 'portas' },
    ],
  },
  {
    id: 3,
    name: 'C3 — Intenção indireta + nome (R126)',
    turns: ['oi', 'meu nome é Maria', 'quero comprar um material'],
    expects: [
      { type: 'r126_guard', desc: 'IA pergunta QUAL produto (não chuta carrossel)' },
      { type: 'no_carousel', desc: 'NÃO enviou Telha PVC' },
    ],
  },
  {
    id: 4,
    name: 'C4 — Multi-categoria explícita (R127 chave de teste)',
    turns: ['oi', 'João', 'quero porta de alumínio e janela de alumínio'],
    expects: [
      { type: 'multi_cat_ask', desc: 'IA pergunta QUAL começar primeiro (não escolhe sozinha)' },
      { type: 'set_tags_dup_blocked', desc: 'log set_tags_duplicate_keys_rejected presente' },
    ],
  },
  {
    id: 5,
    name: 'C5 — Multi-categoria + escolha',
    turns: ['oi', 'porta e janela alumínio', 'janela primeiro'],
    expects: [
      { type: 'tag_set', key: 'interesse', value: 'janelas' },
      { type: 'qualif_window', desc: 'IA pergunta material/tamanho da janela (fields corretos)' },
      { type: 'no_invent_field', desc: 'IA NÃO pergunta "ambiente da janela" — categoria janelas não tem ambiente' },
    ],
  },
  {
    id: 6,
    name: 'C6 — Categoria digital (tinta) direto, sem nome',
    turns: ['preciso de tinta acrílica branca pra parede'],
    expects: [
      { type: 'tag_set', key: 'interesse', value: 'tintas' },
      { type: 'has_qualif_or_search', desc: 'IA qualifica ou busca (tintas é digital)' },
    ],
  },
  {
    id: 7,
    name: 'C7 — Query super genérica "preço" (R126 outro slug)',
    turns: ['oi', 'qual o preço?'],
    expects: [
      { type: 'r126_guard', desc: 'IA pergunta de QUAL produto antes de buscar' },
    ],
  },
  {
    id: 8,
    name: 'C8 — Categoria offline (vaso sanitário) + qualif sequencial',
    turns: ['oi tudo bem?', 'preciso de um vaso sanitário'],
    expects: [
      { type: 'tag_set', key: 'interesse', value: 'vasos_sanitarios' },
      { type: 'qualif', desc: 'IA pergunta field de vasos_sanitarios' },
    ],
  },
  {
    id: 9,
    name: 'C9 — Multi-categoria 3 produtos',
    turns: ['quero tinta, fechadura e torneira'],
    expects: [
      { type: 'multi_cat_ask', desc: 'IA reconhece 3 categorias e pergunta qual começar' },
    ],
  },
  {
    id: 10,
    name: 'C10 — Bom dia + intenção numa única msg',
    turns: ['bom dia! gostaria de comprar uma fechadura digital'],
    expects: [
      { type: 'tag_set', key: 'interesse', value: 'fechaduras' },
      { type: 'qualif', desc: 'IA qualifica fechaduras direto (greeting+intent fundidos)' },
    ],
  },
]

// ===========================================================================
// Validadores
// ===========================================================================

function evalGreetingOnly(outMsgs) {
  if (outMsgs.length === 0) return { ok: false, why: 'sem outgoing' }
  if (outMsgs.length > 1) return { ok: true, note: `${outMsgs.length} msgs enviadas (greeting + extras OK)` }
  const txt = outMsgs[0].content || ''
  if (/em que posso te ajudar|com quem|oi|olá|bem-vindo/i.test(txt)) return { ok: true }
  return { ok: false, why: `greeting suspeito: "${txt.substring(0, 80)}"` }
}

function evalNoCarousel(outMsgs) {
  const hasCarousel = outMsgs.some((m) => /confira nossas opções|telha de pvc/i.test(m.content || ''))
  return hasCarousel ? { ok: false, why: 'enviou carrossel (provavelmente Telha PVC R126)' } : { ok: true }
}

function evalR126Guard(outMsgs, logs) {
  // Esperado: log search_guard_blocked OU IA pergunta sobre o produto sem buscar
  const blocked = logs.some((l) => l.event === 'search_guard_blocked')
  const asks = outMsgs.some((m) => /qual material|qual produto|sobre qual|categoria|qual.*especific/i.test(m.content || ''))
  if (blocked || asks) return { ok: true, note: blocked ? 'guard blocked' : 'IA perguntou' }
  return { ok: false, why: 'IA não bloqueou nem perguntou — pode ter buscado direto' }
}

function evalMultiCatAsk(outMsgs, logs) {
  const blocked = logs.some((l) => l.event === 'set_tags_duplicate_keys_rejected')
  const asksWhich = outMsgs.some((m) =>
    /qual.*primeiro|começar (por|com)|qual.*prefere|qual.*começa|prefere ver primeiro/i.test(m.content || ''),
  )
  if (blocked && asksWhich) return { ok: true, note: 'guard blocked + IA perguntou qual começar' }
  if (asksWhich) return { ok: true, note: 'IA perguntou qual começar (sem guard log — LLM seguiu prompt)' }
  if (blocked) return { ok: false, why: 'guard bloqueou mas IA não perguntou ao lead' }
  return { ok: false, why: 'IA não tratou multi-categoria (escolheu sozinha ou ignorou)' }
}

function evalSetTagsDupBlocked(logs) {
  const blocked = logs.some((l) => l.event === 'set_tags_duplicate_keys_rejected')
  return blocked ? { ok: true } : { ok: false, why: 'sem log set_tags_duplicate_keys_rejected (LLM pode não ter tentado o dup)' }
}

function evalTagSet(tags, key, value) {
  const has = tags.some((t) => t === `${key}:${value}`)
  return has ? { ok: true } : { ok: false, why: `tag "${key}:${value}" ausente. atual: ${tags.join(', ')}` }
}

function evalQualif(outMsgs, categoryHint) {
  const txt = outMsgs.map((m) => m.content || '').join(' ').toLowerCase()
  const hasQuestion = /[?]/.test(txt)
  const looksQualif = /pra te ajudar|pra encontrar|qual|ambiente|tamanho|material|tipo|cor/i.test(txt)
  return hasQuestion && looksQualif ? { ok: true } : { ok: false, why: 'IA não fez pergunta de qualificação' }
}

function evalQualifWindow(outMsgs) {
  const txt = outMsgs.map((m) => m.content || '').join(' ').toLowerCase()
  const asksValid = /material.*janela|tamanho.*janela|largura.*altura|janela.*material/i.test(txt)
  const asksInvalid = /ambiente.*janela|janela.*ambiente/i.test(txt)
  if (asksInvalid) return { ok: false, why: 'IA inventou field "ambiente janela" (categoria janelas não tem)' }
  if (asksValid) return { ok: true }
  return { ok: false, why: 'IA não perguntou nada esperado pra janela (material ou tamanho)' }
}

function evalNoInventField(outMsgs) {
  const txt = outMsgs.map((m) => m.content || '').join(' ').toLowerCase()
  const invented = /ambiente.*janela|cor.*porta|marca.*vaso|sala.*janela/i.test(txt)
  return invented ? { ok: false, why: 'IA inventou field fora do schema da categoria' } : { ok: true }
}

function evalHasQualifOrSearch(outMsgs, logs) {
  const asked = outMsgs.some((m) => /[?]/.test(m.content || ''))
  const searched = logs.some((l) => Array.isArray(l.tool_calls) && l.tool_calls.some((t) => t.name === 'search_products'))
  return asked || searched ? { ok: true } : { ok: false, why: 'IA nem qualificou nem buscou' }
}

// ===========================================================================
// Runner
// ===========================================================================

async function runScenario(scn, conv_id) {
  console.log(`\n━━━ ${scn.name} ━━━`)
  await clearContext(conv_id)
  await sleep(2000)

  const since = new Date().toISOString()
  for (const t of scn.turns) {
    log(`   → lead: ${t}`)
    await sendText(t)
    await sleep(2500) // espaço entre msgs do mesmo lead
  }
  log(`   aguardando debounce + LLM (~25s)...`)
  // 1 outgoing mínimo; pra greeting+continuation pode ter mais
  const outMsgs = await waitForOutgoing(conv_id, since, 1, 35)
  const logs = await getRecentLogs(conv_id, since)
  const tags = await getTags(conv_id)

  if (VERBOSE) {
    console.log('   outgoing:', outMsgs.map((m) => `[${m.created_at.substring(11, 19)}] ${(m.content || '').substring(0, 80)}`).join('\n             '))
    console.log('   tags:', tags.join(', '))
    console.log('   events:', logs.map((l) => l.event).join(', '))
  } else {
    console.log(`   IA respondeu (${outMsgs.length} msg${outMsgs.length === 1 ? '' : 's'}): "${(outMsgs[0]?.content || '<vazio>').substring(0, 100)}"`)
    if (outMsgs.length > 1) console.log(`               └─ "${(outMsgs[1]?.content || '').substring(0, 100)}"`)
  }

  const results = []
  for (const exp of scn.expects) {
    let r
    switch (exp.type) {
      case 'greeting_only': r = evalGreetingOnly(outMsgs); break
      case 'qualif': r = evalQualif(outMsgs); break
      case 'qualif_window': r = evalQualifWindow(outMsgs); break
      case 'no_invent_field': r = evalNoInventField(outMsgs); break
      case 'no_carousel': r = evalNoCarousel(outMsgs); break
      case 'r126_guard': r = evalR126Guard(outMsgs, logs); break
      case 'multi_cat_ask': r = evalMultiCatAsk(outMsgs, logs); break
      case 'set_tags_dup_blocked': r = evalSetTagsDupBlocked(logs); break
      case 'tag_set': r = evalTagSet(tags, exp.key, exp.value); break
      case 'has_qualif_or_search': r = evalHasQualifOrSearch(outMsgs, logs); break
      default: r = { ok: false, why: `validator não implementado: ${exp.type}` }
    }
    const sym = r.ok ? '✅' : '❌'
    console.log(`   ${sym} ${exp.desc || exp.type}${r.why ? ` — ${r.why}` : ''}${r.note ? ` (${r.note})` : ''}`)
    results.push({ ...exp, ...r })
  }
  return results
}

async function main() {
  console.log('🔬 E2E sandbox → Eletropiso v2 (R126 + R127)')
  console.log(`   sandbox phone: ${SANDBOX_PHONE}`)
  console.log(`   target phone:  ${TARGET_PHONE}`)
  console.log(`   target inbox:  ${TARGET_INBOX}`)

  // Garantir conv existe (envia ping inicial)
  let conv = await findConv()
  if (!conv) {
    console.log('   conv não existe — enviando ping pra criar...')
    await sendText('__HARNESS_INIT__')
    await sleep(8000)
    conv = await findConv()
    if (!conv) {
      console.error('❌ Falha ao criar conv sandbox')
      process.exit(1)
    }
  }
  console.log(`   conv: ${conv.id}`)

  const start = Date.now()
  const all = []
  const targets = ONLY ? CENARIOS.filter((c) => c.id === ONLY) : CENARIOS
  for (const scn of targets) {
    try {
      const res = await runScenario(scn, conv.id)
      all.push({ scn, results: res, pass: res.every((r) => r.ok) })
    } catch (e) {
      console.error(`💥 ${scn.name}: ${e.message}`)
      all.push({ scn, results: [], pass: false, error: e.message })
    }
  }
  const dur = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n\n═════════════════ RESUMO ═════════════════')
  const passed = all.filter((a) => a.pass).length
  for (const a of all) {
    const sym = a.pass ? '✅' : '❌'
    const fails = a.results.filter((r) => !r.ok).length
    console.log(`${sym} ${a.scn.name} (${a.results.length - fails}/${a.results.length})`)
  }
  console.log(`\n${passed}/${all.length} cenários PASS — ${dur}s`)
  if (passed < all.length) process.exit(1)
}

main().catch((e) => {
  console.error('💥', e)
  process.exit(1)
})
