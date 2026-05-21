---
title: Auditoria 2026-05-21 — Veredito Geral + Notas Oficiais
tags: [auditoria, veredito, notas, ai-agent, db, prompts, paridade, research]
sources: [auditoria-2026-05-21-db, auditoria-2026-05-21-ai-agent, auditoria-2026-05-21-prompts, auditoria-2026-05-21-paridade, auditoria-2026-05-21-research]
updated: 2026-05-21
audited_at: 2026-05-21
overall_grade: 5.9/10 — funciona em prod mas em rota de colapso estrutural
---

# Veredito Geral — Auditoria 2026-05-21

> Síntese das 5 ondas paralelas: DB, AI Agent core, prompts/regras, paridade UI↔backend, research. Notas oficiais nos 5 pontos pedidos + 4 áreas de saúde. **Sem mudanças de código nesta sessão** — só auditoria + documentação. Próximos passos em [[wiki/auditoria-2026-05-21-melhorias]].

## Sumário executivo (TL;DR)

WhatsPRO funciona em prod e sustenta tráfego real, mas a curva de incidentes do AI Agent (R124-R134, **10 fixes em 14 dias**) é regressão sistêmica, não bug isolado. O prompt assembled chegou em **~20-30 KB / 5-8k tokens**, `ai-agent/index.ts` em **4.407 linhas / 268 KB**. Cada fix vira novo texto no prompt OU novo guard inline — o LLM tem **menos espaço, mais ruído, e o time confia cada vez menos nele** (override pós-LLM R130, curto-circuita antes da chamada R129). Direção certa, arquitetura errada: **monolito com sedimento de patches**, sem orquestrador, sem subagentes especializados, sem memória longa, prompt e código órfãos (`sub_agents`, `out_of_hours_message`, `known_brands`) ainda em produção.

DB tem 4 P0s (constraints rivais R88, promessas pós-incidente 9h não cumpridas, drift D34/D35 não commitado). Paridade UI↔backend é 7.2/10 com 3 vazamentos write-only/read-only e 1 leitura de coluna inexistente. Research diz: **gpt-5-mini é custo-neutro vs gpt-4.1-mini** (migração de 1 linha), **`strict:true` em tool schemas elimina R125-R127**, e **router pattern com gpt-5-nano + 3 specialists** é a próxima arquitetura.

**Nota geral: 5.9/10** — funcional, fundações OK, mas P0s acumulados + arquitetura monolítica vão estourar em 30-60 dias se não houver sprint de refator.

---

## Notas oficiais nos 5 pontos pedidos (sobre o AI Agent)

| Ponto | Nota | Veredito (1 linha) |
|---|---|---|
| **1. Tamanho do prompt** | **3/10** | Catastrófico — 17 seções, 20-30 KB assembled, `hardcodedRules` 9.3 KB monolito, cresceu ~3-4× em 30 dias sem refator. |
| **2. Funcional / está funcionando?** | **6/10** | Funciona, mas 10 incidentes em 14 dias (R124-R134) + 4ª recidiva família Camada 3 (R132 áudio) = regressão sistêmica. |
| **3. Trabalha com subagentes (prompts curtos especializados)?** | **2/10** | NÃO. 1 único `callLLM` com mega-prompt + 9 tools. Helpers `_shared/` são determinísticos, não agentes LLM. M17 F3 "Profiles" é só prompt override, não roteamento. |
| **4. É orquestrador (router/intent classify antes do LLM)?** | **3/10** | NÃO. Pipeline procedural de detectors + curto-circuitos sedimentados caso a caso. Cada incidente adicionou um `if` novo. |
| **5. Tem contexto (memória longa, RAG, sumário)?** | **5/10** | Contexto dinâmico OK (tags, qualif, funnel) mas memória longa NULA. Re-injeta tudo a cada turno. Sem `conversation_summaries`. Sem RAG. Sliding window cega após 10 msgs. |

**Média ponderada dos 5 pontos: 3.8/10**

Ajustado por "está em prod, atende lead, time corrige rápido": **5.7/10** (espelho da nota da Onda 2).

---

## Notas de saúde por área

| Área | Nota | Origem |
|---|---|---|
| **DB / Schema** | **6.5/10** | Onda 1 — 4 P0s + drift D34/D35 + wiki banco-de-dados.md stale 10d |
| **AI Agent core** | **5.7/10** | Onda 2 — 4.407 lin, prompt inflado, sem orquestrador |
| **Prompts & Regras** | **5.2/10** | Onda 3 — média N1-N5 (modular 6, configurável 5, conflitos 5, few-shot 3, det vs prompt 7) |
| **Paridade UI ↔ Backend** | **7.2/10** | Onda 4 — 3 paths divergentes + 1 leitura sem coluna |
| **Maturidade em best-practices 2026** | **4/10** | Onda 5 — sem `strict:true`, sem router, sem memória hierárquica, sem audit log estruturado |

**Nota global: 5.9/10**

---

## Bugs e inconsistências consolidados (top-20)

### 🔴 P0 — críticos, fixar primeiro

1. **Dois CHECK constraints rivais em `ai_agent_logs.event`** — `ai_agent_logs_event_check` (canônico) e `chk_ai_agent_logs_event` (ressuscitado em 2026-05-20) coexistem. As 3 migrations recentes só atualizam o segundo, deixando o primeiro BLOQUEANDO inserts de `search_guard_blocked`, `set_tags_duplicate_keys_rejected`, `marca_preferida_hallucination_blocked`. Observabilidade dos fixes R126/R127/etc está cega. (R114 de novo)
2. **`handoff_queue_events` sem `EXCLUDE USING gist`** — promessa pós-incidente 2026-05-14 (banco explodiu 50→116 MB em 9h) nunca foi shipada. Só defesa em código.
3. **`purge_notifications_older` cron não existe** — outra promessa do mesmo incidente. Sem retention; próximo loop pode acumular GB.
4. **`agent.known_brands` lido em `brandDetection.ts:13` mas coluna NÃO existe no schema** — detecção de marca silenciosamente cai no fallback. (Onda 4)
5. **`sub_agents` ainda lido no backend** (`ai-agent/index.ts:1532`, `ai-agent-playground:67`) **mas substituído por `agent_profiles` na UI**. M17 F3 migrou UI sem migrar leitor.
6. **`out_of_hours_message` removido da UI (B30)** mas `requeue-conversations:225/234/240` ainda lê. Half-removed.
7. **Inflação de prompt sem teto** — `hardcodedRules` 9.3 KB + qualif 2.3 KB + enrich 5 KB + 17 seções. Cada bug adiciona texto. Custo OpenAI cresce + LLM degrada por dilution.
8. **`ai-agent/index.ts` 4.407 linhas, 12 paths de handoff, 17 seções de prompt no mesmo arquivo.** Pre-commit hook 300-line IGNORA edge functions. Manutenção HIGH RISK em todo PR.

### 🟠 P1 — recidiva provável

9. **Drift D34/D35** — `conversations.resolved_at` (D34) e `service_categories.catalog_status` (D35) existem no DB mas migrations correspondentes NÃO estão em `supabase/migrations/`. `supabase db reset` quebra dev local.
10. **R134 generaliza: curto-circuitos sem guarda anti-loop** — não houve varredura sistemática nos `if (cond) { gravarEstado; }` do `index.ts`. Próximo R-bug é só questão de tempo.
11. **`extraction_address_enabled` write-only** — UI seta, grep no backend retorna 0 leituras. Admin pensa que liga feature mas ninguém ouve.
12. **`tts_fallback_providers` read-only** — backend lê, UI NÃO tem editor. Admin precisa editar DB direto.
13. **`handoff_negative_sentiment` é dead field** — no ALLOWED_FIELDS, sem UI, sem backend reader. Coluna NOT NULL ocupando espaço.
14. **`UPDATE ai_agents` no AIAgentTab sem audit log** — toda mudança crítica (model, system_prompt, validator, blocked_phrases) não fica em `admin_audit_log`. Debug pós-incidente impossível.
15. **11 `as any` no `ai-agent/index.ts`** + `__pendingQuestions` campo "secreto" anexado a array fora do tipo. Race condition latente.
16. **`MAX_ACCUMULATED_INPUT_TOKENS=8192` só corta após round ≥1** — 1º turn pode ultrapassar livremente.
17. **Wiki `wiki/banco-de-dados.md` 10 dias stale + projeto antigo** (`wspro_v2` vs `prfcbfumyrrycsrcrvms`).
18. **`phrasingDiscipline` exemplo literal cross-domain** — "marca (Lorenzetti, Hydra)" hardcoded vaza pra tinta. (Bug 11 família)
19. **7-9 tabelas mortas em `types.ts`** (`keep_alive`, `intent_detections`, `media_library`, `playground_*`, `validator_logs`, `lead_memory`, `pending_responses`) — overhead TS + risco RLS frouxa.

### 🟡 P2 — médio

20. **Tabs `setup`, `prompt`, `intelligence`, `security`, `channels` sem feature_key D36** — gerente edita `system_prompt`, `model`, `temperature` livremente. Botão "Excluir agente" sem guard.

(Mais 30+ findings P2/P3 em [[wiki/auditoria-2026-05-21-melhorias]] e nos 4 wikis técnicos das ondas.)

---

## O que está bom (não tudo é problema)

- ✅ **Pipeline determinístico extraído pra `_shared/`** — 7 guards testáveis nasceram em incidentes (handoffGuard, searchGuard, setTagsValidator, etc). Direção certa.
- ✅ **RLS habilitada na maioria das 89 tabelas** + FKs com `ON DELETE` apropriados.
- ✅ **D30 Fila Inteligente** 8/8 sprints completos com testes (715 vitest).
- ✅ **D36 Permissões granulares** F1 entregue (5 features OK).
- ✅ **Dashboard Gestor** unificado em 4 zonas (Fases 1+2+3 shipped 2026-05-11).
- ✅ **Retention pipeline** existe (M19 S8) — `db_retention_policies` + cron weekly.
- ✅ **Cron de saúde do banco** rodando + alertas 60/70/85%.
- ✅ **Validator agent** roda em todo turn com PASS/REWRITE/BLOCK.
- ✅ **Paridade ALLOWED_FIELDS** alta (45/61 cobertos, 0 dead references).

---

## Comparativo com 30 dias atrás (auditoria 2026-04-27)

| Métrica | 2026-04-27 | 2026-05-21 | Δ |
|---|---|---|---|
| `index.ts` linhas | ~3.300 | **4.407** | +33% |
| Prompt assembled (KB) | ~12-15 | **20-30** | +50-100% |
| Guards em `_shared/` | 3 | **7** | +133% (positivo) |
| Incidentes registrados (14d) | 5 | **10** | +100% |
| Nota AI Agent | 6.5 | **5.7** | -0.8 |

Direção: guards crescendo (bom) **mas mais lento** que prompt+`index.ts`. Time corre atrás de cada bug com patch, sem refator estrutural.

---

## Veredito final

WhatsPRO está em **dívida técnica acelerada no AI Agent**. As fundações (DB, paridade, infra de guards, RLS, retention) são sólidas. O problema é arquitetural:

1. **Sem orquestrador** = todo comportamento mora num `if` no `index.ts` gigante.
2. **Sem subagentes** = LLM único tenta fazer tudo com mega-prompt — falha por dilution, time compensa com guards inline, prompt incha, ciclo se repete.
3. **Sem memória longa** = sessão de 3 dias o lead "renasce". Tags ajudam mas perdem nuance.
4. **Sem audit estruturado das regras** = "o LLM seguiu a regra?" só dá pra responder olhando log bruto.
5. **Sem strict mode + enums** = R125-R127 vão se repetir com nomes diferentes.

**Os 5 pontos pedidos pelo usuário batem nessa raiz comum:** prompt grande porque não tem subagente; não tem subagente porque não tem orquestrador; contexto fraco porque memória é o queue do turno.

**Recomendação operacional:** próximas 2 sprints (4 semanas) precisam **80% refator, 20% feature**. P0s 1-8 acima são pré-requisito. Em paralelo, POC do router pattern + migração gpt-5-mini (custo-neutro, ganho de qualidade).

---

## Próximos artefatos

- [[wiki/auditoria-2026-05-21-melhorias]] — 30 melhorias gerais + 20 melhorias de inteligência priorizadas
- [[wiki/auditoria-2026-05-21-db]] — detalhe técnico DB
- [[wiki/auditoria-2026-05-21-ai-agent]] — detalhe técnico AI Agent
- [[wiki/auditoria-2026-05-21-prompts]] — detalhe técnico prompts
- [[wiki/auditoria-2026-05-21-paridade]] — detalhe técnico paridade
- [[wiki/auditoria-2026-05-21-research]] — best practices 2026

**Frase de retomada:** *"executar fixes P0 da auditoria 2026-05-21"*.
