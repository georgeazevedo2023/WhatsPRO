---
title: Helpdesk — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [helpdesk, funcionalidades, etiquetas, tags, notas, ia, chat, detalhado]
sources: [src/components/helpdesk/, src/pages/dashboard/HelpDesk.tsx]
updated: 2026-04-09
---

# Helpdesk — Central de Atendimento WhatsApp (25 Sub-Funcionalidades)

> O Helpdesk e a **central de atendimento** do WhatsPRO. Imagine uma tela parecida com o WhatsApp Web, mas profissional: do lado esquerdo ficam todas as conversas chegando (de varios numeros de WhatsApp ao mesmo tempo), e do lado direito fica o chat aberto com o cliente. Tudo em tempo real.
>
> Sem uma ferramenta assim, cada atendente precisaria de um celular com WhatsApp aberto. Com 5 atendentes e 3 numeros, seriam 5 celulares, sem controle de quem respondeu quem, sem historico, sem fila. O Helpdesk resolve tudo isso: **multiplos atendentes acessam multiplos WhatsApps pelo computador, com organizacao e rastreabilidade**.
>
> Ver tambem: [[wiki/ai-agent]], [[wiki/modulos]], [[wiki/banco-de-dados]]

---

## 1.1 Layout em 3 Paineis

A tela do Helpdesk e dividida em 3 areas lado a lado, como um e-mail profissional (tipo Gmail):

- **Painel Esquerdo** — Lista de todas as conversas (como lista de e-mails). Cada conversa mostra nome do contato, ultima mensagem, data, badges de etiquetas, nome do atendente e indicador de nao lida.
- **Painel Central** — O chat aberto, onde as mensagens aparecem (como ler um e-mail). Tem cabecalho com nome, telefone, status, botao da IA, notas e botao de finalizar.
- **Painel Direito** — Informacoes do contato: etiquetas, status, prioridade, agente responsavel, departamento, resumo IA, historico de conversas, perfil do lead.

Os paineis laterais podem ser abertos/fechados com botoes (icones de seta). Em celular, funciona como telas separadas — toca na conversa e abre o chat; toca no nome e abre o perfil.

> **Tecnico:** Pagina principal `src/pages/dashboard/HelpDesk.tsx`. Componentes: `ConversationList.tsx` (esquerda), `ChatPanel.tsx` (centro), `ContactInfoPanel.tsx` (direita). Layout responsivo via Tailwind CSS flexbox. Mobile: nav stack com `onBack` callbacks. Desktop: 3 colunas com toggles `PanelLeftOpen/Close` e `PanelRightOpen/Close`.

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

## 1.5 Toggle IA (Ligar/Desligar o Agente Inteligente)

**O que e:** Um botao no cabecalho do chat que **liga ou desliga a inteligencia artificial** para aquela conversa especifica. Quando ligada, a IA le as mensagens e responde automaticamente. Quando desligada, so o atendente humano responde.

**Como funciona na pratica:**
- No cabecalho do chat (segunda linha, ao lado do status), tem um botao arredondado:
  - **"IA Ativa"** (fundo azul, icone de robo) — significa que a IA esta respondendo
  - **"Ativar IA"** (contorno cinza, icone de robo) — IA esta desligada, so humano responde
- Um clique alterna entre os dois estados
- Ao passar o mouse sobre "IA Ativa", o botao fica vermelho ("desativar")

**Os 3 estados da IA numa conversa:**
1. **Ligada** — A IA responde automaticamente ao lead (busca produtos, qualifica, envia carrossel, etc.)
2. **Desligada** — A IA fica em silencio total. So o humano responde. Ativado manualmente ou quando o atendente envia uma mensagem.
3. **Sombra (Shadow)** — A IA **nao responde** ao lead, mas fica "escutando" a conversa e **extraindo dados automaticamente** (nome, cidade, interesses, objecoes). Ativado automaticamente apos a IA transferir para humano (handoff). Ver [[wiki/ai-agent]] para detalhes.

**Regra importante:** Quando o atendente humano **envia qualquer mensagem**, a IA e automaticamente desligada. Isso evita que os dois respondam ao mesmo tempo.

**Cenarios reais:**
1. **Fluxo normal:** Lead chega → IA responde automaticamente → qualifica → envia produtos → lead pede "quero falar com vendedor" → IA faz handoff e entra em modo Shadow → atendente assume.
2. **Conversa delicada:** Gerente abre conversa de reclamacao formal → desliga a IA manualmente → responde pessoalmente com cuidado.
3. **Reativar IA:** Depois que o atendente resolve e finaliza, um novo lead manda mensagem no mesmo numero → atendente liga a IA de volta.
4. **Shadow silencioso:** Apos handoff, enquanto o vendedor negocia por 20 minutos, a IA em Shadow extrai automaticamente: "cidade:campinas", "orcamento:alto", "interesse:pintura-completa". Quando o vendedor abre o perfil do lead, os dados ja estao la.

> **Tecnico:** Estado armazenado em `conversations.status_ia` (enum: 'ligada'|'desligada'|'shadow'). Constantes: `STATUS_IA.LIGADA/DESLIGADA/SHADOW` de `src/constants/statusIa.ts` (frontend) e `_shared/constants.ts` (edge). Toggle em `ChatPanel.tsx` `handleToggleIA()`: `supabase.from('conversations').update({ status_ia: newStatus })`. Auto-desliga no `handleMessageSent` callback: `setIaAtivada(false)`. UI: Button variant `default` (ativa) / `outline` (inativa), hover muda para `destructive`. Estado inicial carregado via `supabase.from('conversations').select('status_ia')`. Realtime sync: broadcast `new-message` payload inclui `status_ia`.

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

## 1.11 Respostas Rapidas (Templates com "/")

**O que e:** Ao digitar a barra "/" na caixa de mensagem, aparece um menu suspenso com **respostas prontas** cadastradas. Funciona como atalhos para textos que o atendente usa o tempo todo.

**Como funciona:**
- Atendente digita **"/"** → menu aparece com ate 8 opcoes
- Continua digitando para filtrar: "/prop" mostra so templates que contem "prop"
- Navega com **setas do teclado**, **Enter** para selecionar, **Esc** para fechar
- O texto e inserido na caixa de mensagem — o atendente pode **editar antes de enviar**

**Cenarios:**
1. `/boas-vindas` → "Ola! Bem-vindo a nossa loja. Como posso ajudar?"
2. `/proposta` → "Segue nossa proposta comercial. O valor total e R$ [VALOR]."
3. `/horario` → "Nosso horario e de segunda a sexta, das 8h as 18h."
4. `/pix` → "Para pagamento via PIX, use a chave: empresa@email.com"

> **Tecnico:** Implementado em `ChatInput.tsx`. Fonte: `supabase.from('message_templates').select('*')`. Trigger: detecta `"/"` no onChange. Filtra por `name` e `content` case-insensitive. Max 8 resultados. Keyboard: ArrowUp/Down para navegar, Enter para selecionar (auto-selects primeiro), Esc para fechar. Template text-only (sem midia). Dropdown posicionado acima do input.

---

## 1.12 Tipos de Midia no Chat

**O que e:** Alem de texto, o chat exibe e permite enviar diversos tipos de conteudo — tudo que o WhatsApp suporta.

| Tipo | O que o atendente ve |
|------|----------------------|
| **Texto** | Mensagem normal, como no WhatsApp |
| **Imagem** | Foto que pode ser clicada para abrir em tamanho grande |
| **Audio** | Player de audio com botao play/pause e controle de velocidade (1x, 1.5x, 2x) |
| **Video** | Player de video com controles (play, pause, barra de progresso) |
| **Documento** | Icone do tipo de arquivo + nome + extensao + botao para baixar |
| **Sticker** | Figurinha do WhatsApp com fundo transparente |
| **Carrossel** | Cards deslizaveis com foto + texto + botoes |
| **Enquete** | Pergunta + opcoes clicaveis (tipo votacao) |
| **Contato (vCard)** | Cartao com nome, telefone, e-mail e botoes de acao |
| **Localizacao** | Dados de geolocalizacao |

**Para enviar arquivos:** O atendente pode usar o botao de anexar (icone de clip) ou simplesmente **arrastar e soltar** um arquivo sobre o chat — aparece a mensagem "Solte o arquivo aqui" com destaque visual.

> **Tecnico:** Renderizacao em `MessageBubble.tsx` com switch em `media_type`. Audio: `AudioPlayer.tsx` com HTMLAudioElement + playbackRate control (1/1.5/2). Carrossel: JSON.parse do content, cards com botoes tipo URL/CALL/REPLY. Enquete: `media_type='poll'` com BarChart3 icon + options cards. vCard: parse com regex de campos (N, TEL, EMAIL, ORG). Imagem: lazy loading + click → lightbox/window.open. Documento: signed URL resolution para Supabase Storage. Drag & drop: `onDragOver/onDragLeave/onDrop` no scroll container, dispatch `helpdesk-file-drop` CustomEvent. Upload via `useSendFile` hook.

---

## 1.13 Transcricao de Audio

**O que e:** Quando o lead envia um audio pelo WhatsApp, o sistema **transcreve automaticamente** o conteudo para texto. Aparece em italico logo abaixo do player de audio, com um icone de bloquinho de notas.

**Por que importa:** Muitos brasileiros preferem mandar audio. Mas o atendente pode estar em ambiente barulhento, ou o audio pode ter 3 minutos. Com a transcricao, ele **le em 10 segundos** o que levaria 3 minutos para ouvir.

> **Tecnico:** Motor: Whisper via Groq API, processado pelo edge function `transcribe-audio` (chamado pelo `process-jobs` worker). Transcricao salva no campo `conversation_messages.transcription`. Realtime: broadcast `transcription-updated` com `{ conversationId, messageId, transcription }` no canal `helpdesk-realtime`. ChatPanel listener atualiza estado: `setMessages(prev => prev.map(m => m.id === messageId ? { ...m, transcription } : m))`. UI: texto italico com prefix de icone abaixo do AudioPlayer. Loading: spinner animado + "Transcrevendo...".

---

## 1.14 Resumo IA da Conversa

**O que e:** Um botao **"Gerar Resumo"** no painel de informacoes (direita) que pede a inteligencia artificial para ler toda a conversa e criar um resumo inteligente.

**O que o resumo contem:**
- **Motivo** — Por que o lead entrou em contato
- **Resumo** — O que foi discutido
- **Resolucao** — Como terminou
- **Quantidade de mensagens** e **data** de quando o resumo foi gerado

**Cenarios:**
1. Gerente abre conversa de 200 mensagens → "Gerar Resumo" → 5 segundos → sabe todo o contexto.
2. Historico: cada conversa passada pode ter seu proprio resumo gerado.

> **Tecnico:** Edge function `summarize-conversation` (Groq/Gemini). Request: `edgeFunctionFetch('summarize-conversation', { conversation_id, force_refresh })`. Response: `{ summary: AiSummary }` com campos `reason`, `summary`, `resolution`, `generated_at`, `message_count`. Salvo em `conversations.ai_summary` (JSONB). UI: botao `Sparkles` + `RefreshCw` no ContactInfoPanel. Estado local: `aiSummary` + `summarizing`. Historico: `handleGenerateHistorySummary(convId)` para conversas passadas.

---

## 1.15 Indicador de Digitacao (Typing Indicator)

**O que e:** Quando um atendente esta digitando numa conversa, os outros membros da equipe veem a mensagem **"Carlos esta digitando..."** com uma animacao pulsante. Assim ninguem responde ao mesmo tempo.

> **Tecnico:** Broadcast: `supabase.channel('helpdesk-realtime').send({ event: 'agent-typing', payload: { conversation_id, agent_id, agent_name } })`. Listener em ChatPanel: filtra `agent_id !== currentUserId` (self-exclusion). Timeout: `setTimeout(() => setTypingAgent(null), 4000)` (limpa apos 4s). Throttle: `broadcastTyping()` minimo 3s entre envios. UI: texto pulsante `animate-pulse` com nome do agente.

---

## 1.16 Indicador de Tempo de Espera

**O que e:** Na lista de conversas, ao lado da data, aparece ha quanto tempo o lead esta **esperando resposta**. Mostra "5m" (5 minutos), "2h30m" (2 horas e meia), "3d" (3 dias).

**Urgencia visual:** O indicador vai ficando mais visivel conforme o tempo passa:
- Menos de 15 minutos → bem discreto
- Entre 15 minutos e 1 hora → visibilidade media
- Mais de 1 hora → bem visivel

So aparece em conversas que nao foram resolvidas.

> **Tecnico:** Calculado em `ConversationItem.tsx` `getWaitInfo()`. Base: `Date.now() - new Date(conversation.last_message_at).getTime()`. Formato: `<60min` → Xm, `<1440min` → XhYm, `>=1440min` → Xd. Opacidade via classes: `opacity-50` (<15min), `opacity-70` (15-60min), `opacity-90` (>60min). Icone `Clock` w-2.5. Oculto quando `conversation.status === 'resolvida'` ou `!conversation.last_message_at`.

---

## 1.17 Rascunhos (Drafts)

**O que e:** Se o atendente comeca a digitar uma resposta e troca de conversa **sem enviar**, o texto nao se perde — e salvo automaticamente na memoria do navegador.

**Como funciona:**
- Salva automaticamente a cada 300 milissegundos de digitacao
- Na lista de conversas, aparece um **badge "Rascunho"** na conversa que tem texto nao enviado
- Ao voltar para a conversa, o texto reaparece na caixa de mensagem

> **Tecnico:** Storage: `localStorage.getItem/setItem('helpdesk-draft-${conversationId}')`. Save debounce: 300ms no onChange do ChatInput. Badge "Rascunho" no ConversationItem: `const hasDraft = !!localStorage.getItem(...)`. Limpa apos enviar. Persistente entre sessoes (localStorage sobrevive reload).

---

## 1.18 Finalizar Atendimento (Ticket Resolution Drawer)

**O que e:** Um painel que desliza de baixo para cima quando o atendente clica no botao verde **"Finalizar"**. Serve para registrar **como** aquele atendimento terminou.

**As 4 categorias:**
1. **Venda Fechada** (verde) — O lead comprou. Aparece campo para digitar o valor da venda (ex: R$ 1.450,00)
2. **Nao Converteu** (vermelho) — O lead nao comprou. Motivo: Preco alto / Concorrente / Sem estoque / Sem resposta
3. **Suporte Resolvido** (azul) — Era duvida ou problema tecnico, e foi resolvido
4. **Spam / Irrelevante** (cinza) — Mensagem indesejada, propaganda, numero errado

**O que acontece ao clicar "Finalizar":**
- Status muda para "Resolvida"
- Tags automaticas aplicadas (ex: `resultado:venda`, `motivo:preco`, `valor:1450`)
- Card do lead no CRM Kanban movido para coluna correspondente
- Perfil do lead atualizado (ticket medio, data ultima compra)
- Se NPS habilitado, agenda enquete de satisfacao automatica
- Campo de observacoes para comentarios finais

**Cenario:** Atendente fecha venda de R$ 2.800 → "Finalizar" → "Venda Fechada" → R$ 2.800 → card move para "Fechado Ganho" → 30 minutos depois, lead recebe NPS.

> **Tecnico:** Componente `TicketResolutionDrawer.tsx` (Drawer, vaul). 4 categorias em `CATEGORIES` array (value, label, icon, color, bgColor). Lost reasons: `LOST_REASONS` array. Kanban mapping: `KANBAN_COLUMN_MAP` (VENDA→'Fechado Ganho', PERDIDO→'Perdido'). Tags: `TAG_MAP` (VENDA→'resultado:venda'). Currency: `formatCurrency/parseCurrency` com mascara pt-BR e limite `MAX_SALE_VALUE = 999_999_99` (centavos). Upsert lead_profiles: average_ticket, last_purchase_at. NPS: chama `triggerNpsIfEnabled()` via job_queue (delay configuravel). Observacoes: textarea livre salvo em tags como `observacao:TEXTO`.

---

## 1.19 Historico de Conversas Passadas

**O que e:** No painel de informacoes (direita), lista de **todas as conversas anteriores** do mesmo cliente.

- Mostra ate **20 conversas** inicialmente. Botao "Carregar todas" expande para ate 200.
- Cada conversa: status, data, ultima mensagem
- Pode gerar resumo IA de cada conversa passada

> **Tecnico:** Query: `supabase.from('conversations').select('id, status, last_message_at, created_at, ai_summary, last_message').eq('contact_id', X).neq('id', currentId).order('last_message_at', { ascending: false }).limit(historyLimit)`. Count total via `.select('id', { count: 'exact', head: true })`. Load all: `setHistoryLimit(200)`. Resumo por conversa: `handleGenerateHistorySummary(convId)` → edgeFunctionFetch. Expansivel via `expandedSummaries: Set<string>`.

---

## 1.20 Contexto do Lead (Perfil + Ultimo Handoff)

**O que e:** No painel de informacoes, o sistema mostra automaticamente **todos os dados que a IA coletou** sobre o lead.

**Dados exibidos:** Nome completo, cidade, interesses, ticket medio, objecoes, notas da IA, ultimo motivo de handoff.

**Por que importa:** O atendente assume e **ja sabe tudo** sem precisar perguntar.

> **Tecnico:** Lead profile: `supabase.from('lead_profiles').select('full_name, city, interests, reason, average_ticket, objections, notes').eq('contact_id', X).maybeSingle()`. Handoff log: `supabase.from('ai_agent_logs').select('metadata, created_at').eq('conversation_id', X).eq('event', 'handoff').order('created_at', { ascending: false }).limit(1).maybeSingle()`. Estado: `leadProfile` + `handoffLog`. Exibicao: icones MapPin (cidade), ShoppingCart (ticket), Target (interesses). Tabela `lead_profiles` com FK `contact_id` para `contacts`.

---

## 1.21 Busca Global (Ctrl+K)

**O que e:** Campo de busca que pesquisa em **todas as conversas de todas as caixas de entrada** ao mesmo tempo.

- Atalho: **Ctrl+K**
- Busca por: nome, telefone, conteudo de mensagens
- Resultados agrupados por inbox
- Minimo 3 caracteres, espera 500ms apos parar de digitar

> **Tecnico:** Componente `GlobalSearchDialog.tsx`. Hook `useGlobalSearch`. Match types: contact_name, phone, message. Full-text search no campo `content` com `ilike` + debounce 500ms. Resultados: `Record<inbox_id, Conversation[]>`. UI: Dialog + Command (cmdk pattern). Trigger: Ctrl+K global keydown listener.

---

## 1.22 Filtros e Ordenacao da Lista

**Filtros (combinaveis):**
- Atribuicao: Todas | Minhas | Nao atribuidas
- Prioridade: Todas | Alta | Media | Baixa
- Etiqueta: qualquer etiqueta criada
- Departamento: qualquer departamento
- Status: Aberta | Pendente | Resolvida | Todas

**Ordenacao:** Mais recentes | Nao lidas | Por prioridade

> **Tecnico:** Hook `useHelpdeskFilters.ts`. Filtros aplicados como query params no Supabase select. Assignment filter: `.eq('assigned_to', userId)` ou `.is('assigned_to', null)`. Priority/status: `.eq()`. Labels: join via `conversation_labels`. Sort: `.order('last_message_at')` ou `.order('priority')` ou `is_read` first. Componente ConversationList renderiza filter pills no topo.

---

## 1.23 Notificacao Sonora + Conexao em Tempo Real

**Notificacao sonora:** Som de alerta discreto quando mensagem chega e navegador esta em outra aba.

**Indicador de conexao:** Bolinha verde (conectado), amarelo pulsante (conectando), vermelho + icone Wi-Fi cortado (desconectado).

**Reconexao automatica:** 5 segundos apos desconexao.

> **Tecnico:** Som: `new Audio('data:audio/wav;base64,...')` com `volume = 0.3`, disparado quando `incomingCount > prevMsgCountRef.current && !document.hasFocus()`. Realtime: canal `helpdesk-realtime` com subscribe status callback: `SUBSCRIBED` → 'connected', `CLOSED` → 'disconnected'. Reconnect: `useEffect` com `setTimeout(fetchMessages, 5000)` quando `channelStatus === 'disconnected'`. Eventos: `new-message`, `transcription-updated`, `agent-typing`. UI: span com classes condicionais `bg-primary/bg-destructive/bg-warning` + `animate-pulse`.

---

## 1.24 Emoji

**O que e:** Botao com icone de carinha sorridente na caixa de mensagem. Abre seletor completo de emojis.

> **Tecnico:** Componente `src/components/ui/emoji-picker.tsx`. Integracao no ChatInput via Popover trigger (icone Smile). Insere emoji na posicao do cursor no textarea.

---

## 1.25 Responder Mensagem (Reply)

**O que e:** Botao de "responder" em cada mensagem. Cria citacao da mensagem original no campo de digitacao.

> **Tecnico:** Estado `replyTo: Message | null` no ChatPanel. Botao reply no MessageBubble (hover action). ChatInput exibe quote da mensagem referenciada. Limpa com `handleClearReply`. Mensagem enviada com referencia ao message_id original.

---

## Arvore de Componentes

```
HelpDesk.tsx (pagina principal)
+-- ConversationList.tsx
|   +-- Search + Sort + Filter pills
|   +-- Bulk action bar (acoes em massa)
|   +-- ConversationItem.tsx (cada conversa na lista)
|       +-- ContactAvatar + bolinha de prioridade
|       +-- ConversationLabels (badges de etiquetas)
|       +-- Badges: departamento, agente, nota, rascunho
|       +-- Tempo de espera (relogio)
+-- ChatPanel.tsx
|   +-- Header linha 1: avatar, nome, telefone, agente, conexao
|   +-- Header linha 2: status, toggle IA, badge notas, botao Finalizar
|   +-- Divisores de data + lista de mensagens
|   |   +-- MessageBubble.tsx (10 tipos de midia)
|   |   +-- AudioPlayer.tsx (player com velocidade)
|   |   +-- Transcricao inline
|   +-- Indicador de digitacao
|   +-- ChatInput.tsx
|   |   +-- Campo de texto + rascunho automatico
|   |   +-- Anexar imagem/documento + drag & drop
|   |   +-- Gravar audio
|   |   +-- Menu de templates (/)
|   |   +-- Seletor de emoji
|   |   +-- Modo nota privada
|   |   +-- Citacao de resposta (reply)
|   +-- NotesPanel.tsx (painel lateral de notas)
|   +-- TicketResolutionDrawer.tsx (painel de finalizacao)
+-- ContactInfoPanel.tsx
    +-- Avatar + nome + telefone
    +-- Secao de etiquetas (LabelPicker + ManageLabelsDialog)
    +-- Dropdown de status (ConversationStatusSelect)
    +-- Dropdown de prioridade
    +-- Dropdown de agente responsavel
    +-- Dropdown de departamento (useDepartments)
    +-- Resumo IA (summarize-conversation edge function)
    +-- Contexto do Lead (lead_profiles + ai_agent_logs)
    +-- Historico de conversas passadas (ate 200)
    +-- GlobalSearchDialog.tsx (Ctrl+K)
```

---

## Links Relacionados

- [[wiki/ai-agent]] — Agente IA que atende automaticamente
- [[wiki/modulos]] — Todos os 17 modulos do sistema
- [[wiki/banco-de-dados]] — Tabelas do banco (conversations, conversation_messages, labels, etc.)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — AI Agent em profundidade (15 sub-funcionalidades)
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rapido de todas as funcionalidades

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Rev 1: Termos tecnicos traduzidos, cenarios enriquecidos, wikilinks adicionados*
*Rev 2: Camada tecnica adicionada (componentes, tabelas, queries, hooks) em cada secao*
