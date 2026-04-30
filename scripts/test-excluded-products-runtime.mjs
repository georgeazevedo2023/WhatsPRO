/**
 * Runtime E2E test — Excluded Products feature.
 *
 * Fetches excluded_products from prod DB and runs matchExcludedProduct
 * against synthetic lead messages, reporting matches and computed responses.
 *
 * This validates the FULL chain: DB schema ↔ helper logic ↔ fallback message,
 * which is what runs when a real lead messages on WhatsApp.
 *
 * Usage: node scripts/test-excluded-products-runtime.mjs
 */

const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'euljumeflwtljegknawy'

if (!SUPABASE_TOKEN) {
  console.error('[FATAL] SUPABASE_ACCESS_TOKEN env var required')
  console.error('Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/test-excluded-products-runtime.mjs')
  process.exit(2)
}

// Replicate matchExcludedProduct + buildFallbackMessage from
// supabase/functions/_shared/excludedProducts.ts (kept in sync via tests)
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildFallbackMessage(matchedKeyword) {
  return `Não trabalhamos com ${matchedKeyword}, posso te ajudar com outro produto?`
}

function matchExcludedProduct(incomingText, excludedProducts) {
  if (!excludedProducts || excludedProducts.length === 0) return null
  if (!incomingText || incomingText.trim().length === 0) return null
  const normalizedText = normalize(incomingText)

  for (const item of excludedProducts) {
    if (!item.keywords || item.keywords.length === 0) continue
    for (const kw of item.keywords) {
      const normalizedKw = normalize(kw)
      if (!normalizedKw) continue
      const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      if (re.test(normalizedText)) {
        const trimmed = (item.message || '').trim()
        return {
          product: item,
          matchedKeyword: kw,
          message: trimmed !== '' ? trimmed : buildFallbackMessage(kw),
        }
      }
    }
  }
  return null
}

// 1. Fetch real config from prod DB
const sqlReq = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query:
        "SELECT excluded_products FROM ai_agents WHERE name = 'Eletropiso' LIMIT 1",
    }),
  },
)
const sqlRes = await sqlReq.json()
const excluded = sqlRes[0]?.excluded_products
console.log(`[1] Loaded ${excluded.length} excluded products from prod DB:`)
for (const p of excluded) {
  console.log(`    - ${p.id}: ${p.keywords.length} keywords`)
}
console.log()

// 2. Test cases — scenarios real leads might send
const testCases = [
  // SHOULD MATCH
  { text: 'Tem caixa de correio?', expect: 'caixa_correio' },
  { text: 'CORREIO?', expect: 'caixa_correio' },
  { text: 'vocês têm correio?', expect: 'caixa_correio' },
  { text: 'precisava de uma mailbox', expect: 'caixa_correio' },
  { text: 'Boa tarde, vendem geladeira?', expect: 'eletrodomesticos' },
  { text: 'tem GELADEIRA inox?', expect: 'eletrodomesticos' },
  { text: 'gelareira', expect: 'eletrodomesticos' }, // typo handling
  { text: 'preciso de um refrigerador', expect: 'eletrodomesticos' },
  { text: 'vendem freezer horizontal?', expect: 'eletrodomesticos' },
  { text: 'tem microondas?', expect: 'eletrodomesticos' },
  { text: 'micro-ondas inox', expect: 'eletrodomesticos' },
  { text: 'micro ondas 30 litros', expect: 'eletrodomesticos' },
  { text: 'AirFryer Mondial', expect: 'eletrodomesticos' },
  { text: 'air fryer 4l', expect: 'eletrodomesticos' },
  { text: 'fritadeira elétrica', expect: 'eletrodomesticos' },

  // SHOULD NOT MATCH
  { text: 'quero comprar tinta branca', expect: null },
  { text: 'tem furadeira?', expect: null },
  { text: 'cabo elétrico de 6mm', expect: null },
  { text: 'preciso de um disjuntor', expect: null },
  { text: 'vou aos correios pegar uma encomenda', expect: null }, // word boundary
]

console.log(`[2] Running ${testCases.length} test cases…\n`)

let pass = 0
let fail = 0
const failures = []

for (const tc of testCases) {
  const result = matchExcludedProduct(tc.text, excluded)
  const actualId = result?.product.id ?? null
  const ok = actualId === tc.expect

  if (ok) {
    pass++
    if (result) {
      console.log(`✅ "${tc.text}"`)
      console.log(`   → matched "${result.matchedKeyword}" → ${actualId}`)
      console.log(`   → response: "${result.message}"`)
    } else {
      console.log(`✅ "${tc.text}" → no match (expected)`)
    }
  } else {
    fail++
    failures.push({ tc, actualId })
    console.log(`❌ "${tc.text}"`)
    console.log(`   expected: ${tc.expect}`)
    console.log(`   got:      ${actualId}`)
    if (result) {
      console.log(`   matched on: "${result.matchedKeyword}"`)
    }
  }
}

console.log(`\n[result] ${pass}/${testCases.length} passed`)
if (fail > 0) {
  console.log(`\nFailures:`)
  for (const f of failures) {
    console.log(`  - "${f.tc.text}" expected ${f.tc.expect} got ${f.actualId}`)
  }
  process.exit(1)
}
process.exit(0)
