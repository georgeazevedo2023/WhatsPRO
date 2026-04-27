---
title: Helpdesk — Organização e Metadata
tags: [helpdesk, etiquetas, tags, notas, status, prioridade, atribuicao, departamentos, bulk]
sources: [src/components/helpdesk/, src/pages/dashboard/HelpDesk.tsx]
updated: 2026-04-27
---

# Helpdesk — Organização e Metadata (8 Sub-Funcionalidades)

> Parte do **Helpdesk (M2)** — sub-página dedicada às funcionalidades de **organização** das conversas: como classificar, etiquetar, priorizar, atribuir e operar em massa. Para o índice geral e outras áreas (IA, Comunicação, UX, Permissões), ver [[wiki/casos-de-uso/helpdesk-detalhado]].

---

## 1.2 Etiquetas (Labels)

**O que e:** Sao "adesivos coloridos" que voce cola nas conversas para organiza-las visualmente. Funciona igual a pastas de cores — voce cria as que quiser, com o nome e a cor que preferir.

**Como funciona na pratica:**
- O gerente vai em **"Gerenciar Etiquetas"** (icone de engrenagem no painel direito) e cria quantas quiser
- Existem **12 cores pre-definidas** para escolher: roxo, violeta, rosa, vermelho, laranja, amarelo, verde, teal (verde-agua), ciano, azul, cinza e marrom
- Para aplicar numa conversa, o atendente clica no botao **"+"** na secao "Etiquetas" do painel direito. Aparece uma lista com checkboxes — marca as que quiser
- Uma conversa pode ter **varias etiquetas ao mesmo tempo** (ex: "Urgente" + "VIP" + "Orcamento")
- Para remover, clica no **"x"** da etiqueta no painel de informacoes
- As etiquetas aparecem como **badges coloridos** na lista de conversas (abaixo do nome do contato)
- Existe um **filtro por etiqueta** — clica e ve so as conversas com aquela etiqueta
- Etiquetas podem ser **editadas** (mudar nome e cor) ou **excluidas** a qualquer momento

**Cenarios reais:**
1. **Loja de materiais** com 50 mensagens/dia cria: "Aguardando pagamento" (amarelo), "Pedido enviado" (verde), "Troca/Devolucao" (vermelho), "Orcamento pendente" (azul). Toda conversa recebe pelo menos 1 etiqueta.
2. **Gerente em reuniao** filtra so "Reclamacao" para priorizar casos urgentes antes de sair.
3. **Final do mes:** gerente filtra "Orcamento" e conta quantos pedidos de orcamento chegaram — metrica simples de conversao.
4. **Atendente VIP:** marca clientes recorrentes como "VIP" — quando ligam, todo mundo sabe que precisa dar atencao especial.

> **Tecnico:** Componentes: `LabelPicker.tsx` (popover com checkboxes), `ManageLabelsDialog.tsx` (CRUD dialog), `ConversationLabels.tsx` (badges de exibicao). Tabelas Supabase: `labels` (id, inbox_id, name, color), `conversation_labels` (conversation_id, label_id — relacao N:N). 12 cores preset em `PRESET_COLORS` array. Toggle via `supabase.from('conversation_labels').insert/delete`. RLS: escopo por inbox.

---

## 1.3 Tags (Metadados Estruturados)

**O que e:** Diferente das etiquetas visuais (que sao manuais e para o humano organizar), as **tags** sao informacoes estruturadas no formato `chave:valor` que ficam "por tras" da conversa. A maioria e aplicada **automaticamente pela IA** ou pelo sistema — o atendente nao precisa fazer nada.

**Pense assim:** Etiquetas sao como post-its coloridos que voce cola na pasta do cliente. Tags sao como os dados que o sistema preenche automaticamente na ficha dele.

**Exemplos de tags automaticas:**
- `motivo:compra` — a IA detectou que o lead quer comprar algo
- `interesse:tintas` — o lead perguntou sobre tintas
- `produto:coral-branco-18L` — o lead pediu esse produto especifico
- `cidade:recife` — o lead mencionou que e de Recife
- `campanha:promo-agosto` — o lead chegou pela campanha de agosto
- `formulario:orcamento` — o lead preencheu o formulario de orcamento
- `origem:bio` — o lead veio pelo Bio Link (pagina de links)
- `funil:captacao-agosto` — o lead esta no funil de captacao
- `resultado:venda` — a conversa terminou em venda
- `sentimento:negativo` — o lead esta frustrado

**Para que servem:**
- **Segmentacao:** enviar mensagem em massa so para leads com `interesse:tintas`
- **Contexto para IA:** quando o lead volta, a IA ja sabe o que ele quer
- **Metricas:** quantos leads com `motivo:compra` viraram `resultado:venda`?
- **Automacao:** regras do tipo "quando tag `resultado:venda`, mover card no Kanban"

**Diferenca resumida:**
| | Etiquetas | Tags |
|---|-----------|------|
| Quem aplica | Atendente (manual) | IA ou sistema (automatico) |
| Formato | Nome + cor | chave:valor |
| Aparencia | Badge colorido visivel | Dado interno |
| Uso | Organizar visualmente | Segmentar, automatizar |

> **Tecnico:** Tags armazenadas como `TEXT[]` na coluna `conversations.tags` no formato `"key:value"`. Helper `mergeTags()` em `_shared/agentHelpers.ts`. Whitelist: `VALID_KEYS`, `VALID_MOTIVOS`, `VALID_OBJECOES` no ai-agent. Tags aplicadas pela IA via tool `set_tags`. Tags de sistema aplicadas por: form-public, bio-public, whatsapp-webhook. Clear context seta `['ia_cleared:TIMESTAMP']` (NUNCA `[]` — tags vazias quebra counter de handoff). Tag taxonomy 3 niveis: motivo (intent), interesse (category), produto (specific).

---

## 1.4 Notas Privadas

**O que e:** Sao anotacoes internas que **so a equipe ve**. O cliente **nunca** ve uma nota privada. Funciona como um post-it colado na conversa, visivel apenas para os colegas de trabalho.

**Como funciona na pratica:**
- No campo de digitacao do chat, o atendente muda o modo para **"Nota privada"** (clica no icone de post-it amarelo)
- Digita a anotacao e envia — ela e salva internamente
- As notas **nao aparecem no chat** do lead — ficam separadas
- No cabecalho do chat, aparece um **badge amarelo com o numero de notas** (ex: o numero "3" em amarelo)
- Clicando nesse badge, abre o **Painel de Notas** que desliza pela direita, listando todas as notas
- Cada nota mostra: **o texto**, **quem escreveu** (nome do atendente) e **quando** (data e hora exatas)
- Notas podem ser **excluidas** individualmente — o sistema pede confirmacao ("Tem certeza? Nao pode desfazer.")
- Na lista de conversas, conversas que tem notas mostram um **icone amarelo de post-it** ao lado do nome

**Cenarios reais:**
1. **Cliente dificil:** Atendente deixa nota "Cliente ja ligou 3x sobre o mesmo problema, esta irritado. Autorizado desconto de 10% pelo gerente Carlos." — todo mundo que abrir a conversa sabe o historico.
2. **Troca de turno:** Atendente A sai as 18h e deixa nota "Aguardando cliente enviar comprovante de pagamento. Se enviar, confirmar e mover pra 'Pedido confirmado'." — Atendente B chega as 8h e sabe exatamente o que fazer.
3. **Gerente precisa de contexto:** Antes de assumir uma conversa transferida, le as notas e ja sabe tudo sem precisar perguntar ao lead.
4. **Registro de dados:** Atendente anota "CPF: 123.456.789-00 | Endereco: Rua X, 100, Recife" como referencia rapida sem poluir o chat.

> **Tecnico:** Notas armazenadas na tabela `conversation_messages` com `direction = 'private_note'`. Componente `NotesPanel.tsx` (Sheet lateral, shadcn/ui). Filtro no ChatPanel: `notes = messages.filter(m => m.direction === 'private_note')`, `chatMessages = messages.filter(m => m.direction !== 'private_note')`. Badge count no header. Delete via `supabase.from('conversation_messages').delete().eq('id', noteId)` com AlertDialog de confirmacao. Exibicao: agentName via `agentNamesMap[note.sender_id]`, data via `formatBR(note.created_at)`. Badge "Nota" no `ConversationItem.tsx` via prop `hasNotes`.

---

## 1.6 Status da Conversa

**O que e:** Cada conversa tem um "semaforo" que indica em que ponto do atendimento ela esta. Ajuda a equipe a saber quais conversas precisam de atencao e quais ja foram resolvidas.

**Os 3 status:**
- **Aberta** (bolinha verde) — Atendimento em andamento, alguem precisa responder
- **Pendente** (bolinha amarela) — Esperando algo: pagamento do cliente, informacao, retorno
- **Resolvida** (bolinha azul) — Atendimento concluido, nao precisa mais de acao

**Onde mudar:** No cabecalho do chat (botao arredondado com a cor) ou no painel de informacoes (direita, dropdown).

**Em massa:** Selecionar 20 conversas → clicar "Resolver" → todas mudam para Resolvida de uma vez.

> **Tecnico:** Campo `conversations.status` (varchar: 'aberta'|'pendente'|'resolvida'). Componente `ConversationStatusSelect.tsx` (pill select no header). Constantes em `src/lib/constants.ts` `STATUS_OPTIONS`. Badge classes: `statusBadgeClass` map em ContactInfoPanel. Bulk: `handleBulkAction` em HelpDesk.tsx com `supabase.from('conversations').update({ status }).in('id', Array.from(selectedIds))`.

---

## 1.7 Prioridade

**O que e:** Indica a **urgencia** da conversa. Aparece como uma bolinha colorida no canto do avatar (foto) do contato na lista de conversas.

**Os 3 niveis:**
- **Alta** (bolinha vermelha) — Atender primeiro. Cliente VIP, reclamacao, urgencia.
- **Media** (bolinha amarela) — Atencao normal. Fluxo padrao.
- **Baixa** (bolinha azul) — Pode esperar. Duvida simples, spam.

**Onde mudar:** No painel de informacoes (direita), dropdown "Prioridade".

**Filtro e ordenacao:** Na lista de conversas, e possivel filtrar "so Alta" ou ordenar "mais urgentes primeiro".

> **Tecnico:** Campo `conversations.priority` (varchar: 'alta'|'media'|'baixa'). Constantes: `PRIORITY_OPTIONS` e `PRIORITY_COLOR_MAP` em `src/lib/constants.ts`. Bolinha no avatar: `ConversationItem.tsx` com `cn()` + `PRIORITY_COLOR_MAP[conversation.priority]`. Filtro/sort em `useHelpdeskFilters.ts`.

---

## 1.8 Atribuicao de Agente (Quem Responde?)

**O que e:** Define qual atendente e **responsavel** por aquela conversa. Evita o problema classico de dois atendentes respondendo a mesma pessoa ao mesmo tempo.

**Como funciona na pratica:**
- No painel de informacoes (direita), tem um dropdown **"Agente Responsavel"** que lista todos os atendentes daquela caixa de entrada
- Seleciona um nome → conversa e atribuida a ele
- Na lista de conversas, aparece um **badge com o nome do agente** (ex: um icone de pessoa + "Carlos")
- Existe filtro **"Minhas conversas"** (mostra so as atribuidas ao atendente logado) e **"Nao atribuidas"** (mostra conversas que ninguem pegou)
- **Auto-atribuicao:** Quando o atendente envia a primeira mensagem numa conversa sem responsavel, ele e automaticamente atribuido
- A atribuicao e **sincronizada em tempo real** — se o gerente atribui pelo painel dele, o atendente ve na hora no painel dele

> **Tecnico:** Campo `conversations.assigned_to` (UUID FK → auth.users). Membros da inbox carregados via `supabase.from('inbox_users').select('user_id')`. Nomes resolvidos via `useUserProfiles` hook. Broadcast: `supabase.channel('helpdesk-conversations').send({ event: 'assigned-agent', payload: { conversation_id, assigned_to } })`. Auto-assign no `handleMessageSent`. Select value `'__none__'` para remover atribuicao. Badge no `ConversationItem.tsx` com icone `UserCheck`.

---

## 1.9 Departamentos

**O que e:** Divisoes da empresa dentro de uma mesma caixa de entrada. Exemplo: a inbox "Vendas" pode ter os departamentos "Tintas", "Ferramentas" e "Eletrica".

**Como funciona:**
- Cada conversa pode ser atribuida a um departamento
- Na lista de conversas, aparece um **badge azul** com o nome do departamento (ex: icone de predio + "Tintas")
- Filtro por departamento na lista — "Mostrar so Tintas"
- Quando a IA faz handoff (transfere para humano), pode direcionar para um departamento especifico automaticamente

> **Tecnico:** Campo `conversations.department_id` (UUID FK → departments). Hook `useDepartments({ inboxId })`. Handler `handleAssignDepartment` em ContactInfoPanel. Nome exibido via `conversation.department_name` (computed/joined). Badge no ConversationItem com icone `Building2`. AI Agent: `handoff_department_id` em agent_profiles/funnels define o departamento de destino.

---

## 1.10 Acoes em Massa (Bulk Actions)

**O que e:** Selecionar varias conversas de uma vez (como selecionar varios e-mails no Gmail) e executar uma acao em todas simultaneamente.

**As 4 acoes disponiveis:**
1. **Marcar como lidas** — Remove o pontinho azul de "nao lida" de todas as selecionadas
2. **Resolver** — Muda o status de todas para "Resolvida"
3. **Arquivar** — Remove da lista principal (ficam no historico, nao sao apagadas)
4. **Atribuir a agente** — Define um responsavel para todas as selecionadas

**Como funciona:** Na lista de conversas, aparece um checkbox em cada uma. Seleciona as desejadas → aparece uma barra no topo com os botoes de acao.

**Cenario:** Segunda-feira, 80 conversas acumuladas do fim de semana. Gerente seleciona as 30 que a IA ja resolveu → "Arquivar todas". Seleciona 20 sobre tintas → atribui ao Carlos. Em 2 minutos, organizou o dia inteiro.

> **Tecnico:** Estado: `Set<string> selectedIds` em HelpDesk.tsx. Handler `handleBulkAction(action)` faz batch update via Supabase. Read: `update({ is_read: true })`. Resolve: `update({ status: 'resolvida' })`. Archive: `update({ archived: true })`. Selection limpa em `useEffect` quando inbox/status filter muda. Archived conversations filtradas na query com `.eq('archived', false)`.

---

## Sub-páginas relacionadas

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-ia]] — Toggle IA, Transcrição, Resumo, Finalização, Contexto do Lead
- [[wiki/casos-de-uso/helpdesk-comunicacao]] — Templates `/`, Mídia, Rascunhos, Emoji, Reply
- [[wiki/casos-de-uso/helpdesk-ux]] — Layout, Typing, Tempo de Espera, Histórico, Busca Global, Filtros, Realtime
- [[wiki/casos-de-uso/helpdesk-permissoes]] — Permissões Granulares + Árvore de Componentes
