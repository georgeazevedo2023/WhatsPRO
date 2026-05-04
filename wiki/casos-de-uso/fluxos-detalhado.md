---
title: Fluxos v3.0 — Casos de Uso Detalhados (Índice)
tags: [fluxos, orquestrador, casos-de-uso, m18, subagentes, templates, indice]
sources: [wiki/fluxos-visao-arquitetura, wiki/fluxos-roadmap-sprints, log.md]
updated: 2026-05-04
---

# M18 — Fluxos v3.0 — Casos de Uso (Índice das 18 Sub-Funcionalidades)

> Orquestrador de fluxos conversacionais que unifica Bio Link, Campanhas, Formulários, Funis e AI Agent em experiência única. Produção: `USE_ORCHESTRATOR` por instância.
>
> Um **Fluxo** é uma automação conversacional completa: define o que acontece do momento que um lead chega até a resolução. O admin configura uma vez, o orquestrador executa para cada lead de forma personalizada.
>
> **Diferença do AI Agent simples:** o AI Agent responde a perguntas. O Fluxo *conduz* uma conversa com objetivo específico (vender, qualificar, suportar), com memória entre sessões, subagentes especializados e métricas por fluxo.

---

## Sub-páginas (organizadas por área)

A documentação das 18 sub-funcionalidades foi particionada em 2 wikis temáticas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o índice abaixo para navegar:

| Sub-página | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/fluxos-orquestrador-subagentes]] | **1** Criação via Formulário Direto, **2** Criação via Conversa Guiada, **3** Instalação de Templates, **4** Gatilhos (16 tipos), **5** Intent Detector (3 camadas), **6** Subagente Greeting, **7** Subagente Qualification, **8** Subagente Sales, **9** Subagente Support, **10** Subagente Survey, **11** Subagente Followup, **12** Subagente Handoff |
| [[wiki/casos-de-uso/fluxos-templates-metricas-migracao]] | **13** Validator (10 checks), **14** Shadow Mode, **15** Métricas por Fluxo, **16** Migração Gradual por Instância, **17** E2E Test Script, **18** Memory Service + apêndice técnico (pipeline + 14 tabelas) |

---

## Como navegar pelo fluxos-detalhado

- Quer entender **como criar um fluxo** (formulário, conversa guiada, templates)? → `fluxos-orquestrador-subagentes`
- Estudando **gatilhos e classificação de intenção**? → `fluxos-orquestrador-subagentes`
- Trabalhando com **subagentes** (greeting, qualification, sales, support, survey, followup, handoff)? → `fluxos-orquestrador-subagentes`
- Configurando **validações de saída** (10 checks anti-alucinação) ou **shadow mode**? → `fluxos-templates-metricas-migracao`
- Acompanhando **métricas, dashboards e relatórios compartilháveis**? → `fluxos-templates-metricas-migracao`
- Fazendo **migração gradual de instância**, rodando **E2E** ou usando **memória persistente**? → `fluxos-templates-metricas-migracao`

---

## Links Relacionados

- [[wiki/fluxos-visao-arquitetura]] — Visão, 4 etapas, orquestrador, 12 templates
- [[wiki/fluxos-roadmap-sprints]] — 12 sprints com entregáveis e bugs corrigidos
- [[wiki/fluxos-banco-dados]] — Schema completo do banco
- [[wiki/fluxos-params-atendimento]] — Parâmetros P0-P3
- [[wiki/fluxos-params-inteligencia]] — Parâmetros P4, P5, P8
- [[wiki/modulos]] — Todos os módulos M1-M18

---

*Documentado em: 2026-04-12 — Documentação detalhada do M18 Fluxos v3.0*
*Rev 1 (2026-05-04): Particionado em 2 sub-wikis temáticas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou índice.*
