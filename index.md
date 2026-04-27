---
title: WhatsPRO — Master Index
updated: 2026-04-27
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
| [[wiki/visao-geral-completa]] | Visao geral: problema, solucao, 17 modulos, jornada, numeros, stack |
| [[wiki/visao-produto]] | Visao resumida: modulos, roles, proposta de valor |
| [[wiki/arquitetura]] | Stack, estrutura de pastas, fluxo de dados, edge functions |
| [[wiki/ai-agent]] | Agente IA M10: tools, SDR, handoff, shadow, validator, prompts |
| [[wiki/modulos]] | Todos os modulos (M1-M17) com status |
| [[wiki/banco-de-dados]] | Tabelas Supabase, RLS, materialized views |
| [[wiki/integracao-funis]] | Campanhas + Bio + Forms + AI Agent (M15) |
| [[wiki/uazapi-polls-interativos]] | UAZAPI Mensagens Interativas |
| [[wiki/plano-enquetes-polls]] | Plano M17: Motor + Funis Agenticos + Enquetes |

## Wiki — Operacional (sempre consultar)

| Pagina | Resumo |
|--------|--------|
| [[wiki/roadmap]] | Milestones, fases, status, proximos passos |
| [[wiki/erros-e-licoes]] | Bugs e regras preventivas (consultar SEMPRE) |
| [[wiki/decisoes-chave]] | Decisoes D1-D15, padroes, seguranca |
| [[wiki/deploy-checklist]] | Checklist obrigatorio de deploy |
| [[wiki/arquitetura-docs]] | Arquitetura docs: 4 arquivos raiz |
| [[wiki/protocolo-subagentes]] | Como dividir tarefas em ondas paralelas — 4 passos + regras de conflito |
| [[wiki/log-arquivo-2026-04-04-a-09]] | Log historico arquivado |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | KPI fixes + S12 + orchestrator (2026-04-12) |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | M19 S1+S2: Shadow + Agregação + Deploy (2026-04-13) |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | Helpdesk audit 10 fixes (2026-04-14) |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | Sessão maratona: Helpdesk inbox + M19 S8 + S8.1 (2026-04-25) |
| [[wiki/handoff-2026-04-27]] | **HANDOFF da sessão 2026-04-27** — Auditoria geral + M19-S10 v2 Service Categories shipped + pendências de teste |
| [[wiki/melhorias-auditoria-2026-04-27]] | Auditoria 2026-04-27: 24 bugs + 210 melhorias (índice geral) |
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
| [[wiki/casos-de-uso/ai-agent-detalhado]] | 15 | 9 tools, SDR, shadow, validator, TTS, prompt studio, profiles, NPS, knowledge base, circuit breaker, debounce, greeting, memoria, contexto canal |
| [[wiki/casos-de-uso/leads-detalhado]] | 12 | Perfil 25+ campos, badge origem, timeline jornada, block IA, clear context, CSV, auto-criacao, formularios, funil card, modal conversa, CRM |
| [[wiki/casos-de-uso/crm-kanban-detalhado]] | 11 | Boards, colunas drag&drop, cards, campos 5 tipos, entidades, acesso, filtros, IA move_kanban, ticket resolution, funis 7 templates |
| [[wiki/casos-de-uso/catalogo-detalhado]] | 10 | Tabela visual, formulario, URL scraping, CSV, batch scrape, imagens, busca fuzzy 4 camadas, categorias, bio link, IA descricao |
| [[wiki/casos-de-uso/broadcast-detalhado]] | 12 | 4 tipos conteudo (texto/midia/carrossel/enquete), grupos vs leads, importador 4 metodos, delay anti-ban, agendamento, historico, templates, verificacao numeros |
| [[wiki/casos-de-uso/campanhas-detalhado]] | 12 | Link rastreavel, QR code, landing page (countdown/form), atribuicao, guards, metricas, contexto IA, clone, 6 tipos, visitas, leads convertidos |
| [[wiki/casos-de-uso/formularios-detalhado]] | 13 | Form builder, 16 tipos campo, 12 templates, FORM:slug trigger, form-bot (sessao/validacao/retry), form-public (landing), webhook, auto-lead, contexto IA, automacao |
| [[wiki/casos-de-uso/bio-link-detalhado]] | 10 | Pagina publica Linktree-style, 5 tipos botao, 3 templates, captacao leads, analytics, contexto IA, agendamento botoes, catalogo, funis |
| [[wiki/casos-de-uso/funis-detalhado]] | 13 | Wizard 4 passos, 7 tipos, auto-criacao tudo, motor automacao (7+4+6), funis agenticos, perfis IA, metricas, tag funil:SLUG, kanban visual |
| [[wiki/casos-de-uso/motor-automacao-detalhado]] | 9 | 7 gatilhos detalhados, 4 condicoes, 6 acoes, fluxo execucao, editor visual, CRUD hooks, NPS trigger, tratamento erros |
| [[wiki/casos-de-uso/enquetes-nps-detalhado]] | 10 | 4 canais envio, UAZAPI /send/menu, rastreamento votos, auto-tags D2, NPS automatico, notificacao nota ruim, dashboard metricas, config admin |
| [[wiki/casos-de-uso/fluxos-detalhado]] | 18 | Fluxos v3.0 M18: orquestrador, 12 sprints, 8 subagentes, validator, shadow, metricas, templates, migração por instância, E2E |
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

*Ultima atualizacao: 2026-04-27 — Auditoria geral do projeto (somente leitura). 24 inconsistências detectadas, 210 melhorias documentadas em 5 wikis temáticas. Achado: pergunta "brilho/fosco" hardcoded em 4 locais sem UI admin. Sessão anterior (04-26): Refactor do orquestrador. Próximo: corrigir top-10 documentais (README, PRD header, AGENTS) ou seguir M19 S6/S7.*
