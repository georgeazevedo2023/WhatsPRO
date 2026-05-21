---
title: Plano Orquestrador + Subagentes — Sprint C + D + Métricas
tags: [orquestrador, subagentes, router, specialists, sprint-c, sprint-d, metricas]
sources: [plano-orquestrador-subagentes, auditoria-2026-05-21-research]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Plano Orquestrador — Parte 2 (Sprint C + D)

> Continuação de [[wiki/plano-orquestrador-subagentes]] (parte 1 = visão + Sprint B). Aqui: POC router + product_specialist + resto dos specialists + métricas alvo.

---

## 🧠 Sprint C (1-2 semanas) — POC Router + product_specialist

> Coexiste com monolito via feature flag durante validação. 100% rollback-able.

### C1 — Schema `ai_agent_runs` (trace por hop)

```sql
CREATE TABLE ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  turn_id UUID,
  hop_n INT NOT NULL,
  specialist TEXT NOT NULL,  -- 'router' | 'greeting' | 'qualif' | 'product' | 'handoff' | 'objection'
  intent TEXT,                -- output do router
  confidence NUMERIC,         -- 0-1
  model TEXT,                 -- gpt-5-nano | gpt-5-mini
  input_tokens INT, output_tokens INT,
  latency_ms INT,
  tools_called JSONB,
  prompt_chars INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON ai_agent_runs (conversation_id, created_at DESC);
```

**Por que:** debug imediato ("LLM ignorou regra X" → log mostra qual specialist + intent + tools). Métrica de hop loops.

### C2 — Router LLM (gpt-5-nano) — ~25 linhas, ~800 chars

```xml
<role>Você classifica a INTENÇÃO da última mensagem do lead em um sistema de
atendimento WhatsApp. Você NÃO responde ao lead — apenas roteia pra um specialist.</role>

<intents>
- saudacao: lead só cumprimentou ou disse o nome
- qualificacao: lead pediu produto sem detalhes / responde campo de qualif
- produto: lead pediu produto com detalhes / marca / pediu preço
- handoff: lead pediu falar com vendedor / sentimento muito negativo / venda fechada
- objecao: lead reclamou de preço, prazo, qualidade, comparou concorrente
- pagamento: pergunta sobre pix, parcelar, boleto, desconto
- fora_escopo: pergunta sem relação com vendas
</intents>

<context>
Tags atuais: {{conversation.tags}}
Última msg lead: {{last_incoming}}
Histórico curto (5 msgs): {{last_5_msgs}}
</context>

<output_schema strict>
{ "intent": <enum>, "confidence": 0-1, "reason": "1 frase" }
</output_schema>

<rules>
- Múltiplas intents? escolha a PRIMÁRIA
- confidence < 0.6 → roteie pra qualificacao (default seguro)
</rules>
```

**Latência alvo:** <500ms. **Custo:** ~$0.0001/turno.

### C3 — Feature flag `ai_agents.routing_mode`

```sql
ALTER TABLE ai_agents ADD COLUMN routing_mode TEXT
  CHECK (routing_mode IN ('monolith', 'router')) DEFAULT 'monolith';
```

Pipeline lê o flag, decide entre rota antiga e nova. Permite rollback instantâneo.

### C4 — Primeiro specialist: `product_specialist` (~60 linhas, ~3 KB)

```xml
<persona>{{agent_name}} — consultor de {{vertical}}</persona>

<task>
Lead qualificado pediu produto. Buscar no catálogo e enviar a melhor opção.
</task>

<rules>
- search_products PRIMEIRO. Sem opinar sobre produto sem buscar.
- Categoria esperada: {{expected_category}} (filtro hard via searchGuard).
- 1 produto = send_media (foto+preço). 2+ = send_carousel.
- Categoria offline → search_guard pula busca e handoff direto.
- Marca mencionada → search_products IMEDIATO (R121).
- Após search: se 0 resultados, entre em enrichment (1 pergunta extra).
- NUNCA diga "não temos" — validator bloqueia.
</rules>

<tools strict>
- search_products (enum category derivada de service_categories)
- send_carousel
- send_media
- set_tags
- update_lead_profile
</tools>

<catalog_summary>{{categories_with_count}}</catalog_summary>
<facts_collected>{{tags_humanizadas}}</facts_collected>
```

**Por que primeiro:** tools bem definidas, guards já existem (searchGuard, filterProductsByExpectedCategory), R126 mostrou maior risco isolado.

### C5 — Hop guard (anti-loop)

- Máx 2 hops: `router → specialist → done`
- Specialist NÃO chama router (sem A→B→A)
- Hop counter no metadata
- Loop detectado → fallback monolith + log + alerta gestor

### C6 — E2E sandbox (10 cenários)

Reaproveitar 10 jornadas R127-R130 (sandbox 558185749970 → EletropisoV2). Cada cenário roda em monolith E router. Comparativo:
- Latência E2E (P50/P95)
- Tools chamadas corretas?
- Validator score
- Custo/conversa
- Qualidade resposta (humano avalia 1-5)

**Critério go/no-go:** router ≥ monolith em qualidade E ≤ 2× em latência.

### C7 — Métricas (dashboard admin "Roteamento")

- Distribuição de intents (pizza)
- Latência por specialist (P50/P95)
- Custo médio por conversa
- Taxa de hop loops (alerta se > 1%)
- Accuracy do router (humano sample 20 por dia)

### Subtotal Sprint C

**Esforço:** 8-10 dias (2 semanas)
**Saída:** 1 specialist (product) rodando atrás de router em feature flag. 100% rollback-able.

---

## 🚀 Sprint D (1-2 semanas) — Resto dos specialists

### D1 — `qualification_specialist` (~70 linhas)

Mais complexo. Lê `qualificationContext` computado, conhece 24 categorias, decide próxima pergunta. Reusa `validateInteresseCategory` (Sprint A) + `setTagsValidator`. Tools: `set_tags`, `update_lead_profile`.

### D2 — `handoff_specialist` (~40 linhas)

Business hours + extended_hours + queue assignment via `runQueueAssignment`. Reusa `handoffGuard` + `pickHandoffMessage` + `enrichOutsideHoursMessage`. Tools: `handoff_to_human`, `send_poll` (NPS).

### D3 — `objection_specialist` (~50 linhas)

Empatia primeiro + business_info pricing. 2+ objeções → handoff. Tools: `set_tags(objecao:tipo)`, `handoff_to_human`.

### D4 — `greeting_specialist` (~30 linhas)

Substitui handler hardcoded atual (`index.ts:1465+`). Greeting + returning + name capture. Tools: `set_tags(lead_name:)`.

### D5 — Migração 100%

Feature flag default `routing_mode='router'`. Monitora 7d. Se métricas OK, atualiza todos os agents em massa.

### D6 — Deprecate monolith

Após 30d sem rollback: remove path do `index.ts`, drop column `routing_mode`, drop legacy `sub_agents`. Refator final.

### Subtotal Sprint D

**Esforço:** 8-10 dias
**Saída:** Arquitetura 100% router. Monolito removido.

---

## 🎯 Métricas-alvo pós-Sprint D (90 dias)

| Métrica | Hoje | Target 90d | Como medimos |
|---|---|---|---|
| Prompt assembled (KB) | 26 | **<8 por specialist** | medição direta |
| `ai-agent/index.ts` lin | 4.407 | **<800** (orquestra fases) | wc -l |
| Incidentes/14d | 10 | **<3** | wiki/erros-e-licoes |
| Args alucinados | ~3% | **<0.1%** | strict mode + audit log |
| Latência P50 (s) | 1.5 | **<2.5** | ai_agent_runs |
| Custo/conversa ($) | 0.002 | **<0.004** | ai_agent_runs aggregação |
| Cobertura audit log | 0% | **100%** | toda hop em ai_agent_runs |
| Sessões > 24h preservadas | 0% | **100%** | lead_memory (futuro Sprint E) |
| Tabelas mortas | 7-9 | **0** | types.ts drift = 0 |

---

## 📅 Ordem operacional recomendada

```
Hoje  →  Sprint B (2 sem)  →  Sprint C (2 sem)  →  Sprint D (2 sem)
                                    ↑
                                    POC com feature flag —
                                    100% rollback-able
```

**Total:** 6 semanas. Cada Sprint é entregável independente (mesmo se parar em B, ganha 45% redução no prompt).

---

## 🔗 Links

- [[wiki/plano-orquestrador-subagentes]] — parte 1 (visão + Sprint B)
- [[wiki/auditoria-2026-05-21-veredito]] · [[wiki/auditoria-2026-05-21-melhorias]] · [[wiki/auditoria-2026-05-21-research]]

**Frase de retomada:** *"executar Sprint B do orquestrador 2026-05-21"*
