---
title: Integração de Funis — Campanhas + Bio Link + Formulários + AI Agent (Índice)
tags: [funis, campanhas, bio-link, formularios, ai-agent, integracao, jornada, m15, m16, indice]
sources: [CLAUDE.md, PRD.md, M15, M16]
updated: 2026-05-04
---

# Integração de Funis — Como Tudo se Conecta (Índice)

> **ATUALIZADO M16**: Tudo unificado sob "Funis". O admin cria funis (não campanhas/bios/forms separados). A tabela `funnels` orquestra os 3 módulos via FK. Tag `funil:SLUG` é propagada automaticamente. AI Agent recebe `<funnel_context>`.
>
> Guia completo de como Campanhas, Bio Link, Formulários e AI Agent trabalham juntos no WhatsPRO. Inclui fluxos de dados, painel admin e exemplos de jornada.

---

## Sub-páginas (organizadas por área)

A documentação foi particionada em 3 wikis temáticas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o índice abaixo para navegar:

| Sub-página | Conteúdo coberto |
|------------|------------------|
| [[wiki/integracao-funis-arquitetura]] | **§1** Visão geral dos 4 sistemas, **§2** Fluxo de dados, módulo `leadHelper.ts`, tags unificadas de origem, contexto injetado no AI Agent, prioridade de `origin` |
| [[wiki/integracao-funis-painel]] | **§3** Onde ver tudo no painel admin: Campanhas (3.1), Bio Link (3.2), Formulários (3.3), Lead/Jornada (3.4), AI Agent (3.5) |
| [[wiki/integracao-funis-jornadas]] | **§4** Cinco jornadas completas (Sorteio, Vaga de emprego, Lançamento, WhatsApp Form, Captação orgânica) + **§5** Tabela de referência rápida |

---

## Como navegar

- Querendo entender **como os sistemas se conectam tecnicamente** (leadHelper, tags, contexto AI)? → `integracao-funis-arquitetura`
- Procurando **onde ver/configurar no painel admin**? → `integracao-funis-painel`
- Quer ver **exemplos práticos ponta-a-ponta** (admin + lead + painel)? → `integracao-funis-jornadas`

---

## Os 4 Sistemas em Resumo

| Sistema | O que faz | Onde no painel |
|---------|-----------|----------------|
| **Campanhas** | Links rastreáveis com UTM, QR Code, métricas de conversão | Sidebar → Campanhas → Todas |
| **Bio Link** | Páginas públicas tipo Linktree com botões rastreáveis | Sidebar → Bio Link → Todas as páginas |
| **Formulários** | Coletam dados via WhatsApp (chat) ou landing page (web) | Sidebar → Formulários |
| **AI Agent** | Robô de IA que atende automaticamente, usando contexto dos 3 sistemas acima | Sidebar → Agente IA → Configuração |

---

## Links Relacionados

- [[wiki/modulos]] — Lista de módulos
- [[wiki/ai-agent]] — Detalhes do AI Agent
- [[wiki/roadmap]] — M15 F3-F5 no backlog (Hub de Funis, Templates, Métricas)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — AI Agent em profundidade

---

*Rev 1 (2026-04-08): Documentação original M15 + atualização M16 (unificação sob Funis)*
*Rev 2 (2026-05-04): Particionado em 3 sub-wikis para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou índice.*
