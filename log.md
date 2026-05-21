---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-21 (madrugada III) — Plano Orquestrador + Subagentes documentado

**Trigger:** user pediu medições reais do prompt + plano orquestrador + o que falta.

**Medições reais (Eletropiso V2):** prompt assembled = **280-310 linhas / ~26 KB / ~6.500 tok**. 8 prompt_sections DB somam 182 lin; `hardcodedRules` sozinho = 24 lin / 9.348 chars (37% do total). Ideal: 4-8 KB. Hoje 3-4× acima.

**Plano 6 sem (3 sprints):** B (extrair hardcodedRules + strict mode + sub_agents reader + R134 sweep + split index.ts em 6 fases → prompt 150 lin), C (router gpt-5-nano + product_specialist POC + feature flag + E2E sandbox), D (qualification/handoff/objection/greeting specialists + migração 100%).

**Arquitetura alvo:** Guards TS pré → Router (gpt-5-nano ~300ms) → 1 dos 5 specialists (gpt-5-mini, ~30-70 lin) → Guards TS pós → Validator → Send.

**Docs:** `wiki/plano-orquestrador-subagentes.md` (parte 1: visão + Sprint B) + `-part2.md` (Sprint C+D+métricas). Refs cruzadas em index.md/CHANGELOG.md.

**Frase de retomada:** *"executar Sprint B do orquestrador 2026-05-21"*

---

## 2026-05-21 (madrugada II) — Sprint A da auditoria (v7.39.0)

**Trigger:** user pediu "executar Sprint A da auditoria 2026-05-21". Aprovou HIGH RISK em ai-agent/index.ts (com testes vitest) + deploy de edge fns ao final.

**Execução por ondas (1-5):**

- **Onda 9 (investigação):** MCP queries pra confirmar findings da auditoria. Descobriu que 3 P0s já estavam fechados (auditor sem MCP):
  - #2 EXCLUDE USING gist em handoff_queue_events: JÁ EXISTE (`handoff_queue_events_one_active_per_conv`)
  - #3 cron purge_notifications: JÁ EXISTE (`purge_notifications_hourly` jobid 36)
  - #4 known_brands: coluna nunca existiu; código usava só DEFAULT_BRANDS — bug fantasma

- **Onda 10 (DB migrations):** 3 migrations aplicadas via MCP + arquivos retroativos commitados:
  - `20260521200000_consolidate_ai_agent_logs_event_check.sql` — DROP `ai_agent_logs_event_check` (lista antiga 20 eventos), `chk_ai_agent_logs_event` (22) vira único
  - `20260521200001_extend_is_table_protected_sprint_a.sql` — whitelist +6 tabelas
  - `20260517000000_d34_conversations_resolved_at_retroactive.sql` — arquivo retroativo (coluna já existia em prod)

- **Onda 11 (requeue-conversations):** trocar `agent.out_of_hours_message` (legado D32 B30) por `agent.handoff_message_outside_hours` + `enrichOutsideHoursMessage` helper. Fallback pro legado preservado. Deploy v6.

- **Onda 12 (paridade lite):** JSDoc enganoso `agent.known_brands` removido de `brandDetection.ts` (feature nunca implementada). Rename de string em teste pra refletir realidade.

- **Onda 13 (HIGH RISK ai-agent):** escopo reduzido honestamente:
  - ✅ I3: fallback default `gpt-5-mini` em `_shared/llmProvider.ts` + `BrainConfig.tsx` UI (3 agents ativos com `model` setado → não afetados)
  - ✅ I2: novo `validateInteresseCategory` em `_shared/setTagsValidator.ts` + wire no handler `set_tags` em `ai-agent/index.ts:3145+` (chamado APÓS `aliasConfig` ser declarado). 9 testes novos — 23/23 PASS.
  - ⏸️ I1 (strict mode 9 tools): exige refator coordenado das 9 schemas (required arrays + null em opcionais). PR dedicado em Sprint B.
  - ⏸️ #4 (sub_agents → agent_profiles): exige entender M17 F3 fallback. Sprint B.
  - ⏸️ #9 (varredura curto-circuitos R134): horas de revisão caso-a-caso. Sprint B.

- **Onda 14 (pipeline):**
  - `npx tsc --noEmit`: 0 erros
  - `npx vitest run`: 863/875 PASS, 9 falhas pré-existentes (Deno-style + useForms + FormBuilder + excludedProducts — não relacionadas)
  - Deploy CLI: `requeue-conversations` v6 + `ai-agent` v74 ACTIVE com `verify_jwt:false`
  - Commit + push

**Resultados:**
- 8 P0s da auditoria: 7 fechados, 1 deferido (I1)
- 5 migrations: 3 aplicadas + 2 confirmadas já-existentes + 1 retroativa
- 2 edge fns deployadas
- 9 testes novos passando (validateInteresseCategory)

**Frase de retomada:** *"executar Sprint B da auditoria 2026-05-21"* (refator hardcodedRules + sub_agents migration + strict mode + varredura R134).

---

## 2026-05-21 (noite) — Auditoria completa 5 ondas paralelas + 30+20 melhorias

**Trigger:** user pediu auditoria 360° (projeto, DB, AI Agent, regras, prompts, paridade UI admin) + análise do agente em 5 pontos específicos (tamanho prompt, funcional, subagentes, orquestrador, contexto) com **nota 0-10 em cada** + research best practices + 30 sugestões gerais + 20 de inteligência (mirando migração pra GPT-5). Deploy = git push (sem deploy de edge function, é auditoria read-only).

**Execução:** 5 agentes paralelos (background, ~8min). Cada um escreveu seu wiki direto:
- Onda 1 DB (gsd-codebase-mapper) — `wiki/auditoria-2026-05-21-db.md` (288 lin)
- Onda 2 AI Agent (gsd-codebase-mapper) — `wiki/auditoria-2026-05-21-ai-agent.md` (229 lin)
- Onda 3 Prompts (gsd-codebase-mapper) — `wiki/auditoria-2026-05-21-prompts.md` (173 lin)
- Onda 4 Paridade (gsd-codebase-mapper) — `wiki/auditoria-2026-05-21-paridade.md` (275 lin)
- Onda 5 Research (general-purpose + WebSearch) — `wiki/auditoria-2026-05-21-research.md` (175 lin)

**Síntese (eu):** `wiki/auditoria-2026-05-21-veredito.md` (142 lin) + `wiki/auditoria-2026-05-21-melhorias.md` (167 lin).

**Nota oficial nos 5 pontos pedidos (sobre AI Agent):**
- Tamanho do prompt: **3/10** (catastrófico — 20-30 KB assembled, hardcodedRules 9.3 KB monolito, cresceu 3-4× em 30d)
- Funcional / está funcionando? **6/10** (10 incidentes em 14d, 4ª recidiva família Camada 3)
- Subagentes / prompts curtos? **2/10** (NÃO existem — 1 mega-LLM call faz tudo)
- Orquestrador / router? **3/10** (NÃO — pipeline procedural de detectors sedimentados)
- Contexto (memória longa, RAG)? **5/10** (contexto dinâmico OK, memória longa NULA)
- **Média ponderada: 3.8/10** → ajustado por "está em prod, time corrige rápido": **5.7/10**

**Nota geral (4 áreas):** DB 6.5 · AI Agent 5.7 · Prompts 5.2 · Paridade 7.2 · Maturidade 2026 4.0 → **5.9/10 global**

**Top-8 P0s (8 melhorias gerais críticas):**
1. Resolver CHECK constraints rivais em `ai_agent_logs.event` (R88 de novo — bloqueio silente de inserts dos eventos novos R126/R127)
2. `handoff_queue_events` sem `EXCLUDE USING gist` — promessa pós-incidente 9h não cumprida
3. Cron `purge_notifications_older` não existe — promessa não cumprida
4. Migrar leitor `sub_agents` → `agent_profiles` (M17 F3 migrou UI sem migrar reader)
5. `agent.known_brands` lido em `brandDetection.ts` mas coluna não existe no schema
6. Migrar `requeue-conversations` de `out_of_hours_message` (legado D32 B30) pra `handoff_message_outside_hours`
7. Commitar migrations retroativas D34 (`conversations.resolved_at`) + D35 (`service_categories.catalog_status`)
8. Inflação de prompt sem teto (`hardcodedRules` 9.3 KB precisa virar `_shared/promptRules.ts` testável)

**Top-4 P0s de inteligência (20 melhorias I1-I20):**
- I1 `strict: true` + `additionalProperties: false` em todas as 9 tool schemas (resolve R125-R127, sprint 2d)
- I2 enum dinâmica em `set_tags.interesse` derivada de `service_categories` (resolve Bug 12)
- I3 migrar `gpt-4.1-mini` → `gpt-5-mini` (custo neutro $6 vs $6.40/10k msgs, instruction following melhor)
- I4 extrair `hardcodedRules` (9.3 KB) → `_shared/promptRules.ts` (meta: prompt < 4 KB)

**Achado crucial sobre modelo:** user mencionou "GPT 5.4" — existe (lançado 2026-04-18) mas é **2.3× mais caro** que gpt-5-mini sem ganho relevante em chat WhatsApp. Flagship atual é **GPT-5.5** (2026-04-24). Recomendação: gpt-5-mini (research §1).

**3 Sprints recomendados:**
- Sprint A (1 sem) — fechar 8 P0s acumulados + I1/I2/I3 (strict + enum + migração modelo)
- Sprint B (1 sem) — refator estrutural: I4 (extract hardcodedRules) + I5 (XML blocks) + I7/I8 (lead_memory + conversation_summary)
- Sprint C+ (2-4 sem) — orquestrador: I13 (Router POC) + I14 (specialist product_search) + I15 (specialist handoff)

**Métricas target 90d:** prompt <8 KB (hoje 20-30), index.ts <2.000 lin (hoje 4.407), incidentes/14d <3 (hoje 10), args alucinados <0.1% (hoje ~3%).

**Frase de retomada:** *"executar Sprint A da auditoria 2026-05-21"*.

---

## 2026-05-21 (tarde) — R133+R134: regex overlap tintas + loop R129 (caso Branca, v7.38.8)

**Trigger:** print Branca (558781754008) — IA respondeu "Posso te ajudar com **tintas e vernizes**, impermeabilizantes e mantas e caixas d'água…" mesmo lead nunca pedindo tinta, e repetiu MESMA pergunta 2x.

**Auditoria via SQL (`supabase db query --linked`):**
- Conv 176f7c6f tags: `multi_interesse_pending:tintas,impermeabilizantes,caixas_dagua` (tintas fantasma)
- Logs `ai_agent_logs`: 2 `response_sent` idênticos `source=r129_multi_interesse_ask` confirmando loop
- Único overlap do banco: termo `impermeabilizante` em AMBAS regex `tintas` E `impermeabilizantes` (3 agents Eletropiso)

**R133 (regex DB overlap):** UPDATE jsonb idempotente em `ai_agents.service_categories` removendo `|impermeabilizante` da regex `tintas`. Aplicado nos 3 agents via `db query`. Migration `20260521120000_*.sql` versionada. Seed default em `_shared/serviceCategories.ts:95` também corrigido.

**R134 (loop R129):** guarda `!alreadyHasMultiPending` antes do curto-circuito em `ai-agent/index.ts:1771`. `buildQualificationContext` reforçado com 3 regras pra LLM lidar com resposta do lead: (a) escolha clara → set_tags 1 valor, (b) "ambos" → escolhe 1ª categoria e avisa, (c) vago → primeira da lista.

**Cleanup Branca:** removidas tags `multi_interesse_pending:...`, `interesse:tintas` (errado), `ambiente:interno` (errado). Só restou `marca_citada:fortlev`. Próxima msg re-processa limpo.

**Testes:** 6 novos em `serviceCategories.test.ts` (125/125 PASS). Cobertura: matchCategory, matchCategoryBySearchText, novo describe `matchAllCategoriesBySearchText` com caso Branca realista.

**Deploy:** `npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓

---

## 2026-05-21 (manhã II) — R132: IA ignorou transcrição de áudio (Edson EletropisoV2 v7.38.7)

**Bug ao vivo prod.** Lead Edson (558781302237) mandou "Bom dia" → "Edson" → áudio "Você tem a quartisolite rejunto pra piscina?". IA respondeu pergunta GENÉRICA "Edson, em que tipo de material ou produto…". User mandou print perguntando "pq o agente de ia nao respondeu a transcrição".

**Investigação:**
- Conv `353e5b4d-fe1c-4634-a38d-04ba1e90e912` — auditei `conversation_messages` + `ai_agent_logs`
- Bug: `ai-agent:308-322` lia só `m.content` do queue; áudio com content="" sumia em `.filter(Boolean)`
- 4º incidente família Camada 3 (R126 + C8 + R50 + R132). Causa comum: queue não captura estado real.

**Fix v7.38.7 (opção B re-leitura DB):** `_shared/incomingMessagesLoader.ts` (4 funções puras, 14 testes) + integração no `ai-agent/index.ts:308-340`. Deploy CLI v64. Detalhe completo: `CHANGELOG.md` v7.38.7. Renomeação R131→R132 por colisão com sessão paralela do phrasing.

**Frase de retorno**: "validar R132 áudio em prod 2026-05-21".

---

## 2026-05-21 (manhã) — R131 + (madrugada) R127/R128/R129/R130 — arquivado

> Movido para [[wiki/log-arquivo-2026-05-21-r127-r131]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: phrasing curto R131 (v7.38.6) + sessão E2E sandbox 4 bugs descobertos R127-R130 (v7.38.5, 9/10 cenários PASS).

---

## 2026-05-20 (noite III) — Fix R126: cross-categoria `search_products({query:"material"})` (v7.38.4)

**Bug em prod (Guttemberg, Eletropiso 558781592373, conv `529f51f8`).** Lead pediu "Porta em alumínio e janela em alumínio, só uma de 139" → IA respondeu com **carrossel de Telha de PVC R$62**. Cross-categoria absoluta.

**Investigação (logs DB):**
- 21:41:14 msg1 "Olá gostaria…material" → debounce processa → ai-agent envia greeting (21:41:33)
- 21:41:37 msg2 "Porta alumínio…" chega WEBHOOK enquanto ai-agent ainda roda LLM da msg1 → entra em queue separada
- 21:41:45 LLM da msg1 termina → `search_products({query:"material"})` → carrossel Telha PVC (único produto digital cadastrado tem "material" na desc)
- Log `response_sent` mostra `incoming_text="Olá gostaria…material"` + `message_count: 1` — confirma que LLM nunca viu "porta/janela/alumínio"

**Causa raiz tripla:**
1. Gap debounce (msg2 chegou entre greeting e LLM)
2. Query genérica escapa Bug 27 fix — `matchCategoryBySearchText("material")` não casa nenhuma das 24 regex → `expectedCategory=null` → `filterProductsByExpectedCategory` no-op
3. Categorias `portas`/`janelas` estão como `catalog_status:offline` mas LLM-driven search NÃO checa isso (só auto-extract `r121_*` checa)

**Fix v7.38.4 (Camadas 1+2):**
- `_shared/searchGuard.ts` (96 lin) com `evaluateSearchGuard()` — guard determinístico ANTES do query DB: recusa query genérica sem categoria + recusa categoria offline
- `_shared/searchGuard.test.ts` — 15 cenários incluindo repro EXATO Guttemberg
- `ai-agent/index.ts` integra helper após cálculo de `expectedCategory` (linha ~2204) + log estruturado `search_guard_blocked`
- Migration `20260520210000_*` adiciona `search_guard_blocked` ao CHECK constraint (R88: silent INSERT fail)

**Camada 3 (debounce gap) — backlog.** HIGH RISK (mexe em fluxo greeting→LLM), merece sprint próprio. Plano documentado: re-check `ai_debounce_queue` antes do LLM rodar + merge mensagens não-processadas + cancelar timer mergeado.

**Pipeline:**
- 15/15 testes PASS em `searchGuard.test.ts`
- typecheck 0 erros
- npm test: 817 pass / 9 falhas pré-existentes (intocadas, mesmo padrão R124/R125)
- Deploy `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v56 → v62 ACTIVE, `verify_jwt:false`

**Docs:**
- CHANGELOG v7.38.4
- erros-e-licoes — R126 (Top recente, antigas PostgREST/UAZAPI≠Business movidas pra historico)
- regras-preventivas — entrada R126
- log.md (este)

**Nota 0-10: 9/10.**
- Conteúdo: 10 (causa raiz tripla precisa via logs DB + queue + catálogo; helper testável + 15 cenários; doc completa)
- Orquestração: 9 (refactor `_shared/`, migration aplicada antes do código depender dela, vault healthcheck respeitado <300lin)
- Estado: 8 (Camadas 1+2 cobrem 90%; Camada 3 documentada como backlog. E2E real via WhatsApp não foi feito — user vai testar agora)

**Frase de retorno**: "continuar bug R126 Camada 3 debounce 2026-05-20".

---

## 2026-05-20 (noite II → tarde) — R124, R125, D36, prefixo nome — arquivado

> Movido para [[wiki/log-arquivo-2026-05-20-full]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: R125 badge fila OFF (v7.38.3), R124 handoff search_fail (v7.38.2), D36 permissões granulares + redesign Categorias (v7.38.0), prefixo `*Nome*` em msgs humanas (v7.37.21).


---

## 2026-05-19 — Migração Eletropiso v2 + DB Reset (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-19-eletropiso-reset]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: criação instância +558781592373 (aditiva, fila OFF, Lucas único assignee), clone integral do ai_agent (56 colunas), TRUNCATE 32 tabelas pré-migração com 0 erros.

---

## Histórico arquivado

- [[wiki/log-arquivo-2026-05-17-a-18-bugs]] — 2026-05-17 (noite) a 2026-05-18 (tarde): Bug 24 v4/v5, Bug 26+27, Bugs 29-32 handoff, R115/R116 fila.

---

## 2026-05-17 (noite) — Bug 24 fix exit_action auto-extract (v7.37.7) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug24-exit-action]] em 2026-05-20 (hard limit 300 linhas).

---

## 2026-05-17 (noite-inicio) — Bug 21+22 validator BLOCK (v7.37.6) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug21-22]] em 2026-05-18 (hard limit 300 linhas).

---

## 2026-05-17 (fim tarde) — Bug 19 IA alucina interesse:CAT (v7.37.5) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug19]] em 2026-05-18 (hard limit 300 linhas).

---


---

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-dashboard]] em 2026-05-14 (hard limit). Inclui Fase 1 (unificado), Fase 2 (métricas avançadas), Fase 3 (pivô comercial).

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |

## 2026-05-17 (tarde + fim tarde) — v7.37.0 a v7.37.4 — arquivado

D34 reabertura, Bug 13 auto-extract, Bug 15b out_of_hours, Bug 16 paths handoff, Bugs 17+18 venda fechada + anti-recumprimento, validação E2E bugs 17+18. Detalhe completo em [[wiki/log-arquivo-2026-05-17-tarde-bugs]].

---
