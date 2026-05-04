---
title: CRM Kanban — Documentacao Detalhada (Indice)
tags: [crm, kanban, boards, cards, campos, leads, funil, detalhado, indice]
sources: [src/components/kanban/, src/pages/dashboard/KanbanCRM.tsx, src/pages/dashboard/KanbanBoard.tsx]
updated: 2026-05-04
---

# CRM Kanban — Quadro Visual de Vendas (Indice das 11 Sub-Funcionalidades)

> O CRM Kanban e um **quadro visual** onde cada cliente/oportunidade e representado por um **cartao** que se move entre colunas. Pense num quadro branco com post-its: a coluna "Novo" tem os leads que acabaram de chegar, "Proposta" tem os que receberam orcamento, "Negociacao" tem os que estao discutindo preco, e "Fechado" tem os que compraram.
>
> A grande diferenca de um quadro fisico e que aqui **a IA move os cartoes automaticamente** — quando o agente qualifica um lead, o cartao vai para "Qualificado". Quando o atendente finaliza uma venda, o cartao vai para "Fechado Ganho". E cada cartao pode ter **campos customizaveis** (valor da venda, data de follow-up, produto de interesse, etc.).
>
> Sem CRM, o gerente nao sabe quantos leads estao em negociacao, qual o valor total no pipeline, nem quais leads estao parados ha dias. O Kanban resolve isso: **visualizacao instantanea de todo o funil de vendas**.
>
> Ver tambem: [[wiki/casos-de-uso/leads-detalhado]] (leads vinculados aos cards), [[wiki/casos-de-uso/ai-agent-detalhado]] (tool move_kanban), [[wiki/modulos]]

---

## Sub-paginas (organizadas por area)

A documentacao das 11 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/crm-kanban-estrutura]] | **4.1** Pagina de Boards, **4.2** Quadro Kanban (Colunas e Drag & Drop), **4.6** Gestao de Colunas, **4.7** Controle de Acesso e Visibilidade |
| [[wiki/casos-de-uso/crm-kanban-cards-campos]] | **4.3** Cartoes (Cards), **4.4** Campos Customizaveis por Board, **4.5** Entidades Reutilizaveis, **4.8** Filtros e Busca no Board |
| [[wiki/casos-de-uso/crm-kanban-integracoes]] | **4.9** Integracao com IA (tool `move_kanban`), **4.10** Integracao com Finalizacao de Ticket, **4.11** Integracao com Funis + Arvore de Componentes + Tabelas do Banco |

---

## Como navegar pelo crm-kanban-detalhado

- Configurando **a estrutura do quadro** (criar boards, colunas, drag & drop, controle de acesso)? → `crm-kanban-estrutura`
- Trabalhando com **o conteudo dos cards** (campos customizados, entidades, filtros, busca)? → `crm-kanban-cards-campos`
- Ligando o Kanban com **IA, Helpdesk ou Funis** (tool `move_kanban`, finalizar ticket, board automatico)? → `crm-kanban-integracoes`

---

## Links Relacionados

- [[wiki/casos-de-uso/leads-detalhado]] — Leads vinculados aos cards via contact_id
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool move_kanban (IA move cards)
- [[wiki/casos-de-uso/helpdesk-detalhado]] — TicketResolutionDrawer move cards ao finalizar
- [[wiki/modulos]] — Todos os modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
