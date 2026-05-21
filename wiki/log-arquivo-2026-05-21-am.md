---
title: Log arquivado — 2026-05-21 madrugada (Plano Orquestrador + Sprint A + Auditoria)
tags: [log-arquivo, 2026-05-21, sprint-a, auditoria, plano-orquestrador]
description: Sprint A executada (v7.39.0) + Auditoria 360° (5 ondas paralelas, 30+20 melhorias) + Plano Orquestrador (parte 1+2 documentadas). Movido de log.md 2026-05-21 (hard limit 300 lin).
updated: 2026-05-21
audited_at: 2026-05-21
---

# Log arquivado 2026-05-21 (madrugada I → manhã)

> Histórico cronológico das sessões da madrugada/manhã 2026-05-21. Movido em 2026-05-21 (hard limit log.md). 3 sessões: noite (auditoria) → madrugada II (Sprint A) → madrugada III (Plano Orquestrador).

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
