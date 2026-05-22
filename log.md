---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-22 (madrugada) — Validação E2E em prod + Fix Bug #7 shipped (v7.40.9)

**Trigger:** depois do shipping da Onda 2c-ii, validação em prod com user mandando msgs reais na EletropisoV2. 3 cenários planejados (R121 + autoExtract + inline search; R129 multi-categoria; R136 multi-item). Cenários 1+2 executados, Cenário 3 não chegou a ser feito porque bug descoberto no Cenário 2 demandou fix.

**Setup pra teste E2E:**
- Cadastrei 1 produto fake `TEST-CORAL-18L` (tinta Coral fosca branca neve 18L, R$ 489,90) com imagem placehold.co — pra ter pelo menos 1 SKU na categoria tintas (catálogo Eletropiso V2 tinha só 1 telha PVC).
- Trocas de modelo testadas: gpt-5-mini falhou (LLM call deu erro em 11.5s — provável max_tokens vs max_completion_tokens incompatível com família reasoning). Rollback pra gpt-4.1-mini em 15s, refator funcionou.
- Corrigi `handoff_message_outside_hours` (removi "Olá! 😊" desnecessário do começo — sintaxe transbordo já é meio-de-conversa).

**Bugs descobertos em prod (7 total):**
1. gpt-5-mini incompatível com max_tokens — `_shared/llmProvider.ts:109` precisa branch reasoning model (Sprint A I3 foi shipped incompleto)
2. `search_products` retornou "Erro interno" intermitente
3. LLM ignorou hint `[INTERNO — search_products já chamado]` e pediu mais qualif em vez de mostrar tinta
4. LLM tenta `interesse:tinta` (singular) → Sprint A I2 bloqueia (validator funcionando)
5. autoExtract não casa flexões morfológicas ("fosca" no incoming não bate "fosco" do examples)
6. Tag `produto:` populada com query inteira slugificada (corolário do bug #2)
7. **R129/R136 short-circuit perde info da msg original** ("porta de ENTRADA e janela" — sistema perdia "entrada" + outras specs)

**Fix Bug #7 implementado nesta sessão:**
- `_shared/agent/preLLMShortCircuits.ts`: novo helper privado `extractRichFieldsFromCategories(text, matchedCats, existingTags)` itera pelas categorias detectadas, chama `autoExtractFields` na union dos fields de cada uma, dedupe por key (primeira categoria vence em colisão).
- R129 + R136 ambos chamam o helper ANTES do INSERT do tag pending. Tags ricas são persistidas junto com `multi_interesse_pending` / `qualif_horizontal:pending`.
- `auto_field_extracted` log carrega `rich_extracted` no metadata pra observabilidade.
- +5 testes (R129 extrai subtipo+material+tipo_janela; R129 não duplica tag existente; R136 extrai ambiente+acabamento; agent sem fields ricos não falha; guard R134 preservado).

**Tentativa Playwright descartada:** explorei usar UI Playground (localhost:8080/dashboard/ai-agent/playground) pra automatizar os 3 cenários. Descobri que `ai-agent-playground/index.ts` NÃO importa os módulos novos (preLLMShortCircuits, preLLMAutoExtract, exitActionDispatcher) — então chamar via Playwright ou HTTP não validaria R121/R129/R136 reais. Cenários da UI usam LLM simulado. Aba "E2E Real" enviaria msg WhatsApp pro user — pollua. Decisão: pular automação nesta sessão, focar no fix do bug que mais impacta UX.

**Backlog atualizado pra próxima sessão:**
1. Integrar módulos novos no ai-agent-playground (pra desbloquear automação Playwright futura)
2. Bug #1 — gpt-5-mini compatibilidade `max_completion_tokens` no llmProvider
3. Bug #2 — search_products "erro interno" intermitente (investigar handler)
4. Bug #3 — fortalecer prompt do `[INTERNO]` pra LLM mostrar produto em vez de pedir mais qualif
5. Bug #5 — admin UI pra editar examples (adicionar flexões morfológicas)
6. **B5 Onda 3 — toolExecution split por capacidade** (~1500 lin, vai subdividir em 3-4 mini-ondas — pré-req real do Sprint C)

**Pipeline Fix #7:** tsc 0 · vitest **1067 pass (+5 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v83→**v84** ACTIVE via CLI.

**Andamento Plano Orquestrador:** 43% (mantém — Fix #7 é hardening da Onda 2c, não nova onda). Próximo passo: Onda 3 (com fix Bug #1 antes pra desbloquear gpt-5-mini real).

**Frase de retomada:** *"executar B5 Onda 3 toolExecution split por capacidade"* OU *"fix bug 1 gpt-5-mini llmProvider"* (antes da Onda 3 se quiser router em gpt-5).

---

## 2026-05-21 (noite VI) — Sprint B5 Onda 2c-ii shipped (v7.40.8) — autoExtract + exit_action handoff + R121 inline search

**Trigger:** user pediu "prossiga" após combinar plano (Onda 2c-ii HIGH RISK como caminho crítico do objetivo principal Sprint C). Sessão dedicada conforme planejado.

**Diagnóstico inicial:**
- Bloco 1502-1673 (~170 lin) com 3 sub-blocos acoplados via flags `pendingExitAction*`:
  1. autoExtract + R121 trigger + score + flags (~110 lin)
  2. Bug 24 handoff dispatcher (~35 lin) — early return Response
  3. R121 inline search (~25 lin)
- Closure crítica `runQueueAssignment` (linha 689) capturada por path 2 — refator passa como callback no ctx, evitando criar dependência circular.
- `pickHandoffMessage` (função local linha 82, pura) também passa como callback — mantém index.ts dono dela.

**Execução (2 módulos + 26 testes + 1 refator):**

1. `_shared/agent/preLLMAutoExtract.ts` — função orquestradora pura+DB. Extrai META_KEYS pra constante, regex `DIRECT_PRODUCT_QUESTION_RE` isolada, helper `buildSearchQuery(interesseValue, tags, newTags, fallbackText)`. Retorna `{ pendingExitActionHandoff, pendingExitActionSearch, tagsMutated }`.

2. `_shared/agent/exitActionDispatcher.ts` — 2 funções:
   - `dispatchExitActionHandoff(ctx, pending, log)` — recebe callbacks (sendTextMsg, broadcastEvent, runQueueAssignment, pickHandoffMessage). Sequência: outsideHours → pickHandoffMessage → runQueueAssignment → sendText → insert msg → update conv (status_ia=SHADOW + dept profile>funnel) → log implicit_handoff → broadcast → Response 200. Skip em status_ia=SHADOW.
   - `runInlineSearchProducts(ctx, pending, log)` — recebe callback executeToolSafe. Sequência: log info → executeToolSafe → log tool_called → monta string `[INTERNO]`. Retorna `{ inlineSearchContext, toolCall }`. Skip em SHADOW. Erros não propagam.

3. Testes (17 + 9 = 26 novos):
   - **preLLMAutoExtract**: guards (vazio, suppress, no-cat), R121 (digital trigger, offline skip, produto: skip, aguardando_upsell skip, shadow skip, query sem META_KEYS), autoExtract (score progressivo+persist, handoff em stage2 max, shadow skip handoff, search C2 skip em offline, interesse: reuso → resolved_via='interesse_tag', no-fields no-mutation, pending_exit_handoff no log), prioridade R121 > C2.
   - **exitActionDispatcher**: handoff happy path (queue+send+conv+log+broadcast+Response), shadow skip, dept profile > funnel, dept funnel fallback, outsideHours, response body, inline search happy, inline shadow skip, inline executeToolSafe throw → log.error non-fatal.

4. `ai-agent/index.ts:1502-1673` (~170 lin) → 3 chamadas (~30 lin): `runPreLLMAutoExtract` + `dispatchExitActionHandoff` + `runInlineSearchProducts`. Saldo: 4153 → **4032 lin** (-121). Acumulado B5: **-512 lin** desde 4544.

**Hiccup:** 1ª passada vitest 16/17 do módulo A — teste esperava `pendingExitActionSearch` quando score=30 atinge max do stage1. Mas `getCurrentStage` usa `[min, max)` exclusivo → score=30 já cai em stage2 (handoff [30,100)), e `30 < 100` não dispara nada. Comportamento PRESERVADO do código original (não é bug do refator). Teste ajustado pra refletir comportamento real (score=30 boundary não dispara exit action; só dispara quando atinge max do stage atual).

**Pipeline:** tsc 0 · vitest **1062 pass (+26 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v82→**v83** ACTIVE via CLI.

**Andamento Plano Orquestrador:** 41% → **43%**. Próxima onda crítica: **Onda 3 toolExecution** (~1500 lin) — vai subdividir em 3-4 mini-ondas por capacidade. É o **pré-req real do Sprint C** porque aqui é onde se define o boundary dos specialists.

**Frase de retomada:** *"executar B5 Onda 3 toolExecution split por capacidade"*.

---

## 2026-05-21 (noite V) — Sprint B5 Onda 2c-i shipped (v7.40.7) — extrai R136 + R129 short-circuits

**Trigger:** user pediu pra prosseguir nesta sessão a partir da frase de retomada "executar B5 Onda 2c pre-LLM decisions". Confirmação via AskUserQuestion: escopo da sessão = só 2c-i (R136 + R129), deixando 2c-ii (autoExtract + exit_action + inline search, HIGH RISK) pra sessão dedicada.

**Diagnóstico do bloco antes de codar:**
- Pre-LLM decisions hoje ocupa linhas 1480-1782 (~302 lin), 5 sub-blocos com risco gradual.
- 2c-i ataca **só os 2 short-circuits espelhados** (1486-1547 R136, 1549-1609 R129) — mesma estrutura: detectar → persistir tag → enviar mensagem → log → return Response. Helper privado `persistAndBroadcastReply` recolhe a parte duplicada.
- Closures críticos `runQueueAssignment` ficam INTOCADOS — só são usados no path 2c-ii (Bug 24 handoff).

**Execução:**
1. `_shared/agent/preLLMShortCircuits.ts` — função orquestradora `runPreLLMShortCircuits(ctx, log)` retornando `{ shortCircuited, response, suppressAutoExtractForMulti }`. R136 internamente vence R129 quando ambos batem (lista multi-item já carrega o sinal de R129).
2. `preLLMShortCircuits.test.ts` — 13 testes mockando supabase (builder fluent + insert chain p/ conversation_messages.select().single()) + sendTextMsg + broadcastEvent. Cobre: guards de input (texto vazio/espaços), R136 happy + already-pending + fallback send-fail + lista all-matched-not-mixed, R129 happy + 3 categorias + interesse-set + multi-pending-set + 1 categoria + fallback, ordem R136 > R129.
3. `ai-agent/index.ts`: 1486-1609 (124 lin in-line) → 9 lin (chamada + retorno). Movi `suppressAutoExtractForMulti` pra `const` no escopo do `if`. Removi 4 imports órfãos pós-extração (`detectMultiItem`, `buildHorizontalQuestion`, `HORIZONTAL_QUALIF_PENDING_TAG`, `matchAllCategoriesBySearchText`).
4. index.ts: 4265 → **4153 lin** (-112). Acumulado B5: **-391 lin** desde 4544.

**Hiccup:** primeiro pass dos testes 4/13 fail. Causa: config de teste sem `phrasing` no stage → `isValidConfig` retorna false → `getCategoriesOrDefault` cai no DEFAULT (só tintas+impermeabilizantes). Como o texto dos testes era "porta e janela", não casava ninguém. Fix: stage com `phrasing: 'me conta {label}?'` válido. 13/13 pass.

**Pipeline:** tsc 0 · vitest **1036 pass (+13 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v81→**v82** ACTIVE via CLI (`SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy ai-agent --no-verify-jwt`).

**Andamento Plano Orquestrador:** 38% → **41%**. Próxima onda crítica: **2c-ii** (autoExtract + score progressivo + exit_action handoff Bug 24 + R121 inline search, ~180 lin HIGH RISK).

**Frase de retomada:** *"executar B5 Onda 2c-ii autoExtract + exit_action handoff"*.

---

## 2026-05-21 (noite IV) — Sprint B5 Onda 2b shipped (v7.40.6) — extrai buildQualificationContext

**Trigger:** user pediu pra prosseguir após Onda 2a + reportar %. Onda 2b é função pura (~127 lin) com R134/R135/R136/R129/R131 acoplados, baixo risco.

**Execução:**
1. `_shared/agent/qualificationContext.ts` — função pura única recebendo currentTags + agentCfg + recentMessages. Importa deps de `serviceCategories`, `qualificationAntiLoop`, `horizontalQualif`.
2. `qualificationContext.test.ts` — 15 testes cobrindo prioridade R136 > R129, fallback id quando label inexistente, DEFAULT_SERVICE_CATEGORIES_V2 (`interesse:tinta` casa em `tinta|esmalte|verniz`), nudge anti-loop R135.
3. `ai-agent/index.ts`: remove função local inteira (linhas 1460-1578, ~120 lin) → 1 comentário. index.ts: 4390 → 4265 (-125 lin). Acumulado B5: -279 lin desde 4544.

**Hiccup:** primeira passada dos testes falhou em 4/16 — eu havia montado agentCfg "inválido" (stages sem campos required `id/min_score/max_score`), então `getCategoriesOrDefault` caía no DEFAULT silenciosamente. Refatorei testes pra usar DEFAULT direto (`{}` como agent) ou IDs unknown pra testar fallback. 15/15 passam.

**Pipeline:** tsc 0 · vitest 1023 pass (+15 novos) / 9 fail pré-existentes idênticos. Deploy ai-agent v80→v81 ACTIVE.

**Andamento Plano Orquestrador:** 35% → **38%**. Próxima: Onda 2c (pre-LLM decisions, ~400 lin HIGH RISK — early returns + DB writes + broadcasts). Vai exigir sessão dedicada.

**Frase de retomada:** *"executar B5 Onda 2c pre-LLM decisions"*.

---

## 2026-05-21 (noite III) — Sprint B5 Onda 2a shipped (v7.40.5) — extrai promptSections puras

**Trigger:** user pediu pra documentar andamento no CLAUDE.md + prosseguir + reportar %. Adicionei painel de andamento (30%→35%) e prossegui com Onda 2a do B5.

**Re-escopo Onda 2 (decidido após leitura real):**
- Plano original: extrair tudo de 1499-2104 (~600 lin) em 1 onda. Risco alto demais.
- Re-escopo: 2a (sections puras ~85 lin, ✅ esta sessão), 2b (buildQualificationContext função pura ~127 lin, próxima), 2c (pre-LLM decisions com side effects ~400 lin, sessão dedicada HIGH RISK).

**Execução:**
1. `_shared/agent/promptSections.ts` (novo): 7 funções puras — `replaceVars`, `buildIdentitySection`, `buildBusinessSection`, `buildLeadContextBlock`, `buildDynamicContext`, `buildFactsBlock`, `buildAgentPromptSections` bundle.
2. `promptSections.test.ts` (novo): 28 testes — humanização META_KEYS_FACTS, missing fields business, lead recorrente vs novo, aviso aceleração handoff, tags malformadas, valor com `:` interno.
3. `ai-agent/index.ts:1431-1515` (~85 lin in-line) → 3 chamadas únicas. index.ts: 4454 → 4390 lin (-64). Acumulado B5: -154 lin.

**Pipeline:** tsc 0 · vitest **1008 pass (+28 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v79→v80 ACTIVE.

**Andamento Plano Orquestrador:** 30% → **35%**. Próxima onda crítica: Onda 2b (buildQualificationContext função pura, R134/R135/R136/R129/R131 acoplados).

**Frase de retomada:** *"executar B5 Onda 2b buildQualificationContext"*.

---

## 📦 Entradas anteriores (Onda 0+1, 2a, B3, B2, B1.5, B1) arquivadas em 2026-05-21

Movidas pra [[wiki/log-arquivo-2026-05-21-sprintb]] (hard limit 300 linhas). Conteúdo: shipping logs das ondas anteriores deste mesmo dia + ponteiros pra R124-R136 e D36.

