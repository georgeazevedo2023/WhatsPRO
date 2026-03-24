# PRD — Módulo CRM / Kanban

**Versão:** 1.0  
**Data:** 2026-03-03  
**Status:** Completo

---

## 1. Visão Geral

O módulo CRM / Kanban oferece um sistema de gestão de leads e oportunidades baseado em quadros Kanban totalmente personalizáveis. Cada board representa um funil de vendas ou processo, com colunas como etapas, cards como leads/oportunidades, e campos dinâmicos para capturar dados específicos do negócio.

### Características Principais
- **Multi-board**: múltiplos quadros independentes por organização
- **Campos dinâmicos**: 5 tipos de campos configuráveis por board (text, currency, date, select, entity_select)
- **Entidades reutilizáveis**: tabelas de valores compartilhadas entre cards (ex: Origem do Lead, Produto)
- **Visibilidade**: boards compartilhados (shared) ou privados (private)
- **Controle de acesso**: herança via inbox ou membros diretos com roles (editor/viewer)
- **Drag-and-drop**: reordenação de cards com @dnd-kit
- **Automações por coluna**: mensagens automáticas ao mover cards (preparado para WhatsApp)

### Rota Principal
\`/dashboard/crm\` — Lista de boards  
\`/dashboard/crm/:boardId\` — Visualização do board

---

## 2. Modelo de Dados

### 2.1 kanban_boards
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| name | TEXT | NÃO | — | Nome do board |
| description | TEXT | SIM | NULL | Descrição |
| visibility | kanban_visibility | NÃO | 'shared' | Visibilidade: shared ou private |
| inbox_id | UUID | SIM | NULL | FK → inboxes.id (herança de acesso) |
| instance_id | TEXT | SIM | NULL | FK → instances.id (para automações) |
| created_by | UUID | NÃO | — | Criador do board |
| created_at | TIMESTAMPTZ | NÃO | now() | — |
| updated_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.2 kanban_columns
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| board_id | UUID | NÃO | — | FK → kanban_boards.id |
| name | TEXT | NÃO | — | Nome da coluna (etapa do funil) |
| color | TEXT | NÃO | '#6366f1' | Cor hexadecimal |
| position | INTEGER | NÃO | 0 | Ordem no board |
| automation_enabled | BOOLEAN | NÃO | false | Automação ativa |
| automation_message | TEXT | SIM | NULL | Mensagem da automação |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.3 kanban_cards
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| board_id | UUID | NÃO | — | FK → kanban_boards.id |
| column_id | UUID | NÃO | — | FK → kanban_columns.id |
| title | TEXT | NÃO | — | Título do card |
| assigned_to | UUID | SIM | NULL | Responsável |
| created_by | UUID | NÃO | — | Criador |
| tags | TEXT[] | NÃO | '{}' | Tags do card |
| position | INTEGER | NÃO | 0 | Ordem na coluna |
| notes | TEXT | SIM | NULL | Notas/observações |
| created_at | TIMESTAMPTZ | NÃO | now() | — |
| updated_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.4 kanban_card_data
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| card_id | UUID | NÃO | — | FK → kanban_cards.id |
| field_id | UUID | NÃO | — | FK → kanban_fields.id |
| value | TEXT | SIM | NULL | Valor do campo (serializado) |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.5 kanban_fields
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| board_id | UUID | NÃO | — | FK → kanban_boards.id |
| name | TEXT | NÃO | — | Nome do campo |
| field_type | kanban_field_type | NÃO | 'text' | Tipo do campo |
| options | JSONB | SIM | NULL | Opções (para select) |
| is_primary | BOOLEAN | NÃO | false | Campo primário (título do card) |
| required | BOOLEAN | NÃO | false | Obrigatório |
| show_on_card | BOOLEAN | NÃO | false | Exibir na listagem |
| entity_id | UUID | SIM | NULL | FK → kanban_entities.id |
| position | INTEGER | NÃO | 0 | Ordem |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.6 kanban_entities
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| board_id | UUID | NÃO | — | FK → kanban_boards.id |
| name | TEXT | NÃO | — | Nome da entidade |
| position | INTEGER | NÃO | 0 | Ordem |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.7 kanban_entity_values
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| entity_id | UUID | NÃO | — | FK → kanban_entities.id |
| label | TEXT | NÃO | — | Rótulo do valor |
| position | INTEGER | NÃO | 0 | Ordem |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

### 2.8 kanban_board_members
| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NÃO | gen_random_uuid() | PK |
| board_id | UUID | NÃO | — | FK → kanban_boards.id |
| user_id | UUID | NÃO | — | Membro |
| role | TEXT | NÃO | 'editor' | Role: editor ou viewer |
| created_at | TIMESTAMPTZ | NÃO | now() | — |

---

## 3. Enums

### kanban_visibility
| Valor | Descrição |
|-------|-----------|
| shared | Todos os membros veem todos os cards |
| private | Cada usuário vê apenas cards que criou ou que lhe foram atribuídos |

### kanban_field_type
| Valor | Descrição |
|-------|-----------|
| text | Texto curto |
| currency | Moeda BRL (formatação pt-BR) |
| date | Data com calendário |
| select | Lista de opções fixas (definidas em options JSONB) |
| entity_select | Referência a entidade reutilizável (via entity_id) |

---

## 4. Funções de Segurança (SECURITY DEFINER)

### can_access_kanban_board(_user_id UUID, _board_id UUID) → BOOLEAN
Verifica se o usuário pode acessar o board:
1. É \`super_admin\` → acesso total
2. É membro direto do board (\`kanban_board_members\`)
3. É membro de inbox vinculada ao board (\`inbox_users\` + \`kanban_boards.inbox_id\`)

\`\`\`sql
SELECT (
  is_super_admin(_user_id)
  OR EXISTS (SELECT 1 FROM kanban_board_members m WHERE m.board_id = _board_id AND m.user_id = _user_id)
  OR EXISTS (
    SELECT 1 FROM inbox_users iu
    INNER JOIN kanban_boards b ON b.inbox_id = iu.inbox_id AND b.id = _board_id
    WHERE iu.user_id = _user_id AND b.inbox_id IS NOT NULL
  )
)
\`\`\`

### can_access_kanban_card(_user_id UUID, _card_id UUID) → BOOLEAN
Verifica acesso ao card considerando visibilidade:
1. É \`super_admin\` → acesso total
2. Board \`shared\` + \`can_access_kanban_board\` → acesso
3. Board \`private\` + (criador OU atribuído) → acesso

\`\`\`sql
SELECT EXISTS (
  SELECT 1 FROM kanban_cards kc
  JOIN kanban_boards b ON b.id = kc.board_id
  WHERE kc.id = _card_id AND (
    is_super_admin(_user_id)
    OR (b.visibility = 'shared' AND can_access_kanban_board(_user_id, b.id))
    OR (b.visibility = 'private' AND (kc.created_by = _user_id OR kc.assigned_to = _user_id))
  )
)
\`\`\`

---

## 5. Políticas RLS

### kanban_boards
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam todos | \`is_super_admin(auth.uid())\` |
| INSERT | Apenas super admins criam | \`is_super_admin(auth.uid())\` |
| UPDATE | Apenas super admins atualizam | \`is_super_admin(auth.uid())\` |
| DELETE | Apenas super admins excluem | \`is_super_admin(auth.uid())\` |
| SELECT | Usuários veem boards acessíveis | \`is_super_admin OR created_by = uid OR (inbox_id IS NOT NULL AND has_inbox_access) OR EXISTS(kanban_board_members)\` |

### kanban_columns
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT | Usuários veem colunas | \`can_access_kanban_board(auth.uid(), board_id)\` |

### kanban_cards
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT | Visibilidade respeitada | shared: \`can_access_kanban_board\`; private: \`created_by = uid OR assigned_to = uid\` |
| INSERT | Board acessível | \`auth.uid() = created_by AND can_access_kanban_board(auth.uid(), board_id)\` |
| UPDATE | Criador/responsável/dono | \`created_by = uid OR assigned_to = uid OR board.created_by = uid\` |
| DELETE | Criador/dono do board | \`created_by = uid OR board.created_by = uid\` |

### kanban_card_data
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT/INSERT/UPDATE/DELETE | Card acessível | \`can_access_kanban_card(auth.uid(), card_id)\` |

### kanban_fields
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT | Board acessível | \`can_access_kanban_board(auth.uid(), board_id)\` |

### kanban_entities / kanban_entity_values
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT | Board/entidade acessível | via \`can_access_kanban_board\` |

### kanban_board_members
| Operação | Política | Condição |
|----------|----------|----------|
| ALL | Super admins gerenciam | \`is_super_admin(auth.uid())\` |
| SELECT | Próprio acesso | \`auth.uid() = user_id\` |

---

## 6. Visibilidade dos Boards

### Shared (Compartilhado)
- Todos os membros (diretos + via inbox) veem **todos** os cards do board
- Ideal para equipes colaborativas onde todos acompanham o funil

### Private (Privado)
- Cada usuário vê **apenas** cards que criou (\`created_by\`) ou que estão atribuídos a ele (\`assigned_to\`)
- Auto-assign: ao criar card em board privado, \`assigned_to\` é automaticamente definido para o usuário logado
- Ideal para vendedores individuais com carteiras próprias

> **Enforcement duplo**: filtro aplicado no frontend (UX) e enforced pelo backend via RLS

---

## 7. Campos Dinâmicos (Fields)

### Tipos de Campo

| Tipo | Renderização | Armazenamento |
|------|-------------|---------------|
| text | \`<Input>\` texto livre | String direta |
| currency | Input com formatação BRL (R$ 1.234,56) | Centavos como string (ex: "123456") |
| date | Popover com \`<Calendar>\` | ISO string (ex: "2026-03-03") |
| select | \`<Select>\` com opções fixas | String da opção selecionada |
| entity_select | \`<Select>\` com valores da entidade | UUID do entity_value |

### Propriedades do Campo

| Propriedade | Efeito |
|-------------|--------|
| is_primary | Valor exibido como título principal do card (substitui \`title\`). Apenas 1 por board |
| required | Validado ao salvar no CardDetailSheet |
| show_on_card | Valor exibido diretamente na listagem do KanbanCardItem |

### Armazenamento
- Valores em \`kanban_card_data\` (card_id + field_id → value)
- Upsert: ao salvar, verifica se já existe registro para o par card_id/field_id
- Resolução de entity_select: converte UUID do value para label legível via \`kanban_entity_values\`

---

## 8. Entidades Reutilizáveis

Entidades são tabelas de valores compartilhados entre todos os cards do board. Exemplos:
- **Origem do Lead**: Site, Indicação, WhatsApp, Instagram
- **Produto**: Plano Basic, Plano Pro, Plano Enterprise
- **Motivo de Perda**: Preço, Concorrência, Timing

### Estrutura
- \`kanban_entities\`: define a entidade (nome + posição)
- \`kanban_entity_values\`: define os valores possíveis (label + posição)
- \`kanban_fields\`: campo com \`field_type = 'entity_select'\` aponta para \`entity_id\`

### CRUD
- Gerenciado via **EditBoardDialog → aba "Entidades"**
- Ao salvar o board, entidades/valores novos recebem UUIDs temporários (prefixo "temp-") que são remapeados para UUIDs reais após insert
- Campos que referenciam entidades excluídas perdem o vínculo (entity_id → NULL)

---

## 9. Automações por Coluna

Cada coluna pode ter uma automação configurada:
- \`automation_enabled\`: ativa/desativa
- \`automation_message\`: texto da mensagem

### Comportamento Atual
- Ao mover card para coluna com automação ativa, sistema exibe **toast informativo** com a mensagem configurada
- O board armazena \`instance_id\` para futura integração com envio via WhatsApp

### Configuração
- Via **EditBoardDialog → aba "Colunas"** → toggle de automação + textarea para mensagem
- Cada coluna pode ter automação independente

---

## 10. Controle de Acesso e Membros

### Herança via Inbox
Se o board possui \`inbox_id\`, todos os \`inbox_users\` dessa inbox têm acesso automático ao board (como editors).

### Membros Diretos
Tabela \`kanban_board_members\` com roles:
- **editor**: pode criar, editar e mover cards
- **viewer**: visualização apenas (não pode adicionar cards)

### Permissões Efetivas
| Papel | Criar Board | Editar Board | Adicionar Card | Editar Card | Mover Card |
|-------|:-----------:|:------------:|:--------------:|:-----------:|:----------:|
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| gerente | ❌ | ❌ | ✅ | ✅ | ✅ |
| editor (direto) | ❌ | ❌ | ✅ | ✅ | ✅ |
| viewer (direto) | ❌ | ❌ | ❌ | ❌ | ❌ |
| membro via inbox | ❌ | ❌ | ✅ | ✅ | ✅ |

### Gestão de Acesso
- **EditBoardDialog → aba "Acesso"**
- Exibe membros da inbox vinculada (não removíveis, herdados)
- CRUD de membros diretos: adicionar por email, alterar role, remover
- Usuários adicionados diretamente recebem role padrão "editor"

---

## 11. Drag and Drop

### Biblioteca
- \`@dnd-kit/core\`: DndContext, DragOverlay, closestCorners
- \`@dnd-kit/sortable\`: SortableContext, useSortable, verticalListSortingStrategy
- \`@dnd-kit/utilities\`: CSS transform

### Sensors
- **PointerSensor**: \`activationConstraint: { distance: 5 }\` (evita cliques acidentais)
- **TouchSensor**: \`activationConstraint: { delay: 200, tolerance: 8 }\` (mobile)

### Comportamento
1. **Dentro da mesma coluna**: reordena cards verticalmente, atualiza \`position\`
2. **Entre colunas**: \`handleDragOver\` move card para nova coluna; \`handleDragEnd\` persiste \`column_id\` + \`position\`
3. **DragOverlay**: renderiza clone visual do card durante arraste
4. **Persistência**: batch update via Supabase (\`kanban_cards\` UPDATE column_id + position)

### Botões Prev/Next
- Alternativa ao drag-and-drop para mover cards entre colunas adjacentes
- Botões \`←\` e \`→\` no KanbanCardItem (desabilitados se não há coluna anterior/posterior)

---

## 12. Interface do Usuário

### Componentes Principais

| Componente | Descrição |
|------------|-----------|
| \`KanbanCRM.tsx\` | Lista de boards com busca, contagem de colunas/cards/membros, botão "Novo Quadro" (super_admin) |
| \`BoardCard.tsx\` | Card do board com badges (visibilidade, inbox, membros), menu com ações (editar, duplicar, excluir) |
| \`KanbanBoard.tsx\` | Visualização do board: header, busca, filtro por responsável, scroll horizontal, DndContext |
| \`KanbanColumn.tsx\` | Coluna do funil: header colorido, contagem de cards, área droppable, botão adicionar card inline |
| \`KanbanCardItem.tsx\` | Card individual: campo primário, campos show_on_card, tags coloridas, avatar do responsável, botões prev/next |
| \`CardDetailSheet.tsx\` | Sheet lateral: edição completa do card (título, coluna, responsável, tags, notas, campos dinâmicos) |
| \`DynamicFormField.tsx\` | Renderizador genérico de campos dinâmicos (text/currency/date/select/entity_select) |
| \`CreateBoardDialog.tsx\` | Dialog de criação: nome, descrição, visibilidade, inbox |
| \`EditBoardDialog.tsx\` | Dialog completo com 5 abas: Geral, Colunas, Campos, Entidades, Acesso |

### EditBoardDialog — Abas

| Aba | Funcionalidade |
|-----|----------------|
| **Geral** | Nome, descrição, visibilidade (shared/private), inbox vinculada |
| **Colunas** | Adicionar/remover/reordenar colunas, cores (10 opções), toggle automação + mensagem |
| **Campos** | Tipos de campo, opções, entidade vinculada, is_primary, required, show_on_card |
| **Entidades** | CRUD de entidades + valores (tabelas reutilizáveis) |
| **Acesso** | Inbox vinculada (herdada), membros diretos (CRUD com role editor/viewer) |

---

## 13. Fluxos Operacionais

### Criar Board
1. Super admin clica "Novo Quadro" em \`KanbanCRM\`
2. \`CreateBoardDialog\`: preenche nome, descrição, visibilidade, inbox (opcional)
3. Insere em \`kanban_boards\` com \`created_by = auth.uid()\`
4. Redireciona para lista de boards

### Configurar Funil (Colunas)
1. Super admin abre \`EditBoardDialog\` → aba "Colunas"
2. Adiciona colunas com nomes (ex: Novo, Qualificado, Proposta, Fechado)
3. Define cores e posições (drag para reordenar)
4. Opcionalmente ativa automação com mensagem
5. Salva: sync colunas no Supabase (delete removidas, insert novas, update existentes)

### Definir Campos
1. Super admin abre \`EditBoardDialog\` → aba "Campos"
2. Adiciona campos: nome, tipo (text/currency/date/select/entity_select)
3. Para \`select\`: define opções fixas
4. Para \`entity_select\`: vincula a entidade existente
5. Marca \`is_primary\`, \`required\`, \`show_on_card\` conforme necessário
6. Salva: sync campos com remapeamento de entity_id (temp → real UUID)

### Adicionar Card
1. Membro com permissão clica \`+\` na coluna
2. Digita título e confirma (Enter ou botão ✓)
3. Insere em \`kanban_cards\` com \`position = last + 1\`
4. Em boards privados: \`assigned_to\` = usuário logado automaticamente

### Editar Card
1. Clique no card → abre \`CardDetailSheet\`
2. Edita: título (ou campo primário), coluna, responsável, tags, notas, campos dinâmicos
3. Salva: UPDATE \`kanban_cards\` + UPSERT \`kanban_card_data\` para cada campo

### Mover Card (Drag-and-Drop)
1. Clica e arrasta card para outra coluna
2. \`handleDragOver\`: reposiciona visualmente
3. \`handleDragEnd\`: persiste \`column_id\` + \`position\` no Supabase
4. Se coluna destino tem automação ativa: exibe toast com mensagem

### Duplicar Board
1. Super admin clica menu "Duplicar" no \`BoardCard\`
2. Copia: board + colunas + entidades + entity_values + campos
3. Remapeia \`entity_id\` dos campos para novos UUIDs das entidades duplicadas
4. **Não copia cards** (board começa vazio)

### Excluir Board
1. Super admin clica menu "Excluir" no \`BoardCard\`
2. Confirmação via AlertDialog
3. DELETE \`kanban_boards\` (cascade deleta colunas, cards, campos, entidades, membros)

---

## 14. Filtros e Busca

### Busca Global (no board)
- Campo de busca no header do \`KanbanBoard\`
- Filtra cards por: \`title\`, \`tags[]\`, \`assignedName\`, \`primaryFieldValue\`
- Aplicado em tempo real no frontend (sem re-fetch)

### Filtro por Responsável
- Chips de membros que possuem cards atribuídos
- Chip "Todos" para remover filtro
- Clique no chip filtra cards por \`assigned_to\`

### Busca na Lista de Boards
- Campo de busca em \`KanbanCRM\`
- Filtra boards por \`name\` e \`description\`

---

## 15. Regras de Negócio

1. **Apenas super_admin** pode criar, editar configuração e excluir boards
2. **Boards privados**: auto-assign ao criar card (\`assigned_to\` = usuário logado)
3. **Campo primário**: apenas 1 por board; valor exibido como título principal do card (substitui \`title\` na UI)
4. **Duplicação**: copia toda a estrutura **exceto cards** (board começa limpo)
5. **Entidade referenciada**: ao excluir entidade, campos vinculados perdem \`entity_id\` (volta para select genérico)
6. **Cores de colunas**: 10 opções pré-definidas, cicladas automaticamente ao adicionar
7. **Tags**: cor calculada por hash do texto (5 cores Tailwind fixas)
8. **Position**: cards e colunas usam position inteiro para ordenação, recalculado após drag
9. **Cascade delete**: excluir board remove tudo (colunas, cards, card_data, campos, entidades, valores, membros)
10. **Unique constraint**: \`kanban_board_members\` não permite duplicatas (board_id + user_id)

---

## 16. Formatação de Moeda (Currency)

- Input: usuário digita apenas números
- Conversão: remove não-dígitos, divide por 100, formata com \`toLocaleString('pt-BR')\`
- Exibição: \`R$ 1.234,56\`
- Armazenamento: centavos como string (ex: "123456")
- Renderização no card: \`show_on_card\` exibe valor formatado

---

## 17. Dependências Técnicas

| Pacote | Uso |
|--------|-----|
| @dnd-kit/core | DndContext, DragOverlay, closestCorners, sensors |
| @dnd-kit/sortable | SortableContext, useSortable, verticalListSortingStrategy |
| @dnd-kit/utilities | CSS transform utility |
| date-fns | Formatação de datas nos campos |
| react-day-picker | Componente Calendar para campo date |

---

## 18. Considerações de Performance

- **Carregamento**: board + colunas + campos + cards carregados em paralelo
- **Entity values**: pré-carregados em mapa (entityValuesMap) para evitar N+1 queries
- **Filtros**: aplicados no frontend (sem re-fetch do Supabase)
- **DnD**: apenas cards afetados são atualizados (batch update otimizado)
- **Contagens**: boards na lista carregam counts via queries separadas (colunas, cards, membros)