---
title: Visao Geral Completa — WhatsPRO (Indice)
tags: [visao, projeto, modulos, jornada, numeros, stack, documentacao, indice]
sources: [wiki/visao-produto.md, wiki/roadmap.md, wiki/modulos.md, ARCHITECTURE.md]
updated: 2026-05-04
---

# WhatsPRO — Visao Geral Completa do Projeto (Indice)

> Documento consolidado com a visao completa do WhatsPRO para onboarding de novos membros, investidores, ou sessoes de contexto. Escrito para leigos com blocos tecnicos para devs.

O WhatsPRO e uma **plataforma completa de atendimento e vendas via WhatsApp**. Imagine juntar o WhatsApp Web, um CRM de vendas, uma inteligencia artificial vendedora, um sistema de campanhas de marketing, e um construtor de funis — tudo num so lugar, acessivel pelo navegador em `crm.wsmart.com.br`.

A empresa conecta seus numeros de WhatsApp ao sistema, e a plataforma cuida de tudo: **atende clientes automaticamente com IA** (24h por dia, 7 dias por semana), qualifica leads, busca produtos no catalogo, envia fotos e carrosseis, transfere para humanos quando precisa, e organiza todo o pipeline de vendas num quadro visual.

**Multi-tenant** significa que varias empresas podem usar a mesma plataforma, cada uma com seus proprios dados, numeros e configuracoes — completamente isoladas entre si.

---

## Para Quem Este Documento Serve

| Perfil | O que ler primeiro |
|--------|-------------------|
| **Novo dev no time** | [[wiki/visao-geral-projeto]] → [[wiki/visao-geral-modulos]] → [[wiki/visao-geral-arquitetura]] |
| **Investidor / fundador** | [[wiki/visao-geral-projeto]] (problema + diferenciais) → [[wiki/visao-geral-jornadas-numeros]] (jornada + numeros) |
| **Gerente / cliente novo** | [[wiki/visao-geral-projeto]] → [[wiki/visao-geral-jornadas-numeros]] (jornada do lead) |
| **Tech lead / arquiteto** | [[wiki/visao-geral-arquitetura]] (stack, 59 tabelas, fluxo de dados) |
| **Sessao de contexto IA** | Esta pagina (indice) → as 4 sub-wikis em ordem |

---

## Sub-wikis (organizadas por tema)

A documentacao foi particionada em 4 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-wiki | O que cobre |
|----------|-------------|
| [[wiki/visao-geral-projeto]] | **O que e o WhatsPRO**, problema que resolve, perfis de uso, 3 papeis (Super Admin / Gerente / Atendente), analise competitiva (8 concorrentes), 6 diferenciais unicos, posicionamento de mercado |
| [[wiki/visao-geral-modulos]] | **Os 19 modulos** organizados em 5 grupos: Comunicacao (Helpdesk, Broadcast, Forms), Inteligencia (AI Agent, Motor, Enquetes/NPS, Agent QA), CRM & Leads (Leads DB, Kanban, Catalogo), Campanhas & Funis (UTM, Bio Link, Funis), Infraestrutura (Dashboard, Agendamentos, Instancias, Deploy) |
| [[wiki/visao-geral-arquitetura]] | **Stack tecnica** (React + Supabase + UAZAPI + OpenAI), arquitetura de documentacao (4 camadas), **banco de dados** com 59 tabelas em 9 dominios, **fluxo de dados** ponta-a-ponta (lead → webhook → IA → helpdesk → metricas) |
| [[wiki/visao-geral-jornadas-numeros]] | **Jornada completa de um lead** (cenario real loja de construcao, 11 etapas), numeros do projeto (17 modulos, 187 sub-funcs, 31 edge fns, 7 milestones), **roadmap por milestone** (v1.0 a M17), 15 ideias para o proximo roadmap, endpoints de producao |

---

## Como Navegar

- Quero saber **o que faz e por que existe** → [[wiki/visao-geral-projeto]]
- Quero ver **lista de funcionalidades** → [[wiki/visao-geral-modulos]]
- Sou dev e quero entender **a stack** → [[wiki/visao-geral-arquitetura]]
- Quero ver **um lead percorrer o sistema** → [[wiki/visao-geral-jornadas-numeros]]

---

## Links Relacionados

### Documentacao base
- [[wiki/visao-produto]] — Visao resumida do produto
- [[wiki/roadmap]] — Status de todos os milestones
- [[wiki/modulos]] — Tabela canonica dos 17 modulos
- [[wiki/arquitetura]] — Stack tecnica detalhada
- [[wiki/banco-de-dados]] — Esquema completo das 59 tabelas
- [[wiki/erros-e-licoes]] — Bugs e regras preventivas
- [[wiki/decisoes-chave]] — 10 decisoes arquiteturais (D1-D10)
- [[wiki/arquitetura-docs]] — Como a documentacao se organiza

### Funcionalidades detalhadas (17 wikis)
- [[wiki/casos-de-uso/helpdesk-detalhado]] (25) | [[wiki/casos-de-uso/ai-agent-detalhado]] (15) | [[wiki/casos-de-uso/leads-detalhado]] (12)
- [[wiki/casos-de-uso/crm-kanban-detalhado]] (11) | [[wiki/casos-de-uso/catalogo-detalhado]] (10) | [[wiki/casos-de-uso/broadcast-detalhado]] (12)
- [[wiki/casos-de-uso/campanhas-detalhado]] (12) | [[wiki/casos-de-uso/formularios-detalhado]] (13) | [[wiki/casos-de-uso/bio-link-detalhado]] (10)
- [[wiki/casos-de-uso/funis-detalhado]] (13) | [[wiki/casos-de-uso/motor-automacao-detalhado]] (9) | [[wiki/casos-de-uso/enquetes-nps-detalhado]] (10)
- [[wiki/casos-de-uso/agendamentos-detalhado]] (6) | [[wiki/casos-de-uso/dashboard-detalhado]] (8) | [[wiki/casos-de-uso/agent-qa-detalhado]] (8)
- [[wiki/casos-de-uso/instancias-detalhado]] (7) | [[wiki/casos-de-uso/deploy-detalhado]] (6)

### Casos de uso ricos
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rapido + 10 jornadas
- [[wiki/casos-de-uso/campanha-deputado-anderson]] — Case campanha politica

---

*Documentado em: 2026-04-10 — Visao geral consolidada do projeto WhatsPRO (187 sub-funcionalidades em 17 modulos, 59 tabelas, 7 milestones, versao 7.9.0)*
*Rev 4 (2026-05-04): Particionado em 4 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
