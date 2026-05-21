---
title: Auditoria AI Agent — 2026-05-21
tags: [auditoria, ai-agent, arquitetura, prompt, tools, guards, debt]
sources: [supabase/functions/ai-agent/index.ts, supabase/functions/_shared/*.ts, wiki/erros-e-licoes.md, wiki/ai-agent.md, wiki/decisoes-chave.md]
updated: 2026-05-21
audited_at: 2026-05-21
verdict: 5.7/10 — funcionando, mas em rota de colapso por inflação de prompt e acúmulo de guards inline
---

# Auditoria AI Agent — 2026-05-21

## Resumo executivo

`ai-agent/index.ts` tem **4.407 linhas / 268 KB**, 1 mega-LLM call com prompt ensamblado de ~20-30 KB (5-8k tokens) em **17 seções** + 4-tool round loop. Arquitetura é "1 LLM faz tudo" — não há orquestrador/router/subagentes especializados. Modularização tímida: 7 guards extraídos pra `_shared/` (R124-R134 ensinaram), mas helpers críticos (`buildQualificationContext`, `buildEnrichmentInstructions`, `buildQualificationChain`, `pickHandoffMessage`, `replaceVars`, `hardcodedRules`) ainda inline. **10 incidentes em 21 dias** (R124-R134, todos no `index.ts`) + 4ª recidiva da família "Camada 3" (R132 áudio). Tooling determinístico ganhando terreno (search/handoff/setTags guard + override pós-LLM + auto-extract), mas o prompt continua inflando linearmente — `hardcodedRules` sozinho tem 9.3 KB. Caminho atual = mais regras a cada bug, sem refator. **Veredito geral: 5.7/10.**

---

## D1. Tamanho do prompt — **3/10**

**Composição (`index.ts:2016-2040`):** 17 seções concatenadas com `\n\n`:

1. `identitySection` (`ps.identity`) — DB
2. `businessSection` — gerado de `agent.business_info` (~500-1500 chars)
3. `leadContextBlock` — gerado (~200-400 chars)
4. `sdrSection` (`ps.sdr_flow`) — DB
5. `productSection` (`ps.product_rules`) — DB
6. `handoffSection` (`ps.handoff_rules`) — DB
7. `tagsSection` (`ps.tags_labels`) — DB
8. `absoluteSection` (`ps.absolute_rules`) — DB
9. `hardcodedRules` — **9.348 chars hardcoded** (`index.ts:1644-1668`, 25 regras invioláveis)
10. `objectionsSection` (`ps.objections`) — DB
11. `extractionInstruction` — gerado de `agent.extraction_fields`
12. `knowledgeInstruction` — FAQ + docs embarcados em XML
13. `subAgentInstruction` — legacy sub-agents (~500 chars) só quando `!profileData`
14. `dynamicContext` — labels + tags humanizadas + blocked_topics + msg counter (~600-2000 chars)
15. `additionalSection` (`ps.additional`) — DB
16. `outsideHoursContext` — gerado (~400 chars quando aplicável)
17. `qualificationContext` — **gerado por turno (~1.500-2.500 chars)** (`index.ts:1675-1745`)
- Pós-concat: `\n\n⚠️ REGRA FINAL: Chame o lead de "${leadName}"` + `funnelInstructionsSection` (perfil/funil, ~500-1500 chars)

**Estimativa total assembled:** **20-30 KB** = **~5.000-8.000 tokens** só de system prompt. Cada turno re-injeta TUDO (sem rolling cache). Com history + tool results (3 rounds), input total chega facilmente em 12-15k tokens (`MAX_ACCUMULATED_INPUT_TOKENS=8192` ceiling em `index.ts:3765`, mas só corta após round ≥1 → primeira chamada pode ultrapassar livremente).

**Evidências de inflação:**
- `hardcodedRules` (9.3 KB, 25 bullets) virou catch-all de bug fix. Cada incidente (R121 marca, Bug 17 saudação, Bug 19 alucinação) adicionou bullet, nenhum foi removido.
- `qualificationContext` tem 2 caminhos (multi-categoria R129/R134 + stage normal) com ~2.3 KB de instruções por turno (`index.ts:1727-1741`).
- `buildEnrichmentInstructions` + `buildQualificationChain` somam ~5 KB de templates condicionais (`index.ts:2180-2310`).
- Override defensivo pós-LLM (R130, `index.ts:4014-4050`) reescreve a resposta se LLM divergiu — sinal de que o prompt não consegue conduzir o LLM sozinho.

**Veredito:** **catastrófico**. Prompt cresceu ~3-4× nos últimos 30 dias (R109+R114+R121+R124-R134). Custo OpenAI sobe linear; tempo de leitura do LLM degrada (mais context = pior recency). Cada nova regra é um patch — falta refator pra mover do prompt → tool/handler determinístico.

---

## D2. Funcionalidade / estado atual — **6/10**

**Incidentes 14 dias (R124-R134, 2026-05-14 a 2026-05-21):** 10 fixes, 9 deles no `index.ts` (HIGH RISK).

- R124 handoff bloqueado eterno após search_fail (guard `toolCallsLog`-only)
- R125 badge "Em fila" com Modo OFF (backend cria event sem checar flag)
- R126 search cross-categoria genérica (LLM chamou `search_products({query:"material"})`)
- R127 mergeTags REPLACE-by-key silente em multi-categoria
- R128 `sale_closed` false positive ("quero comprar material" → handoff prematuro)
- R129 auto-extract escolhia 1ª categoria em multi-interesse
- R130 LLM improvisa field inválido após `set_tags(interesse:NEW_CAT)` — exigiu override pós-LLM
- R131 phrasing repetido em 2ª+ pergunta do stage
- R132 IA ignorou transcrição de áudio (4ª recidiva família Camada 3)
- R133/R134 regex overlap tintas↔impermeabilizantes + loop R129 sem guarda anti-loop

**Paths de handoff via `runQueueAssignment`:** **12** chamadas no `index.ts` (linhas 698, 738, 867, 991, 1953, 3494, 3676, 4040, 4125, 4181, 4352 + 1 indireto via tool call). Mapa não-trivial — implicit handoff (sale_closed), upsell-close handoff, excluded_products handoff, max_lead_messages handoff, search_fail handoff, enrichment-complete handoff, exit_action handoff, tool-call handoff, fallback final handoff. Risco: cada path tem own logging + cleanup; divergência fácil.

**Guards determinísticos (em `_shared/` testáveis):** **7 prontos** — `handoffGuard` (R124), `searchGuard` (R126), `setTagsValidator` (R127), `saleClosedDetection` (R128), `fieldAutoExtractor` (Bug 4), `excludedProducts` (D28), `incomingMessagesLoader` (R132). Cada um nasceu de incidente. Boa direção, mas há lógica equivalente AINDA inline.

**Determinístico vs LLM-driven:** estimo **60% determinístico / 40% LLM-driven** hoje. R130 (override pós-LLM) e R129 (curto-circuita o LLM antes da chamada quando 2+ categorias) provam que o time confia cada vez menos no LLM sozinho. Direção correta, mas inflação concomitante do prompt indica que o LLM ainda é convocado pra muito.

**Veredito:** funciona em prod mas instável. Taxa de incidentes ~1/2 dias × 14 dias = sinal de regressão sistêmica. Boa parte é colateral de mudanças anteriores (R130 = recidiva pós-R127, R134 = guarda anti-loop ausente).

---

## D3. Subagentes / Modularidade — **2/10**

**Resposta direta:** NÃO existem subagentes especializados. Tudo passa por **1 único `callLLM`** (`index.ts:3774`) com mega-prompt + 9 tools. Em caso de tool round → 2 LLM calls max (loop com `MAX_TOOL_ROUNDS=3`, mas force final text-only no 3º). Há também 1 `callLLM` para SHADOW (`index.ts:1307`) — prompt pequeno, especializado, ~50 linhas, **mas reativo, não orquestrado**.

**Sub-agents "legados" (`index.ts:1529-1555`):** estrutura `agent.sub_agents` (JSONB com modos sdr/sales/support/handoff) que mapeia tag `motivo:` → prompt extra. Está DEPRECATED por M17 F3 Agent Profiles (perfil ÚNICO carregado do funil ou is_default), também injetado como texto extra no system prompt — não é uma chamada LLM separada, só uma seção a mais no mesmo prompt monolítico.

**Helpers em `_shared/`:** ~15 arquivos puros (detection, validation, formatting), mas TODOS são funções síncronas determinísticas — nenhum é "subagente LLM". `validatorAgent.ts` ainda existe mas só vejo `import { validateResponse }` (não roteado por intent).

**Falta clara:** especialista por área (greeting, qualif, search/produto, handoff, objeção). Em vez disso, o LLM único é alimentado com 17 seções tentando ensinar tudo.

**Veredito:** monolito. Modularização atual = extração de **guards/detectores determinísticos**, não de **agentes LLM especializados**. M17 F3 "Agent Profiles" é só prompt-override por funil, não roteamento.

---

## D4. Orquestrador / Routing — **3/10**

**Não existe camada de "router" antes do LLM.** O pipeline é uma cascata de checks determinísticos sequenciais no próprio `index.ts`:

1. R132 re-leitura DB (`incomingMessagesLoader`)
2. button reply handler (carrossel upsell)
3. `detectSaleClosed` → pending handoff
4. `detectObjection` → set_tags
5. `detectPayment` → answer inline
6. `detectBrand` → set_tags `marca_preferida`
7. `detectClientType` → set_tags `tipo_cliente`
8. `matchExcludedProduct` → early-return com handoff
9. Shadow mode branch (LLM call dedicado)
10. Greeting handler (sem LLM call)
11. Auto-extract fields (`autoExtractFields`)
12. R121 inline search (curto-circuita LLM)
13. R129 multi-interesse curto-circuito
14. Build system prompt (17 sections)
15. `callLLM` (LLM 1)
16. Tool round loop (até LLM 2-3)
17. Override pós-LLM (R130)
18. `validatorAgent` (PASS/REWRITE/BLOCK)
19. Send TTS/Text + persistir
20. Possible fallback handoff

Isso é uma **pipeline procedural**, não um orquestrador. Detectors (`detect*`) ficam "no caminho" e disparam side-effects (set_tags, handoff inline) sem decidir "qual subagente atende". Curto-circuitos crescem caso a caso — R121 inline search, R129 multi-interesse, sale_closed implicit handoff, excluded_products early-return — cada um adicionado em incidente diferente.

**Risco:** ordem dos checks importa silenciosamente. R128 (sale_closed false positive) provou que ter detector determinístico ANTES de qualif gera bugs. Não há config declarativa do pipeline; é tudo `if/else` em código de 4k linhas.

**Veredito:** "orquestração por sedimento". Funciona, mas a complexidade ciclomática cresce a cada nova regra e não há separação de "fase" (intent classify → route → executar → validar).

---

## D5. Contexto — **5/10**

**Contexto dinâmico por turno (`index.ts:1610-1641`, `dynamicContext`):**

- `leadContext` (resumo histórico, gerado fora) — opcional
- `campaignContext` (origem campanha/form/bio/funil) — opcional
- `LIMITE DE MENSAGENS: ${leadMsgCount}/${MAX_LEAD_MESSAGES}`
- Labels disponíveis + atuais
- **FATOS JÁ ESTABELECIDOS** (R121) — tags humanizadas (`material_mesa = plástico`)
- `blocked_topics`, `blocked_phrases`
- `outsideHoursContext` (R104, quando outside)
- `qualificationContext` (R103 — stage + próxima pergunta computada)
- `funnel_context` / `<form_data>` / `<bio_context>` quando aplicável

**Memória longa:** **nenhuma**. Não há `conversation_summaries`, nem RAG sobre histórico. Cada turn re-lê `conversation.tags` (jsonb na conv) + `last N msgs` direto. Knowledge base (FAQ + docs) embarcada inline a cada turn — `knowledgeInstruction` re-injeta TUDO.

**Rolling window:** **frágil**. `MAX_ACCUMULATED_INPUT_TOKENS=8192` só corta context APÓS toolRound ≥1 (`index.ts:3797`); 1º turn já passa pelo gateway sem cap. `contextMessages` traz histórico mas sem limite explícito — depende do upstream (debounce + webhook).

**Tokens médios de contexto por chamada:** estimo **8k-12k tokens** (5-8k system prompt + 2-4k history + 1-2k tool results). Bate o ceiling.

**Veredito:** contexto é "tudo a cada turn". Boa observabilidade via `ai_agent_logs` (44 INSERT em `index.ts`), mas custo crescente. Falta cache estável (system prompt poderia ser hash-cached pelo provider) e falta sumarização de histórico longo.

---

## D6. Tools & guards — **7/10**

**9 tools definidas (`index.ts:2096-2176`):**

| Tool | Guard | Local |
|------|-------|-------|
| `search_products` | `evaluateSearchGuard` (R126) | `_shared/searchGuard.ts` ✅ |
| `send_carousel` | — | inline (no separate guard) ⚠️ |
| `send_media` | — | inline ⚠️ |
| `assign_label` | label whitelist (`availableLabelNames`) | inline ✅ |
| `set_tags` | `validateSetTagsInput` (R127) + `VALID_KEYS` dinâmica (R84) + `interesse:` evidence check (Bug 19) + `interesse:` category regex check (Bug 12 parcial) | `_shared/setTagsValidator.ts` ✅ parcial |
| `move_kanban` | — | inline ⚠️ |
| `update_lead_profile` | — | inline ⚠️ |
| `handoff_to_human` | `evaluateHandoffGuard` (R124) | `_shared/handoffGuard.ts` ✅ |
| `send_poll` | inline (NUNCA numerar opções, 2-12 opções, char limits) | inline ⚠️ |

**Detectors determinísticos que rodam ANTES do LLM (não-tool):** `detectSaleClosed`, `detectObjection`, `detectPayment`, `detectBrand`, `detectClientType`, `matchExcludedProduct`, `autoExtractFields`, `matchAllCategoriesBySearchText`, `enrichOutsideHoursMessage`.

**Validator pós-LLM:** `validateResponse(text)` (`_shared/validatorAgent.ts`) — score 0-10, PASS/REWRITE/BLOCK. Roda em todo turn.

**Gaps:**
- `send_poll` não tem validador testável (regras inline)
- `move_kanban` aceita qualquer `column_name`; sem whitelist contra colunas reais
- `update_lead_profile` confia 100% no LLM (Bug 19 mostrou que LLM inventa)
- `send_carousel`/`send_media` não checam ownership do produto/asset

**Veredito:** os 2 tools de maior risco (handoff + set_tags + search) estão guardados. Resto ainda é "confia no LLM". `assign_label` está OK (whitelist via system_settings). Direção certa, mas 4/9 tools sem guard testável.

---

## Findings

### P0 — Risco alto, fix urgente
- **Inflação de prompt sem teto** — `hardcodedRules` 9.3 KB + qualif 2.3 KB + enrich 5 KB + 17 seções, sem refator. Cada bug fix adiciona texto. Atinge custo OpenAI + degrada LLM por dilution. **Ação:** extrair regras "if X then say Y" para validator/handler determinístico; deixar prompt só pra estilo/voz.
- **0 separação de responsabilidades dentro de `index.ts`** — 4.407 linhas, 12 paths de handoff, 17 seções de prompt no mesmo arquivo. Pre-commit hook 300 linhas IGNORA edge functions (não é vault). **Ação:** mover `buildQualificationContext`, `buildEnrichmentInstructions`, `buildQualificationChain`, `hardcodedRules` para `_shared/promptBuilder.ts` testável.

### P1 — Recidiva provável
- **`as any` em `geminiContents.__pendingQuestions`** (4 ocorrências, linhas 2087/3852/3858/3900/3916) — campo "secreto" anexado a array fora do tipo. Race condition latente em retries.
- **`(conversation as any)?.lead_msg_count`** (linhas 3222, 3240) — type loose; já causou bug schema mismatch antes (D20).
- **`(sub as any).whatsapp_forms?.name`** (linha 1117) — supabase join não tipado.
- **`MAX_ACCUMULATED_INPUT_TOKENS=8192` só corta após round ≥1** (linha 3797) — 1º turn pode ultrapassar livremente; sem early cap.
- **R134 ensinou: curto-circuito determinístico SEM guarda anti-loop** redispara a cada turn. Falta auditoria: quais `if (cond) { gravarEstado; }` no `index.ts` checam `if (!jaGravou)`? Não há varredura sistemática.

### P2 — Médio, tracked
- **Sub-agents legacy ainda no código** (`index.ts:1529-1555`) DEPRECATED por M17 F3 mas ainda compila e injeta texto extra no prompt quando `!profileData`. Remover quando todos os tenants migrarem.
- **`out_of_hours_message`** legado preservado no DB (`D32`) — campo morto, deve sair em migration de cleanup.
- **`buildValidTagKeys` cálculo a cada turn** — poderia ser memo por agent_id.
- **`send_poll`, `move_kanban`, `update_lead_profile` sem guard testável** — 3 tools rodando "no susto".
- **`broadcastEvent` fire-and-forget** sem retry/log — se Realtime cair, helpdesk não atualiza sem visibilidade.

### P3 — Cosmético/limpeza
- Comentários R-numerados (R84-R134) no código são úteis pra debug histórico mas saturam o arquivo (estimo 200+ ocorrências). Mover datas/contexto para git log + wiki.
- `TODOS` mencionado uma vez (linha 1739) é texto em pt-BR, não FIXME real — 0 dívida marcada explicitamente.
- 11 `as any` no arquivo (poderiam virar tipos do `types.ts`).

---

## Veredito final — **5.7/10**

| Dimensão | Nota |
|---|---|
| D1. Tamanho do prompt | 3/10 |
| D2. Funcionalidade | 6/10 |
| D3. Subagentes/Modularidade | 2/10 |
| D4. Orquestrador/Routing | 3/10 |
| D5. Contexto | 5/10 |
| D6. Tools & guards | 7/10 |
| **Média ponderada** | **~4.3/10** |
| **Ajustado por "está em prod, atende lead"** | **5.7/10** |

**Resumo:** sistema funciona, sustenta tráfego real, time já internalizou "guard determinístico > prompt" (R124-R134), mas a arquitetura é "monólito com sedimento de patches". Sem refator estrutural nas próximas 2-4 semanas, a curva de incidentes acelera (cada novo bug fix infla mais o prompt = mais lugares pra LLM errar = mais bugs).

---

## Próximas 5 ações recomendadas

1. **Extrair `hardcodedRules` (9.3 KB) → `_shared/promptRules.ts` testável** — categorizar as 25 regras em (a) cosmética/voz (mantém em prompt), (b) política (vai pra validator), (c) anti-alucinação (vai pra guard). Meta: prompt < 4 KB.
2. **Split `index.ts` em módulos por fase do pipeline** — `phase1-detectors.ts`, `phase2-pre-llm.ts`, `phase3-llm-call.ts`, `phase4-post-llm.ts`, `phase5-handoff.ts`. Reduz superfície HIGH RISK por mudança.
3. **Auditoria sistemática de curto-circuitos com gravação de estado** — varrer cada `if (cond) { set_tags / handoff / queue }` no `index.ts` e adicionar `!jaGravou` (R134 generaliza pra todos).
4. **Memoizar `VALID_KEYS`, `service_categories`, `agent_profile` por agent_id+versão** — hash-key no edge function; reduz CPU e custo de re-cálculo por turn.
5. **Sprint Agente Consultivo já aberta (2026-05-21) começa pelo lado certo:** detectar desconhecimento técnico do lead e explicar antes de qualificar. Mas tem que vir **junto** de um budget de refator: pra cada feature nova, 1 P0/P1 acima. Senão a próxima semana repete R124-R134 com nomes diferentes.
