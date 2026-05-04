---
title: CRM Kanban — Cards, Campos, Entidades e Busca
tags: [crm, kanban, cards, campos, entidades, busca, filtros, detalhado]
sources: [src/components/kanban/, src/pages/dashboard/KanbanBoard.tsx]
updated: 2026-05-04
---

# CRM Kanban — Cards, Campos Customizados e Busca

> Esta sub-wiki cobre o **conteudo** dos quadros Kanban: a ficha de cada cartao, os campos customizados de cada board, as entidades reutilizaveis e os filtros/busca dentro de um board.
>
> Sub-funcionalidades cobertas: **4.3** Cartoes (Cards), **4.4** Campos Customizaveis por Board, **4.5** Entidades Reutilizaveis, **4.8** Filtros e Busca no Board.
>
> Indice: [[wiki/casos-de-uso/crm-kanban-detalhado]]

---

## 4.3 Cartoes (Cards) — A Ficha de Cada Lead/Oportunidade

**O que e:** Cada cartao representa um **lead ou oportunidade**. Na lista, mostra informacoes resumidas. Ao clicar, abre um painel lateral com todos os detalhes editaveis.

**O que aparece no card (visao resumida):**
- **Titulo** (ou valor do campo primario, se configurado)
- **Lead vinculado** — badge com foto de perfil + telefone (se tem `contact_id`)
- **Tags** — ate 3 tags coloridas (cores baseadas no hash do texto — 5 cores automaticas)
- **Campos extras** — ate 5 campos marcados como "mostrar no card" (ex: "Valor: R$ 2.800")
- **Responsavel** — avatar + nome do atendente atribuido (ou "Sem responsavel")
- **Icone de arrastar** (grip) para drag & drop

**O que aparece no detalhe (painel lateral ao clicar):**
- **Titulo** editavel
- **Coluna atual** — dropdown para mover para outra coluna
- **Responsavel** — dropdown com membros do board
- **Tags** — adicionar/remover inline
- **Notas** — campo de texto livre
- **Todos os campos dinamicos** — os campos customizados do board (texto, moeda, data, selecao, entidade)
- **Botao excluir** — com confirmacao

**Criacao rapida:** No rodape de cada coluna, tem um campo de texto + botao. Digita o titulo e confirma. Em boards privados, o card ja vem atribuido ao usuario que criou.

**Cenarios reais:**
1. **Card completo:** "Pedro Silva - Reforma Fachada" | Tags: "tintas", "VIP" | Valor: R$ 12.500 | Responsavel: Carlos | Coluna: Negociacao
2. **Card minimo:** Titulo "Maria" e nada mais — criado rapidamente no rodape da coluna
3. **Clique no card:** Abre painel lateral, edita valor da venda para R$ 15.000, muda responsavel para Joao, adiciona nota "Reuniao agendada para sexta"

> **Tecnico:** Componente `KanbanCardItem.tsx` (memoizado). Detalhe: `CardDetailSheet.tsx` (Sheet lateral shadcn/ui). Tabela `kanban_cards` (id, board_id, column_id, title, assigned_to UUID, created_by, tags TEXT[], position INT, notes TEXT, contact_id UUID FK → contacts). Criacao: INSERT com position = last + 1. Private boards: auto `assigned_to = user.id`. Tags: ate 3 exibidas, cores via hash do texto (5 cores Tailwind). Contact badge: JOIN contacts para name, phone, profile_pic_url. Campos extras: JOIN `kanban_card_data` + `kanban_fields` WHERE `show_on_card = true` (max 5). Exclusao com confirmacao.

---

## 4.4 Campos Customizaveis por Board

**O que e:** Cada quadro pode ter **campos extras** que voce define — como uma planilha com colunas personalizadas. Esses campos aparecem no detalhe de cada card e, opcionalmente, na visao resumida do card.

**Os 5 tipos de campo:**

| Tipo | O que e | Exemplo |
|------|---------|---------|
| **Texto** | Campo livre para digitar qualquer coisa | "Observacoes", "Endereco" |
| **Moeda (R$)** | Valor monetario com formatacao brasileira | "Valor da Venda" → R$ 2.800,00 |
| **Data** | Seletor de data com calendario | "Data do Follow-up" → 15/04/2026 |
| **Selecao** | Lista fixa de opcoes para escolher | "Status" → Quente / Morno / Frio |
| **Entidade** | Lista de opcoes reutilizavel (compartilhada entre campos) | "Produto" → Tinta Coral 18L, Verniz 3.6L, etc. |

**Propriedades de cada campo:**
- **Primario** — se marcado, o valor desse campo substitui o titulo do card (ex: campo "Nome do Lead" vira o titulo)
- **Obrigatorio** — nao deixa salvar sem preencher
- **Mostrar no card** — valor aparece na visao resumida do card (maximo 5 campos)
- **Posicao** — ordem em que os campos aparecem no detalhe

**Cenario real:** Board "Pipeline Vendas" com campos:
- "Nome do Lead" (texto, primario) → vira o titulo do card
- "Valor" (moeda, mostrar no card) → aparece como "R$ 2.800" no card
- "Produto de Interesse" (entidade → lista de produtos) → dropdown com os produtos da loja
- "Data do Follow-up" (data, mostrar no card) → "15/04/2026" no card
- "Temperatura" (selecao: Quente/Morno/Frio) → dropdown com 3 opcoes

> **Tecnico:** Tabela `kanban_fields` (id, board_id, name, field_type ENUM, options JSONB, position INT, is_primary BOOL, required BOOL, show_on_card BOOL, entity_id UUID FK). Dados: `kanban_card_data` (card_id, field_id, value TEXT — UNIQUE constraint). Currency: armazenado como centavos string, formatado client-side em `DynamicFormField.tsx`. Date: ISO string, renderizado com `react-day-picker` popover. Select: opcoes em `options` JSONB (comma-separated). Entity_select: `entity_id` FK → `kanban_entities`, armazena UUID do valor selecionado, resolve label via `entityValueLabels` lookup. Componente editor: `FieldsTab.tsx` dentro de `EditBoardDialog.tsx`.

---

## 4.5 Entidades Reutilizaveis

**O que e:** Tabelas de valores compartilhados que podem ser usadas em multiplos campos. Exemplo: voce cria uma entidade "Produtos" com os valores "Tinta Coral 18L", "Verniz 3.6L", "Massa Corrida 25kg". Depois, qualquer campo do tipo "Entidade" pode usar essa lista.

**Para que serve:** Evita repetir a mesma lista em varios campos. Se adicionar um produto novo, ele aparece automaticamente em todos os campos que usam aquela entidade.

**Cenario:** Cria entidade "Origem do Lead" com valores: "Instagram", "Google", "Indicacao", "Bio Link". Depois cria campo "Origem" do tipo entidade → dropdown mostra as 4 opcoes. Se amanha adicionar "TikTok", todos os cards ja veem a nova opcao.

> **Tecnico:** Tabelas: `kanban_entities` (id, board_id, name, position), `kanban_entity_values` (id, entity_id, label, position). Escopo: por board (cada board tem entidades independentes). Field linking: `kanban_fields.entity_id` FK. Componente editor: `EntitiesTab.tsx` (tab Entidades no EditBoardDialog). Ao deletar entidade: `kanban_fields.entity_id = NULL` (campo reverte para select generico). Duplicacao de board copia entidades e remapeia `entity_id` nos campos.

---

## 4.8 Filtros e Busca no Board

**O que e:** Dentro de um board aberto, o usuario pode filtrar e buscar cards.

**Busca global:** Digita no campo de busca e filtra por titulo do card, tags, nome do responsavel, ou valor do campo primario — tudo em tempo real (sem chamar API).

**Filtro por responsavel:** Chips com os nomes dos atendentes que tem cards. Clica em "Carlos" → so ve cards do Carlos. Clica em "Todos" → volta ao normal.

> **Tecnico:** Busca client-side em `KanbanBoard.tsx`: filtra array de cards por `title`, `tags[]`, `assignedName`, `primaryFieldValue` (case-insensitive includes). Filtro assignee: chips renderizados a partir de atendentes unicos nos cards, estado `filterAssignee`. Sem chamada API — filtro 100% frontend.

---

## Links Relacionados

- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Indice geral do CRM Kanban
- [[wiki/casos-de-uso/crm-kanban-estrutura]] — Boards, colunas, drag & drop, acesso
- [[wiki/casos-de-uso/crm-kanban-integracoes]] — IA, finalizacao de ticket, funis
- [[wiki/casos-de-uso/leads-detalhado]] — Leads vinculados aos cards via contact_id
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Rev 1 (2026-05-04): Particionado a partir de `crm-kanban-detalhado.md` (regra 14, max 200 linhas/MD).*
