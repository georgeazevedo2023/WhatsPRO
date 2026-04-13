---
title: Métricas de Leads — Visão e Gaps
tags: [metricas, leads, shadow, gestao, insights, dashboard]
sources: [discussao-2026-04-12]
updated: 2026-04-12
---

# Métricas de Leads — Visão e Gaps

## Arquitetura do Pipeline de Dados

### Fluxo do Webhook

1. **UAZAPI** permite apenas 1 webhook por instância
2. **n8n** (`flux.wsmart.com.br`) recebe como middleware fan-out:
   - Ramo 1: Set — extrai campos para automações futuras no n8n
   - Ramo 2: HTTP Request — forward do body inteiro para `whatsapp-webhook` do WhatsPRO
3. **Filtros UAZAPI:** escuta `messages`, exclui `wasSentByApi` + `isGroupYes`
4. **Captura:** mensagens do lead (`fromMe: false`) E do atendente pelo celular (`fromMe: true`)

### Ciclo de Vida da IA

| status_ia | Comportamento | Quando |
|-----------|--------------|--------|
| `ligada` | IA responde automaticamente | Estado inicial, após ia_cleared |
| `shadow` | Ouvidos abertos, boca fechada — escuta, extrai, não responde | Após handoff (automático ou manual) |
| `desligada` | IA completamente inativa | APENAS para bloqueio manual (concorrentes, equipe interna) — NUNCA no fluxo normal |

**Regra:** ciclo normal é `ligada` ↔ `shadow`. `desligada` é exceção configurada pelo admin.

## O que Coletamos Hoje (Lead Side)

### Dados Funcionais ✅

| Dado | IA Ligada | Shadow | Armazenamento | Exibição |
|------|-----------|--------|---------------|----------|
| Nome (primeiro nome) | ✅ | ✅ | `lead_profiles.full_name` | LeadDetail, Helpdesk |
| Telefone | ✅ Auto (JID) | ✅ | `contacts.jid` | Automático |
| Motivo do contato | ✅ | ❌ | Tag `motivo:compra/suporte/etc` | KPI card |
| Produto de interesse | ✅ | ❌ | Tags `produto:`, `interesse:` | KPI card |
| Marca indisponível | ✅ | ❌ | Tag `marca_indisponivel:` | KPI card (vermelho) |
| Tipo de cliente (profissão) | ✅ | ❌ | Tag `tipo_cliente:pintor/arquiteto/etc` | Card violeta KPI |
| Score de engajamento 0-100 | ✅ Frontend | ❌ | Calculado on-the-fly (não persistido) | Badge Frio/Morno/Quente |
| Resumo da conversa | ✅ | ❌ | `lead_profiles.conversation_summaries` (últimas 10) | Alimenta prompt |
| Total interações | ✅ | ❌ | `lead_profiles.total_interactions` | Score |

### Gaps — O que NÃO Coletamos

| Dado | Valor para Gestão | Fonte |
|------|-------------------|-------|
| **Objeções** (preço, prazo, frete) | Top objeções, taxa por produto | Shadow + IA ligada |
| **Menção a concorrentes** | Mapa competitivo, frequência | Shadow + IA ligada |
| **Intenção de compra** ("quero pagar", "manda o pix") | Funil de conversão real | Shadow |
| **Conversão confirmada** (comprovante, vendedor confirma) | Receita, taxa de fechamento | Shadow (vendedor) + Kanban |
| **Ticket médio** | Valor médio por lead/segmento | Cruzamento produtos × preços |
| **Horários/dias preferidos** | Melhor horário para abordar | Análise temporal de mensagens |
| **Preferências de marca consolidadas** | Ranking marcas por segmento | Agregação de tags existentes |
| **Cidade/bairro** | Segmentação geográfica | IA ligada (se lead informar) |
| **Email** | Canal alternativo, remarketing | IA ligada (raramente coletado) |
| **Motivo de perda** | Por que não comprou | Shadow (detectar desistência) |
| **Score persistido** | Ranking, segmentação, alertas | Salvar no DB em vez de calcular on-the-fly |
| **Score alimentado por shadow** | Score evolui mesmo em atendimento humano | Shadow contribui com dados |

### Tags que Shadow Deveria Extrair (Futuro)

```
objecao:preco / objecao:prazo / objecao:frete / objecao:qualidade
concorrente:leroy_merlin / concorrente:telhanorte / concorrente:casabemol
intencao:compra / intencao:orcamento / intencao:desistiu
motivo_perda:preco / motivo_perda:prazo / motivo_perda:indisponivel
conversao:intencao / conversao:comprovante / conversao:confirmada
```

## Apresentação ao Gestor

### Fase 1: Dashboard Interno no WhatsPRO

Telas com gráficos, KPIs agregados, filtros por período/segmento/produto. Integrado ao sistema, tempo real, sem dependência externa.

### Fase 2: IA Generativa Conversacional

Gestor pergunta em linguagem natural:
- "Quantos leads do bairro Heliópolis?"
- "Qual a objeção mais comum este mês?"
- "Quais produtos mais pedidos por pintores?"
- "Qual o ticket médio dos arquitetos?"
- "Quais leads quentes não foram atendidos ontem?"

## Follow-up (Lado Lead)

| Métrica | Detalhe |
|---------|---------|
| Lead reativado por follow-up | Respondeu após follow-up da IA ou vendedor |
| Tempo de inatividade antes de responder | Quanto tempo o lead ficou parado |
| Estágio onde o lead trava | Pós-greeting? Pós-catálogo? Pós-preço? |
| Lead reativado espontaneamente | Voltou sozinho sem follow-up — após quantos dias? |
| Motivo de inatividade | Preço? Indecisão? Concorrência? (inferido pelo contexto anterior) |

## Funil de Conversão Desejado

```
Contato inicial (lead novo)
  → Qualificação (IA coleta dados)
    → Intenção de compra (lead expressa interesse)
      → Conversão confirmada (vendedor confirma pagamento)
```

Cada etapa rastreada com timestamp, permitindo medir tempo médio e taxa de conversão por etapa.
