---
title: Leads Database — Documentacao Detalhada (Índice)
tags: [leads, funcionalidades, perfil, timeline, origem, crm, detalhado, indice]
sources: [src/components/leads/, src/pages/dashboard/Leads.tsx, src/pages/dashboard/LeadDetail.tsx]
updated: 2026-05-04
---

# Leads Database — Cadastro Inteligente de Clientes (Índice das 12 Sub-Funcionalidades)

> O modulo de Leads e o **cadastro de todos os contatos** que ja conversaram com a empresa pelo WhatsApp. Pense nele como uma **agenda de clientes inteligente**: nao e so nome e telefone — cada lead tem um perfil completo com tudo que a IA coletou, todos os formularios que preencheu, todas as campanhas por onde chegou, e toda a jornada desde o primeiro clique ate a ultima compra.
>
> Sem isso, cada conversa no WhatsApp e isolada. O atendente nao sabe se aquele numero ja comprou antes, se e um lead frio ou quente, de qual campanha veio, ou o que a IA ja descobriu sobre ele. O modulo de Leads centraliza **tudo sobre cada pessoa** em um unico lugar.
>
> Ver tambem: [[wiki/ai-agent]] (agente que coleta os dados), [[wiki/casos-de-uso/helpdesk-detalhado]] (onde as conversas acontecem), [[wiki/modulos]] (todos os modulos)

---

## Sub-páginas (organizadas por área)

A documentação das 12 sub-funcionalidades foi particionada em 3 wikis temáticas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o índice abaixo para navegar:

| Sub-página | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/leads-visao-perfil]] | **3.1** Página de Leads (KPIs e Gráficos), **3.2** Card do Lead (Perfil Completo), **3.3** Badge de Origem, **3.4** Timeline de Jornada |
| [[wiki/casos-de-uso/leads-inteligencia-controle]] | **3.5** Ligar/Desligar IA por Lead (Block IA), **3.6** Limpar Contexto (Clear Context), **3.10** Card do Funil Ativo, **3.12** Integração com CRM Kanban |
| [[wiki/casos-de-uso/leads-captura-historico]] | **3.7** Importação CSV, **3.8** Auto-Criação de Leads, **3.9** Formulários Respondidos, **3.11** Modal de Conversa + Apêndices (árvore de componentes, tabelas do banco) |

---

## Como navegar pelo leads-detalhado

- Procurando **como visualizar leads** (KPIs, perfil, origem, timeline da jornada)? → `leads-visao-perfil`
- Trabalhando com **controle da IA por lead** (bloquear, resetar) ou **pipeline comercial** (funil, Kanban)? → `leads-inteligencia-controle`
- Precisa **importar leads em massa**, entender **auto-criação** ou **revisar formulários e conversas antigas**? → `leads-captura-historico`

---

## Links Relacionados

- [[wiki/ai-agent]] — Agente IA que coleta os dados dos leads automaticamente
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento onde as conversas acontecem
- [[wiki/casos-de-uso/ai-agent-detalhado]] — 9 tools do agente (update_lead_profile, set_tags, move_kanban)
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco
- [[wiki/integracao-funis]] — Como Campanhas + Bio + Forms se conectam aos Leads

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis temáticas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou índice.*
