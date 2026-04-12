---
title: WhatsPRO — Master Index
updated: 2026-04-12
type: index
---

# WhatsPRO — Master Index

> Ponto de entrada para a IA (Claude Code) e humanos navegarem toda a base de conhecimento. Atualizado a cada ingest/mudança significativa.

---

## Arquitetura de Documentacao (4 arquivos raiz)

> O projeto usa 4 arquivos na raiz que se complementam. O CLAUDE.md e o orquestrador enxuto (96 linhas) que carrega automaticamente. Os demais sao carregados sob demanda.

| Arquivo | Linhas | Funcao | Carregamento |
|---------|--------|--------|--------------|
| [[CLAUDE.md]] | ~120 | Orquestrador — protocolos, regras de ouro, links, regras de documentacao | Automatico (toda sessao) |
| [[RULES.md]] | ~230 | Regras detalhadas — integridade, entrega, SYNC, CORS, AI Agent, documentacao e notas | Sob demanda |
| [[ARCHITECTURE.md]] | 87 | Referencia tecnica — stack, edge functions, deploy, modulos, roles | Sob demanda |
| [[PATTERNS.md]] | 150 | Padroes de implementacao — 12 areas tematicas | Sob demanda |

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
| [[wiki/log-arquivo-2026-04-04-a-09]] | Log historico arquivado |

## Wiki — Fluxos v3.0 (design em andamento)

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
| [[wiki/casos-de-uso/helpdesk-detalhado]] | 25 | Etiquetas, tags, notas privadas, toggle IA, status, prioridade, bulk, templates, midia, transcricao, resumo IA, typing, rascunhos, finalizacao, historico, busca global, filtros, realtime |
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

*Ultima atualizacao: 2026-04-12 — S1 ✅ S2 ✅ S3 ✅ S4 ✅ S5 ✅ S6 ✅ S7 ✅. Camadas 1+2+Intelligence(S7) completas. USE_ORCHESTRATOR=false (S12 migra por instância). Próximo: S8 Sales + Support.*
