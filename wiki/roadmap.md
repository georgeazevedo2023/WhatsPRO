---
title: Roadmap
tags: [roadmap, milestones, fases, status]
sources: [.planning/ROADMAP.md, .planning/STATE.md, CLAUDE.md]
updated: 2026-04-08
---

# Roadmap

## Milestones

| Milestone | Status | Detalhes |
|-----------|--------|----------|
| v1.0 Refatoração e Blindagem | ✅ Shipped (2026-04-04) | 7 fases, 17 planos — circuit breaker, webhook, forms, componentes, tipagem, data fetching, helpers |
| v2.0 Agent QA Framework | ✅ Shipped (2026-04-05) | Pré-requisitos + F1-F4 completos |
| M12 WhatsApp Forms | ✅ Shipped (2026-04-05) | Forms por agent_id, FORM:slug trigger, form-bot, validações, webhook externo |
| M13 Campanhas + Forms + Funil | ✅ Shipped (2026-04-05) | Landing page rica, form na landing, auto-tag, AI form context, lead auto-creation |
| M14 Bio Link | ✅ Shipped (2026-04-06) | Linktree-style: 3 templates, 5 tipos de botão, agendamento, produto do catálogo, opções visuais, captação de leads, contexto AI, analytics |
| M15 Integração Funis F1+F2 | ✅ Shipped (2026-04-07) | Bio→Lead real, leadHelper shared, bio_context AI Agent, badge origem, journey timeline, "Usado em" forms, campaign leads |
| M16 Funis (Fusao Total) F1-F5 | ✅ Shipped (2026-04-07) | Tabela funnels, sidebar unificada (3→1), wizard auto-criacao 7 tipos, `<funnel_context>` AI Agent, handoff por funil, tag funil:SLUG em 3 edge functions, FunnelDetail com metricas+kanban, OriginBadge funil, import recursos existentes |

## Milestone 2: Agent QA Framework (concluído)

| Feature | Status | O que faz |
|---------|--------|-----------|
| Pré-requisitos | ✅ | Fix activeSubAgents, 38 migrations, types.ts, e2e_test_batches |
| F1: Histórico Persistente | ✅ | BatchHistoryTab, hooks, runAllE2e com batch (commit 4fe98ad) |
| F2: Fluxo de Aprovação Admin | ✅ | useE2eApproval, ApprovalQueue, ReviewDrawer (commit 95ad466) |
| F3: Barra de Evolução | ✅ | agentScoring, useAgentScore, AgentScoreBar (commit 95ad466) |
| F4: Ciclo Automatizado | ✅ | migration + e2e-scheduled + E2eSchedulePanel + RegressionBadge + BatchHistoryPanel |

## M14: Bio Link (em andamento)

| Feature | Status | O que faz |
|---------|--------|-----------|
| Fase 1: Bio Link Core | ✅ Shipped (2026-04-06) | bio_pages + bio_buttons tables, RLS, RPCs, edge function bio-public, 3 templates (simples/shopping/negocio), 5 tipos de botão (url/whatsapp/form/social/catalog), BioLinkEditor, BioLinkCard, BioLinkPreview |
| Fase 2: Melhorias Incrementais | ✅ Shipped (2026-04-06) | Agendamento de botões (starts_at/ends_at), botão tipo catálogo (ai_agent_products), opções visuais (fonte/espaçamento/capa), commit 7bfc119 |
| Fase 3: Funil + Analytics | ✅ Shipped (2026-04-06) | Formulário inline de captação (configurável), injeção de contexto no AI Agent, analytics por página/botão (commit 0b44f50) |

## M15: Integração Funis (F1+F2 shipped, F3-F5 backlog)

| Feature | Status | O que faz |
|---------|--------|-----------|
| F1: Foundation | ✅ Shipped (2026-04-07) | Bio cria leads reais, tags unificadas, `<bio_context>` no AI Agent, leadHelper.ts compartilhado, migration bio_lead_captures |
| F2: Jornada do Lead | ✅ Shipped (2026-04-07) | Badge de origem, timeline de jornada, "Usado em" nos forms, leads no campaign detail |
| F3: Hub de Funis | ✅ Absorbed by M16 | Implementado como M16 Funis |
| F4: Templates | ✅ Absorbed by M16 | 7 templates por tipo em funnelTemplates.ts |
| F5: Métricas de Funil | ✅ Absorbed by M16 | useFunnelMetrics + FunnelDetail com kanban visual |

## M16: Funis — Fusao Total (4 fases shipped)

| Feature | Status | O que faz |
|---------|--------|-----------|
| F1: Fundacao | ✅ Shipped | Tabela funnels (FK campaigns/bio/forms/kanban), sidebar 3→1, tipos TS, hooks CRUD, FunnelsPage, tag `funil` em VALID_KEYS |
| F2: Wizard + Auto-Criacao | ✅ Shipped | Wizard 4 passos, 7 tipos de funil, auto-cria Board+Columns+Form+Fields+BioPage+Buttons+Campaign+Funnel |
| F3: AI Agent + Handoff | ✅ Shipped | `<funnel_context>` injection, handoff priority funil>agente, tag `funil:SLUG` propagada via form-public/bio-public/webhook |
| F4: Detail + Metricas | ✅ Shipped | FunnelDetail (KPIs+Kanban visual+3 tabs), useFunnelMetrics, OriginBadge funil (laranja) |
| F5: Import + Polish | ✅ Shipped | ImportExistingDialog, botao "Importar existente", rotas antigas como sub-items |
| Polish: Dashboard + Jornada + Intelligence | ✅ Shipped | KPI "Funis Ativos", FunnelConversionChart, funnel_entry na timeline, LeadFunnelCard, filtro por funil na Intelligence |

## Módulos Implementados

16 módulos (M1-M16) implementados. Ver [[wiki/modulos]].

## Links

- [[.planning/ROADMAP]] — Roadmap detalhado
- [[.planning/STATE]] — Estado snapshot
- [[wiki/visao-produto]] — Visão geral
