---
title: Roadmap
tags: [roadmap, milestones, fases, status, m19-s10, eletropiso, d28-excluded-products, helpdesk-escopo-tabs]
sources: [.planning/ROADMAP.md (deprecated), .planning/STATE.md (deprecated), CLAUDE.md, PRD.md]
updated: 2026-05-04
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
| **M18 Fluxos v3.0** | ✅ Shipped (2026-04-12) | Unifica 17 módulos em experiência "Fluxos". 12/12 sprints completos. S12: Métricas + Migração por Instância + Rollback + E2E. Sprints: [[wiki/fluxos-roadmap-sprints]] |

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

## M17: Plataforma Inteligente — 4 Pilares (COMPLETO ✅)

> Motor de Automação + Funis Agênticos + Perfis & Integração + Enquetes + NPS

| Fase | Nome | Status | O que faz |
|------|------|--------|-----------|
| F1 | Motor de Automação | ✅ Shipped (2026-04-08) | Tabela automation_rules, automationEngine.ts (7 gatilhos, 4 condições, 5 ações), Tab "Automações" no FunnelDetail, form-bot integrado, 6 testes |
| F2 | Funis Agênticos | ✅ Shipped (2026-04-08) | funnel_prompt + handoff_rule por funil, `<funnel_instructions>` no AI Agent, Tab "Agente IA" no FunnelDetail |
| F3 | Perfis & Integração | ✅ Shipped (2026-04-09) | Agent Profiles (unifica sub-agents + funnel_prompt), tabela agent_profiles, ProfilesConfig UI, seletor de perfil no FunnelDetail, ai-agent profile loading, backward compat |
| F4 | Enquetes (Polls) | ✅ Shipped (2026-04-09) | poll_messages/responses, proxy send-poll, webhook poll_update, tool send_poll (9a), broadcast tab Enquete + PollEditor, form-bot field_type poll, helpdesk poll render, automationEngine send_poll |
| F5 | NPS + Métricas | ✅ Shipped (2026-04-09) | NPS automático pós-resolve (delay configurável), nota ruim→notifica gerente, PollMetricsCard + PollNpsChart dashboard, PollConfigSection admin, notifications table, triggerNpsIfEnabled |

**Ordem:** F1→F2→F3→F4→F5 (motor primeiro, enquetes depois — cada feature é apenas mais uma ação/gatilho no motor)
**Pré-requisito UAZAPI:** Só na F4 (Task 4.1 teste ao vivo). F1-F3 não dependem de UAZAPI.
**Módulos afetados:** AI Agent, Broadcast, Forms, Funis, Webhook, Helpdesk, Dashboard, Kanban/CRM (8 módulos)
**Decisões aprovadas (10):** D1 (imagem=checkbox), D2 (tags=IA+editável), D3 (activateFunnel centralizado), D4 (prompt por funil), D5 (transbordo=dept+timeout), D6 (NPS=pós-resolve+notifica), D7 (form-bot poll, NUNCA opções numeradas), D8 (motor automação MVP, tags+etiquetas como gatilhos), D9 (Motor+Agêntico ambos dentro do Funil — cérebro=global, funil=por contexto), D10 (Agent Profiles — unifica sub-agents+funnel_prompt)
**Plano completo (histórico):** [[wiki/historico-planos/plano-enquetes-polls]]

## M19: Plataforma de Métricas & IA Conversacional (em andamento)

| Sprint | Nome | Status | Tasks |
|--------|------|--------|-------|
| S1 | Shadow Inteligente (Coleta) | ✅ Shipped (2026-04-13) | Shadow bilateral, tags expandidas, extract_shadow_data, isTrivialMessage |
| S2 | Armazenamento & Agregação | ✅ Shipped + Fixed (2026-04-13) | Views SQL, aggregate-metrics, cron, UTMs, lead_score, funnel_events. Fix: join convs, resolved_at, T7+T8 populate |
| S3 | Dashboard do Gestor | ✅ Shipped (2026-04-13) | /gestao, KPIs, gráficos, comparativo IA vs vendedor. 11 arquivos, tsc 0 erros. |
| S4 | Fichas Individuais | ✅ Shipped (2026-04-13) | 7 planos, 27 arquivos: Ficha Vendedor, Ficha Agente IA, Painel Transbordo, Métricas Origem, Metas Configuráveis (GoalProgressBar+Modal), Navegação (4 rotas + Sidebar). tsc 0 erros, build ok. |
| S5 | IA Conversacional | ✅ Shipped (2026-04-13) | 7 fases, ~13 arquivos. Widget Ctrl+J, 20 intents, cache 5min, página /assistant. tsc 0, build ok. |
| S6 | NPS Automático | — | npsDispatcher, vínculo vendedor, v_nps_by_seller |
| S7 | Alertas Proativos | — | process-alerts, NotificationBell, 6 tipos |
| S8 | DB Monitoring & Auto-Cleanup | ✅ Shipped (2026-04-25) | 3 camadas: Camada 1 (DbSizeCard + semáforo 300 MB + top tabelas), Camada 2 (db-size-monitor pg_cron 06:07 UTC + NotificationBell super_admin), Camada 3 slice seguro (db_retention_policies + 6 seed policies OFF + AdminRetention UI + pg_cron weekly). 8% atual (24 MB). Plano: [[.planning/m19-s8-PLAN]] |
| S8.1 | DB Backup JSONL Integration | ✅ Shipped (2026-04-25) | Bucket privado + 2 edge functions (db-retention-backup gzipa→upload→delete; db-cleanup-old-backups limpa >365d) + 2 crons (weekly backup, monthly backup retention). Policy conversation_messages liberada. E2E validado. |
| S9 | Hardening RLS Permissões Helpdesk | — | Estender `can_view_conversation` para enforçar `can_view_unassigned` e `can_view_all_in_dept` (hoje SOFT/frontend-only — R73). Agendado: ~3 semanas após ship das permissões de inbox (2026-04-25). |
| S10 v1 | Service Categories (Backend + UI plana) | ✅ Shipped (2026-04-27) | Migration `20260427000001` + helper `_shared/serviceCategories.ts` + `ServiceCategoriesConfig.tsx` (UI plana com `qualification_fields[]` + `ask_pre_search`). Substitui 4 hardcodes de tinta no AI Agent. **Superseded por v2 na mesma sessão** antes de UI integrar. |
| S10 v2 | Service Categories — Stages + Score | ✅ Shipped (2026-04-27) | Migration `20260427000002` (stages + score + RPC `add_lead_score_event`) + UI v2 (drag-drop em stages e fields, slider score, preview funil). Hierarquia: Categoria → Stage → Field. Score persiste em `lead_score:N` + `lead_score_history`. F3 v2 em ai-agent/index.ts (4 edits HIGH RISK). F5: nova tab "Qualificação" (9ª). 7 sub-decisões D26.1–D26.7. |
| S10 v3 | Qualif UX Redesign (modo Iniciante) | ✅ Shipped (2026-04-28) | UX didática: toggle Iniciante/Avançado (default Iniciante), fontes maiores, tooltips, chips "Inserir", RadioGroup Leve/Médio/Importante para score, score-cap como warning não-bloqueante (banner vermelho só em erros REAIS). Backward-compat 100% (slugs preservados via guardrail M1). Commit `adb2bda`. |
| Sprint Eletropiso | 23 categorias + 7 fixes ai-agent + BusinessHoursEditor | ✅ Shipped (2026-04-29) | Agente Eletropiso configurado com 23 categorias home center (portas, fechaduras, escadas, cabos, canos, churrasqueiras, revestimentos, fechaduras, pias, janelas, furadeiras, torneiras, vasos_sanitarios, chuveiros, lampadas, tomadas_interruptores, disjuntores, registros, cimento_argamassa, caixas_dagua, ferramentas_manuais, pregos_parafusos + tintas/impermeabilizantes preservadas). 7 fixes em `ai-agent/index.ts` (v162→v169): uniqueKeys/categoria, isWellQualified, sdr_flow do banco, aliasing automático em set_tags, exit_action enforcement, +13 categorias, BusinessHoursEditor (UI semanal). VALID_KEYS expandido (60+ keys). 13 FAQs na KB. 17 handoff_triggers. R80-R84 promovidas. D27 (handoff-first em catálogo embrionário). |
| D28 Excluded Products + Fix Handoffs Duplicados | ✅ Shipped (2026-04-30) | **Feature D28**: lista `ai_agents.excluded_products JSONB` editável via UI (subseção tab Qualificação). Helper `_shared/excludedProducts.ts` (matcher word-boundary case-insensitive) + check em ai-agent ANTES do counter → IA responde polidamente sem transbordo e sem incrementar contador. Fallback automático "Não trabalhamos com {kw}, posso te ajudar com outro produto?" quando admin deixa message vazio. **Fix R85+R86**: 3 handoffs duplicados na conversa Josafa — guard `status_ia !== SHADOW` no auto-handoff por message limit + reset `lead_msg_count: 0` em 5 paths SHADOW. **R88**: CHECK constraint silent fail (`chk_ai_agent_logs_event` faltava `excluded_product_match` → INSERT falhava sem throw). **R89**: UI controlled input com `.trim()` em onChange impede digitar espaço — solução: sub-componente com useState local. Edge function v170→v172. Bundle prod `index-CFmkOcne.js`. 47 testes (27 unit + 20 integrated). Validado real com lead George em prod. |
| Helpdesk — Top tabs viram ESCOPO | ✅ Shipped (2026-05-03) | Atendente reportou "Atendendo 13 + lista vazia" (counts de status ignoravam atribuição). Topo agora é `Minhas / Não atribuídas / Todas` (escopo), Status virou Select dentro do filtro expansível. Counts respeitam status+departamento. Permissões: `canViewUnassigned`/`canViewAllInDept`/`canViewAll` ocultam tabs proibidas. Empty state ganhou variante para "nao-atribuidas". 2 arquivos: `HelpDesk.tsx` + `ConversationList.tsx`. PRD v7.20.0. |
| **D30 Fila Inteligente — Sprint A** (DB) | ✅ Shipped (2026-05-04) | 6 migrations: `departments` (queue_mode_enabled/timeout/default_assignee/cursor) + `department_members` (queue_position/queue_paused/gestor_in_queue + backfill espaçado) + `inboxes.default_department_id` (D-α) + `ai_agents.extended_hours_until` + tabela `business_hours_exceptions` (RLS) + tabela `handoff_queue_events` (5 status, 3 índices, RLS) + RPC `pick_next_assignee` atômica (SELECT FOR UPDATE no cursor, R91 mitigado, gestor opt-in via flag). Smoke test rotação 8 chamadas em prod OK. Detalhes: [[wiki/casos-de-uso/handoff-fila-detalhado]]. |
| **D30 Fila Inteligente — Sprint B** (Backend) | ✅ Shipped + Deployed (2026-05-04) | `_shared/handoffQueue.ts` + `_shared/handoffDepartment.ts` + edge fn `assign-handoff` (verify_jwt=false + verifyCronOrService) + integração nos 6 paths em `ai-agent/index.ts` via closure `runQueueAssignment` com try/catch (HIGH RISK mitigado por fallback). D-α/D-β/D-γ. tsc 0, vitest 662 passam (5 pré-existentes em FormBuilder). Deployado em prod: ai-agent v174 + assign-handoff v1. Smoke ao vivo: pick_next_assignee retorna user válido, cursor avança, gate auth funcionando. Aguarda 1 handoff real (lead via WhatsApp) para validar E2E. |
| **D30 Fila Inteligente — Sprint C** (Cron + Horário) | ✅ Shipped + Deployed (2026-05-04) | `_shared/businessHours.ts` + edge fn `requeue-conversations` v1 (cron 1min, 5 cases A-E + reativação Q5) + migration `pg_cron` aplicada (jobid 12 ativo) + Realtime broadcast `queue-update`. Notifica gestores em loop completo + sem atendente elegível. **Hotfix R92**: vault.SUPABASE_ANON_KEY atualizada para `sb_publishable_*` (todos os crons estavam silenciosamente 401ando). Smoke ao vivo: tick 21:24:00 BRT retornou 200 OK com queue vazia. |
| **D30 Fila Inteligente — Sprint D** (Admin UI) | ✅ Shipped (2026-05-04) | `QueueConfig.tsx` dialog em DepartmentsTab: toggle Modo Fila, slider Timeout (1-15min), select Atendente Padrão, drag-drop dos membros (`@dnd-kit/sortable`, queue_position espaçada por 10), toggle Pausar/Despausar, toggle "Incluir gestor" (só renderizado para role gerente). Reset cursor RR ao salvar. Audit log `update_dept_queue_config`. **InboxesTab**: select inline "Departamento padrão (handoff)" auto-save → `inboxes.default_department_id` (D-α), audit log `set_inbox_default_dept`. tsc 0, vitest 662 (5 pré-existentes). Sprints E-H pendentes. |

**Plano completo:** [[wiki/metricas-plano-implementacao]]

## Módulos Implementados

18 módulos (M1-M18) implementados. Ver [[wiki/modulos]].

## Links

- [[.planning/ROADMAP]] — Roadmap detalhado
- [[.planning/STATE]] — Estado snapshot
- [[wiki/visao-produto]] — Visão geral
