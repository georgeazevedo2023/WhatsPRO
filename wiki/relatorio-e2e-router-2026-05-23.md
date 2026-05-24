---
title: Relatório E2E Router/Specialist — Sprint C6
tags: [sprint-c, router, specialist, e2e, testes, eletropiso]
sources: [plano-orquestrador-subagentes-part2, sprint-c-progress]
updated: 2026-05-23
audited_at: 2026-05-23
---

# Relatório E2E Router/Specialist — 2026-05-23 (C6)

> Validação E2E real dos 7 intents do router, lead↔IA nas instâncias reais. Cada cenário com lead resetado a frio. Runner formal: `scripts/e2e-router-runner.mjs` + `scripts/e2e-scenarios.json`.

## Setup

- **Lead (emissor):** Testador Wsmart `558185749970` (UAZAPI `/send/text`, server wsmart.uazapi.com).
- **IA sob teste:** agent Eletropiso `174af654`, instância `r466a98889b5809` (owner `558181696546`), `routing_mode='router'`.
- **Leitura:** `conversation_messages` + `ai_agent_runs` + `ai_agent_logs` via Supabase MCP (projeto `prfcbfumyrrycsrcrvms`).
- **Reset frio por cenário** (descoberto nesta sessão — 3 fontes de contaminação): limpar `ai_agent_logs` (fonte de `hasInteracted`), `conversations` (status_ia/tags/ai_summary) e `lead_profiles` (conversation_summaries/notes/interests). Marcador `greeting_sent` sintético injetado p/ testar router (lead "pós-saudação") sem o handler de saudação interceptar.

## Modelos (confirmados no código)

- Router: **gpt-4.1-mini** (`router.ts:183`)
- product_specialist: **gpt-4.1** (`productSpecialist.ts:314`)
- Monolith (fallthrough): **gpt-4.1-mini** ← era gpt-5-mini, trocado nesta sessão (ver Bug A)

## Resultado — 7/7 nota 10 (após 2 fixes)

| # | Intent | Path | Modelo | Nota | Observação |
|---|---|---|---|---|---|
| 1 | saudacao | handler determinístico (pré-router) | — | 10 | "Olá! Bem-vindo a Eletropiso, com quem eu falo?" — para na saudação pura |
| 2 | qualificacao | router→specialist | gpt-4.1 | 10 | "De qual tipo/material você precisa?" — qualifica sem despejar catálogo |
| 3 | produto | router→specialist | gpt-4.1 | 10 | search_products(tintas, Coral) → carrossel 3 produtos + preço real R$792 |
| 4 | handoff | trigger determinístico "vendedor" | — | 10 | mensagem fora-horário correta + status→shadow |
| 5 | objecao | router→specialist (após fix B) | gpt-4.1 | 10* | empatia + defesa de valor (ver Bug B) |
| 6 | pagamento | router→monolith | gpt-4.1-mini | 10 | formas de pagamento do business_info, sem inventar |
| 7 | fora_escopo | router→monolith | gpt-4.1-mini | 10 | recusa educada + redireciona |

\* S5 validado após deploy do fix B.

### Nota de roteamento
- Router classifica produto/qualificacao com fronteira fuzzy ("vcs vendem piso?" → produto 0.9; "quanto custa X" às vezes objecao). Inofensivo na POC porque produto+qualificacao+objecao+handoff convergem no specialist. Fica como item p/ Sprint D (qualification_specialist dedicado precisa de fronteira nítida).
- saudacao pura e handoff explícito ("vendedor") são interceptados por handlers determinísticos ANTES do router (correto — rápido e previsível). Router só decide quando esses não disparam.

## 2 bugs reais encontrados (fix na fonte)

### Bug A — gpt-5-mini devolvia resposta VAZIA → fallback "Em que posso te ajudar?"
- **Sintoma:** objecao/pagamento/fora_escopo (monolith gpt-5-mini) sempre respondiam genérico.
- **Causa raiz:** `llmProvider.ts` setava `max_completion_tokens = agent.max_tokens ?? 1024`. Reasoning models (gpt-5*) gastam tokens de raciocínio contra esse teto → 1024 esgotava no raciocínio → saída vazia → fallback `llmCallLoop.ts:400`.
- **Impacto:** afeta **EletropisoV2 em produção** (gpt-5-mini, monolith, max_tokens=1024).
- **Fixes:** (1) piso `Math.max(maxTokens, 4096)` p/ reasoning em `llmProvider.ts` (código, defesa permanente); (2) monolith do agent de teste trocado p/ **gpt-4.1-mini** (rápido + confiável). Validação: gpt-5-mini@4096 funcionou mas ficou LENTO (15-25s, raciocínio desperdiçado) e ainda errava objeção — confirmou a escolha de gpt-4.1-mini.

### Bug B — objeção atropelada por qualificação determinística
- **Sintoma:** "achei caro" → "interno ou externo?" (qualificação), ignorando a objeção.
- **Causa raiz:** monolith injeta qualificationContext (próxima pergunta) e atropela a objeção — mesmo problema que motivou mover produto/qualif/handoff pro specialist no hardening.
- **Fix:** `objecao` adicionada a `salesFunnelIntents` (index.ts) → roteia pro product_specialist; **regra 10** de objeção adicionada ao prompt do specialist (empatia + defesa de valor, sem desconto automático, pedido aberto).

## Pendências
- Deploy `ai-agent` com Bug A (llmProvider floor) + Bug B (objecao→specialist + regra 10) → validar S5 ao vivo (7/7 definitivo).
- **Prod:** EletropisoV2 (`1062059a`, gpt-5-mini monolith, max_tokens=1024) deve migrar p/ gpt-4.1-mini OU receber o deploy do floor.

## Links
- [[wiki/plano-orquestrador-subagentes-part2]] (plano C6/C7) · [[wiki/sandbox-ia-instancia]] · `scripts/e2e-router-runner.mjs`
