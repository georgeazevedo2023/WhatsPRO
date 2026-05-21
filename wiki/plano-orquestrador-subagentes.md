---
title: Plano Orquestrador + Subagentes — Visão + Sprint B
tags: [orquestrador, subagentes, router, specialists, ai-agent, sprint-b, refator, prompt-size]
sources: [auditoria-2026-05-21-veredito, auditoria-2026-05-21-melhorias, auditoria-2026-05-21-research, auditoria-2026-05-21-ai-agent]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Plano Orquestrador + Subagentes — Parte 1

> Saída consolidada de 2026-05-21: planejamento da transição **monolito → router + 5 specialists**. Sprint A já fechou pré-requisitos (I2, I3, gpt-5-mini). Sprint B prepara terreno; Sprint C+D em [[wiki/plano-orquestrador-subagentes-part2]].

---

## 📊 Estado atual vs alvo

| | Hoje (monolito) | Sprint B (enxuto) | Sprint C+D (orquestrador) |
|---|---|---|---|
| Linhas prompt principal | **280-310** | ~150 | router 25 + specialist 30-70 |
| Tamanho assembled | ~26 KB / 6.5k tok | ~12 KB / 3k tok | router ~800 ch + specialist 3-5 KB |
| LLM calls por turno | 1 mega + 1 validator | 1 enxuto + 1 validator | 2 (router + specialist) + 1 validator |
| Latência típica | 1-3s | 1-3s | 1.5-4s (+1 hop) |
| Custo/conversa | $0.001-0.003 | mesmo | +50% (~$0.0015-0.004) |
| Args alucinados | ~3% | <1% (I2 ativo) | <0.1% (strict mode) |
| Debug "LLM ignorou X" | "não sei" | "não sei" | log mostra specialist + intent |
| Incidentes /14d | 10 | esperado 3-5 | esperado <3 |

### Composição atual do prompt (Eletropiso V2)

| Componente | Linhas | Chars |
|---|---|---|
| sdr_flow | 44 | 3.280 |
| tags_labels | 32 | 1.870 |
| absolute_rules | 27 | 1.333 |
| handoff_rules | 27 | 1.326 |
| objections | 21 | 1.015 |
| product_rules | 17 | 946 |
| identity | 13 | 594 |
| additional | 1 | 1.095 |
| **Subtotal 8 sections DB** | **182** | 11.459 |
| `hardcodedRules` | 24 | **9.348** ❌ |
| qualificationContext (computed) | ~25 | ~1.500 |
| dynamicContext | ~20 | ~1.000 |
| businessSection + leadContextBlock + outsideHours + suffix | ~20 | ~1.500 |
| **Total prompt assembled** | **~280-310** | **~26.000** |

---

## 🛠️ Sprint B (1-2 semanas) — Pré-requisitos do orquestrador

> **NÃO pular pra Sprint C sem fechar B.** Senão cada specialist herda os mesmos 9 KB de `hardcodedRules`.

### B1 — Extrair `hardcodedRules` (9.3 KB) ⚡ MAIOR IMPACTO ✅ SHIPPED v7.40.0 (2026-05-21)

**Resultado real:** **-89,98% no prompt** (9.348 → 937 chars / ~-2.100 tokens/turno). 5 agentes paralelos + 1 auditor. 10 arquivos tocados. +50 testes novos todos pass. Deploy de edge fn pendente de aprovação. **Edit 3 (searchGuard PRÉ-LLM wire) pulado** — defer Sprint B5 após split do index.ts. Detalhe em [[CHANGELOG.md]] e [[log.md]].

**Hoje:** `ai-agent/index.ts:1644-1668` — 24 linhas que viram string única com 23 bullets no prompt. Não-configurável, cresceu por bug fix.

**Categorização das 23 regras:**

| Categoria | Quantidade | Destino |
|---|---|---|
| **Anti-alucinação** (NUNCA dizer "não temos", NUNCA inventar produto, NUNCA expor erro) | 4 regras | **`_shared/promptRules.ts`** + validator pós-LLM rejeita |
| **Qualif** (LEIA toda msg, NUNCA repita pergunta, NUNCA ecoar) | 5 regras | Mantém no prompt (~5 linhas concisas) |
| **Técnico** (search ANTES de handoff, marca → search imediato, R121) | 6 regras | **Guards determinísticos** ampliados (searchGuard + handoffGuard) |
| **Anti-recumprimento, anti-eco** (Bug 17, Bug 19) | 3 regras | **Validator** detecta + rejeita |
| **Pagamento ≠ handoff, info não cadastrada → handoff** | 2 regras | Mantém no prompt (~2 linhas) |
| **Nome do lead, profissão set_tags** | 3 regras | Mantém no prompt (~3 linhas) |

**Target:** ~10 linhas no prompt (só voz/tom) + resto em código testável. Reduz **~7 KB do prompt**.

**Esforço:** L (3-4 dias). Risco: regressão se LLM perder regras. Mitigação: validator pós-LLM como rede.

### B2 — Strict mode em 9 tool schemas

**Hoje:** `_shared/llmProvider.ts:77-80` envia tools sem `strict: true`. Args alucinados ~3%.

**Mudanças:**
- Adicionar `strict: true` em cada tool function
- Adicionar `additionalProperties: false`
- Todos os args em `required[]`
- Opcionais → tipo union `["string", "null"]`

**Tools alinhadas (já têm required completo):** `assign_label`, `set_tags`, `move_kanban`, `handoff_to_human`.
**Tools desalinhadas (precisam refator):** `search_products`, `send_carousel`, `send_media`, `update_lead_profile`, `send_poll`.

**Pré-requisito:** `gpt-5-mini` (Sprint A ✅).

**Esforço:** M (2 dias). Esperado: alucinação **3% → <0.1%**.

### B3 — Migrar leitor `sub_agents` → `agent_profiles`

**Hoje:** `ai-agent/index.ts:1532` e `ai-agent-playground:67` leem `agent.sub_agents` (jsonb legado). UI já migrou (M17 F3) mas reader nunca migrou.

**Mudanças:**
- Buscar perfil ativo via `agent_profiles WHERE agent_id=X ORDER BY position LIMIT 1`
- Fallback se nenhum: comportamento padrão (sem profile override)
- Drop coluna `sub_agents` após 1 sprint sem regressão

**Esforço:** M (1-2 dias). Pré-req pros specialists (cada um pode ter profile próprio).

### B4 — Varredura curto-circuitos R134

**Hoje:** R134 ensinou que `if (cond) { gravarEstado; }` sem `!jaGravou` redispara. Sem varredura sistemática.

**Tarefa:** ripgrep `set_tags|set_status_ia|broadcastEvent|notifyGestores` em `index.ts` → mapear cada chamada → classificar: (a) tem guard, (b) precisa guard, (c) idempotente por design.

**Saída:** tabela + plano de fix caso-a-caso.

**Esforço:** M (1-2 dias).

### B5 — Split `index.ts` em fases

**Hoje:** 4.407 linhas, 12 paths de handoff, 17 seções de prompt no mesmo arquivo.

**Mudanças:**
- `phase1-detectors.ts` — detectors pré-LLM (saleClosed, brand, objection, payment, clientType, excludedProducts)
- `phase2-pre-llm.ts` — autoExtract, R121 inline search, R129 multi-interesse, R132 re-leitura
- `phase3-prompt-build.ts` — construção das seções
- `phase4-llm-call.ts` — callLLM + tool round loop
- `phase5-post-llm.ts` — override R130, validator, send
- `phase6-handoff.ts` — runQueueAssignment, fallback handoff
- `index.ts` vira **<300 linhas** — só orquestra as fases

**Esforço:** L (3-4 dias). Pré-req pro Sprint C: sem split, refator pra extrair specialists é HIGH RISK.

### Subtotal Sprint B

**Esforço:** 8-12 dias (2 semanas)
**Saída:** prompt assembled ~150 lin (-45%), index.ts <300 lin, alucinação <0.1%, hardcodedRules em código testável.

---

## 🔗 Próxima parte

- [[wiki/plano-orquestrador-subagentes-part2]] — Sprint C (Router + product_specialist POC) + Sprint D (resto dos specialists) + Métricas alvo 90d

## 🔗 Links

- [[wiki/auditoria-2026-05-21-veredito]] — síntese 5.9/10 + notas oficiais
- [[wiki/auditoria-2026-05-21-melhorias]] — 30+20 melhorias priorizadas
- [[wiki/auditoria-2026-05-21-ai-agent]] — detalhe técnico AI Agent 5.7/10
- [[wiki/auditoria-2026-05-21-prompts]] — detalhe 24 regras hardcoded
- [[wiki/auditoria-2026-05-21-research]] — best practices 2026

**Frase de retomada:** *"executar Sprint B do orquestrador 2026-05-21"* — começa com B1 (extrair hardcodedRules) que sozinho corta prompt em 30%.
