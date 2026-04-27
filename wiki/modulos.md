---
title: Módulos
tags: [modulos, features, helpdesk, crm, leads, broadcast, funis, fluxos, metricas, gestor, assistente, db-monitoring]
sources: [CLAUDE.md, PRD.md, docs/CONTEXTO_PROJETO.md]
updated: 2026-04-27
---

# Módulos

## M1 — WhatsApp (Instâncias & Grupos) ✅
- Multi-instância, QR code, sincronização UAZAPI
- Controle de acesso por instância
- Envio de mensagens/mídia para grupos

## M2 — Helpdesk ✅
- Chat real-time com Supabase Realtime
- Labels, assignments, departamentos
- Bulk actions (ler, resolver, arquivar)
- Quick reply templates ("/" prefix)
- Typing indicator, date dividers
- Paginação: últimas 50 msgs + "Load older"

## M3 — Broadcast ✅
- Texto, mídia, carrossel para grupos e leads
- Agendamento de mensagens

## M4 — Leads (M11) ✅
- Lead cards, timeline, conversation modal
- Block IA, clear context, quick IA toggle
- CSV import, lead auto-creation from forms
- contact_id FK para kanban

## M5 — CRM Kanban ✅
- Boards customizáveis com campos custom
- Integração com leads (contact_id FK)
- TicketResolutionDrawer (4 categorias, move card, tags)

## M6 — Catálogo ✅
- Quick Product Import (URL → scrape → auto-fill)
- Busca fuzzy (pg_trgm, word-level similarity)
- Search pipeline: ILIKE → word-by-word → fuzzy → post-filter AND

## M7 — Campanhas UTM ✅
- Links, QR codes, métricas, AI contextual
- Landing page com countdown + captura client-side
- Clone, starts_at, attribution guards
- landing_mode: 'redirect' ou 'form'

## M8 — Relatórios ✅
- Dashboard de inteligência/analytics
- Agent performance (ranking, resolution rate, response time)

## M9 — Agendamentos ✅
- Mensagens agendadas/recorrentes
- Templates de mensagem

## M10 — AI Agent ✅
- Ver [[wiki/ai-agent]] para detalhes completos

## M11 — Leads Database ✅
- Ver M4 acima

## M12 — WhatsApp Forms ✅
- Trigger via FORM:<slug>
- Validações: CPF, email, CEP, scale, select, yes_no, signature
- Max 3 retries por campo
- Webhook externo POST ao completar
- 12 templates built-in

## M14 — Bio Link ✅

- Página pública Linktree-style com slug único (bio-public edge fn sem JWT)
- 3 templates visuais: simples, shopping, negocio
- 5 tipos de botão: url, whatsapp, form, social, catalog
- Agendamento de botões (starts_at / ends_at)
- Botão tipo catálogo puxa produtos do `ai_agent_products`
- Opções visuais: fonte, espaçamento, capa
- Captação de leads: formulário inline configurável → contact + lead_profile
- Injeção de `<bio_context>` no AI Agent quando lead vem do Bio Link
- Analytics por página/botão em `bio_analytics`

## M13 — Campanhas + Formulários + Funil Conversacional ✅

- Landing page rica com countdown + captura client-side
- landing_mode: 'redirect' (countdown→wa.me) ou 'form' (formulário na landing)
- Form na landing page com validações (CPF checksum, email, phone, CEP)
- Auto-criação de lead no submit (FIELD_MAP → lead_profiles)
- Auto-tag de conversa: `formulario:SLUG` + `origem:formulario`
- AI Agent form context: detecta tag `formulario:SLUG`, injeta dados no prompt
- LeadFormsSection: componente no LeadDetail com formulários respondidos
- form-public edge function: GET (sem JWT) + POST → contact + lead_profile + form_submission + kanban card
- Attribution guards: webhook checa status='active' + expires_at antes de tagar

## M15 — Integração de Funis (Bio + Campanhas + Forms) ✅

- Bio Link cria leads reais (contact + lead_profile com origin='bio')
- Tags unificadas: `origem:bio`, `bio_page:SLUG` em todos os sistemas
- AI Agent recebe `<bio_context>` quando lead vem do Bio Link
- leadHelper.ts compartilhado (elimina FIELD_MAP duplicado)
- Badge de origem colorido no LeadDetail (Bio/Campanha/Formulário)
- Timeline de jornada do lead (bio → form → conversa → kanban)
- Forms mostra "Usado em" (quais campanhas/bios usam cada form)
- Campaign Detail mostra leads convertidos

## M16 — Funis: Fusao Total (Campanhas + Bio Link + Formularios) ✅

- Tabela `funnels` orquestra utm_campaigns + bio_pages + whatsapp_forms + kanban_boards via FK
- Sidebar unificada: 3 itens separados → 1 "Funis" com sub-items
- Wizard 4 passos: Tipo → Detalhes → Canais → Resumo — auto-cria todos os recursos em 1 clique
- 7 tipos: sorteio, captacao, venda, vaga, lancamento, evento, atendimento
- AI Agent: `<funnel_context>` injection + handoff priority funil > agente + max_messages do funil
- Tag `funil:SLUG` propagada automaticamente por form-public, bio-public, whatsapp-webhook
- FunnelDetail: KPIs + kanban visual + 3 tabs (Canais, Formulario, Config)
- LeadFunnelCard: card no LeadDetail mostrando funil ativo + etapa + dias
- FunnelConversionChart: grafico horizontal Visitas→Capturas→Leads→Conversoes no Dashboard
- KPI "Funis Ativos" no DashboardHome + filtro por funil na Intelligence
- ImportExistingDialog: vincular recursos existentes a funis
- OriginBadge suporta 'funil' (laranja)

## M17 — Plataforma Inteligente ✅ COMPLETO (F1-F5 shipped 2026-04-08 a 2026-04-09)

> Plano: [[wiki/plano-enquetes-polls]] | UAZAPI: [[wiki/uazapi-polls-interativos]]

| Fase | Entrega |
|------|---------|
| F1 — Motor de Automação | `automation_rules` + `automationEngine.ts` (7 gatilhos, 4 condições, 6 ações), Tab "Automações" no FunnelDetail, form-bot dispara `form_completed` |
| F2 — Funis Agênticos | `funnel_prompt`, `handoff_rule`, `handoff_department_id`, `handoff_max_messages` em funnels; `<funnel_instructions>` no prompt; Tab "Agente IA" no FunnelDetail |
| F3 — Perfis & Integração | `agent_profiles` (prompt+handoff reutilizável), `funnels.profile_id` FK, ProfilesConfig substitui SubAgentsConfig, profileData > funnelData > agent (D10), sub-agents deprecados |
| F4 — Enquetes Nativas | `poll_messages`/`poll_responses`, action `send-poll` no uazapi-proxy, tool `send_poll` (9ª tool), webhook `poll_update`, broadcast tab "Enquete", helpdesk render `media_type=poll` |
| F5 — NPS + Métricas | 5 campos NPS em ai_agents, `is_nps` flag, `notifications` table, PollConfigSection, PollMetricsCard + PollNpsChart, `triggerNpsIfEnabled()`, TicketResolutionDrawer agenda NPS, nota ruim notifica gerentes |

**Decisões D1-D10:** ver [[wiki/plano-enquetes-polls]] e [[wiki/decisoes-chave]] (D10 = Agent Profiles)

## M18 — Fluxos v3.0 ✅ COMPLETO (2026-04-12, 12 sprints em 4 camadas)

> Orquestrador conversacional unificado. Detalhes: [[wiki/casos-de-uso/fluxos-detalhado]] | [[wiki/fluxos-visao-arquitetura]] | [[wiki/fluxos-roadmap-sprints]]

| Camada | Sprints | Entregas-chave |
|--------|---------|----------------|
| **Infra** (S1-S3) | 14 tabelas (`flow_definitions`, `flow_steps`, `flow_triggers`, `flow_states`, `flow_events`, `lead_short_memory`, `lead_long_memory`, `flow_step_executions`, `guided_sessions`, `flow_report_shares`, `flow_followups`); feature flag `USE_ORCHESTRATOR` + `instances.use_orchestrator`; FlowsPage, FlowWizard, FlowTemplatesPage, FlowDetail |
| **Engine** (S4-S6) | Flow Triggers (keyword/tag/form/bio/utm/api/schedule); Memory Service (short TTL 1h + long); Greeting (4 casos), Qualification (16 tipos campo, smart_fill) |
| **Intelligence** (S7-S9) | Intent Detector 3 camadas (L1 normalização BR ~5ms, L2 fuzzy+Soundex ~12ms, L3 LLM ~200ms); Sales Subagent (busca 3 camadas + carousel); Support Subagent (word overlap); Validator 10 checks 0 tokens; Shadow Mode |
| **Completion** (S10-S12) | Survey (UAZAPI /send/menu); Followup (cron `process-flow-followups`); Handoff (briefing 3 níveis); Templates instaláveis (`install_flow_template`); Conversa Guiada (`guided-flow-builder`); FlowEditor 6 tabs; FlowMetricsPanel; Rollback automático 3-falhas-5min |

## M19 — Plataforma de Métricas & IA Conversacional + DB Monitoring (em andamento)

> Detalhes completos em [[wiki/roadmap]] e [[wiki/metricas-plano-implementacao]]. Resumo:

| Sprint | Status | Entrega |
|--------|--------|---------|
| S1 Shadow Inteligente | ✅ 2026-04-13 | Shadow bilateral + tags expandidas |
| S2 Armazenamento & Agregação | ✅ 2026-04-13 | 5 views SQL + `aggregate-metrics` + cron diário + `lead_score_history` + `conversion_funnel_events` |
| S3 Dashboard do Gestor | ✅ 2026-04-13 | `/gestao` (ManagerDashboard) + KPIs + comparativo IA vs vendedor |
| S4 Fichas Individuais | ✅ 2026-04-13 | 4 fichas (`/gestao/vendedor/:id`, `/agente`, `/transbordo`, `/origem`) + Metas Configuráveis (`instance_goals`) |
| S5 IA Conversacional | ✅ 2026-04-13 | Widget Ctrl+J + `/assistant` + `assistant-chat` (20 intents) + `assistant_sessions/messages` |
| S6 NPS Automático | — | `npsDispatcher`, vínculo vendedor, `v_nps_by_seller` |
| S7 Alertas Proativos | — | `process-alerts`, NotificationBell, 6 tipos |
| S8 DB Monitoring & Auto-Cleanup | ✅ 2026-04-25 | 3 camadas: `DbSizeCard` (Camada 1), `db_alert_state` + cron (Camada 2), `db_retention_policies` + `apply_retention_policy` + UI `/admin/retention` (Camada 3). D22-D25, R74. |
| S8.1 DB Backup JSONL | ✅ 2026-04-25 | Bucket privado `db-backups` + 2 edge fns + 2 crons. Policy `conversation_messages` 120d com backup gzipado. R75-R77. |
| S9 Hardening RLS Helpdesk | — | Estender `can_view_conversation` para enforçar `can_view_unassigned` e `can_view_all_in_dept` (R73) |

**Detalhes:** [[wiki/casos-de-uso/db-retention-detalhado]] (S8/S8.1) | [[wiki/metricas-plano-implementacao]] (plano completo)

## Links

- [[wiki/ai-agent]] — Agente IA em profundidade
- [[wiki/roadmap]] — Status e próximos módulos
- [[wiki/plano-enquetes-polls]] — Plano de enquetes (sprints, tasks, schema)
- [[wiki/uazapi-polls-interativos]] — UAZAPI mensagens interativas
- [[wiki/casos-de-uso/fluxos-detalhado]] — M18 casos de uso completos
- [[wiki/fluxos-visao-arquitetura]] — Arquitetura e templates de fluxos
- [[wiki/casos-de-uso/db-retention-detalhado]] — M19 S8/S8.1 DB monitoring & cleanup
- [[wiki/metricas-plano-implementacao]] — M19 plano completo
