---
title: Módulos
tags: [modulos, features, helpdesk, crm, leads, broadcast, funis]
sources: [CLAUDE.md, PRD.md, docs/CONTEXTO_PROJETO.md]
updated: 2026-04-09
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

## M17 — Plataforma Inteligente ✅ COMPLETO

> Status: **F1-F5 Shipped (2026-04-08 a 2026-04-09)** — Milestone completo.
> Plano: [[wiki/plano-enquetes-polls]] | UAZAPI: [[wiki/uazapi-polls-interativos]]

### F1 — Motor de Automação ✅ Shipped (2026-04-08)
- Tabela `automation_rules` (funnel_id FK, trigger_type, condition_type, action_type, configs JSONB, RLS)
- `automationEngine.ts` shared: `executeAutomationRules()` — 7 gatilhos, 4 condições, 6 ações
- Tab "Automações" no FunnelDetail com CRUD visual + AutomationRuleEditor dialog
- form-bot integrado: dispara `form_completed` após conclusão

### F2 — Funis Agênticos ✅ Shipped (2026-04-08)
- `funnel_prompt` + `handoff_rule` + `handoff_department_id` + `handoff_max_messages` na tabela funnels
- ai-agent injeta `<funnel_instructions>` no system prompt (prioridade máxima)
- Tab "Agente IA" no FunnelDetail

### F3 — Perfis & Integração ✅ Shipped (2026-04-09)
- Tabela `agent_profiles` — pacotes reutilizáveis de prompt + handoff rules
- Unifica sub-agents (JSONB) + funnel_prompt em 1 conceito
- `funnels.profile_id` FK → seletor dropdown no FunnelDetail
- ProfilesConfig substitui SubAgentsConfig na tab Inteligência
- ai-agent: profileData > funnelData > agent em handoff. `<profile_instructions>` última seção
- Sub-agents deprecados com guard `if (!profileData)` — backward compat 100%

### F4 — Enquetes (Polls) ✅ Shipped (2026-04-09)
- Tabelas `poll_messages` + `poll_responses` + RLS
- uazapi-proxy: action `send-poll` (2-12 opções, 255 chars max)
- whatsapp-webhook: handler `poll_update` (upsert, auto-tags D2, automation trigger, AI debounce)
- AI Agent: tool `send_poll` (9a, sideEffectTools) + broadcastEvent
- Broadcast: tab "Enquete" + PollEditor (D1 image checkbox)
- form-bot: field_type `poll` (envio nativo + validate + normalize)
- Helpdesk: media_type='poll' rendering com BarChart3 + options cards
- automationEngine: action `send_poll` implementada (substituiu placeholder)

### F5 — NPS + Métricas ✅ Shipped (2026-04-09)
- 5 campos NPS em ai_agents (enabled, delay, question, options, notify_on_bad)
- `is_nps` flag em poll_messages + tabela `notifications` para alertas
- PollConfigSection admin (NPS toggle, delay, pergunta, opções, notificação)
- PollMetricsCard (4 KPIs) + PollNpsChart (distribuição NPS) no Dashboard
- usePollMetrics hook (totalPolls, totalVotes, responseRate, npsAvg, distribution)
- triggerNpsIfEnabled() no automationEngine (delay + guard sentimento:negativo)
- TicketResolutionDrawer agenda NPS via job_queue após resolver
- Nota ruim (Ruim/Péssimo) → notifica gerentes da inbox

### Decisões aprovadas (10 — D1 a D10)
- D1-D9: ver [[wiki/plano-enquetes-polls]]
- D10: Agent Profiles (unifica sub-agents + funnel_prompt) — ver [[wiki/decisoes-chave]]

## Links

- [[wiki/ai-agent]] — Agente IA em profundidade
- [[wiki/roadmap]] — Status e próximos módulos
- [[wiki/plano-enquetes-polls]] — Plano de enquetes (sprints, tasks, schema)
- [[wiki/uazapi-polls-interativos]] — UAZAPI mensagens interativas
