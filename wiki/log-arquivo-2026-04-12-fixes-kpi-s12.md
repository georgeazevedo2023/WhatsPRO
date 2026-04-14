---
title: Log Arquivo — KPI Fixes + S12 (2026-04-12)
tags: [log, arquivo]
---

# Log Arquivo — KPI + Orchestrator + S12 (2026-04-12)

### fix(leads): kpiAtendidoIA usa tags da conversa atual (commit 306b5c7)

`kpiAtendidoIA` usava `tags` agregadas de TODAS as conversas → `ia:shadow` de conversa antiga contaminava novas. Corrigido: usa `latestConv.tags` apenas.

### fix(leads): KPI datas/duração + tipo_cliente tag-based (commit 4848d53)

- `latestConv` agora ordena por `created_at DESC`
- Duração >24h: formato `Xd Yh`
- Novo card violeta "Tipo de Cliente" no KPI grid
- DB: `prompt_sections.additional` + `tags_labels` atualizados (R50)

### fix(leads): KPI Produto exibia '—' — filtro _interno (commit 6af187f)

Filtro `!t.endsWith('_interno')` excluía tags válidas. Removido (R51).

### Agente IA: Tipo de Cliente configurado no DB (sem commit — config via SQL)

Agente Eletropiso (`174af654`). Campo `tipo_cliente` em `extraction_fields`. Instrução de inferência em `prompt_sections.additional`.

### Página do Lead: KPI Atendimento + Score + Embellezamento (commit c58507a)

Card "Resumo do Atendimento" 6 KPIs + Score de engajamento 0-100 (badge Frio/Morno/Quente).

### Helpdesk: KPI grid no Contexto IA (commits 6b542b1 + c432fd0)

Grid 2 colunas no ContactInfoPanel: Produto, Em falta, Início, Fim, Duração, Atendido por IA.

### fix(orchestrator): post-handoff guard (commit 64b91a8) + deploy

Guard: `flow_states WHERE status='handoff' AND completed_at >= now()-4h` antes de criar novo flow. Evita handoff duplicado. (R48)

### fix(greeting): saudação dupla para leads migrados (commit 460ddd5) + deploy

Cases B+C unificados — se `lead.lead_name` existe, sempre usa `known_lead_message`. (R47)

### S12 COMPLETO — Métricas + Migração por Instância + Rollback (commit b7017e8)

M18 Fluxos v3.0 COMPLETO — 12/12 sprints shipped.
- T1: Migration (instances.use_orchestrator, flow_report_shares)
- T2: Webhook per-instance
- T3: Rollback automático (3 falhas em 5min)
- T4: FlowMetricsPanel (KPI, funil, timing, top intents, compartilhar)
- T5: FlowDetail tabs + OrchestratorToggle
- T6: E2E (5 cenários, 100pts max, threshold ≥80)
