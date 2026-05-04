---
title: CRM Kanban — Estrutura (Boards, Colunas, Acesso)
tags: [crm, kanban, boards, colunas, acesso, visibilidade, detalhado]
sources: [src/components/kanban/, src/pages/dashboard/KanbanCRM.tsx, src/pages/dashboard/KanbanBoard.tsx]
updated: 2026-05-04
---

# CRM Kanban — Estrutura: Boards, Colunas e Acesso

> Esta sub-wiki cobre a **estrutura** dos quadros Kanban: como listar, abrir e configurar boards, como criar/reordenar colunas, como mover cards entre etapas e como controlar quem ve o que.
>
> Sub-funcionalidades cobertas: **4.1** Pagina de Boards, **4.2** Quadro Kanban (Colunas e Drag & Drop), **4.6** Gestao de Colunas, **4.7** Controle de Acesso e Visibilidade.
>
> Indice: [[wiki/casos-de-uso/crm-kanban-detalhado]]

---

## 4.1 Pagina de Boards — Lista de Quadros

**O que e:** A pagina principal do CRM mostra todos os quadros Kanban da empresa. Cada quadro e como uma "mesa de trabalho" separada — voce pode ter um quadro para "Pipeline de Vendas", outro para "Vagas de Emprego", outro para "Suporte Tecnico".

**O que cada card de board mostra:**
- Nome e descricao do quadro
- Numero de colunas (ex: "5 etapas")
- Numero de cards (ex: "23 cards")
- Numero de membros com acesso direto
- Badge de visibilidade ("Compartilhado" ou "Privado")
- Se esta vinculado a uma inbox WhatsApp

**Acoes disponiveis:**
- **Criar novo** — botao "Novo Board" abre dialog
- **Duplicar** — copia toda a estrutura (colunas, campos, entidades) mas nao os cards (comeca limpo)
- **Excluir** — com confirmacao, deleta tudo (colunas, cards, dados, campos, membros)
- **Buscar** — filtro por nome e descricao

**Cenario real:** Loja de materiais tem 3 boards: "Pipeline Vendas" (leads B2C), "Corporativo" (leads B2B), "Suporte" (chamados tecnicos). Gerente abre o CRM e ve: Pipeline tem 45 cards, Corporativo tem 12, Suporte tem 8.

> **Tecnico:** Pagina `src/pages/dashboard/KanbanCRM.tsx`, rota `/dashboard/crm`. Componente `BoardCard.tsx` para cada card. Estatisticas via RPC `get_kanban_board_counts()` (migration 20260321103238). Duplicacao: copia `kanban_columns`, `kanban_entities`, `kanban_entity_values`, `kanban_fields` com remap de `entity_id`. Delete cascade: columns → cards → card_data → fields → entities → members. Busca: client-side filter por `name` e `description` case-insensitive.

---

## 4.2 Quadro Kanban — Colunas e Drag & Drop

**O que e:** Ao abrir um quadro, voce ve as **colunas lado a lado** (como listas verticais), cada uma representando uma etapa do processo. Os cartoes ficam dentro das colunas e podem ser **arrastados** de uma para outra.

**Como funciona:**
- Cada coluna tem um **cabecalho colorido** com nome e contagem de cards
- Os cartoes podem ser **arrastados e soltos** (drag & drop) entre colunas
- Tambem tem botoes **"<" e ">"** em cada card para mover para a coluna anterior/proxima (util em celular onde drag & drop e dificil)
- Ao soltar o card numa coluna, a posicao e atualizada automaticamente no banco
- Se a coluna destino tem **automacao ativada**, aparece uma notificacao ("Automacao ativa: coluna Fechado")
- Area vazia na coluna mostra "Arraste cards para ca"
- Botao "+" no rodape de cada coluna para criar card novo rapidamente

**Cenarios reais:**
1. **Vendedor fecha proposta:** Arrasta card "Pedro - Tinta 18L" de "Proposta" para "Negociacao". Gerente ve em tempo real que tem mais um em negociacao.
2. **Gerente no celular:** Nao consegue arrastar. Usa os botoes "<" e ">" para mover card de "Qualificado" para "Proposta".
3. **Automacao futura:** Quando card chega na coluna "Fechado Ganho", sistema pode enviar mensagem automatica de agradecimento pelo WhatsApp.

> **Tecnico:** Pagina `src/pages/dashboard/KanbanBoard.tsx`, rota `/dashboard/crm/:boardId`. Drag & drop via `@dnd-kit/core` + `@dnd-kit/sortable`. Componente `KanbanColumn.tsx` (droppable). On drop: `supabase.from('kanban_cards').update({ column_id, position })`. Posicao: inteiro sequencial dentro da coluna. Automacao: `kanban_columns.automation_enabled` + `automation_message` (toast atual, preparado para WhatsApp via `board.instance_id`). Prev/next: botoes em `KanbanCardItem.tsx` que movem para coluna adjacente por `position`. Hook: `useKanbanBoardData.ts`.

---

## 4.6 Gestao de Colunas

**O que e:** O admin configura as colunas (etapas) de cada quadro — nome, cor, ordem e automacao.

**Operacoes:**
- **Adicionar** coluna com nome e cor
- **Editar** nome e cor (10 cores pre-definidas: roxo, violeta, rosa, vermelho, laranja, amarelo, verde, teal, azul, cinza)
- **Reordenar** com botoes subir/descer
- **Excluir** coluna (com confirmacao)
- **Automacao** — toggle que ativa uma mensagem automatica quando card chega naquela coluna (preparado para WhatsApp, hoje mostra notificacao)

**Template de mensagem de automacao:** Suporta variaveis como `{{nome}}` e `{{campo:Valor}}` que sao substituidas pelos dados do card.

> **Tecnico:** Tabela `kanban_columns` (id, board_id, name, color HEX, position INT, automation_enabled BOOL, automation_message TEXT). 10 cores em `PRESET_COLORS` array no ColumnsTab.tsx. Editor: `ColumnsTab.tsx` dentro de `EditBoardDialog.tsx` (tab Colunas). Persistencia: compara estado local com DB no save — DELETE removidas, INSERT novas, UPDATE existentes. Automacao: template com placeholders `{{nome}}`, `{{campo:NAME}}`. Preparado para envio WhatsApp via `board.instance_id`.

---

## 4.7 Controle de Acesso e Visibilidade

**O que e:** Cada board tem configuracoes de quem pode ver e editar.

**2 modos de visibilidade:**
- **Compartilhado** — Todos os membros do board veem todos os cards
- **Privado** — Cada usuario so ve os cards que criou ou que foram atribuidos a ele

**3 niveis de acesso:**
1. **Super Admin** — acesso total a todos os boards
2. **Membros da Inbox** — se o board esta vinculado a uma inbox, todos os membros dela ganham acesso automatico (editor)
3. **Membros diretos** — adicionados manualmente com role "Editor" ou "Visualizador"

**Cenarios:**
1. **Board privado de vendedor:** Vendedor so ve seus proprios leads. Gerente ve todos.
2. **Board compartilhado da equipe:** Todo mundo ve todos os cards — util para pipeline unico.
3. **Visualizador:** Diretor quer ver o pipeline mas nao mexer — acesso como visualizador.

> **Tecnico:** Campo `kanban_boards.visibility` ENUM ('shared'|'private'). Tabela `kanban_board_members` (board_id, user_id, role ENUM 'editor'|'viewer' — UNIQUE constraint). RLS functions: `can_access_kanban_board(_user_id, _board_id)`, `can_access_kanban_card(_user_id, _card_id)`. Inbox inheritance: se `board.inbox_id` setado, todos `inbox_users` ganham acesso editor automatico. Componente: `AccessTab.tsx` (tab Acesso no EditBoardDialog). Membros herdados da inbox sao read-only (nao removiveis).

---

## Links Relacionados

- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Indice geral do CRM Kanban
- [[wiki/casos-de-uso/crm-kanban-cards-campos]] — Cards, campos, entidades e busca
- [[wiki/casos-de-uso/crm-kanban-integracoes]] — IA, finalizacao de ticket, funis
- [[wiki/casos-de-uso/leads-detalhado]] — Leads vinculados aos cards
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Rev 1 (2026-05-04): Particionado a partir de `crm-kanban-detalhado.md` (regra 14, max 200 linhas/MD).*
