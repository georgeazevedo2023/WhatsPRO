---
title: Métricas do Vendedor/Atendente — Visão e Gaps
tags: [metricas, vendedor, atendente, shadow, gestao, nps, dashboard]
sources: [discussao-2026-04-12]
updated: 2026-04-12
---

# Métricas do Vendedor/Atendente — Visão e Gaps

> Shadow escuta `fromMe: true` mas hoje não extrai nada. Esses dados são ouro para gestão.

## Métricas de Performance (Tempo)

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Tempo de resposta (handoff → 1ª msg) | Timestamp handoff vs 1ª msg `fromMe` | Ranking velocidade |
| Tempo de resolução (handoff → conversão/abandono) | Timestamps início/fim | Eficiência |
| Qtd mensagens até fechar | Contar msgs do vendedor por conversa | Objetividade |
| Horários ativos | Distribuição temporal `fromMe` | Cobertura, gaps |
| Conversas simultâneas | Msgs em conversas diferentes no mesmo período | Capacidade |
| Tempo ocioso (lead esperando) | Gap entre msg lead e resposta vendedor | Leads em risco |

## Métricas Comerciais (Conversão)

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Taxa de conversão por vendedor | Intenção → confirmação / total handoffs | Ranking |
| Ticket médio por vendedor | Produtos × preços catálogo | Quem vende mais caro/barato |
| Desconto concedido | Shadow detecta "vou fazer por X", "desconto Y%" | Margem real vs tabela |
| Upsell/cross-sell | Vendedor sugeriu produto adicional? | Oportunidades aproveitadas |
| Produtos mais vendidos por vendedor | Cruzamento conversa × catálogo | Especialização |
| Motivo de perda por vendedor | Lead desistiu após contato — por quê? | Treinamento direcionado |

## Métricas de Qualidade

| Métrica | Como Extrair | Valor |
|---------|-------------|-------|
| Tom/cordialidade | Shadow analisa sentimento das msgs do vendedor | Qualidade |
| Respondeu todas as perguntas? | Lead perguntou X, vendedor respondeu? | Completude |
| Follow-up feito? | Vendedor voltou a contatar lead parado? | Proatividade |
| Ofereceu alternativa? | Produto indisponível → sugeriu outro? | Resiliência comercial |
| Informação incorreta? | Preço/prazo diferente do catálogo | Risco, treinamento |

## Follow-up (Lado Vendedor)

| Métrica | Detalhe |
|---------|---------|
| Vendedor fez follow-up? | Lead parado há X horas — vendedor retomou? |
| Tempo até follow-up | Quanto demora para retomar lead parado |
| Taxa de recuperação | Leads recuperados com follow-up / leads perdidos |
| Leads abandonados | Vendedor nunca mais respondeu — quantos? quais? |
| Follow-up proativo vs reativo | Vendedor voltou por conta própria ou após alerta do sistema? |

## NPS / Pesquisa de Satisfação

| Item | Detalhe |
|------|---------|
| Quando disparar | Após atendimento humano concluído (configurável: Kanban move, timeout, manual) |
| Motor | M17 já tem enquetes/NPS — reutilizar |
| Vínculo | Nota vinculada ao **vendedor** (`assigned_to`), não só ao lead |
| Visões | NPS médio por vendedor, evolução temporal, comentários textuais |
| Segmentação | NPS por tipo de lead, produto, horário — cruzar com dados do lead |

## Tags que Shadow Extrairia (Lado Vendedor)

```
vendedor_desconto:10%
vendedor_upsell:sim / vendedor_upsell:nao
vendedor_followup:sim / vendedor_followup:nao
vendedor_alternativa:sugeriu / vendedor_alternativa:nao_sugeriu
vendedor_tom:cordial / vendedor_tom:seco / vendedor_tom:impaciente
venda_status:fechada / venda_status:perdida / venda_status:pendente
venda_motivo_perda:preco / venda_motivo_perda:prazo / venda_motivo_perda:sem_resposta
pagamento:pix / pagamento:cartao / pagamento:boleto
```

## Apresentação ao Gestor

### Dashboard do Gestor (visão agregada)

- Ranking de vendedores (conversão, tempo, NPS)
- Comparativo lado a lado entre vendedores
- Tendências temporais (melhora/piora por vendedor)
- Alertas: lead sem resposta há X horas, vendedor abaixo da meta, NPS caindo
- Metas configuráveis: "tempo resposta < 5min", "conversão > 30%", "NPS > 8"

### Ficha do Vendedor (visão individual)

- KPIs pessoais: conversão, tempo médio, NPS, ticket médio
- Histórico de atendimentos com resultado (converteu/perdeu/pendente)
- Pontos fortes e fracos (baseado em tags shadow)
- Evolução temporal (mês a mês)
- Produtos que mais vende vs. perde

### Distribuição Inteligente (futuro)

- Baseada em performance — leads quentes para os melhores vendedores
- Especialização: lead pede tinta → vendedor especialista em tintas
- Balanceamento de carga: vendedor com muitas conversas simultâneas recebe menos

## Status Atual

| Capacidade | Status |
|-----------|--------|
| Shadow captura msgs do vendedor (`fromMe: true`) | ✅ Funciona |
| Identifica qual vendedor respondeu (`assigned_to`) | ✅ Funciona |
| NPS motor (M17 enquetes) | ✅ Existe |
| Extrai dados do vendedor em shadow | ❌ Não implementado |
| Dashboard performance por vendedor | ❌ Não existe |
| Ficha do vendedor | ❌ Não existe |
| Ranking de vendedores | ❌ Não existe |
| Alertas proativos | ❌ Não existe |
| NPS vinculado ao vendedor | ❌ Não implementado |
| Distribuição inteligente | ❌ Não existe |
