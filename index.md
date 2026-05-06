---
title: WhatsPRO — Master Index
updated: 2026-05-05
type: index
---

# WhatsPRO — Master Index

> Ponto de entrada para a IA (Claude Code) e humanos navegarem toda a base de conhecimento. Atualizado a cada ingest/mudança significativa.

---

## Arquitetura de Documentacao (4 arquivos raiz)

> O projeto usa 6 arquivos na raiz que se complementam. O CLAUDE.md e o orquestrador enxuto (~125 linhas) que carrega automaticamente. Os demais sao carregados sob demanda.

| Arquivo | Linhas | Funcao | Carregamento |
|---------|--------|--------|--------------|
| [[CLAUDE.md]] | ~125 | Orquestrador — protocolos, regras de ouro, links, regras de documentacao | Automatico (toda sessao) |
| [[RULES.md]] | ~172 | Regras detalhadas — integridade, entrega, SYNC, CORS, AI Agent, documentacao e notas | Sob demanda |
| [[ARCHITECTURE.md]] | ~99 | Referencia tecnica — stack, edge functions, deploy, modulos, roles | Sob demanda |
| [[PATTERNS.md]] | ~150 | Padroes de implementacao — 12 areas tematicas | Sob demanda |
| [[AGENTS.md]] | ~140 | Onboarding rapido em ingles para agentes externos | Sob demanda |
| [[PRD.md]] | ~3200 | Fonte de verdade: changelog versionado, modulos, roadmap | Sob demanda |

**Fluxo:**
```
Sessao inicia → CLAUDE.md (auto, 4KB)
  → Protocolo: index + roadmap + erros + log + decisoes
  → Tarefa do usuario
    → Implementar? → ler PATTERNS.md
    → Verificar regra? → ler RULES.md
    → Entender stack? → ler ARCHITECTURE.md
```

---

## Wiki — Produto (v1-v2, construido)

| Pagina | Resumo |
|--------|--------|
| [[wiki/visao-geral-completa]] | Visão geral (índice — particionado 2026-05-04 em 4 sub-wikis abaixo) |
| ↳ [[wiki/visao-geral-projeto]] | O que é, problema, para quem, papéis, análise competitiva |
| ↳ [[wiki/visao-geral-modulos]] | Os 19 módulos em 5 grupos (Comunicação, Inteligência, CRM/Leads, Campanhas/Funis, Infra) |
| ↳ [[wiki/visao-geral-arquitetura]] | Stack, docs, banco (59 tabelas), fluxo de dados ponta-a-ponta |
| ↳ [[wiki/visao-geral-jornadas-numeros]] | Jornada do lead, números, roadmap milestones, ideias futuras |
| [[wiki/visao-produto]] | Visao resumida: modulos, roles, proposta de valor |
| [[wiki/arquitetura]] | Stack, estrutura de pastas, fluxo de dados, edge functions |
| [[wiki/ai-agent]] | Agente IA M10: tools, SDR, handoff, shadow, validator, prompts |
| [[wiki/modulos]] | Todos os modulos (M1-M17) com status |
| [[wiki/banco-de-dados]] | Tabelas Supabase, RLS, materialized views |
| [[wiki/integracao-funis]] | M15 Integração Funis (índice — particionado 2026-05-04 em 3 sub-wikis abaixo) |
| ↳ [[wiki/integracao-funis-arquitetura]] | Visão dos 4 sistemas, leadHelper.ts, tags unificadas, contexto AI |
| ↳ [[wiki/integracao-funis-painel]] | Onde ver tudo no painel (Campanhas, Bio, Forms, Lead, AI Agent) |
| ↳ [[wiki/integracao-funis-jornadas]] | 5 jornadas completas (Sorteio, Vaga, Lançamento, Form, Captação) |
| [[wiki/uazapi-polls-interativos]] | UAZAPI Mensagens Interativas (índice — particionado 2026-05-04) |
| [[wiki/uazapi-polls-poll]] | Endpoint `/send/menu` (poll), webhook poll_update, plano de implementação |
| [[wiki/uazapi-polls-list-quickreply]] | Endpoints `/send/list` e `/send/quickreply` + tabela comparativa |
| [[wiki/uazapi-polls-casos-uso]] | 5 casos de uso reais (AI Agent, Broadcast, Forms, NPS, Campanha) + troubleshooting |
| [[wiki/historico-planos/plano-enquetes-polls]] | Plano M17 (histórico): Motor + Funis Agenticos + Enquetes |

## Wiki — Operacional (sempre consultar)

| Pagina | Resumo |
|--------|--------|
| [[wiki/roadmap]] | Milestones, fases, status, proximos passos |
| [[wiki/erros-e-licoes]] | Bugs e regras preventivas (consultar SEMPRE) |
| [[wiki/decisoes-chave]] | Decisões ativas (D27, D28, D29) + regras integridade/SYNC/CORS/HIGH RISK |
| [[wiki/decisoes-arquivo-d21-d26]] | Arquivado: D21 Helpdesk Permissões, D22-D25 DB Monitoring, D26 v2 Service Categories, Auditoria Helpdesk 2026-04-14 |
| [[wiki/deploy-checklist]] | Checklist obrigatorio de deploy |
| [[wiki/free-forever-playbook]] | Plano operacional pra ficar no plano grátis Supabase: 4 camadas + escalation por nível (60/70/85%) — 2026-05-05 |
| [[wiki/testes-d30-sprint-f-playwright]] | Specs Playwright de 8 cenários da Sprint F + regression de R93/R94/R95 — 2026-05-05 |
| [[wiki/playwright-onda1]] | **Playwright Onda 1 — 30 testes smoke (2026-05-06):** 31/31 PASS em 3.7min, 0 bugs reais. Setup `@playwright/test` + 6 specs (Auth, Helpdesk, AI Agent, Leads/CRM, Admin, Dashboard). 9 falhas iniciais eram todas seletor frágil, auditadas e documentadas. Lições pra próximas ondas. |
| [[wiki/playwright-onda2]] | **Playwright Onda 2 — 30 testes deep + R100 (2026-05-06):** 60/60 PASS após fix. 6 specs (Helpdesk deep, AI Agent deep, Leads/CRM deep, Campanhas, Broadcast, Flows). **1 bug real corrigido: R100** — `<SelectItem value="">` em CampaignForm.tsx quebrava criação de campanha via ErrorBoundary. Fix com sentinel `__none__`. Total Onda 1+2: **61/61 PASS** em 6.1min. |
| [[wiki/playwright-onda3]] | **Playwright Onda 3 — 30 testes profundos (2026-05-06):** 30/30 PASS em 3.9min, 0 bugs reais (lições Onda 1+2 aplicadas no projeto). 6 specs: Métricas (/gestao/transbordo, /origem, KPIs), Admin (/secrets, /docs, /backup, users, inboxes), Catálogo, Knowledge, Forms editor, Bio Page editor. **Cobertura acumulada: 90 testes, 90/90 PASS, 1 bug real (R100) corrigido em prod, suite completa em ~14min.** |
| [[wiki/playwright-onda4]] | **Playwright Onda 4 — 30 testes interativos (2026-05-06):** 30/30 PASS em ~6min, 0 bugs reais. 6 specs: Helpdesk conversation (click conversa), AI Agent tabs (navegação + **fill+restore**), Kanban Board detail, Funnels Wizard, Flows Wizard, Lead detail. **Cobertura total: 120 testes, 120/120 PASS, 1 bug real, ~20min suite completa.** |
| [[wiki/auditoria-completa-2026-05-05]] | **Auditoria completa do projeto (5 ondas paralelas):** 0 P0 / 8 P1 / 11 P2 / 7 P3 — saúde geral 6.8/10. Plano de correção em 6 sprints. **Sprint 1 SHIPPED 2026-05-05 (commit e4def62):** P1-3 search_path em 24 fns + P1-4/5 process-jobs hardening + P1-8 FKs CASCADE/SET NULL + P1-1 process-flow-followups deploy v1. **Sprint 2 SHIPPED 2026-05-05 (PRD v7.29.4):** P1-6 ChatPanel `currentUserIdRef` + P1-7 Promise.then→async/await + P2-1 `activate-ia` CORS dinâmico + P2-3 `helpdeskBroadcast` R93 pattern. **Sprint 3 SHIPPED 2026-05-06 (PRD v7.29.5, HIGH RISK aprovado):** P1-2 verify_jwt drift fechado — `activate-ia` v12 alinhada com config (`false`), `ai-agent-playground` config alinhada com prod (`false`). 8/8 P1s shipados. Zero regressão. |
| [[wiki/migracao-eletropiso-COMPLETA]] | **🎉 MIGRAÇÃO LIVE 2026-05-06** — Eletropiso operando no novo `prfcbfumyrrycsrcrvms`. 1.944 rows + 4 storage migrados (diff=0). 41 edge fns + 15 crons + 8 secrets validados. Frontend cutover. n8n+UAZAPI atualizados. 3 hotfixes pós-cutover (R97/R98/R99). **Ref consolidada: endpoints, secrets, commits, pendências de rotação.** Frase retomada: "continuar smoke E2E migracao eletropiso pos hotfix R99" |
| [[wiki/migracao-eletropiso-handoff]] | Handoff inicial — decisões + 8 ondas plano. Substituído pela [[wiki/migracao-eletropiso-COMPLETA]] após cutover. |
| [[wiki/migracao-eletropiso-inventario]] | **Inventário Onda 0 da migração Eletropiso (2026-05-06):** instance_id `r466a98889b5809`, 7 users (todos migram), ~1.900 rows escopadas (1.341 mensagens + 274 validações IA), 4 storage objects, 2 vault secrets, 12 pg_cron jobs (4 com URL hardcoded), 43 edge fns (41 migram), 160 migrations. 4 bloqueios pré-Onda 1 a confirmar com usuário. |
| [[wiki/arquitetura-docs]] | Arquitetura docs: 4 arquivos raiz |
| [[wiki/protocolo-subagentes]] | Como dividir tarefas em ondas paralelas — 4 passos + regras de conflito |
| [[wiki/log-arquivo-2026-04-04-a-09]] | Log historico arquivado |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | KPI fixes + S12 + orchestrator (2026-04-12) |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | M19 S1+S2: Shadow + Agregação + Deploy (2026-04-13) |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | Helpdesk audit 10 fixes (2026-04-14) |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | Sessão maratona: Helpdesk inbox + M19 S8 + S8.1 (2026-04-25) |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | M19-S10 v1+v2+v3 (Service Categories Stages+Score) + Deploy 16 commits represados (2026-04-27 a 04-28) |
| [[wiki/handoff-2026-04-27]] | HANDOFF da sessão 2026-04-27 — Auditoria geral + M19-S10 v2 Service Categories shipped |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | Sprint Eletropiso 23 categorias + 7 fixes ai-agent (v162→v169) + BusinessHoursEditor + audit vault (2026-04-29) |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | D28 Excluded Products + D29 VALID_KEYS dinâmico + Avatares em Storage + R85/R86/R87/R88 (2026-04-30) |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | Auditoria Profunda Helpdesk (9 ondas + trigger DB) + Top tabs viram ESCOPO + Header mobile-first + Gerenciar deptos inline (2026-05-02 + 2026-05-03) |
| [[wiki/log-arquivo-2026-05-04-admin]] | Auditoria de vault (15 wikis particionadas) + Auditoria Módulo Admin Sprint 0+1+2 + R90 hotfix user_roles UNIQUE (2026-05-04 manhã) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | D30 Fila Inteligente Sprints A (DB) + B (backend HIGH RISK) + C (cron + R92 hotfix vault) — 2026-05-04 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | D30 Fila Inteligente Sprints D (Admin UI) + F (Helpdesk UI) + G (Tests + Retention) + E (Modo Estendido) — 2026-05-04/05 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | Sessão manhã 2026-05-05 — R93/R94/R95 + Free Forever 4 camadas + Sprint H D30 (arquivado quando log.md ultrapassou 200 linhas) |
| [[log.md]] | **Sessão 2026-05-05 (tarde)** — Auditoria forense `event-processor`/`process-jobs` (chamadores n8n externos, ~302k inv/mês = 60% Free Tier queimadas) + Fase 2 defesa em código: migration `platform_usage_db_to_fn_metrics` estende snapshot com sentinel R96 + R96 documentado + playbook ganha SOP "Auditoria de tráfego órfão". Pendente operacional: cleanup n8n (fora do repo). Frases pra retomar: **"continuar n8n cleanup"** ou **"continuar testes D30 cenário 8"**. |
| [[wiki/melhorias-auditoria-2026-04-27]] | Auditoria 2026-04-27: 24 bugs + 210 melhorias (índice geral) |
| [[wiki/auditoria-helpdesk-2026-05-02]] | Auditoria profunda Helpdesk + Banco (2026-05-02): nota 7.4/10, 6 sprints de plano de ação |
| [[wiki/auditoria-admin-2026-05-04]] | Auditoria profunda Módulo Admin (2026-05-04): nota 6.5/10 (recalibrada), 7 sprints, 1 crítico real (C1 R88) + 20 médios. Sprint 0 confirmou RLS user_roles rigorosa (A2 falso positivo) |
| [[wiki/melhorias-helpdesk-2026-05-02]] | 20 Melhorias do Helpdesk: duplicações, inconsistências, UI (5 quick wins shipados 2026-05-02) |
| [[wiki/melhorias-modulos-comunicacao]] | Melhorias: Helpdesk, Broadcast, Forms (30 itens) |
| [[wiki/melhorias-modulos-inteligencia]] | Melhorias: AI Agent, Profiles, Motor, Enquetes/NPS, Fluxos (50 itens) |
| [[wiki/melhorias-modulos-leads-crm]] | Melhorias: Leads, Kanban, Catálogo (30 itens) |
| [[wiki/melhorias-modulos-canais]] | Melhorias: Campanhas, Bio, Funis (30 itens) |
| [[wiki/melhorias-modulos-plataforma]] | Melhorias: Dashboard, Gestor, Assistente, Instâncias, Admin, Doc (70 itens) |
| [[wiki/metricas-leads-visao]] | Metricas de leads: visao, gaps, shadow, dashboard, IA conversacional |
| [[wiki/metricas-vendedor-visao]] | Metricas do vendedor: performance, conversao, NPS, ficha, ranking |
| [[wiki/metricas-agente-ia-visao]] | Metricas da IA: eficiencia, qualidade, follow-up, custo, comparativo |
| [[wiki/metricas-transbordo-visao]] | Metricas de transbordo: motivos, tempo pickup, conversao pos-handoff |
| [[wiki/metricas-origem-leads-visao]] | Metricas de origem: canais, atribuicao UTM, ROI por canal |
| [[wiki/metricas-plano-implementacao]] | Plano: 7 sprints, 55 tasks (v2 auditado) |
| [[.planning/m19-s8-PLAN]] | M19 S8 DB Monitoring & Auto-Cleanup — 3 camadas + S8.1 backup |
| [[wiki/casos-de-uso/db-retention-detalhado]] | Retenção de dados: visibility, alerts, cleanup, backup JSONL |

## Wiki — Fluxos v3.0 (✅ Shipped 2026-04-12 — 12/12 sprints)

| Pagina | Linhas | Resumo |
|--------|--------|--------|
| [[wiki/fluxos-visao-arquitetura]] | 173 | Visao, 4 etapas, orquestrador, 12 templates, mapeamento |
| [[wiki/fluxos-params-atendimento]] | 116 | P0-P3: Saudacao, Qualificacao, Produtos, Interacoes |
| [[wiki/fluxos-params-inteligencia]] | 95 | P4,P5,P8: Tags, Seguranca, Lead Score |
| [[wiki/fluxos-params-entrada]] | 133 | P6-P7,P10-P13: Gatilhos, Condicoes, UTM, QR, Forms, Webhooks |
| [[wiki/fluxos-params-biolink]] | 100 | P9: Bio Link (15 sub-params, 12+ templates, midia) |
| [[wiki/fluxos-servicos]] | 178 | Memory, Audio(STT/TTS), Validator, Metrics |
| [[wiki/fluxos-detector-intents]] | 167 | 13 intents, 3 camadas, normalizacao BR |
| [[wiki/fluxos-shadow-mode]] | ~120 | Shadow Mode: 7 dimensoes, objecoes, follow-up, resgate, gestor |
| [[wiki/fluxos-banco-dados]] | 199 | Schema banco: 14 tabelas, 4 grupos, 4 migrations, padroes RLS |
| [[wiki/fluxos-roadmap-sprints]] | ~193 | 12 sprints em 4 camadas, fatias verticais, DTs, riscos, cobertura |
| [[wiki/fluxos-wireframes-admin]] | 84 | G5 Wireframes — indice das 5 telas (4 arquivos especializados) |
| [[wiki/fluxos-wireframes-listagem]] | 105 | /flows listagem + /flows/new selecao de modo |
| [[wiki/fluxos-wireframes-wizard]] | 139 | Wizard formulario 4 etapas + galeria 12 templates |
| [[wiki/fluxos-wireframes-guiada]] | 148 | Conversa Guiada split-screen: chat + preview live |
| [[wiki/fluxos-wireframes-editor]] | 200 | FlowEditor 5 tabs + Dashboard metricas compartilhavel |

---

## Documentacao Detalhada por Funcionalidade

> Guias com padrao dual (didatico para leigos + tecnico para devs). Cada doc tem: o que e, como funciona, cenarios reais, blocos tecnicos (componentes, tabelas, queries).

| Pagina | Sub-func | Resumo |
|--------|----------|--------|
| [[wiki/casos-de-uso/helpdesk-detalhado]] | 26 (índice) | Helpdesk — entrada principal com índice das 5 sub-páginas abaixo |
| ↳ [[wiki/casos-de-uso/helpdesk-organizacao]] | 8 | Etiquetas, tags, notas privadas, status, prioridade, atribuição, departamentos, bulk |
| ↳ [[wiki/casos-de-uso/helpdesk-ia]] | 5 | Toggle IA (ligada/desligada/shadow), transcrição áudio, resumo IA, finalização (TicketResolution), contexto do lead |
| ↳ [[wiki/casos-de-uso/helpdesk-comunicacao]] | 5 | Templates `/`, 10 tipos de mídia, rascunhos automáticos, emoji, reply (citação) |
| ↳ [[wiki/casos-de-uso/helpdesk-ux]] | 7 | Layout 3 paineis, typing indicator, tempo de espera, histórico, busca global Ctrl+K, filtros, realtime + som |
| ↳ [[wiki/casos-de-uso/helpdesk-permissoes]] | 1+ | Permissões granulares de inbox (D21, R73) + árvore de componentes |
| [[wiki/casos-de-uso/ai-agent-detalhado]] | 15 (índice) | Particionado 2026-04-30 em 4 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] | 2.1+2.2 | Cérebro LLM gpt-4.1-mini + circuit breaker + 9 ferramentas (search/carousel/media/handoff/labels/tags/kanban/profile/poll) |
| ↳ [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] | 2.3+2.4 | Fluxo SDR com Service Categories (stages+score) + Shadow Mode (extração silenciosa pós-handoff) |
| ↳ [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] | 2.5-2.7 | Validator Agent (supervisor) + TTS (voz) + Prompt Studio (9 seções editáveis) |
| ↳ [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] | 2.8-2.14 | Perfis + NPS + Knowledge Base + Debounce + Greeting + Memória + Contexto Canal + Painel 9 tabs |
| [[wiki/casos-de-uso/excluded-products-detalhado]] | 7 | D28 — Lista de produtos NÃO vendidos: schema, matcher word-boundary, fallback automático, integração no edge function, validação prod, R88+R89 |
| [[wiki/casos-de-uso/admin-detalhado]] | 9 | Painel super_admin: 9 páginas (inboxes, users, departments, secrets, docs, roadmap, backup, retention) + 3 edge fns admin-* + 3 camadas de defesa |
| [[wiki/casos-de-uso/handoff-fila-detalhado]] | 11 | **D30 COMPLETO — 8/8 sprints shipped 2026-05-04 a 05-05.** Fila Inteligente completa: backend + admin UI (QueueConfig + ExtendedHoursConfig) + helpdesk UI (badge "Em fila — Lucas (3:42)" countdown ao vivo + pause toggle pessoal + cancelar fila em reatribuição manual) + 66 testes Vitest + retention policy 90d + wikis finais. 2 modos (ON/OFF), round-robin global, timeout 5min, pausa horário comercial, drag-drop ordem, toggle pause individual, override gestor, modo estendido pontual |
| [[wiki/casos-de-uso/leads-detalhado]] | 12 (3 sub) | Perfil 25+ campos, badge origem, timeline, block IA, clear context, CSV, auto-criação, funil card, kanban — *particionado 2026-05-04* |
| [[wiki/casos-de-uso/crm-kanban-detalhado]] | 11 (3 sub) | Boards, drag&drop, cards, campos customizáveis, entidades, acesso, IA `move_kanban`, ticket resolution, funis |
| [[wiki/casos-de-uso/catalogo-detalhado]] | 10 (3 sub) | Tabela, formulário, URL scraping, CSV, batch scrape, imagens, busca fuzzy 4 camadas, categorias, bio link, IA |
| [[wiki/casos-de-uso/broadcast-detalhado]] | 12 (3 sub) | 4 tipos conteúdo, grupos vs leads, importador 4 métodos, delay anti-ban, agendamento, histórico, templates |
| [[wiki/casos-de-uso/campanhas-detalhado]] | 12 (3 sub) | Link rastreável, QR, landing page, atribuição, métricas, contexto IA, clone, 6 tipos, leads convertidos |
| [[wiki/casos-de-uso/formularios-detalhado]] | 13 (3 sub) | Form builder, 16 tipos campo, 12 templates, FORM:slug, form-bot, form-public, webhook, auto-lead, contexto IA |
| [[wiki/casos-de-uso/bio-link-detalhado]] | 10 (2 sub) | Linktree-style, 5 tipos botão, 3 templates, captação leads, analytics, contexto IA, agendamento, catálogo |
| [[wiki/casos-de-uso/funis-detalhado]] | 13 (3 sub) | Wizard 4 passos, 7 tipos, auto-criação tudo, motor automação (7+4+6), agênticos, perfis IA, métricas, kanban visual |
| [[wiki/casos-de-uso/motor-automacao-detalhado]] | 9 (3 sub) | 7 gatilhos, 4 condições, 6 ações, fluxo execução, editor visual, CRUD hooks, NPS trigger, tratamento erros |
| [[wiki/casos-de-uso/enquetes-nps-detalhado]] | 10 (3 sub) | 4 canais envio, UAZAPI /send/menu, rastreamento votos, auto-tags D2, NPS auto, notificação nota ruim, dashboard |
| [[wiki/casos-de-uso/fluxos-detalhado]] | 18 (2 sub) | Fluxos v3.0 M18: orquestrador, 12 sprints, 8 subagentes, validator, shadow, métricas, templates, migração, E2E |
| [[wiki/casos-de-uso/agendamentos-detalhado]] | 6 | Unico/recorrente (diario/semanal/mensal), delay anti-ban, tipos agendaveis, gestao status, edge function processamento |
| [[wiki/casos-de-uso/dashboard-detalhado]] | 8 | KPIs principais, graficos, performance atendentes, tempo resposta IA/humano, Intelligence (analise IA), filtros, shift reports |
| [[wiki/casos-de-uso/agent-qa-detalhado]] | 8 | Batches, 30+ cenarios, score composto (4 fatores), aprovacao humana, regressao, ciclo automatizado, playground, historico |
| [[wiki/casos-de-uso/instancias-detalhado]] | 7 | QR code, status tempo real, controle acesso, detalhes (4 abas), delete soft/hard, profile pic, sync |
| [[wiki/casos-de-uso/deploy-detalhado]] | 6 | Docker multi-stage, CI/CD GitHub Actions, Hetzner+Portainer, edge functions, health check, checklist |
| [[wiki/casos-de-uso/guia-funcionalidades-completo]] | — | Guia rapido: 13 funcionalidades + 10 integracoes + 10 jornadas |
| [[wiki/casos-de-uso/campanha-deputado-anderson]] | — | Case: campanha politica deputado estadual PE |

---

## Fontes Brutas (raw — read-only)

| Arquivo | Conteudo |
|---------|----------|
| [[PRD.md]] | Fonte de verdade: funcionalidades, versionamento, changelog |
| [[docs/CONTEXTO_PROJETO]] | Contexto completo do projeto (v2.8.0) |
| [[docs/REGRAS_ASSISTENTE]] | Regras do assistente Claude |
| [[docs/AUDIT_V3]] | Auditoria v3 do projeto |

---

## Planejamento (.planning/)

| Arquivo | Conteudo |
|---------|----------|
| [[.planning/ROADMAP]] | Milestones e fases com status |
| [[.planning/STATE]] | Estado atual do projeto (snapshot) |
| [[.planning/PROJECT]] | Referencia do projeto GSD |
| [[.planning/MILESTONES]] | Historico de milestones |

---

## Tags Globais

#ai-agent #whatsapp #uazapi #supabase #edge-functions #crm #helpdesk #leads #kanban #broadcast #formularios #campanhas #tts #validator

---

*Última atualização: 2026-05-05 noite (Auditoria completa do projeto — 5 ondas paralelas) — Estado atual: PRD v7.22.0, M19 ativo (S6/S7/S9 abertos), D30 100% shipped. Sessão noite: 5 subagentes Explore em paralelo cobriram backend/frontend/db/vault/config. Saúde geral 6.8/10. Zero P0 confirmados (3 P0 dos agentes eram falsos positivos), 8 P1 reais. Top P1: `process-flow-followups` cron 1x/h batendo em fn não-deployada, `verify_jwt` drift em 2 fns, 26 SECURITY DEFINER sem search_path. Documento completo `wiki/auditoria-completa-2026-05-05.md` (187 linhas) com plano em 6 sprints. Sessão tarde: R96 sentinel + Fase 2 defesa em código (Free Forever monitoring). Bundle prod `index-CFmkOcne.js`.*
