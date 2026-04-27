---
title: Helpdesk — Documentacao Detalhada (Índice)
tags: [helpdesk, funcionalidades, etiquetas, tags, notas, ia, chat, detalhado, indice]
sources: [src/components/helpdesk/, src/pages/dashboard/HelpDesk.tsx]
updated: 2026-04-27
---

# Helpdesk — Central de Atendimento WhatsApp (Índice das 26 Sub-Funcionalidades)

> O Helpdesk e a **central de atendimento** do WhatsPRO. Imagine uma tela parecida com o WhatsApp Web, mas profissional: do lado esquerdo ficam todas as conversas chegando (de varios numeros de WhatsApp ao mesmo tempo), e do lado direito fica o chat aberto com o cliente. Tudo em tempo real.
>
> Sem uma ferramenta assim, cada atendente precisaria de um celular com WhatsApp aberto. Com 5 atendentes e 3 numeros, seriam 5 celulares, sem controle de quem respondeu quem, sem historico, sem fila. O Helpdesk resolve tudo isso: **multiplos atendentes acessam multiplos WhatsApps pelo computador, com organizacao e rastreabilidade**.
>
> Ver tambem: [[wiki/ai-agent]], [[wiki/modulos]], [[wiki/banco-de-dados]]

---

## Sub-páginas (organizadas por área)

A documentação das 26 sub-funcionalidades foi particionada em 5 wikis temáticas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o índice abaixo para navegar:

| Sub-página | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/helpdesk-organizacao]] | **1.2** Etiquetas (Labels), **1.3** Tags (metadados), **1.4** Notas Privadas, **1.6** Status, **1.7** Prioridade, **1.8** Atribuição de Agente, **1.9** Departamentos, **1.10** Ações em Massa (Bulk) |
| [[wiki/casos-de-uso/helpdesk-ia]] | **1.5** Toggle IA (Ligada/Desligada/Shadow), **1.13** Transcrição de Áudio, **1.14** Resumo IA, **1.18** Finalizar Atendimento (TicketResolutionDrawer), **1.20** Contexto do Lead (perfil + handoff) |
| [[wiki/casos-de-uso/helpdesk-comunicacao]] | **1.11** Respostas Rápidas (`/` templates), **1.12** Tipos de Mídia (10), **1.17** Rascunhos automáticos, **1.24** Emoji, **1.25** Reply (citação) |
| [[wiki/casos-de-uso/helpdesk-ux]] | **1.1** Layout em 3 Paineis, **1.15** Indicador de Digitação, **1.16** Indicador de Tempo de Espera, **1.19** Histórico de Conversas, **1.21** Busca Global (Ctrl+K), **1.22** Filtros e Ordenação, **1.23** Notificação Sonora + Realtime |
| [[wiki/casos-de-uso/helpdesk-permissoes]] | **1.26** Permissões Granulares de Inbox (D21, 2026-04-25) + Árvore completa de Componentes (apêndice) |

---

## Como navegar pelo helpdesk-detalhado

- Procurando **como organizar conversas** (etiquetas, tags, status, atribuir)? → `helpdesk-organizacao`
- Trabalhando com **a IA na conversa** (toggle, resumo, finalizar com NPS)? → `helpdesk-ia`
- Precisa **escrever, anexar mídia ou usar templates**? → `helpdesk-comunicacao`
- Quer entender o **layout, atalhos de teclado e indicadores em tempo real**? → `helpdesk-ux`
- Configurando **quem vê o quê (admin)** ou estudando **a estrutura de componentes**? → `helpdesk-permissoes`

---

## Links Relacionados

- [[wiki/ai-agent]] — Agente IA que atende automaticamente
- [[wiki/modulos]] — Todos os módulos do sistema
- [[wiki/banco-de-dados]] — Tabelas do banco (conversations, conversation_messages, labels, etc.)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — AI Agent em profundidade (15 sub-funcionalidades)
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rápido de todas as funcionalidades
- [[wiki/decisoes-chave]] — D21 (Permissões granulares de inbox), R73 (limitação RLS atual)

---

*Documentado em: 2026-04-09 — Sessão de documentação detalhada com George Azevedo*
*Rev 1: Termos técnicos traduzidos, cenários enriquecidos, wikilinks adicionados*
*Rev 2: Camada técnica adicionada (componentes, tabelas, queries, hooks) em cada seção*
*Rev 3 (2026-04-27): Particionado em 5 sub-wikis temáticas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou índice.*
