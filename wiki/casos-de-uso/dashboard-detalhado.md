---
title: Dashboard e Intelligence — Documentacao Detalhada
tags: [dashboard, analytics, metricas, intelligence, kpi, detalhado]
sources: [src/pages/dashboard/DashboardHome.tsx, src/pages/dashboard/Intelligence.tsx, src/components/dashboard/]
updated: 2026-04-10
---

# Dashboard e Intelligence — Painel de Metricas e Analise IA (8 Sub-Funcionalidades)

> O Dashboard e o **painel de controle** da empresa — a primeira tela que o gerente ve ao logar. Mostra quantas instancias estao online, quantos leads chegaram, desempenho dos atendentes, conversao dos funis e satisfacao NPS. A Intelligence e uma camada mais profunda: usa IA para **analisar conversas** e gerar insights estrategicos (motivos de contato, produtos mais pedidos, objecoes, sentimento).
>
> Ver tambem: [[wiki/casos-de-uso/helpdesk-detalhado]], [[wiki/casos-de-uso/leads-detalhado]], [[wiki/casos-de-uso/funis-detalhado]], [[wiki/casos-de-uso/enquetes-nps-detalhado]]

---

## 14.1 KPIs Principais (DashboardHome)

**O que e:** Cards grandes no topo mostrando numeros-chave do negocio.

**KPIs exibidos:**
- **Instancias** — total de instancias WhatsApp com status (online/offline)
- **Online** — quantas estao conectadas agora
- **Grupos** — total de grupos WhatsApp nas instancias
- **Leads Hoje** — leads novos do dia com tendencia vs ontem (% de mudanca)
- **Funis Ativos** — quantos funis estao operando (so super_admin)

**Detalhes expandiveis:** Instancias offline, total de participantes, usuarios do sistema.

**Tempo real:** Leads atualizados via Supabase Realtime (INSERT event).

> **Tecnico:** Pagina `DashboardHome.tsx`. KPIs: query `instances` (status), `lead_database_entries` (7 dias rolling), `uazapi-proxy` (groups/participants, cache 5min). Realtime: `supabase.channel('helpdesk-leads').on('postgres_changes', INSERT, lead_database_entries)`. Componente `StatsCard.tsx` com trend % (hoje vs ontem). Filtros: `DashboardFilters.tsx` (instance, inbox, period 7/15/30/60 dias).

---

## 14.2 Graficos do Dashboard

**O que e:** Graficos visuais com dados agregados.

**Graficos:**
- **Status das instancias** — pizza Online vs Offline
- **Grupos por instancia** — barras horizontais (top 6)
- **Participantes por instancia** — barras horizontais (top 6)
- **Leads do Helpdesk** — grafico de area (7 dias rolling, barras coloridas por dia)
- **Conversao de Funis** — barra horizontal: Visitas → Capturas → Leads → Conversoes (agregado de todos funis ativos)
- **Metricas de Enquetes** — PollMetricsCard (4 KPIs) + PollNpsChart (distribuicao NPS)

> **Tecnico:** Componentes: `DashboardCharts.tsx` (status pie, groups bar, participants bar, leads area — Recharts), `FunnelConversionChart.tsx` (agrega funnels ativos), `PollMetricsCard.tsx` + `PollNpsChart.tsx` (hook `usePollMetrics`). Limites: HelpdeskMetricsCharts `.limit(500)` para performance.

---

## 14.3 Performance dos Atendentes (AgentPerformanceCard)

**O que e:** Ranking dos atendentes com metricas de desempenho individual.

**Metricas por atendente:**
- **Conversas atendidas** — total no periodo
- **Taxa de resolucao** — % de conversas resolvidas
- **Mensagens enviadas** — total de mensagens outgoing
- **Tempo medio de resposta** — primeira incoming → primeira outgoing

**Destaque:** Melhor atendente aparece com icone de tendencia positiva.

**Cenario:** Gerente abre dashboard → ve que Carlos atendeu 45 conversas com 92% resolucao em 3min medio. Maria atendeu 38 com 88% em 5min. Carlos e o top da semana.

> **Tecnico:** Componente `AgentPerformanceCard.tsx`. Query: conversations + conversation_messages por periodo. Response time: exclui gaps >24h e tempos negativos. Ranking: order by conversations count DESC. Max 10 atendentes visiveis. Scrollable table.

---

## 14.4 Tempo de Resposta (HelpdeskMetricsCharts)

**O que e:** Dois graficos lado a lado mostrando velocidade de resposta — da IA e dos atendentes humanos.

**Grafico 1 — Tempo de Resposta IA (por inbox):**
- Barras horizontais por inbox
- Mede: incoming msg → proxima outgoing msg (quando status_ia='ligada')
- Exclui gaps >1h e tempos negativos

**Grafico 2 — Tempo de Resposta Atendentes (por inbox):**
- Barras agrupadas por inbox, subdividido por atendente
- Mostra media do primeiro tempo de resposta
- Formato legivel: "45min", "2h 15min"
- Cores relativas ao max

> **Tecnico:** Componente `HelpdeskMetricsCharts.tsx`. Query: ultimas 500 conversas. IA: filtra `status_ia='ligada'`. Calculo: diff entre incoming.created_at e next outgoing.created_at em segundos. Exclui >3600s e negativos. Agrupado por inbox_id → avg. Recharts horizontal BarChart.

---

## 14.5 Intelligence — Analise IA de Conversas

**O que e:** Pagina dedicada que usa IA para **analisar resumos de conversas** e gerar insights estrategicos. Diferente do dashboard (que mostra numeros), a Intelligence mostra **o que os clientes querem, o que os atrapalha, e como se sentem**.

**Filtros:** Periodo (1-90 dias), Inbox, Funil (opcional).

**Como funciona:** Admin clica "Gerar Analise" → sistema envia resumos das conversas para edge function `analyze-summaries` → IA processa → retorna insights.

**O que a analise mostra:**
- **Top motivos de contato** — por que os leads entram em contato (compra, suporte, orcamento)
- **Top produtos mencionados** — quais produtos mais aparecem nas conversas
- **Top objecoes** — o que impede a venda (preco, concorrente, prazo)
- **Sentimento** — % positivo, neutro, negativo
- **Insights estrategicos** — resumo em texto com recomendacoes

**Acoes:** Copiar analise, regenerar, ver conversas detalhadas (nome, telefone, resumo).

**Cenario:** Gerente filtra ultimo mes → "Gerar Analise" → descobre que 40% dos leads perguntam sobre frete, 25% reclamam do preco, sentimento 60% positivo. Insight: "Considere oferecer frete gratis acima de R$ 300 — principal barreira de conversao."

> **Tecnico:** Pagina `Intelligence.tsx`. Edge function `analyze-summaries` (Groq/Gemini). Retorna `AnalysisResult` com: total_analyzed (max 200), top_reasons/products/objections (arrays com IDs para drill-down), sentiment (positive/neutral/negative % + ID arrays), key_insights (texto), conversations_detail (nome, phone, date, summary). Cache: staleTime 5min, gcTime 10min. Rate limit: 429. KPI cards clicaveis → dialog com lista de conversas. Copy: formata como texto clipboard.

---

## 14.6 Filtros do Dashboard

**O que e:** Controles no topo para segmentar os dados.

**Filtros disponiveis:**
- **Instancia** — qual numero WhatsApp (com status on/off)
- **Inbox** — qual caixa de entrada
- **Periodo** — 7, 15, 30 ou 60 dias
- **Funil** — filtro adicional na Intelligence

> **Tecnico:** Componente `DashboardFilters.tsx`. State: instanceId, inboxId, period. Selecionar instancia limpa inbox (recarrega). Intelligence: dropdown periodo extra (1/2/7/30/90 dias) + funil. Badge de contagem de resumos (cor: 0=vermelho, <5=amarelo, ≥5=verde).

---

## 14.7 Shift Reports

**O que e:** Relatorios de turno enviados via WhatsApp. Atualmente nao ha UI dedicada — a Intelligence substitui com analise por periodo customizado.

> **Tecnico:** Edge function `send-shift-report/index.ts` existe mas nao tem UI de configuracao no dashboard. Intelligence permite analise de 1-90 dias como substituto.

---

## 14.8 Integracao com Modulos

| Modulo | O que aparece no Dashboard |
|--------|---------------------------|
| Helpdesk | Leads hoje, tempo de resposta IA/atendente |
| Funis | Conversao agregada (Visitas→Leads→Conversoes) |
| Enquetes/NPS | 4 KPIs + distribuicao NPS |
| Instancias | Status online/offline, grupos, participantes |
| AI Agent | Performance, score, validacoes |

---

## Links Relacionados

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Metricas de atendimento
- [[wiki/casos-de-uso/funis-detalhado]] — Conversao de funis
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Metricas de enquetes e NPS
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
