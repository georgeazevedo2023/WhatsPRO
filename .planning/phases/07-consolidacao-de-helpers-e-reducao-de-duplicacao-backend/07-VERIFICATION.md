---
phase: 07-consolidacao-de-helpers-e-reducao-de-duplicacao-backend
verified: 2026-03-30T18:31:33Z
status: gaps_found
score: 5/6 must-haves verified
gaps:
  - truth: "Supabase client criado em 1 lugar, importado por todas as funcoes"
    status: partial
    reason: "rateLimit.ts em _shared/ ainda importa createClient diretamente de esm.sh em vez de usar createServiceClient() de supabaseClient.ts. Todos os 28 index.ts de edge functions foram migrados corretamente, mas rateLimit.ts ficou fora do escopo dos planos de execucao."
    artifacts:
      - path: "supabase/functions/_shared/rateLimit.ts"
        issue: "Linha 1: import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'; linha 17: const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY) — deveria usar createServiceClient()"
    missing:
      - "Substituir import { createClient } por import { createServiceClient } from './supabaseClient.ts'"
      - "Remover consts SUPABASE_URL e SERVICE_ROLE_KEY (usadas apenas para o client)"
      - "Substituir createClient(SUPABASE_URL, SERVICE_ROLE_KEY) por createServiceClient()"
human_verification:
  - test: "Verificar respostas de erro de ai-agent e whatsapp-webhook em runtime"
    expected: "Todas as respostas JSON incluem headers CORS corretos (Access-Control-Allow-Origin etc)"
    why_human: "Os 22 responses de ai-agent e 20 de whatsapp-webhook usam raw new Response() em vez de errorResponse()/successResponse(), mas visualmente parecem ter corsHeaders. Confirmar em producao que nenhum cliente recebe resposta sem CORS."
---

# Phase 07: Consolidacao de Helpers e Reducao de Duplicacao Backend — Verification Report

**Phase Goal:** Eliminar codigo duplicado e centralizar utilities compartilhadas.
**Verified:** 2026-03-30T18:31:33Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Acceptance Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supabase client criado em 1 lugar, importado por todas as funcoes | PARTIAL | 28/28 index.ts migrados. _shared/rateLimit.ts ainda tem inline createClient |
| 2 | Zero duplicacao de carousel building logic | VERIFIED | Todas as definicoes em _shared/carousel.ts. Zero funcoes duplicadas em index.ts files |
| 3 | Error responses padronizadas com CORS correto | VERIFIED | 24/28 funcoes usam successResponse/errorResponse. 4 excecoes documentadas: ai-agent e whatsapp-webhook usam raw Response mas incluem corsHeaders em 100% dos responses; go nao tem respostas JSON; uazapi-proxy repassa responses do proxy |
| 4 | Carousel auto-send text configuravel (agent.carousel_text) | VERIFIED | 4 ocorrencias de `agent.carousel_text \|\| 'Confira:'` em ai-agent/index.ts |
| 5 | Metricas LLM basicas registradas em logs estruturados | VERIFIED | latency_ms em LLMResponse interface (llmProvider.ts:61), em callOpenAI (linha 121) e callGemini (linha 210), log.info('LLM response', {provider, model, latency_ms, input_tokens, output_tokens}) em ai-agent |
| 6 | Todas as 28 funcoes usam createLogger (zero console.log/error) | VERIFIED | 28/28 funcoes com createLogger confirmado. Zero console.* em qualquer index.ts |

**Score:** 5/6 truths verified (1 partial)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/functions/_shared/supabaseClient.ts` | createServiceClient + createUserClient | VERIFIED | Existe, 39 linhas, exporta ambas as funcoes. Unico arquivo que importa de esm.sh supabase-js |
| `supabase/functions/_shared/carousel.ts` | buildCarousel, generateCarouselCopies, cleanProductTitle, LRU cache | VERIFIED | Existe, exporta cleanProductTitle, generateCarouselCopies, parseCopyResponse, buildCarousel, CAROUSEL_CACHE_TTL_MS, CAROUSEL_CACHE_MAX_SIZE, _carouselCopyCache |
| `supabase/functions/_shared/supabaseClient.test.ts` | Unit tests para client factories | VERIFIED | Existe, 86 linhas |
| `supabase/functions/_shared/carousel.test.ts` | Unit tests para carousel + cache | VERIFIED | Existe, 192 linhas |
| `supabase/functions/_shared/auth.ts` | Usa supabaseClient.ts (sem inline createClient) | VERIFIED | Linha 1: import { createServiceClient, createUserClient } from './supabaseClient.ts'. Zero import de esm.sh |
| `supabase/functions/_shared/llmProvider.ts` | latency_ms em LLMResponse + createLogger | VERIFIED | latency_ms na interface (linha 61), em callOpenAI (linha 121), callGemini (linha 210). createLogger importado e usado |
| `supabase/functions/_shared/rateLimit.ts` | Deveria usar createServiceClient | STUB | Ainda usa inline createClient de esm.sh — nao foi incluido nos planos de migracao 07-02/03/04 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth.ts | supabaseClient.ts | import { createServiceClient, createUserClient } | WIRED | Linha 1 de auth.ts |
| llmProvider.ts | createLogger | import { createLogger } from './logger.ts' | WIRED | Linha 14-16 |
| ai-agent/index.ts | _shared/carousel.ts | import { generateCarouselCopies, cleanProductTitle } | WIRED | Linha 10 de ai-agent |
| ai-agent/index.ts | agent.carousel_text | agent.carousel_text \|\| 'Confira:' em 4 locais | WIRED | Linhas 969, 970, 998, 1000 |
| 28 edge functions | _shared/supabaseClient.ts | import { createServiceClient/createUserClient } | WIRED | 25 funcoes com import confirmado; 3 sem cliente (group-reasons, scrape-product, process-scheduled-messages) — correto, nao usam Supabase SDK |
| 28 edge functions | _shared/logger.ts | createLogger em todos | WIRED | 28/28 confirmado |
| rateLimit.ts | supabaseClient.ts | NAO WIRED | NOT_WIRED | Usa createClient inline direto |

---

### Data-Flow Trace (Level 4)

Fase de refatoracao — sem novos componentes de renderizacao de dados. Nao aplicavel.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| supabaseClient exports createServiceClient e createUserClient | grep -c "export function create" supabaseClient.ts | 2 | PASS |
| carousel.ts exports todas as funcoes necessarias | grep "^export" carousel.ts \| wc -l | 9 exports | PASS |
| Zero inline createClient em index.ts files | grep -rn esm.sh supabase --include=index.ts \| wc -l | 0 | PASS |
| Zero console.log em index.ts files | grep -rn console.log --include=index.ts \| wc -l | 0 | PASS |
| carousel_text configuravel (4 ocorrencias) | grep -c carousel_text ai-agent/index.ts | 4 | PASS |
| latency_ms em LLMResponse | grep -c latency_ms llmProvider.ts | 3 (interface + 2 implementacoes) | PASS |
| 28 funcoes com createLogger | grep -rl createLogger --include=index.ts \| wc -l | 28 | PASS |
| rateLimit.ts usa createServiceClient | grep createServiceClient rateLimit.ts | nenhum match | FAIL |

---

### Requirements Coverage

Nenhum requirement ID declarado nos PLANs (requirements: [] em todos os 4 planos). REQUIREMENTS.md nao mapeia IDs para fase 07. Criterio nao aplicavel.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/functions/_shared/rateLimit.ts` | 1, 17 | `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` + `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` | Warning | Viola o criterio "1 lugar" do ROADMAP. Funciona corretamente mas e excecao nao intencional ao padrao centralizado |
| `supabase/functions/_shared/carousel.ts` | 113, 186, 191, 193, 198 | `console.log` e `console.warn` em vez de createLogger | Info | carousel.ts e _shared utility (nao edge function). O criterio ROADMAP diz "28 funcoes" (index.ts), nao _shared utilities. Baixo impacto |
| `supabase/functions/ai-agent/index.ts` | 56-1779 (22 ocorrencias) | `new Response(JSON.stringify(...))` em vez de successResponse/errorResponse | Info | Todos os 22 responses incluem `{ ...corsHeaders, 'Content-Type': 'application/json' }`. CORS esta correto. Pattern e intencional para webhook high-throughput (42 early-returns) |
| `supabase/functions/whatsapp-webhook/index.ts` | multiplos (20 ocorrencias) | `new Response(JSON.stringify(...))` em vez de successResponse/errorResponse | Info | Idem ai-agent — todos incluem corsHeaders. Pattern intencional para webhook |

---

### Human Verification Required

#### 1. CORS em runtime de ai-agent e whatsapp-webhook

**Test:** Fazer uma chamada real ao endpoint ai-agent ou whatsapp-webhook com um payload invalido e inspecionar os headers da resposta de erro no browser network tab ou via curl -I.

**Expected:** Headers devem incluir `Access-Control-Allow-Origin: *` (ou origem especifica) em todos os responses, incluindo os de erro 400/500.

**Why human:** Os 22 responses de ai-agent e 20 de whatsapp-webhook usam raw `new Response()` em vez dos helpers `errorResponse()`/`successResponse()`. Todos visualmente incluem `{ ...corsHeaders }` no next-line do objeto de opcoes, mas verificacao em runtime confirma que nenhum erro de merge de objeto silencioso ocorreu.

---

### Gaps Summary

**1 gap bloqueando criterio completo:**

**rateLimit.ts nao migrado** — O arquivo `supabase/functions/_shared/rateLimit.ts` ainda importa `createClient` diretamente de `https://esm.sh/@supabase/supabase-js@2` e instancia `const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` no nivel de modulo. O CONTEXT.md da fase define escopo como "supabase/functions/_shared/", mas os planos de execucao (07-02, 07-03, 07-04) cobriam apenas arquivos `index.ts` de edge functions. rateLimit.ts ficou fora do radar. A correcao e trivial: substituir o import e a instanciacao por `createServiceClient()`.

**Impacto:** Nao ha impacto funcional ou de seguranca — rateLimit.ts funciona corretamente. O unico impacto e que o criterio "1 lugar" do ROADMAP nao e 100% satisfeito enquanto houver um segundo arquivo em _shared/ fazendo o mesmo import.

---

_Verified: 2026-03-30T18:31:33Z_
_Verifier: Claude (gsd-verifier)_
