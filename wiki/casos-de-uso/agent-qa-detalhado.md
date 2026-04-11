---
title: Agent QA Framework — Documentacao Detalhada
tags: [qa, testes, e2e, score, aprovacao, regressao, playground, detalhado]
sources: [src/components/admin/ai-agent/playground/, src/hooks/useE2eBatchHistory.ts, supabase/functions/e2e-test/]
updated: 2026-04-10
---

# Agent QA Framework — Testes Automatizados do AI Agent (8 Sub-Funcionalidades)

> O QA Framework e o sistema de **testes automatizados** do agente IA. Ele simula conversas reais (envia mensagens DE VERDADE pelo WhatsApp) e verifica se o agente respondeu corretamente — se usou as ferramentas certas, se nao inventou dados, se fez handoff quando devia. Funciona como um "inspetor de qualidade" que roda testes periodicamente e avisa quando algo quebrou.
>
> Pense num QA humano que liga para a loja fingindo ser cliente, faz perguntas e avalia as respostas. So que automatizado, com 30+ cenarios, e rodando toda semana.
>
> Ver tambem: [[wiki/casos-de-uso/ai-agent-detalhado]] (agente testado), [[wiki/modulos]]

---

## 15.1 Batches de Teste (Lotes)

**O que e:** Um "batch" e um lote de testes executados de uma vez. Cada batch roda varios cenarios e registra: quantos passaram, quantos falharam, score geral.

**Tipos de batch:**
- **Manual** — admin clica "Rodar Testes" no Playground
- **Agendado** — roda automaticamente por pg_cron (ex: toda segunda 8h)
- **Regressao** — rodado quando score cai abaixo do limiar

**Ciclo de vida:** Running → Complete → Aprovado/Rejeitado (apos revisao humana).

> **Tecnico:** Tabela `e2e_test_batches` (agent_id, run_type manual/scheduled/regression, status running/complete/approved/rejected, total, passed, failed, composite_score, is_regression BOOL, regression_context JSONB). Hooks: `useCreateBatch()`, `useCompleteBatch()`. Score: `(passed/total)*100`. FK: `e2e_test_runs.batch_uuid`.

---

## 15.2 Cenarios de Teste (30+ Cenarios)

**O que e:** Cada cenario simula um tipo de conversa real. Tem: nome, categoria, dificuldade, passos (mensagens), e expectativas (quais ferramentas devem ser usadas).

**17 categorias:** vendas, suporte, troca, devolucao, defeito, curioso, preco, frete, pagamento, horario, endereco, objecao, frustrado, transbordo, navegando, recorrente, spam.

**Cada cenario define:**
- **Passos** — sequencia de mensagens (texto, audio, imagem) com delay entre cada
- **Expectativas** — quais tools o agente DEVE usar, quais NAO DEVE, se deve fazer handoff, se deve bloquear

**Cenario exemplo:** "Lead Frustrado" → step 1: "Boa noite" → step 2: "Isso e um absurdo, quero falar com o gerente!" → expectativa: DEVE usar handoff_to_human, NAO DEVE usar search_products.

> **Tecnico:** Tipo `TestScenario` em `src/types/playground.ts`. Campos: id, name, category, description, difficulty (easy/medium/hard), steps [{content, media_type, delay_ms}], expected {tools_must_use[], tools_must_not_use[], should_handoff, should_block}, tags. 30+ cenarios built-in. Galeria: `PlaygroundScenariosTab.tsx` com search + filtro por categoria + badges dificuldade.

---

## 15.3 Score Composto (4 Fatores)

**O que e:** Nota de 0 a 100 calculada a partir de 4 fatores ponderados.

**Formula:**
| Fator | Peso | O que mede |
|-------|------|-----------|
| Taxa de aprovacao E2E | 40% | % de cenarios que passaram |
| Media do Validator | 30% | Score medio das validacoes (0-10 → normalizado 0-100) |
| Precisao de ferramentas | 20% | 1 - (ferramentas faltantes / total esperado) |
| Latencia | 10% | 100 - max(0, (media_ms - 3000) / 70) |

**Tiers (faixas):**
- **Excelente** (90-100) — verde
- **Bom** (70-89) — azul
- **Atencao** (50-69) — amarelo
- **Critico** (0-49) — vermelho

**Tendencia:** Compara media dos ultimos 3 dias vs 3 dias anteriores. Seta para cima/baixo/estavel (delta ±3 pontos).

> **Tecnico:** Modulo `src/lib/agentScoring.ts`. Hook `useAgentScore.ts`. Dados: `e2e_test_runs` (passed, tools_used, tools_missing, latency_ms) + `ai_agent_validations` (score 0-10). Lookback: 7 dias. Componente `AgentScoreBar.tsx` (numero + barra + trend icon + tooltip breakdown).

---

## 15.4 Fila de Aprovacao (Revisao Humana)

**O que e:** Quando um cenario falha, o admin pode revisar e classificar: **falso positivo** (teste errado, agente estava certo) ou **regressao real** (agente errou de verdade).

**Fluxo:**
1. Cenario falha → aparece na fila de aprovacao com badge de contagem
2. Admin clica em "Revisar" → ReviewDrawer abre com detalhes
3. Ve: cenario, cada passo, resposta do agente, ferramentas usadas vs esperadas, latencia
4. Decide: **Aprovar** (falso positivo, marca `human_approved`) ou **Rejeitar** (regressao real, marca `human_rejected`)
5. Pode adicionar notas de revisao

> **Tecnico:** Componente `ApprovalQueue.tsx` (lista pending: `approval IS NULL AND passed = false`). `ReviewDrawer.tsx` (Sheet lateral com steps expandiveis, tools badges verde/vermelho, notes textarea, botoes Approve/Reject). Hook `useE2eApproval.ts`. Campos: `e2e_test_runs.approval` ('human_approved'|'human_rejected'), `approved_by`, `approved_at`, `reviewer_notes`.

---

## 15.5 Deteccao de Regressao

**O que e:** O sistema detecta automaticamente quando o agente **piorou** — quando o score cai significativamente ou fica abaixo do limiar por varios batches seguidos.

**Quando e flagrado como regressao:**
- Score caiu mais de X pontos vs batch anterior (threshold configuravel, default 10)
- Score ficou abaixo de Y% por N batches consecutivos (healthy rate configuravel, default 80%)

**Badge de regressao:** Badge vermelho com triangulo de alerta + delta (ex: "-15 pts") no historico de batches.

> **Tecnico:** Campos em `e2e_test_batches`: `is_regression` BOOL, `regression_context` JSONB com {delta, current_score, previous_score, consecutive_below_threshold, failed_scenarios[{id, name, reason}]}. Componente `RegressionBadge.tsx` (AlertTriangle vermelho + tooltip com breakdown). Detection: score delta > `regressionThreshold` OU consecutive < `healthyPassRate`.

---

## 15.6 Ciclo Automatizado (Scheduling)

**O que e:** Testes rodam automaticamente em intervalos configuraveis (2h, 6h, 12h, 24h) sem o admin clicar.

**Configuracao:**
- **Intervalo** — a cada quantas horas rodar (default 6h)
- **Taxa saudavel** — limiar minimo de aprovacao (default 80%)
- **Limiar de regressao** — queda em pontos para flagrar regressao (default 10)
- **Alerta WhatsApp** — enviar mensagem de alerta quando regressao detectada

**Subconjunto de cenarios:** O ciclo automatizado roda 6 cenarios rapidos (~2min total): suporte-horario, pagamento, preco, navegando, transbordo, objecao-momento.

**Pre-condicoes verificadas:** business_info configurado, produtos no catalogo, etc.

> **Tecnico:** Edge function `e2e-scheduled/index.ts` via pg_cron. Configuracao em `system_settings` (e2e_schedule_interval_hours, e2e_healthy_pass_rate, e2e_regression_threshold, e2e_alert_whatsapp_enabled, e2e_alert_number). Guard: compara tempo desde ultimo batch 'complete' vs interval. 6 cenarios subset. Alerta: envia msg WhatsApp se threshold breached. Componente: `E2eSchedulePanel.tsx` (colapsavel com inputs).

---

## 15.7 Playground (Interface de Testes)

**O que e:** Interface visual no admin do AI Agent para rodar testes manualmente, ver resultados em tempo real, e gerenciar cenarios.

**Funcionalidades:**
- **Galeria de cenarios** — 30+ cenarios organizados por 17 categorias, com busca, filtro e badges de dificuldade
- **Execucao ao vivo** — seleciona cenario → clica "Executar" → ve em tempo real: mensagem enviada → agente respondendo → ferramentas usadas → resultado
- **Status por step** — pending/running/sending/done/error com indicador animado
- **Score por categoria** — % de aprovacao por categoria com emojis (verde/amarelo/vermelho)
- **Historico de batches** — timeline com score, tipo, regressao badge
- **Fila de aprovacao** — badge com contagem de pendentes

**Aviso importante:** Testes enviam mensagens REAIS pelo WhatsApp via UAZAPI. Nao e simulacao.

> **Tecnico:** `PlaygroundE2eTab.tsx` (container principal). Sub-tabs: Run (galeria + execucao), History (BatchHistoryTab/Panel). `PlaygroundScenariosTab.tsx` (galeria com search + filter). Execucao: chama edge function `e2e-test` por cenario. Live feedback: status por step com spinner animado. Score: `BatchHistoryTab.tsx` (30 ultimos batches, score bar verde≥80%/amarelo≥60%/vermelho<60%).

---

## 15.8 Historico de Batches (BatchHistoryTab)

**O que e:** Lista dos ultimos 30 batches com detalhes expandiveis.

**Cada batch mostra:** Data, tipo (manual/agendado/regressao), total de cenarios, passaram/falharam, score composto, badge de regressao, status (running/complete/approved/rejected).

**Expandir:** Ve cada cenario do batch com resultado individual, ferramentas usadas, latencia.

**Botao retest:** Rodar o mesmo batch novamente para comparar.

> **Tecnico:** Componentes: `BatchHistoryTab.tsx` (lista expandivel, 30 por agente), `BatchHistoryPanel.tsx` (timeline compacta com botao retest + regression badge). Hook `useE2eBatchHistory(agentId)`. Score bar: barra colorida com tier.

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `e2e_test_batches` | Lotes de teste (agent_id, run_type, status, score, is_regression, regression_context) |
| `e2e_test_runs` | Resultados individuais (batch_uuid FK, scenario_id, passed, tools_used/missing, latency_ms, approval) |
| `system_settings` | Config do scheduling (interval, thresholds, alert) |
| `ai_agent_validations` | Scores do Validator (alimenta calculo do score composto) |

---

## Links Relacionados

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Agente IA que e testado
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
