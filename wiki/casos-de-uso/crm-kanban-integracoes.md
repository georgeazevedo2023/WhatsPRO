---
title: CRM Kanban — Integracoes (IA, Helpdesk, Funis) + Componentes + Tabelas
tags: [crm, kanban, ia, helpdesk, funis, componentes, tabelas, detalhado]
sources: [src/components/kanban/, supabase/functions/ai-agent/, src/components/helpdesk/TicketResolutionDrawer.tsx]
updated: 2026-05-04
---

# CRM Kanban — Integracoes, Arvore de Componentes e Tabelas

> Esta sub-wiki cobre as **integracoes** do Kanban com outros modulos (IA, Helpdesk, Funis) e o apendice tecnico (arvore de componentes + tabelas do banco).
>
> Sub-funcionalidades cobertas: **4.9** Integracao com IA (tool `move_kanban`), **4.10** Integracao com Finalizacao de Ticket, **4.11** Integracao com Funis. Mais: arvore de componentes + tabelas do banco.
>
> Indice: [[wiki/casos-de-uso/crm-kanban-detalhado]]

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

**O que e:** Quando o atendente clica "Finalizar" no Helpdesk (ver [[wiki/casos-de-uso/helpdesk-ia]] secao 1.18), o card do lead e **movido automaticamente** para a coluna correspondente.

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

- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Indice geral do CRM Kanban
- [[wiki/casos-de-uso/crm-kanban-estrutura]] — Boards, colunas, drag & drop, acesso
- [[wiki/casos-de-uso/crm-kanban-cards-campos]] — Cards, campos, entidades, busca
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool move_kanban (IA move cards)
- [[wiki/casos-de-uso/helpdesk-ia]] — TicketResolutionDrawer move cards ao finalizar
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Rev 1 (2026-05-04): Particionado a partir de `crm-kanban-detalhado.md` (regra 14, max 200 linhas/MD).*
