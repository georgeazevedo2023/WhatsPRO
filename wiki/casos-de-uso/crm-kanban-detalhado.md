---
title: CRM Kanban — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [crm, kanban, boards, cards, campos, leads, funil, detalhado]
sources: [src/components/kanban/, src/pages/dashboard/KanbanCRM.tsx, src/pages/dashboard/KanbanBoard.tsx]
updated: 2026-04-09
---

# CRM Kanban — Quadro Visual de Vendas (11 Sub-Funcionalidades)

> O CRM Kanban e um **quadro visual** onde cada cliente/oportunidade e representado por um **cartao** que se move entre colunas. Pense num quadro branco com post-its: a coluna "Novo" tem os leads que acabaram de chegar, "Proposta" tem os que receberam orcamento, "Negociacao" tem os que estao discutindo preco, e "Fechado" tem os que compraram.
>
> A grande diferenca de um quadro fisico e que aqui **a IA move os cartoes automaticamente** — quando o agente qualifica um lead, o cartao vai para "Qualificado". Quando o atendente finaliza uma venda, o cartao vai para "Fechado Ganho". E cada cartao pode ter **campos customizaveis** (valor da venda, data de follow-up, produto de interesse, etc.).
>
> Sem CRM, o gerente nao sabe quantos leads estao em negociacao, qual o valor total no pipeline, nem quais leads estao parados ha dias. O Kanban resolve isso: **visualizacao instantanea de todo o funil de vendas**.
>
> Ver tambem: [[wiki/casos-de-uso/leads-detalhado]] (leads vinculados aos cards), [[wiki/casos-de-uso/ai-agent-detalhado]] (tool move_kanban), [[wiki/modulos]]

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

## 4.7 Colunas do Board — Controle de Acesso e Visibilidade

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

## 4.8 Filtros e Busca no Board

**O que e:** Dentro de um board aberto, o usuario pode filtrar e buscar cards.

**Busca global:** Digita no campo de busca e filtra por titulo do card, tags, nome do responsavel, ou valor do campo primario — tudo em tempo real (sem chamar API).

**Filtro por responsavel:** Chips com os nomes dos atendentes que tem cards. Clica em "Carlos" → so ve cards do Carlos. Clica em "Todos" → volta ao normal.

> **Tecnico:** Busca client-side em `KanbanBoard.tsx`: filtra array de cards por `title`, `tags[]`, `assignedName`, `primaryFieldValue` (case-insensitive includes). Filtro assignee: chips renderizados a partir de atendentes unicos nos cards, estado `filterAssignee`. Sem chamada API — filtro 100% frontend.

---

## 4.9 Integracao com IA (Tool move_kanban)

**O que e:** O agente IA pode **mover cards automaticamente** durante a conversa com o lead. Quando a IA qualifica um lead, ela chama a ferramenta `move_kanban` e o card se move sozinho.

**Cenarios:**
1. IA qualifica lead → chama `move_kanban("Qualificado")` → card move de "Novo" para "Qualificado"
2. IA detecta que lead quer comprar → move para "Interesse"
3. IA faz handoff → move para "Em Atendimento"

> **Tecnico:** Tool `move_kanban` no ai-agent/index.ts. Busca `kanban_cards` WHERE `contact_id` = lead contact_id AND `board_id`. Move para coluna destino via UPDATE `column_id`. Registrado em `TOOL_META` (playground): label "Kanban", icon Columns3, cor orange. Pode ser desabilitado via `disabledTools` override no Playground.

---

## 4.10 Integracao com Finalizacao de Ticket

**O que e:** Quando o atendente clica "Finalizar" no Helpdesk (ver [[wiki/casos-de-uso/helpdesk-detalhado]] secao 1.18), o card do lead e **movido automaticamente** para a coluna correspondente.

**Mapeamento:**
- Venda Fechada → coluna "Fechado Ganho"
- Nao Converteu → coluna "Perdido"
- Suporte Resolvido → coluna "Resolvido"
- Spam → coluna "Resolvido"

> **Tecnico:** `KANBAN_COLUMN_MAP` em `TicketResolutionDrawer.tsx`. Busca coluna por nome no board vinculado. UPDATE `kanban_cards.column_id`. Tags aplicadas simultaneamente: `resultado:venda`, `resultado:perdido`, etc.

---

## 4.11 Integracao com Funis

**O que e:** Cada funil pode ter um board Kanban vinculado. Quando o funil e criado pelo wizard, o board e as colunas sao criadas automaticamente com base no tipo de funil.

**Colunas pre-definidas por tipo de funil:**
| Tipo | Colunas |
|------|---------|
| Sorteio | Inscrito → Confirmado → Sorteado → Entregue |
| Captacao | Novo → Qualificado → Em Contato |
| Venda | Novo → Interesse → Proposta → Negociacao → Fechado |
| Vaga | Candidato → Entrevista → Avaliacao → Aprovado |
| Lancamento | Interessado → Lista VIP → Pre-venda → Comprou |
| Evento | Inscrito → Confirmado → Presente → Follow-up |
| Atendimento | Triagem → Em Atendimento → Resolvido |

No perfil do lead, o `LeadFunnelCard` mostra o funil ativo + etapa Kanban + dias na etapa.

> **Tecnico:** FK: `funnels.kanban_board_id` UUID. Templates em `src/data/funnelTemplates.ts`. Auto-criacao no wizard: INSERT board + columns com nomes e cores do template. `LeadFunnelCard.tsx`: query `kanban_cards` WHERE contact_id AND board_id = funnel.kanban_board_id, JOIN kanban_columns para nome e cor. Dias: `Math.floor((Date.now() - updated_at) / 86400000)`.

---

## Arvore de Componentes

```
KanbanCRM.tsx (lista de boards — /dashboard/crm)
+-- Busca por nome/descricao
+-- BoardCard.tsx (cada board)
|   +-- Nome, descricao, badges (visibilidade, membros)
|   +-- Acoes: abrir, duplicar, excluir
+-- CreateBoardDialog.tsx (criar novo board)

KanbanBoard.tsx (board aberto — /dashboard/crm/:boardId)
+-- Busca global + filtro por responsavel (chips)
+-- EditBoardDialog.tsx (configuracoes do board)
|   +-- Tab Geral (nome, descricao, visibilidade, inbox)
|   +-- Tab Colunas (ColumnsTab — CRUD colunas + cores)
|   +-- Tab Campos (FieldsTab — campos dinamicos)
|   +-- Tab Entidades (EntitiesTab — tabelas de valores)
|   +-- Tab Acesso (AccessTab — membros + roles)
+-- KanbanColumn.tsx (cada coluna — droppable)
|   +-- Cabecalho: cor + nome + contagem
|   +-- KanbanCardItem.tsx (cada card — draggable)
|   |   +-- Titulo ou campo primario
|   |   +-- Contact badge (lead vinculado)
|   |   +-- Tags (ate 3)
|   |   +-- Campos extras (ate 5 show_on_card)
|   |   +-- Responsavel avatar
|   |   +-- Botoes prev/next coluna
|   +-- Criacao rapida (input + confirmar)
+-- CardDetailSheet.tsx (painel lateral de detalhe)
    +-- Titulo editavel
    +-- Select coluna
    +-- Select responsavel
    +-- Tags inline
    +-- Notas textarea
    +-- DynamicFormField.tsx (campos dinamicos)
    +-- Botao excluir
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `kanban_boards` | Quadros (name, description, visibility, inbox_id, instance_id) |
| `kanban_columns` | Colunas/etapas (name, color, position, automation) |
| `kanban_cards` | Cartoes (title, column_id, assigned_to, tags[], contact_id FK) |
| `kanban_card_data` | Valores dos campos customizados (card_id, field_id, value) |
| `kanban_fields` | Definicao dos campos (name, type, options, is_primary, show_on_card) |
| `kanban_entities` | Tabelas de valores reutilizaveis (name) |
| `kanban_entity_values` | Valores dentro das entidades (label) |
| `kanban_board_members` | Membros com acesso direto (user_id, role) |

---

## Links Relacionados

- [[wiki/casos-de-uso/leads-detalhado]] — Leads vinculados aos cards via contact_id
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool move_kanban (IA move cards)
- [[wiki/casos-de-uso/helpdesk-detalhado]] — TicketResolutionDrawer move cards ao finalizar
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
