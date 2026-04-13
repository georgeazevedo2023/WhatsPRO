---
title: Métricas do Agente IA — Visão e Gaps
tags: [metricas, agente-ia, shadow, gestao, dashboard, follow-up]
sources: [discussao-2026-04-12]
updated: 2026-04-12
---

# Métricas do Agente IA — Visão e Gaps

## Performance (Eficiência)

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Tempo de resposta (msg lead → resposta IA) | `ai_agent_logs.latency_ms` | Experiência do lead |
| Msgs até handoff | Contar msgs antes do evento handoff | Qualificação eficiente? |
| Msgs até conversão | Contagem até intenção de compra | Eficiência comercial |
| Taxa de resolução autônoma | Leads sem handoff / total | % que a IA resolve sozinha |
| Taxa de handoff | Handoffs / total conversas | Quanto menor, melhor |
| Custo por atendimento | Tokens × preço do modelo | ROI da IA |
| Custo por lead qualificado | Custo total / leads qualificados entregues ao vendedor | Custo de aquisição |

## Qualidade (Acurácia)

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Score do Validator | `ai_agent_logs` scores | Qualidade média |
| Taxa de REWRITE | Respostas corrigidas / total | IA errando? |
| Taxa de BLOCK | Respostas bloqueadas → handoff forçado | Falhas graves |
| Busca com resultado | search_products com produtos / total | Catálogo atende? |
| Busca sem resultado | search_products com 0 / total | Gaps no catálogo |
| Carrosséis enviados | Mídias enviadas com sucesso | Produtos mostrados |
| Dados extraídos por conversa | Média de tags setadas | Riqueza da qualificação |
| Greeting → resposta do lead | Lead respondeu / total greetings | Engajamento |

## Follow-up (IA)

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Follow-ups enviados | Contagem eventos follow-up | Volume de reativação |
| Taxa de reativação | Lead respondeu após follow-up / enviados | Eficácia |
| Tempo ideal de follow-up | Análise: após quantas horas converte melhor | Otimização de cadência |
| Conteúdo que reativa | Qual tipo funciona (pergunta, oferta, lembrete) | A/B de mensagens |
| Follow-ups por estágio | Pós-greeting vs pós-qualificação vs pós-catálogo | Onde o lead trava |
| Sequência de follow-ups | 1º lembrete → 2º oferta → 3º última chance | Qual passo converte |
| Follow-ups agendados vs executados | Sistema programou vs realmente enviou | Confiabilidade |
| Cancelados (lead/vendedor respondeu antes) | Quantos foram desnecessários | Inteligência da cadência |

## Comportamento / Padrões

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Horários de pico | Distribuição temporal | Demanda por horário |
| Tools mais usadas | Ranking: search_products, set_tags, handoff | O que a IA faz |
| Motivos de handoff (agregado) | Campo `reason` nos handoffs | Por que transfere |
| Perguntas mais frequentes | Clustering msgs incoming | FAQ real |
| Produtos mais buscados | Queries search_products | Demanda do catálogo |
| Marcas mais pedidas | Tags + queries | Interesse por marca |
| Objeções que a IA não resolve | Objeção → handoff | Limites = treinamento |

## Comparativo IA vs Vendedor

| Métrica | IA | Vendedor | Insight |
|---------|-----|---------|---------|
| Tempo de resposta | Segundos | Minutos/horas | IA X vezes mais rápida |
| Taxa de conversão | Qualificado→handoff | Handoff→venda | Funil completo |
| Custo por atendimento | Tokens | Salário/hora | ROI real |
| NPS | Nota pós-IA | Nota pós-vendedor | Quem atende melhor? |
| Cobertura horária | 24/7 | Comercial | Fora de horário |
| Follow-up | Automático, configurável | Manual, inconsistente | Consistência |

## Status Atual

| Capacidade | Status |
|-----------|--------|
| `ai_agent_logs` com tokens, latency, tool_calls | ✅ Existe |
| Validator com score/verdict | ✅ Existe |
| Evento handoff com reason | ✅ Existe |
| Evento response_sent com metadata | ✅ Existe (fix R58) |
| Follow-up orchestrator (flow_followups) | ✅ Parcial (M18) |
| Dashboard performance da IA | ❌ Não existe |
| Custo acumulado por período | ❌ Não calculado |
| Taxa resolução autônoma | ❌ Não calculado |
| Comparativo IA vs vendedor | ❌ Não existe |
| Agregação motivos handoff/produtos | ❌ Não existe |
| Métricas de follow-up | ❌ Não calculado |
