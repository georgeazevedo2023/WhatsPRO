---
title: Métricas de Transbordo — Visão e Gaps
tags: [metricas, transbordo, handoff, gestao, dashboard]
sources: [discussao-2026-04-12]
updated: 2026-04-12
---

# Métricas de Transbordo — Visão e Gaps

> Transbordo = momento mais crítico do funil. Onde a IA passa o bastão para o humano.

## Volume e Padrões

| Métrica | Detalhe |
|---------|---------|
| Total de transbordos por período | Tendência subindo ou descendo? |
| Taxa de transbordo | Transbordos / total conversas IA |
| Horários de pico | Correlacionar com horário comercial |
| Dentro vs fora do horário | Lead transferido com vendedor disponível? |
| Por tipo de lead | Pintor transfere mais? Arquiteto resolve com IA? |

## Motivos (Por que a IA transfere?)

| Métrica | Detalhe |
|---------|---------|
| Motivos agregados (ranking) | Produto não encontrado, lead pediu, objeção, tema fora |
| Produto não encontrado | Gaps do catálogo — o que pedem e não temos |
| Lead pediu explicitamente | Em qual momento da conversa? |
| Objeção não resolvida | Preço/prazo — treinamento necessário? |
| Tema fora do escopo | Atualizar business_info? |
| Validator BLOCK | IA ia errar — quantas vezes? |
| Sentimento negativo | Lead frustrado → poderia ter sido evitado? |

## Qualidade do Transbordo

| Métrica | Detalhe |
|---------|---------|
| Dados entregues ao vendedor | Qualification chain completa? |
| Lead repetiu informação? | Teve que dizer tudo de novo ao vendedor |
| Departamento correto? | Lead de suporte foi para vendas? |
| Mensagem de transbordo adequada | Tom empático vs genérico |

## Tempo

| Métrica | Detalhe |
|---------|---------|
| Tempo de pickup | Handoff → 1ª msg vendedor |
| Lead desistiu esperando? | Handoff feito, vendedor não respondeu |
| Tempo IA até transbordo | Quanto tempo IA levou para decidir |
| Fila de espera | Leads esperando por vendedor |

## Resultado Pós-Transbordo

| Métrica | Detalhe |
|---------|---------|
| Conversão pós-transbordo | Vendedor converteu / total transbordos |
| Perda pós-transbordo | Nunca comprou — por quê? |
| Retorno à IA | Lead reativou IA — transbordo desnecessário? |
| NPS pós-transbordo | Satisfação com a transferência |

## Transbordo Evitável vs Necessário

| Tipo | Exemplo | Ação |
|------|---------|------|
| Evitável — catálogo | Produto existe mas IA não achou | Melhorar search |
| Evitável — informação | Dado está no business_info mas IA não sabia | Atualizar prompt |
| Evitável — objeção | "Achei caro" → IA transferiu | Treinar IA |
| Necessário — pedido | Lead quer humano | OK |
| Necessário — complexidade | Orçamento sob medida | OK |
| Necessário — negativo | Lead irritado | OK — humano melhor |

## Status Atual

| Capacidade | Status |
|-----------|--------|
| Evento handoff com reason | ✅ Logado |
| qualification_chain no handoff | ✅ Existe |
| Timestamp do handoff | ✅ Existe |
| Motivos agregados (dashboard) | ❌ Não existe |
| Tempo de pickup por vendedor | ❌ Não calculado |
| Conversão pós-transbordo | ❌ Não calculado |
| Classificação evitável vs necessário | ❌ Não existe |
| Lead desistiu esperando | ❌ Não detectado |
| Dashboard de transbordo | ❌ Não existe |
