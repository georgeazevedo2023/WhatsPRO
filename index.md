---
title: WhatsPRO — Master Index
updated: 2026-05-04
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
| [[log.md]] | **Sessão atual 2026-05-02 → 2026-05-03** — Auditoria profunda Helpdesk (nota 7.4/10) + 14 melhorias UX + Top tabs viram ESCOPO + Header mobile-first + Equipe gerenciar deptos inline + redesign expanded view |
| [[wiki/melhorias-auditoria-2026-04-27]] | Auditoria 2026-04-27: 24 bugs + 210 melhorias (índice geral) |
| [[wiki/auditoria-helpdesk-2026-05-02]] | Auditoria profunda Helpdesk + Banco (2026-05-02): nota 7.4/10, 6 sprints de plano de ação |
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
| [[wiki/casos-de-uso/leads-detalhado]] | 12 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/leads-visao-perfil]] | 4 | Página de Leads, KPIs, Card+Perfil 25+ campos, Badge Origem, Timeline Jornada |
| ↳ [[wiki/casos-de-uso/leads-inteligencia-controle]] | 4 | Block IA, Clear Context, Funil Ativo, Kanban CRM |
| ↳ [[wiki/casos-de-uso/leads-captura-historico]] | 4 | Importação CSV, Auto-Criação, Formulários Respondidos, Modal de Conversa |
| [[wiki/casos-de-uso/crm-kanban-detalhado]] | 11 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/crm-kanban-estrutura]] | 4 | Página de Boards, Quadro Kanban (Colunas + Drag&Drop), Gestão de Colunas, Controle de Acesso |
| ↳ [[wiki/casos-de-uso/crm-kanban-cards-campos]] | 4 | Cards, Campos Customizáveis, Entidades Reutilizáveis, Filtros e Busca |
| ↳ [[wiki/casos-de-uso/crm-kanban-integracoes]] | 3 | IA `move_kanban`, Finalização de Ticket, Integração com Funis |
| [[wiki/casos-de-uso/catalogo-detalhado]] | 10 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/catalogo-crud-ui]] | 5 | Tabela, Formulário, Imagens, Categorias, Descrição IA |
| ↳ [[wiki/casos-de-uso/catalogo-importacao]] | 3 | Importação URL (scraping), CSV, Batch Scrape |
| ↳ [[wiki/casos-de-uso/catalogo-busca-integracoes]] | 2 | Busca Inteligente (4 camadas + fuzzy), Bio Link |
| [[wiki/casos-de-uso/broadcast-detalhado]] | 12 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/broadcast-conteudo]] | 3 | 4 Tipos de Conteúdo (texto/mídia/carrossel/enquete), Templates, Construtor de Carrossel |
| ↳ [[wiki/casos-de-uso/broadcast-audiencia]] | 4 | Modos Grupos vs Leads, Importador 4 formas, Lead Databases, Verificação de Números |
| ↳ [[wiki/casos-de-uso/broadcast-execucao]] | 5 | Agendamento, Delay anti-ban, Progresso real-time, Seleção Instância, Histórico |
| [[wiki/casos-de-uso/campanhas-detalhado]] | 12 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/campanhas-criacao]] | 5 | Criação, Link/QR, Landing Page, Fluxo Redirect, 6 Tipos+Templates |
| ↳ [[wiki/casos-de-uso/campanhas-tracking]] | 3 | Atribuição automática+tags, Contexto IA, Visitas com metadados |
| ↳ [[wiki/casos-de-uso/campanhas-operacao]] | 4 | Métricas, Clone, Leads convertidos, Gestão de Status |
| [[wiki/casos-de-uso/formularios-detalhado]] | 13 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/formularios-construtor]] | 3 | Construtor, 16 Tipos de Campo, 12 Templates Prontos |
| ↳ [[wiki/casos-de-uso/formularios-execucao]] | 4 | FORM:slug trigger, form-bot session, validações, form-public landing |
| ↳ [[wiki/casos-de-uso/formularios-integracao]] | 6 | Webhook externo, Auto-criação lead, Contexto AI, "Usado em", Submissões+CSV, Automação |
| [[wiki/casos-de-uso/bio-link-detalhado]] | 10 (índice) | Particionado 2026-05-04 em 2 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/bio-link-configuracao]] | 4 | Criação/Edição, 5 Tipos de Botão, Página Pública, Gestão e Status |
| ↳ [[wiki/casos-de-uso/bio-link-operacao]] | 6 | Captação de Leads, Analytics, Contexto IA, Funis, Formulários, Catálogo |
| [[wiki/casos-de-uso/funis-detalhado]] | 13 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/funis-wizard-tipos]] | 4 | Wizard de Criação, 7 Tipos, Importar Recursos, Sidebar Unificada |
| ↳ [[wiki/casos-de-uso/funis-operacao-visualizacao]] | 5 | Lista+KPIs, Detalhe+5 Tabs, Tag funil:SLUG, LeadFunnelCard, OriginBadge |
| ↳ [[wiki/casos-de-uso/funis-inteligencia-metricas]] | 4 | Motor Automação F1, Funis Agênticos F2, Perfis F3, Métricas |
| [[wiki/casos-de-uso/motor-automacao-detalhado]] | 9 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/motor-automacao-componentes]] | 3 | Os 7 Gatilhos, As 4 Condições, As 6 Ações |
| ↳ [[wiki/casos-de-uso/motor-automacao-execucao]] | 4 | Fluxo de Execução, Onde gatilhos são chamados, NPS via Motor, Tratamento de Erros |
| ↳ [[wiki/casos-de-uso/motor-automacao-editor]] | 2 | Editor Visual de Regras, CRUD de Regras |
| [[wiki/casos-de-uso/enquetes-nps-detalhado]] | 10 (índice) | Particionado 2026-05-04 em 3 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] | 3 | Criação (PollEditor), 4 Canais de Envio, Endpoint UAZAPI |
| ↳ [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] | 3 | Rastreamento de Respostas, Auto-Tags por Opção (D2), Exibição no Helpdesk |
| ↳ [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] | 4 | NPS Automático, Notificação Nota Ruim, Dashboard, Configuração Admin |
| [[wiki/casos-de-uso/fluxos-detalhado]] | 18 (índice) | Particionado 2026-05-04 em 2 sub-wikis abaixo |
| ↳ [[wiki/casos-de-uso/fluxos-orquestrador-subagentes]] | 12 | Criação (form/guiada/templates), Gatilhos, Intent Detector, 7 Subagentes |
| ↳ [[wiki/casos-de-uso/fluxos-templates-metricas-migracao]] | 6 | Validator, Shadow Mode, Métricas, Migração Gradual, E2E, Memory Service |
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

*Última atualização: 2026-05-04 (auditoria de vault) — Estado atual: PRD v7.20.3, M19 ativo (S6/S7/S9 abertos). Sessões recentes: **v7.19.0 Auditoria Profunda Helpdesk** (nota 7.4/10, 14 melhorias UX shipadas em 6 ondas, trigger DB centraliza last_message_at), **v7.20.0 Top tabs viram ESCOPO** (Minhas/Não atribuídas/Todas), **v7.20.1 Header mobile-first** (HIG compliant, drop título redundante, inbox como pill), **v7.20.2 Equipe gerenciar deptos inline**, **v7.20.3 redesign expanded view** (cards por caixa, fix link 404). Bundle prod `index-CFmkOcne.js`, ai-agent v173 deployado em prod. **Pendência operacional**: 1 commit não-pushado (`5679edd`).*
