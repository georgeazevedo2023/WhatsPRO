---
title: Visao do Produto
tags: [produto, whatsapp, crm, helpdesk, automacao, perfis, enquetes, fluxos, metricas]
sources: [CLAUDE.md, PRD.md]
updated: 2026-04-27
---

# Visao do Produto

## O que e o WhatsPRO

Plataforma multi-tenant de **atendimento WhatsApp** (helpdesk) e **CRM** com agente IA. Combina gestao de conversas, automacao de vendas, CRM kanban, campanhas, funis inteligentes e enquetes — tudo via WhatsApp.

## Core Value

Agente IA que qualifica leads e vende produtos via WhatsApp, sem intervencao humana ate o handoff. Perfis de atendimento adaptam o comportamento por contexto. Motor de automacao executa acoes sem IA. NPS automatico mede satisfacao.

## Roles

| Role | Acesso |
|------|--------|
| `super_admin` | Tudo — instancias, inboxes, usuarios, agente IA, funis, automacoes |
| `gerente` | Gerencia equipe dentro dos inboxes atribuidos, CRM, leads |
| `user` | Atende conversas nos inboxes atribuidos |

## Modulos (19)

### Comunicacao
- **Helpdesk** — Chat real-time, labels, assignments, departamentos, bulk actions
- **Broadcast** — Mensagens em massa (texto, midia, carrossel, **enquetes nativas**)
- **Formularios WhatsApp (M12)** — Forms via chat com validacao e webhook externo

### Inteligencia
- **AI Agent (M10)** — 9 tools, SDR, shadow mode, TTS, **perfis de atendimento**, enquetes
- **Perfis (M17 F3)** — Pacotes reutilizaveis de prompt + handoff rules por contexto
- **Motor de Automacao (M17 F1)** — Gatilho > Condicao > Acao (7+4+6)
- **Validator Agent** — Audita respostas IA (score 0-10, PASS/REWRITE/BLOCK)

### CRM & Leads
- **Leads (M11)** — Cards, timeline, conversas, qualificacao, badge de origem
- **CRM Kanban** — Boards customizaveis com campos e integracao de leads
- **Catalogo** — Produtos com scraping de URL, busca fuzzy (pg_trgm)

### Campanhas & Funis
- **Campanhas UTM** — Links, QR codes, metricas, landing pages, attribution guards
- **Bio Link (M14)** — Linktree-style com captacao de leads e contexto AI
- **Funis (M16)** — Orquestra campanhas + bio + forms + kanban. 7 tipos de funil.
- **Enquetes (M17 F4)** — Enquetes nativas WhatsApp (poll) via UAZAPI /send/menu

### Analytics
- **Dashboard** — KPIs, performance por agente, metricas de funil, **NPS**
- **NPS (M17 F5)** — Enquete automatica pos-resolve, nota ruim notifica gerente
- **Intelligence** — Analises avancadas, filtros por instancia/periodo/funil

## Producao

- **URL:** crm.wsmart.com.br
- **Infra:** Docker Swarm + Traefik + SSL (Hetzner CX42)
- **CI/CD:** GitHub Actions → ghcr.io → Portainer stack
- **Versao:** 7.13.0 (2026-04-25)

## Numeros do Projeto

| Metrica | Valor |
|---------|-------|
| Modulos implementados | 19 (M1-M19) |
| Sub-funcionalidades documentadas | 210+ |
| Edge functions | 38 |
| Milestones shipped | v1.0 + M2 + M12-M18 completos; M19 em progresso (S1-S5 + S8 + S8.1) |
| Wikis detalhadas | 21 documentos em wiki/casos-de-uso/ |
| Versao | 7.13.0 (2026-04-25) |

## Links

- [[wiki/visao-geral-completa]] — Visao geral completa com jornada, numeros, stack, documentacao
- [[wiki/ai-agent]] — Detalhes do agente IA
- [[wiki/modulos]] — Todos os modulos em detalhe
- [[wiki/arquitetura]] — Stack tecnica
- [[wiki/roadmap]] — Status e proximos passos
- [[wiki/arquitetura-docs]] — Como a documentacao se organiza
