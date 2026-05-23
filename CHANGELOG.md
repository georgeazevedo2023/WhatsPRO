---
title: Changelog
type: changelog
updated: 2026-05-21
audited_at: 2026-05-21
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.42.0 (2026-05-23) — Sprint C parcial 1/3: Foundations + Router LLM (NOVO MARCO)

Início do Sprint C — router LLM + product_specialist POC. Esta entrega cobre C1+C2+C3 (foundations + router em isolamento). Prod intocada (default `routing_mode='monolith'`).

- **Migration C1:** tabela `ai_agent_runs` aplicada em prod (trace por hop do router → specialist). 11 colunas: conversation_id, agent_id, turn_id, hop_n, specialist (CHECK 9 valores), intent, confidence, model, tokens, latency_ms, tools_called, prompt_chars, metadata. 2 índices (conv+created DESC, agent+specialist+created DESC). RLS enabled (service_role only — dashboard Sprint C7 vai via RPC SECURITY DEFINER).
- **Migration C3:** coluna `ai_agents.routing_mode TEXT NOT NULL DEFAULT 'monolith' CHECK IN ('monolith','router')`. Index parcial WHERE routing_mode <> 'monolith' (dashboard "quantos agents em router?"). `'routing_mode'` adicionado em ALLOWED_FIELDS do AIAgentTab.tsx.
- **Router LLM:** `_shared/agent/router.ts` (~280 lin) exporta `classifyIntent(ctx)` + `logRouterRun(supabase, ...)` + constante `ROUTER_SYSTEM_PROMPT` (~800 chars XML-style). Modelo padrão `gpt-5-nano` (alvo <500ms, ~$0.0001/turno). Output JSON estrito com 7 intents (saudacao/qualificacao/produto/handoff/objecao/pagamento/fora_escopo).
- **Defesa em profundidade:** parser tolera JSON puro / markdown fence ```json``` / texto extra envolvente. Fallback determinístico pra `qualificacao` em 4 cenários: parse JSON falhou / intent inválido / confidence < 0.6 (override mesmo com intent válido) / LLM exception. Sempre retorna `RouterResult` válido — pipeline nunca quebra.
- **Testes:** `router.test.ts` **21 testes 100% PASS**: 7 intents × happy, defesa (5 fallbacks), construção prompt (system+user+tags+history), routerModel override, history truncado em 5, `logRouterRun` INSERT correto + non-fatal em DB failure.
- **types.ts regenerado** via MCP (project prfcbfumyrrycsrcrvms) — `ai_agent_runs` + `routing_mode` agora tipados.
- **Pipeline:** tsc 0 erros · vitest **1236 pass / 9 fails pré-existentes idênticos** (+21 novos) · deploy CLI ai-agent v101→**v102 ACTIVE**

**Próximos passos do Sprint C (próximas sessões):**
- **C4** — product_specialist (~60 lin, ~3 KB prompt) reusa tools/searchProducts.ts
- **C5** — hop guard anti-loop (max 2 hops)
- **C6** — E2E sandbox 10 cenários comparativos monolith vs router
- **C7** — dashboard admin "Roteamento" (intents/latência/custo/accuracy)

**Andamento plano orquestrador:** 60% → **63%** (Sprint C foundations + 1/4 do router work).

### v7.41.16 (2026-05-22 noite IV) — Sprint B5 Onda 5: extrai `dispatchResponse` (FIM DO SPLIT B5)

Última extração do Sprint B5: steps 15.5-22 + final log/Response 200 do `ai-agent/index.ts` pra `_shared/agent/dispatchResponse.ts`.

- **Arquivo novo:** `_shared/agent/dispatchResponse.ts` (348 lin) — handoff detection (HANDOFF_PATTERNS copiado pra escopo do módulo), TTS decision tree, save msg + update conv + broadcast, response_sent log, lead_profile upsert, deferred handoff trigger, Response 200 build.
- **Testes novos:** `dispatchResponse.test.ts` (**15 testes, 100% PASS**): happy text/audio paths, TTS fallback, audio split, incomingHasAudio flag, hadExplicitHandoffInLoop skip, broadcast SHADOW, implicit handoff detection (+ negative lookbehind test "não vou te encaminhar"), deferred trigger paths (objection detection + skip quando já houve explícito), summary com products/sentiment/outcome/tools, slice -10 nas conversation_summaries.
- **index.ts: 2494 → 2306 lin (-188 nesta onda).** Acumulado Sprint B5: **-2238 lin desde 4544 (-49.3%)**. Imports limpos: removidos `splitAudioAndText` (só usado no bloco extraído) + `HANDOFF_PATTERNS` const local.
- **Sprint B5 FECHADO** com 11 ondas: 0+1, 2a, 2b, 2c-i, 2c-ii, 3a, 3b, 3c, 3d, 4, 5. `ai-agent/index.ts` virou orquestrador de ~2300 lin (de 4544).
- **Pipeline:** tsc 0 erros · vitest **1215 pass / 9 fails pré-existentes idênticos** (+15 novos) · deploy CLI ai-agent v100→**v101 ACTIVE**

**Andamento plano orquestrador:** 56% → **60%** (Sprint B5 100% completo). Próximo marco: **Sprint C — Router LLM + product_specialist POC** (~2-3 semanas).

### v7.41.15 (2026-05-22 noite III) — Sprint B5 Onda 4: extrai `llmCallLoop`

Extração do loop principal de function calling do monolito `ai-agent/index.ts` pra `_shared/agent/llmCallLoop.ts`. Inclui setup (geminiContents→llmMessages), while loop (LLM call → tool execution seq/parallel → handoff guard → MAX_TOOL_ROUNDS safety → retry backoff → 502 em 3 falhas → pending Qs injection + follow-up call), e post-LLM cleanup (dedup nome + greeting strip Bug 17 v2).

- **Arquivo novo:** `_shared/agent/llmCallLoop.ts` (327 lin) com `runLlmCallLoop(ctx)` + interface `LlmCallLoopCtx`/`LlmCallLoopResult`
- **Testes novos:** `llmCallLoop.test.ts` (16 testes, todos PASS): happy paths, tool calls seq/parallel, handoff break, handoff guard block (bug latente do monolito preservado linha-a-linha), MAX_TOOL_ROUNDS, retry/backoff, error 502, pending Qs (injection + follow-up), dedup nome, greeting strip, token ceiling
- **index.ts:** 2678 → 2494 lin (**-184 lin nesta onda**). Acumulado Sprint B5: **-2050 lin desde 4544 (-45.1%)**. Imports limpos: removidos `appendToolResults`, `LLMMessage`, `evaluateHandoffGuard`, `HANDOFF_GUARD_BLOCKED_MSG` (todos só usados no bloco extraído). Adicionado import único `runLlmCallLoop`.
- **`executeToolSafe` permanece em `ai-agent/index.ts`** (também usado por R121 inline + R137 wire + set_tags handler — keeping evita refator cross-cutting). Injetado via ctx.
- **`toolCallsLog` ref mutável** compartilhada entre pre-LLM (R121/R137) e loop — padrão idêntico ao de setTagsAndHandoff/searchProducts.
- **Validator + question mark guard** stayed em index.ts mas saíram do wrapper `while`: antes da Onda 4 ficavam dentro do loop com `break` final; agora rodam linearmente após o helper.
- **Pipeline:** tsc 0 erros · vitest **1200 pass / 9 fails pré-existentes idênticos** (+16 novos) · deploy CLI ai-agent v99→**v100 ACTIVE**

**Andamento plano orquestrador:** 53% → **56%** (Onda 4 fechada). Próximas:
- Onda 5 — `dispatchResponse` (~240 lin) — última do split B5
- Sprint C — Router LLM + product_specialist POC (~2-3 semanas, marco)

### v7.41.7 → v7.41.14 (2026-05-22 noite II) — Sessão maratona R140-R145

**8 versões em ~6 horas** atacando bug Sandrielly definitivamente. ai-agent v89→v99 ACTIVE.

| Versão | R# | Resultado |
|---|---|---|
| v7.41.7 | R139 (regex) + **R140 (stack trace)** | R140 foi o divisor — sem ele eu chutava |
| v7.41.8 | **R141 TDZ** | causa REAL do crash: `let carouselSentInThisCall` em linha 1928 referenciado por `executeTool` em linha 1751 → ReferenceError pré-LLM. Movido pra linha 497 |
| v7.41.9 | R142 chain rica | buildQualificationChain inclui ambiente/cor/voltagem/volume |
| v7.41.10 | R143 seed sem fields | preLLMAutoExtract persiste interesse:CAT mesmo se extracted=[] (caso Jessica) |
| v7.41.11 | R144 fuzzy I2 | auto-correct singular↔plural/regex/levenshtein-1 antes de bloquear |
| v7.41.12 | R145 v1 dedup | falso-positivo (60s window) — SUPERSEDIDA |
| v7.41.13 | R145 v2 + ia_cleared | ainda bloqueava (placeholder) — SUPERSEDIDA |
| v7.41.14 | **R145 v3** | + startTime barrier → finalmente correto |

**Lição central:** R140 (observability) deveria ter sido v7.41.5 não v7.41.7. Stack trace persistido em `ai_agent_logs.error` revelou TDZ em 1 query — sem isso eu testei 2 hipóteses erradas (vírgula, regex unicode).

**Doc cleanup (commit 5082784):**
- Nova wiki `wiki/erros/familias-r-codes.md` (205 lin) agrupa ~140 R# em 10 famílias
- `regras-preventivas.md`: + R137-R145, status [RESOLVIDA]/[SUPERSEDIDA], fix R86/R87 duplicados
- index.md: pointer pra famílias

**Pipeline final:** tsc 0 · vitest 1184 pass / 9 fails pré-existentes · ai-agent v99 ACTIVE · 8 camadas determinísticas protegendo qualif→handoff.

**Frase de retomada próxima sessão:** *"continuar Sprint B5 Onda 4 llmCallLoop após valida cenários Jessica/Wsmart em prod"*.

---

### v7.41.6 (2026-05-22) — R138 + R137 v2: sanitiza query antes de PostgREST + 6 integration tests reais

Versão definitiva do fix Sandrielly, depois de **v7.41.4 quebrar em prod** (search crashou ao rodar inline com query ruidosa contendo vírgulas) e **v7.41.5 reverter** (volta loop original).

**Causa raiz descoberta em prod (`ai_agent_logs` da conv 5b78ee46-b861):**
- R137 wire (v7.41.4) construía query `"iquine por quanto esta a tinta pintalar da , de 3,6l? com george"` direto do texto do lead.
- `searchProducts.ts:277` passa essa query pra `.or('title.ilike.%VALUE%,description.ilike.%VALUE%,...')` da PostgREST.
- `escapeLike` em `agentHelpers.ts:172` só escapa `%`, `_`, `\` — **NÃO escapa `,`**.
- Vírgula no `VALUE` quebra parser PostgREST `.or()` (`,` é o separator). 400 Bad Request → throw → `executeToolSafe` retorna *"Erro interno ao executar search_products"* → LLM perde caminho viável → handoff sem qualif.
- Bug é pré-existente (qualquer query LLM com vírgula crashava), mas R137 expôs ao construir query bruta.

**Fix em 2 camadas (defesa profunda):**
- **Camada 1 — `searchProducts.ts`**: novo helper exportado `cleanSearchQuery(raw)` strip de `, ; : " ' ? ! ( ) [ ] { }` → espaço + colapsa whitespace. Aplicado no entry: `args.query` e `args.category` sanitizados ANTES de qualquer uso. Protege contra LLM mandando vírgulas (rare) E callers internos (R137 wire) passando texto bruto.
- **Camada 2 — `preLLMAutoExtract.ts`**: R137 wire re-adicionado COM sanitização:
  - `stripLeadNameSuffix(query)` remove `com X`, `meu nome é X`, `sou X` do final
  - `cleanSearchQuery(stripped)` strip punctuation
  - `buildSearchQuery(...)` combina com tags existentes
  - `cleanSearchQuery(combined)` 2ª passada (defesa)
  - Skip se query < 2 chars após cleanup

**Testes integration NOVOS (`r137-integration.test.ts`, 6 cenários):**
1. Sandrielly EXATO inside hours catálogo vazio → R137 dispara + search sem crash + PATH A enrichment
2. Sandrielly EXATO outside hours catálogo vazio → R137 dispara + search sem crash + R120 handoff
3. "Quanto custa a Coral fosca?" (marca isolada sem verbo) → R137 brand_mentioned + search limpo
4. "Preciso de tinta acrílica fosca" (R121 verboso) → R121 inline > R137 + search limpo
5. "Boa tarde, tudo bem?" (saudação pura) → no_signal, R137 NÃO dispara
6. REGRESSÃO: query EXATA do log prod 22:13:09 não causa crash em `.or()`

**Supabase mock realístico** que rejeita malformed `.or()` exatamente como PostgREST 400 — se code passar vírgula/parênteses/"?" pro filter, teste falha.

**Vitest:** +6 integration scenarios + 8 unit tests cleanSearchQuery + 2 sanitization tests = **+16 testes novos**. Suite total: 1165 pass / 9 fail pré-existentes idênticos. tsc 0.

**Deploy:** ai-agent v89→**v90 (revert R137 v7.41.4)**→**v91 ACTIVE (R138+R137 v2)** via CLI. SHA `f869b307...` novo. verify_jwt:false preservado.

**Lição aprendida (autocrítica honesta):**
- v7.41.4 testou R137 isoladamente em `preLLMAutoExtract.test.ts`, mas NÃO exercitou o caminho real `runInlineSearchProducts → dispatchSearchTool → searchProducts → .or() do PostgREST`. Mocks de teste eram limpos demais.
- Bug pré-existente do `escapeLike` ficou latente desde sempre — só apareceu quando R137 passou query ruidosa.
- v7.41.6 introduziu mock de supabase que **simula a rejeição PostgREST**, garantindo que regressão futura é detectada antes de prod.

**Frase de retomada:** *"executar B5 Onda 4 llmCallLoop"*.

---

### v7.41.4 (2026-05-22) — R137 v1 (REVERTIDO — bug crash em prod)

Primeira tentativa do R137 wire. Crashou em prod no caso Sandrielly (1 ocorrência). Causa: query bruta com vírgulas/`?` quebrou PostgREST `.or()`. Reverteu na v7.41.5, re-implementado correto na v7.41.6.

---

## 📦 Releases anteriores (v7.41.3 e abaixo — Sprint B5 ondas 3a-3d) arquivadas em 2026-05-23

Movidas pra [[wiki/changelog/2026-05-part10]] (hard limit 300 linhas). Conteúdo: v7.41.3 (Onda 3d set_tags+handoff), v7.41.2 (Onda 3c searchProducts), v7.41.1 (Onda 3b crmTools), v7.41.0 (Onda 3a mediaTools).

