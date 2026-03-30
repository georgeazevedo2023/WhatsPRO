# Phase 7: Consolidacao de Helpers e Reducao de Duplicacao (Backend) — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminar codigo duplicado nas 26 Edge Functions do Supabase e centralizar utilities compartilhadas em `_shared/`. Zero mudancas de comportamento — apenas reorganizacao estrutural e padronizacao de imports/responses/logging.

Escopo: `supabase/functions/_shared/`, todas as 26 edge functions em `supabase/functions/`.
Nenhum arquivo frontend e tocado nesta fase.

</domain>

<decisions>
## Implementation Decisions

### Supabase Client Centralizado

- **D-01:** Criar `_shared/supabaseClient.ts` com 2 funcoes separadas:
  - `createServiceClient()` — retorna client com SERVICE_ROLE_KEY (bypassa RLS). Usado em ai-agent, webhooks, cron jobs, process-jobs.
  - `createUserClient(req: Request)` — extrai JWT do header Authorization, cria client autenticado (respeita RLS). Usado em admin-create-user, admin-update-user, admin-delete-user, activate-ia, etc.
  - Ambas leem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` de `Deno.env.get()`.
  - Eliminar todos os `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` individuais — substituir por import de `_shared/supabaseClient.ts`.

### Adocao de response.ts e logger.ts

- **D-02:** Migrar **todas as 26 funcoes** para usar `_shared/response.ts` (`successResponse`, `errorResponse`) e `_shared/logger.ts` (`createLogger`).
  - Substituir os 158 `new Response(JSON.stringify(...))` por `successResponse()` ou `errorResponse()`.
  - Substituir os 243 `console.log/console.error` por `log.info()` / `log.error()` com campos estruturados.
  - `unauthorizedResponse()` de `_shared/auth.ts` permanece — ja e um helper padronizado. Apenas `database-backup` e outras funcoes que usam `new Response` raw para 401 devem migrar para `unauthorizedResponse()`.
  - Esta e a ultima fase do milestone — oportunidade de padronizar tudo de uma vez.

### Carousel Helper

- **D-03:** Extrair logica de carousel de `ai-agent/index.ts` para `_shared/carousel.ts`:
  - `buildCarousel(products, copies)` — constroi o objeto carousel a partir de produtos + copies
  - `generateCarouselCopies(products, agent, options)` — gera AI sales copy via Groq->Gemini->Mistral chain
  - Cache LRU in-memory (mover `_carouselCopyCache` + constantes `CAROUSEL_CACHE_*`)
  - `ai-agent/index.ts` importa e usa — zero mudanca de comportamento
- **D-04:** Texto `'Confira:'` hardcoded em 4 locais vira campo configuravel do agente:
  - Campo: `agent.carousel_text` (string, default `'Confira:'`)
  - Os 4 locais que usam `'Confira:'` passam a ler `agent.carousel_text || 'Confira:'`
  - **NAO precisa de migration SQL** — campo JSON do agente aceita campos opcionais

### Metricas Estruturadas

- **D-05:** Metricas LLM apenas no `ai-agent` e `_shared/llmProvider.ts`:
  - Campos padrao: `latency_ms`, `token_count`, `provider` (groq/gemini/mistral/openai), `model`
  - Usar o `createLogger` existente — sem nova infraestrutura
  - Exemplo: `log.info('LLM response', { provider: 'groq', model: 'llama-3.3-70b', latency_ms: 450, token_count: 120 })`
  - Metricas de request-level (latencia total por funcao) ficam FORA do escopo — so metricas LLM

### Claude's Discretion

- Ordem de execucao dos planos: Claude decide baseado em dependencias (supabaseClient primeiro, depois response/logger migration, carousel por ultimo)
- Se alguma funcao tem padrao muito diferente das demais (ex: whatsapp-webhook com streaming), Claude pode adaptar a migracao sem consultar
- Se `generateCarouselCopies` for muito acoplada ao ai-agent (usa variaveis de escopo do handler), Claude pode manter parcialmente no ai-agent e extrair so o que faz sentido
- Nomes exatos de query keys e cache constants: Claude define

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Shared utilities existentes (fonte de verdade para patterns)
- `supabase/functions/_shared/response.ts` — successResponse(), errorResponse() (existem mas NAO SAO USADOS)
- `supabase/functions/_shared/logger.ts` — createLogger() (existe mas NAO E USADO)
- `supabase/functions/_shared/auth.ts` — verifyAuth(), verifySuperAdmin(), verifyCronOrService(), unauthorizedResponse()
- `supabase/functions/_shared/cors.ts` — corsHeaders shared
- `supabase/functions/_shared/circuitBreaker.ts` — geminiBreaker, groqBreaker, mistralBreaker
- `supabase/functions/_shared/llmProvider.ts` — LLM provider chain (onde metricas serao adicionadas)
- `supabase/functions/_shared/fetchWithTimeout.ts` — fetch com 30s timeout
- `supabase/functions/_shared/rateLimit.ts` — atomic RPC check_rate_limit()
- `supabase/functions/_shared/constants.ts` — STATUS_IA constants

### Destinos novos (a criar)
- `supabase/functions/_shared/supabaseClient.ts` — createServiceClient() + createUserClient(req)
- `supabase/functions/_shared/carousel.ts` — buildCarousel(), generateCarouselCopies(), cache LRU

### Funcao principal de referencia para carousel
- `supabase/functions/ai-agent/index.ts` — carousel logic (~150 LOC), 4x 'Confira:' hardcoded, _carouselCopyCache

### Funcoes que criam supabase client (todas precisam migrar)
- Todas as 26 funcoes em `supabase/functions/*/index.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Padrao atual de client (repetido 20+ vezes)
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
```

### Padrao alvo (createServiceClient)
```ts
import { createServiceClient } from '../_shared/supabaseClient.ts'
const supabase = createServiceClient()
```

### Padrao alvo (createUserClient)
```ts
import { createUserClient } from '../_shared/supabaseClient.ts'
const supabase = createUserClient(req)
```

### response.ts ja existe mas ninguem usa
```ts
// 158 ocorrencias de: new Response(JSON.stringify({...}), { status, headers })
// Alvo: return successResponse(corsHeaders, { data }) ou errorResponse(corsHeaders, 'msg', 400)
```

### logger.ts ja existe mas ninguem usa
```ts
// 243 ocorrencias de: console.log(...) / console.error(...)
// Alvo: const log = createLogger('function-name', reqId); log.info('msg', { data })
```
</code_context>
