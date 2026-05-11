---
title: WhatsPRO — Master Index
type: index
updated: 2026-05-11
audited_at: 2026-05-11
---

# WhatsPRO — Master Index

> Ponto de entrada do vault. Mapa navegável pra IA (Claude Code) e humanos. Ver `CLAUDE.md` pra orquestração e regras de uso.

---

## 🚦 Sempre consultar (protocolo de início — passos 1-5)

| Página | Conteúdo |
|--------|----------|
| [[wiki/roadmap]] | Milestones + fases + status atual + bloqueios |
| [[wiki/erros-e-licoes]] | Top-3 lições recentes + ponteiros pra regras e histórico |
| [[wiki/decisoes-chave]] | Decisões ativas (D27-D30) + regras integridade/SYNC/CORS/HIGH RISK |
| [[log.md]] | Sessões dos últimos ~3 dias (arquivo histórico via ponteiros no fim) |
| [[wiki/deploy-checklist]] | Checklist obrigatório antes de deploy |

## 🛡️ Operacional secundário

| Página | Quando |
|--------|--------|
| [[wiki/protocolo-subagentes]] | Tarefa grande — ondas paralelas |
| [[wiki/free-forever-playbook]] | Monitoring Supabase 60/70/85% |
| [[wiki/erros/regras-preventivas]] | ~30 regras destiladas dos incidentes (tabela) |

---

## 📦 Produto — referência principal

| Página | Conteúdo |
|--------|----------|
| [[PRD.md]] (raiz) | Índice + ponteiros (67 lin) |
| [[CHANGELOG.md]] (raiz) | Releases recentes (~14 dias) |
| [[wiki/modulos]] | Tasks por módulo (M1-M9) — split do PRD |
| [[wiki/infraestrutura]] | Stack, edge fns, storage, segurança |
| [[wiki/audio-pipeline]] | Fluxo end-to-end UAZAPI → Groq → DB → UI |
| [[wiki/visao-geral-projeto]] | O que é, problema, papéis, competidores |
| [[wiki/visao-geral-modulos]] | Os 19 módulos em 5 grupos |
| [[wiki/visao-geral-arquitetura]] | Stack, 59 tabelas, fluxo dados ponta-a-ponta |
| [[wiki/visao-geral-jornadas-numeros]] | Jornada do lead, números, milestones futuros |
| [[wiki/ai-agent]] | AI Agent: tools, SDR, handoff, shadow, validator |
| [[wiki/arquitetura]] | Stack, estrutura de pastas, edge fns |
| [[wiki/banco-de-dados]] | Tabelas Supabase, RLS, materialized views |

## 📅 Roadmap detalhado

| Página | Conteúdo |
|--------|----------|
| [[wiki/roadmap/planejado-resumo]] | Listas resumidas dos itens planejados |
| [[wiki/roadmap/m10-agente-ia-part1]] · [[wiki/roadmap/m10-agente-ia-part2]] | M10 Agente IA (12 tasks) |
| [[wiki/roadmap/m11-ecommerce-part1]] · [[wiki/roadmap/m11-ecommerce-part2]] | M11 E-commerce (12 tasks) |
| [[wiki/roadmap/m12-formularios]] | M12 Formulários |
| [[wiki/roadmap/m13-cursos-part1]] · [[wiki/roadmap/m13-cursos-part2]] | M13 Cursos & Membership (10 tasks) |
| [[wiki/roadmap/melhorias-existentes]] | R18-R30 em módulos existentes |

---

## 📜 Histórico — diretórios

| Diretório | Conteúdo |
|-----------|----------|
| `wiki/changelog/` (10 arquivos) | Releases arquivadas por mês (2026-pre-04, -04, -05) em partes |
| `wiki/erros/` (3 arquivos) | Regras preventivas + histórico R91-R114 |
| `wiki/historico-planos/` (9 arquivos) | Planos shipados (enquetes-polls, S10, S11) particionados |
| `wiki/log-arquivo-*` (12+ arquivos) | Logs históricos particionados ≤300 lin cada |

Última entrada do log ativo: `log.md`. Anteriores acessíveis via ponteiros no fim do `log.md`.

---

## 🎯 Fluxos v3.0 — M18 shipped 2026-04-12

| Página | Conteúdo |
|--------|----------|
| [[wiki/fluxos-visao-arquitetura]] | Visão, 4 etapas, orquestrador, 12 templates |
| [[wiki/fluxos-params-atendimento]] | P0-P3: Saudação, Qualificação, Produtos, Interações |
| [[wiki/fluxos-params-inteligencia]] | P4, P5, P8: Tags, Segurança, Lead Score |
| [[wiki/fluxos-params-entrada]] | P6-P7, P10-P13: Gatilhos, Condições, UTM, QR, Forms |
| [[wiki/fluxos-params-biolink]] | P9: Bio Link (15 sub-params, 12+ templates) |
| [[wiki/fluxos-servicos]] | Memory, Audio (STT/TTS), Validator, Metrics |
| [[wiki/fluxos-detector-intents]] | 13 intents, 3 camadas, normalização BR |
| [[wiki/fluxos-shadow-mode]] | Shadow Mode: 7 dimensões |
| [[wiki/fluxos-banco-dados]] | Schema: 14 tabelas, 4 grupos |
| [[wiki/fluxos-roadmap-sprints]] | 12 sprints (todas shipped) |
| [[wiki/fluxos-wireframes-admin]] | Índice das 5 telas |
| [[wiki/fluxos-wireframes-listagem]] · [[wiki/fluxos-wireframes-wizard]] · [[wiki/fluxos-wireframes-guiada]] · [[wiki/fluxos-wireframes-editor]] | Wireframes especializados |

---

## 📚 Casos de uso (didático + técnico)

> Cada arquivo descreve uma área: o que é, como funciona, cenários reais, blocos técnicos (componentes, tabelas, queries).

| Página | Conteúdo |
|--------|----------|
| [[wiki/casos-de-uso/helpdesk-detalhado]] (índice) | Helpdesk — 5 sub-páginas abaixo |
| ↳ [[wiki/casos-de-uso/helpdesk-organizacao]] | Etiquetas, tags, notas, status, prioridade, atribuição |
| ↳ [[wiki/casos-de-uso/helpdesk-ia]] | Toggle IA, transcrição áudio, resumo, finalização |
| ↳ [[wiki/casos-de-uso/helpdesk-comunicacao]] | Templates, 10 tipos de mídia, rascunhos, emoji, reply |
| ↳ [[wiki/casos-de-uso/helpdesk-ux]] | Layout 3 paineis, typing, espera, busca Ctrl+K, filtros |
| ↳ [[wiki/casos-de-uso/helpdesk-permissoes]] | Permissões granulares de inbox (D21, R73) |
| [[wiki/casos-de-uso/ai-agent-detalhado]] (índice) | AI Agent — 4 sub-páginas abaixo |
| ↳ [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] | LLM gpt-4.1-mini + 9 ferramentas |
| ↳ [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] | Fluxo SDR + Shadow Mode |
| ↳ [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] | Validator + TTS + Prompt Studio |
| ↳ [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] | Perfis, NPS, KB, Debounce, Memória |
| [[wiki/casos-de-uso/handoff-fila-detalhado]] | D30 — Fila Inteligente completa |
| [[wiki/casos-de-uso/excluded-products-detalhado]] | D28 — Produtos NÃO vendidos |
| [[wiki/casos-de-uso/admin-detalhado]] | super_admin: 9 páginas + 3 edge fns + 3 camadas |
| [[wiki/casos-de-uso/leads-detalhado]] | Perfil 25+ campos, badge origem, timeline, CSV |
| [[wiki/casos-de-uso/crm-kanban-detalhado]] | Boards, drag&drop, IA `move_kanban`, ticket resolution |
| [[wiki/casos-de-uso/catalogo-detalhado]] | URL scraping, CSV, batch, fuzzy 4 camadas |
| [[wiki/casos-de-uso/broadcast-detalhado]] | 4 tipos conteúdo, importador 4 métodos, delay anti-ban |
| [[wiki/casos-de-uso/campanhas-detalhado]] | Link rastreável, QR, landing, atribuição, 6 tipos |
| [[wiki/casos-de-uso/formularios-detalhado]] | Builder, 16 tipos campo, FORM:slug, webhook |
| [[wiki/casos-de-uso/bio-link-detalhado]] | Linktree, 5 tipos botão, 3 templates, captação |
| [[wiki/casos-de-uso/funis-detalhado]] | Wizard 7 tipos, motor automação, agênticos, métricas |
| [[wiki/casos-de-uso/motor-automacao-detalhado]] | 7 gatilhos, 4 condições, 6 ações |
| [[wiki/casos-de-uso/enquetes-nps-detalhado]] | 4 canais, /send/menu, auto-tags, NPS, dashboard |
| [[wiki/casos-de-uso/fluxos-detalhado]] | Fluxos v3.0 M18: orquestrador, 12 sprints, 8 subagentes |
| [[wiki/casos-de-uso/agendamentos-detalhado]] | Único/recorrente, delay, edge fn de processamento |
| [[wiki/casos-de-uso/dashboard-detalhado]] | KPIs, gráficos, performance, Intelligence |
| [[wiki/casos-de-uso/agent-qa-detalhado]] | Batches, score composto, aprovação, regressão |
| [[wiki/casos-de-uso/instancias-detalhado]] | QR, status, controle acesso, detalhes 4 abas |
| [[wiki/casos-de-uso/deploy-detalhado]] | Docker, CI/CD, Hetzner+Portainer, edge fns |
| [[wiki/casos-de-uso/db-retention-detalhado]] | Retenção, visibility, alerts, cleanup, backup JSONL |
| [[wiki/casos-de-uso/guia-funcionalidades-completo]] | Guia rápido: 13 features + 10 integrações |

---

## 🔍 Auditorias e Melhorias

| Página | Conteúdo |
|--------|----------|
| [[wiki/auditoria-completa-2026-05-05]] | 5 ondas paralelas, 0 P0 / 8 P1 / 11 P2 / 7 P3, 6 sprints |
| [[wiki/auditoria-admin-2026-05-04]] | Módulo Admin: nota 6.5/10, 7 sprints |
| [[wiki/auditoria-helpdesk-2026-05-02]] | Helpdesk + Banco: nota 7.4/10, 6 sprints |
| [[wiki/melhorias-helpdesk-2026-05-02]] | 20 melhorias do Helpdesk |
| [[wiki/melhorias-auditoria-2026-04-27]] | 24 bugs + 210 melhorias (índice) |
| [[wiki/melhorias-modulos-comunicacao]] · [[wiki/melhorias-modulos-inteligencia]] · [[wiki/melhorias-modulos-leads-crm]] · [[wiki/melhorias-modulos-canais]] · [[wiki/melhorias-modulos-plataforma]] | Melhorias por área (~210 itens) |

## 📊 Métricas

| Página | Conteúdo |
|--------|----------|
| [[wiki/metricas-leads-visao]] | Leads: visão, gaps, shadow, IA conversacional |
| [[wiki/metricas-vendedor-visao]] | Vendedor: performance, conversão, NPS, ranking |
| [[wiki/metricas-agente-ia-visao]] | IA: eficiência, qualidade, follow-up, custo |
| [[wiki/metricas-transbordo-visao]] | Transbordo: motivos, tempo pickup, conversão |
| [[wiki/metricas-origem-leads-visao]] | Origem: canais, atribuição UTM, ROI |
| [[wiki/metricas-plano-implementacao]] | Plano: 7 sprints, 55 tasks |

---

## 🧪 Sandbox / Migração / Playwright

| Página | Conteúdo |
|--------|----------|
| [[wiki/sandbox-ia-instancia]] | Sandbox IA: instância de teste 558185749970 |
| [[wiki/plano-testes-sandbox]] | 15 cenários (A smoke, B qualificação, C produtos, D handoff, E edge) |
| [[wiki/relatorio-testes-sandbox-sessao4]] | Relatório Sessão 4 — Onda 2 (6 cenários) |
| [[wiki/migracao-eletropiso-COMPLETA]] | Migração LIVE 2026-05-06 (ref consolidada) |
| [[wiki/migracao-eletropiso-handoff]] · [[wiki/migracao-eletropiso-inventario]] | Plano original + inventário Onda 0 |
| [[wiki/notif-handoff-vendedor]] | Notif handoff MVP (v7.32.0) |
| [[wiki/playwright-onda1]] · [[wiki/playwright-onda2]] · [[wiki/playwright-onda3]] · [[wiki/playwright-onda4]] | 4 ondas Playwright, 120 testes total |

---

## 📂 Casos especiais

| Página | Conteúdo |
|--------|----------|
| [[wiki/casos-de-uso/campanha-deputado-anderson]] | Case: campanha política deputado estadual PE |
| [[wiki/uazapi-polls-poll]] | Endpoint `/send/menu` (poll) + plano implementação |
| [[wiki/uazapi-polls-list-quickreply]] | Endpoints `/send/list` e `/send/quickreply` |
| [[wiki/uazapi-polls-casos-uso]] | 5 casos uso (AI, Broadcast, Forms, NPS, Campanha) |
| [[wiki/integracao-funis-arquitetura]] · [[wiki/integracao-funis-painel]] · [[wiki/integracao-funis-jornadas]] | M15 Integração Funis (3 sub-wikis) |
| [[wiki/testes-d30-sprint-f-playwright]] | Specs Playwright D30 Sprint F |
| [[wiki/handoff-2026-04-27]] | Handoff geral 2026-04-27 |
| [[wiki/arquitetura-docs]] | Meta: arquitetura dos docs do projeto |

---

## 🗂️ Fontes brutas / planejamento

| Arquivo | Conteúdo |
|---------|----------|
| `docs/CONTEXTO_PROJETO.md` | Contexto completo (snapshot v2.8.0) |
| `docs/REGRAS_ASSISTENTE.md` | Regras do Claude |
| `docs/AUDIT_V3.md` | Auditoria v3 |
| `.planning/ROADMAP.md` · `.planning/STATE.md` · `.planning/PROJECT.md` · `.planning/MILESTONES.md` | Estado GSD |

---

## 🏷️ Tags globais

#ai-agent #whatsapp #uazapi #supabase #edge-functions #crm #helpdesk #leads #kanban #broadcast #formularios #campanhas #tts #validator #d30-fila #notif-handoff #audio-pipeline #postgrest #schema-mismatch
