---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-22 (noite III) — Sprint B5 Onda 4 shipped (v7.41.15) — extrai `llmCallLoop`

**Trigger:** user confirmou que cenários Jessica/Wsmart passaram em prod nos testes pós-v7.41.14 e mandou *"bora pra onda 4"* + *"prossiga e depois audite e teste e depois documente, commit e deploy até terminar todas as fases"* + *"só pare quando terminar todas as fases"*.

**Diagnóstico inicial:**
- Mapeei o loop em `ai-agent/index.ts:1992-2211` (220 lin) mais o `while` wrapper que estende até `break` em linha 2355 (validator + question mark guard estavam dentro do loop por convenção histórica). Sprint B5 destrincou: helper só pega LLM call+tools+cleanup, validator volta a rodar linearmente.
- 5 blocos contíguos: setup (1992-2015) + while (2017-2185) + post-LLM cleanup (2187-2211). Total ~244 lin. Estimativa do CLAUDE.md era ~370 — ondas anteriores já trimaram.
- Closures críticas: `executeToolSafe` (closure do index.ts, R140 stack trace persist) usado também fora do loop em R121 inline + R137 wire + set_tags handler — keeping em index.ts evita refator cross-cutting. Injetado via ctx no helper.
- `toolCallsLog` é ref mutável compartilhada pré-LLM ↔ loop (padrão idêntico ao de setTagsAndHandoff/searchProducts).
- `geminiContents.__pendingQuestions` é gambiarra do agrupador de msgs — preservada como-está (refator fora de escopo).

**Execução (cirúrgica):**

1. **`_shared/agent/llmCallLoop.ts` (327 lin)** — `runLlmCallLoop(ctx)` main + interface `LlmCallLoopCtx` (16 campos: agent, llmModel, systemPrompt, toolDefs, geminiContents, toolCallsLog, executeToolSafe, conversation, hasInteracted, sendPresence, log, supabase, agent_id, conversation_id, startTime, corsHeaders) + interface `LlmCallLoopResult` ({responseText, inputTokens, outputTokens, usedModel, errorResponse}). Error 502 retorna `Response` no result em vez de `return` direto (preserva controle no caller).

2. **`llmCallLoop.test.ts` (16 testes, ~340 lin):**
   - Happy: texto puro, 1 tool seq, 2 tools paralelos sem side-effect, força seq quando há side-effect
   - Handoff: handoff_to_human break; handoff guard block (preserva bug latente do monolito — push entry name='handoff_to_human' + check `.some(name===)` → break antes do 2º LLM call)
   - Safety: MAX_TOOL_ROUNDS=3 força text-only; retry erro 1× → sucesso 2ª; erro 3× → errorResponse 502
   - Pending Qs: injection no último tool result; follow-up call após resposta texto-puro
   - Post-LLM: dedup nome ("GeorgeGeorge"→"George"); strip greeting Bug 17 v2 (greeting sem acento — limitação `\b` ASCII-only documentada); NÃO strip quando hasInteracted=false; fallback "Em que posso te ajudar?"
   - Token ceiling: trima llmMessages quando totalInputTokens > 8192 e toolRounds >= 1

3. **`ai-agent/index.ts`:**
   - Imports limpos: removidos `appendToolResults` + `LLMMessage` + `evaluateHandoffGuard` + `HANDOFF_GUARD_BLOCKED_MSG` (todos só usados no bloco extraído)
   - Adicionado import único `runLlmCallLoop`
   - Bloco 220 lin substituído por ~25 lin (call + destructure + early return em errorResponse)
   - Removidos `break` + `}` que fechavam o while (validator agora roda linearmente)
   - **2678 → 2494 lin (-184 nesta onda)**. Acumulado B5: **-2050 desde 4544 (-45.1%)**.

**Hiccup:** primeira passada teste greeting strip falhou — usei "Olá, Pedro!" mas a regex Bug 17 v2 tem `\b` em modo ASCII-only e `á` (U+00E1) não é word-char → boundary com `,` falha. Limitação CONHECIDA do monolito (comment "regex antigo pegava mas algumas variacoes escapavam"). Teste ajustado pra usar "Bom dia! Tem tinta..." que a regex consome corretamente. Documentado no teste como "comportamento preservado linha-a-linha".

Outra: handoff guard block test — assumi loop continuaria pra 2º LLM call. Errado: o `toolCallsLog.some(name==='handoff_to_human')` ACEITA a entry blocked-by-guard como handoff legítimo e quebra o loop antes. Bug latente do monolito desde sempre — preservado linha-a-linha (caller `hadExplicitHandoffInLoop` depende dessa semântica). Teste ajustado pra refletir real behavior.

**Pipeline:**
- tsc 0 erros
- vitest: **1200 pass / 9 fails pré-existentes idênticos** (+16 novos)
- Suite agent isolada: **232/232 PASS** (12 arquivos de teste no `_shared/agent/`)
- Deploy CLI: `npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` → llmCallLoop.ts uploaded entre os assets, **ai-agent v99 → v100 ACTIVE**

**Decisões deferidas (Onda 5+):**
1. Remover gambiarra `geminiContents.__pendingQuestions` — refator do agrupador upstream
2. Refator `executeToolSafe` pra helper `_shared/agent/executeToolSafe.ts` (compartilhado entre R121/R137/set_tags) — não-bloqueador
3. Fix do handoff guard block break (loop deveria continuar pra LLM tentar search_products) — backlog (R# nova)

**Andamento Plano Orquestrador:** 53% → **56%**. Próximas:
- Onda 5 — `dispatchResponse` (~240 lin) — última do split B5
- Sprint C — Router + product_specialist POC (~2-3 sem)

**Frase de retomada:** *"executar B5 Onda 5 dispatchResponse"*.

---

## 2026-05-22 (noite II) — Sessão R141-R145 — fix completo Sandrielly/Wsmart/Jessica + catálogo R# organizado

**Sessão maratona 13 deploys** (v7.41.4→v7.41.14) atacando bug Sandrielly. Iteração brutal de diagnósticos errados até R140 capturar stack trace real.

**Cronologia honesta (3 falhas + 5 acertos):**
- v7.41.4 R137 v1: wire shippado, **crashou em prod** com query bruta (vírgula no `.or()`)
- v7.41.5: revertido
- v7.41.6 R138: sanitiza vírgula → **crash continuou** (vírgula era correlato, não causa)
- v7.41.7 R139+R140: regex unicode + **captura stack trace** ← divisor real
- v7.41.8 **R141**: stack trace revelou `ReferenceError: Cannot access 'carouselSentInThisCall' before initialization` — TDZ! `let` declarado em linha 1928, mas `executeTool` (linha 1751) referencia. Quando R137 inline chamava executeTool pré-LLM, TDZ throw. Fix: mover `let carouselSentInThisCall = false` pra linha 497 (antes de executeTool). **CAUSA REAL fixada.**
- v7.41.9 R142: `buildQualificationChain` enriquecida (ambiente/cor/voltagem/volume) — atendente recebe handoff com chain rica
- v7.41.10 R143: bug pré-existente — `extracted=[]` descartava seed `interesse:CAT`. Caso Jessica "porta de frente" → portas detectado mas "frente" não bateu fields → seed perdido → loop. Fix: persist seed mesmo sem fields.
- v7.41.11 R144: Bug 12 atacado — `validateInteresseCategory` ganha auto-correct fuzzy (plural/singular/regex/levenshtein-1). LLM tenta `interesse:porta` → auto-corrige pra `interesse:portas` em vez de bloquear.
- v7.41.12 R145 v1: anti-dup outgoing janela 60s — falso-positivo, bloqueou greeting legítimo pós-clear-context
- v7.41.13 R145 v2: + ia_cleared check — ainda bloqueou (placeholder do turn atual)
- v7.41.14 **R145 v3**: + startTime barrier excluindo turn atual — finalmente correto

**Pipeline final:**
- tsc 0 · vitest 1184+ pass / 9 fails pré-existentes idênticos
- ai-agent v89→**v99 ACTIVE** (10 versões em ~6 horas)
- 14 commits + push, todos no master

**Doc cleanup (commit 5082784):**
- Nova wiki `wiki/erros/familias-r-codes.md` agrupa ~140 R# em 10 famílias temáticas
- `regras-preventivas.md` ganha 9 entries (R137-R145) + status `ATIVA/RESOLVIDA/SUPERSEDIDA/INCERTA`
- Fix R86/R87 duplicados → R86b/R87b
- 4 marcadas RESOLVIDAS (R84, R96, R97, R98); 2 SUPERSEDIDAS (R145 v1/v2)
- index.md ganha pointer pra famílias

**Lições brutais aprendidas:**
1. **R140 (observability) deveria ter sido o PRIMEIRO fix**, não o terceiro. Antes dele eu chutava (v7.41.4 vírgula errada, v7.41.7 regex incerta). Depois dele, R141 foi cirúrgico.
2. **TDZ silencioso de `let` é classe de bug invisível em testes mocked**. Vitest passou todos os 1184 testes mesmo com bug em prod.
3. **R145 errei DUAS vezes** (v1 e v2) por não pensar nos side effects. Cada vez que toco em código stateful, descubro mais race.
4. **R# acumulam por concentração no monolito** — 49% das 140 R# são AI Agent. Sprint C/D vai diluir ao mover lógica pra specialists.

**Status final:** ai-agent v99 ACTIVE, 8 camadas determinísticas protegendo qualif→handoff (preLLMAutoExtract R143 + I2 R144 + bug27 seed + fallback D33 + R128 phrasing + R130 forced next + stack trace R140 + dedup R145 v3).

**Frase de retomada:** *"continuar Sprint B5 Onda 4 llmCallLoop após valida cenários Jessica/Wsmart em prod"*.

---

## 📦 Entradas anteriores (Ondas 3a/3b/3c/3d + R137 + R138 + Validação E2E) arquivadas em 2026-05-22 noite III

Movidas pra [[wiki/log-arquivo-2026-05-22-sprintb5-ondas3]] (hard limit 300 linhas). Conteúdo: shipping logs das ondas 3a-3d + R137 v1 (revertido) + R138 + Validação E2E Bug #7.

## 📦 Entradas anteriores (Ondas 2a/2b/2c-i/2c-ii + Onda 0+1, B3, B2, B1.5, B1)

Movidas pra [[wiki/log-arquivo-2026-05-21-sprintb]]. Conteúdo: shipping logs das ondas anteriores + ponteiros pra R124-R136 e D36.

