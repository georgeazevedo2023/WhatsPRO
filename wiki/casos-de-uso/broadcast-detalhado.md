---
title: Broadcast — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [broadcast, disparador, mensagens, carrossel, enquete, leads, grupos, detalhado]
sources: [src/pages/dashboard/Broadcaster.tsx, src/components/broadcast/, src/hooks/useBroadcastSend.ts]
updated: 2026-04-10
---

# Broadcast — Disparador de Mensagens em Massa (12 Sub-Funcionalidades)

> O Broadcast (ou "Disparador") e a ferramenta para enviar **mensagens em massa** — a mesma mensagem para dezenas, centenas ou milhares de contatos ao mesmo tempo. Pense nele como um "mala direta" pelo WhatsApp: em vez de enviar mensagem 1 por 1, voce escreve uma unica vez e dispara para uma lista inteira.
>
> Serve para: promocoes ("10% off essa semana"), avisos ("Mudamos de endereco"), lancamentos ("Novo produto chegou"), enquetes ("Como foi seu atendimento?"), e qualquer comunicacao que precisa alcalcar muitas pessoas.
>
> A grande diferenca de um broadcast simples e que aqui voce pode enviar **4 tipos de conteudo** (texto, midia, carrossel de produtos, e enquetes nativas do WhatsApp), para **2 tipos de destinatario** (grupos do WhatsApp ou lista de leads individual), com **agendamento**, **delay aleatorio** entre envios (para nao ser bloqueado pelo WhatsApp), e **historico completo** de tudo que foi enviado.
>
> Ver tambem: [[wiki/casos-de-uso/ai-agent-detalhado]] (IA responde quando lead reage ao broadcast), [[wiki/casos-de-uso/leads-detalhado]] (base de leads usada como destinatario)

---

## 6.1 Os 4 Tipos de Conteudo

**O que e:** O Broadcast permite enviar 4 tipos diferentes de conteudo, cada um com sua aba no formulario de composicao.

### Texto
A mensagem mais simples — texto puro com emojis. Ate 4.096 caracteres. Contador mostra quantos caracteres faltam. Seletor de emoji integrado.

**Cenario:** "Ola! Essa semana temos 15% de desconto em todas as tintas. Venha conferir! Valido ate sexta."

### Midia (Imagem, Video, Audio, Documento)
Enviar um arquivo com legenda opcional. Formatos aceitos:
- **Imagens:** JPEG, PNG, GIF, WebP
- **Videos:** MP4
- **Audios:** MP3, OGG, WAV
- **Documentos:** qualquer formato (PDF, Excel, etc.)
- **PTT (audio de voz):** audio que aparece como se fosse gravado pelo WhatsApp

Tamanho maximo: 10MB. Pode enviar por upload de arquivo ou por URL externa. Preview (pre-visualizacao) antes de enviar.

**Cenario:** Enviar folder do mes em PDF para 300 clientes + legenda "Confira nossas ofertas de abril!"

### Carrossel (Cards Deslizaveis)
Serie de cards horizontais com foto + texto + botoes. De 2 a 10 cards por carrossel. Cada card tem:
- **Texto** (obrigatorio) — descricao do produto
- **Imagem** (obrigatoria) — foto do produto
- **Ate 3 botoes** — cada um pode ser: link (URL), ligar (telefone), ou resposta rapida

Pode incluir uma mensagem principal antes do carrossel. Botoes podem direcionar para o site, para um telefone, ou para uma resposta automatica.

**Cenario:** Broadcast de 5 produtos novos. Cada card: foto do produto + nome + preco + botao "Comprar" (link pro site) + botao "Mais info" (resposta rapida que inicia conversa com a IA).

### Enquete (Poll Nativa do WhatsApp)
Enquete nativa com botoes clicaveis — nao e texto com "1, 2, 3", sao botoes reais que o lead toca. De 2 a 12 opcoes. Pode ser de escolha unica ou multipla.

Opcionalmente, pode enviar uma **imagem antes da enquete** (ex: foto do produto + "Qual cor voce prefere?"). Respostas sao rastreadas automaticamente e podem gerar tags.

**Cenario:** "Qual horario voce prefere para entrega?" → opcoes: "Manha (8h-12h)", "Tarde (13h-17h)", "Noite (18h-21h)". 200 leads respondem, sistema agrupa as respostas.

> **Tecnico:** 4 tabs em `BroadcastMessageForm.tsx` / `LeadMessageForm.tsx`. Texto: max `MAX_MESSAGE_LENGTH = 4096`. Midia: `BroadcastMediaTab.tsx`, accepted types em constantes `ALLOWED_IMAGE_TYPES`, `ALLOWED_VIDEO_TYPES`, `ALLOWED_AUDIO_TYPES`, max `MAX_FILE_SIZE = 10MB`. Carrossel: `CarouselEditor.tsx` + `CarouselCardEditor.tsx` + `CarouselButtonEditor.tsx`, min 2 max 10 cards (`MIN_CARDS`, `MAX_CARDS`), 3 button types (URL, CALL, REPLY). Preview: `CarouselPreview.tsx`. Enquete: `PollEditor.tsx`, 2-12 opcoes, max 255 chars pergunta, 100 chars/opcao, selectable_count (1=single, 0=multi), image_url opcional (D1), auto_tags (D2). Tabelas: `poll_messages`, `poll_responses` (voter_jid + selected_options[] + voted_at).

---

## 6.2 Dois Modos de Envio: Grupos vs Leads

**O que e:** O Broadcast tem 2 fluxos separados dependendo de para quem voce quer enviar.

### Modo Grupos
Envia para **grupos do WhatsApp** (aqueles grupos com varias pessoas). Voce seleciona quais grupos, e a mensagem e enviada em cada grupo selecionado. A mensagem aparece no grupo, visivel para todos os membros.

- Selecao de grupos com checkbox e busca por nome
- Mostra quantidade de membros de cada grupo
- Opcao de **excluir admins** (so envia para membros normais)
- Quando exclui admins, pode escolher manualmente quais participantes incluir

### Modo Leads
Envia para **contatos individuais** (mensagem privada, nao em grupo). Voce monta uma lista de leads e a mensagem e enviada 1 a 1 para cada numero.

- Funciona como mensagem privada — cada lead recebe individualmente
- O lead nao sabe que foi mensagem em massa (parece mensagem pessoal)
- Pode usar listas de leads ja salvas (Lead Databases)

**Cenario comparativo:**
- **Modo Grupos:** "Bom dia a todos! Lembrando da reuniao amanha." → 5 grupos selecionados → mensagem aparece em cada grupo.
- **Modo Leads:** "Ola [Nome]! Temos uma oferta especial para voce." → 300 leads → cada um recebe mensagem privada individual.

> **Tecnico:** Modo Grupos: pagina `Broadcaster.tsx` (rota `/dashboard/broadcast`), 3 passos (instancia → grupos → mensagem). `GroupSelector.tsx` com checkbox multi-select, `useInstanceGroups` hook, `ParticipantSelector.tsx` quando exclude_admins=true. Modo Leads: pagina `LeadsBroadcaster.tsx` (rota `/dashboard/broadcast/leads`), `LeadImporter.tsx` para montar lista. Hook: `useBroadcastSend.ts` (grupos), `useLeadsBroadcaster.ts` (leads).

---

## 6.3 Importador de Leads (4 Formas de Montar Lista)

**O que e:** Antes de enviar no modo Leads, voce precisa montar a lista de quem vai receber. O sistema oferece 4 formas de importar contatos:

### Colar Numeros
Cola uma lista de numeros de telefone (um por linha ou separados por virgula). Pode colar no formato "Nome - Numero" ou so o numero.

**Cenario:** Copia 50 numeros de uma planilha → cola no campo → sistema valida → 48 validos, 2 invalidos.

### Importar CSV
Upload de arquivo CSV com colunas de nome e telefone. Auto-detecta separador e colunas. Maximo 50.000 contatos, 10MB.

**Cenario:** Exporta lista do sistema antigo → importa CSV → 500 leads prontos para broadcast.

### Extrair de Grupos
Seleciona grupos do WhatsApp e extrai os membros como lista individual. Remove duplicatas entre grupos. Exclui admins automaticamente.

**Cenario:** 3 grupos com 100 membros cada → extrai → 250 leads unicos (50 eram membros de mais de 1 grupo).

### Adicionar Manual
Digita telefone e nome um por um. Para quando precisa adicionar poucos contatos especificos.

> **Tecnico:** Componente `LeadImporter.tsx` com 4 tabs: `PasteTab.tsx` (parse "Nome - Numero", validacao), `CsvTab.tsx` (auto-detect delimiter, column mapping, max 10MB/50k rows, CSV injection sanitize), `GroupsTab.tsx` (multi-group extract, exclude admins, dedup by JID), `ManualTab.tsx` (single input + validate). Dados salvos em `lead_database_entries` (phone, name, jid, verification_status, verified_name, source, group_name). Verificacao: `verifyNumbers()` com progress tracking.

---

## 6.4 Lead Databases (Listas Salvas)

**O que e:** Em vez de montar a lista do zero toda vez, voce pode salvar listas de leads para reutilizar. Funciona como "listas de contatos" que ficam salvas no sistema.

**Como funciona:**
- Criar database com nome e descricao (ex: "Clientes VIP Abril")
- Importar contatos via qualquer dos 4 metodos (colar, CSV, grupos, manual)
- Selecionar multiplas databases para um unico broadcast
- Verificar numeros (checar quais sao validos no WhatsApp)
- Editar, renomear ou excluir databases

**Cenario:** Loja cria 3 listas: "Clientes VIP" (50 contatos), "Novos Leads Abril" (200 contatos), "Inativos 90 dias" (150 contatos). Cada broadcast pode usar 1 ou mais listas combinadas.

> **Tecnico:** Tabela `lead_databases` (id, user_id, name, description, leads_count, created_at, updated_at). Tabela `lead_database_entries` (phone, name, jid, verification_status ENUM, verified_name, source, group_name — unique phone per database, ON DELETE CASCADE). Componentes: `CreateLeadDatabaseDialog.tsx`, `EditDatabaseDialog.tsx`, `ManageLeadDatabaseDialog.tsx`, `LeadDatabaseSelector.tsx` (multi-select), `LeadList.tsx`. RLS: users veem proprias, super_admins veem todas.

---

## 6.5 Agendamento de Envio

**O que e:** Em vez de enviar imediatamente, voce pode agendar para uma data e hora especificas. A mensagem fica salva e e disparada automaticamente no horario programado.

**Opcoes:**
- **Envio imediato** — clica "Enviar" e comeca na hora
- **Envio agendado** — escolhe data e hora, clica "Agendar"
- **Carrossel e enquete** — agendamento ainda nao suportado (so envio imediato)

**Cenario:** Gerente prepara broadcast na quinta-feira → agenda para sexta 8h → sistema dispara automaticamente na sexta de manha, sem ninguem precisar estar no computador.

> **Tecnico:** Dialog `ScheduleMessageDialog`. Funcoes `scheduleText()` e `scheduleMedia()` no hook `useBroadcastSend`. Carousel/poll: toast error "Agendamento de carrossel nao suportado ainda". Agendamento usa edge function `process-scheduled-messages`.

---

## 6.6 Delay Aleatorio (Anti-Ban)

**O que e:** Para evitar que o WhatsApp bloqueie o numero por envio em massa, o sistema adiciona um **intervalo aleatorio** entre cada mensagem enviada. Isso faz parecer envio humano, nao automatizado.

**3 opcoes de delay:**
- **Nenhum** — envia o mais rapido possivel (350ms entre cada)
- **5-10 segundos** — intervalo aleatorio de 5 a 10 segundos entre cada envio
- **10-20 segundos** — intervalo mais seguro de 10 a 20 segundos

**Delay base fixo:**
- 350ms entre cada destinatario (dentro de um grupo)
- 500ms entre cada grupo

**Cenario:** 300 leads com delay 10-20s → tempo estimado: ~75 minutos. O sistema mostra o tempo estimado antes de enviar, e durante o envio mostra o tempo restante.

> **Tecnico:** Constantes em `broadcastSender.ts`: `SEND_DELAY_MS = 350`, `GROUP_DELAY_MS = 500`. Funcao `getRandomDelay()` retorna delay aleatorio no range selecionado. Estado `randomDelay` em `BroadcastSendControls.tsx`. Opcoes: 'none' | '5-10' | '10-20'. Tempo estimado calculado antes do envio. Timer real-time durante envio.

---

## 6.7 Progresso de Envio em Tempo Real

**O que e:** Durante o envio, aparece uma janela modal mostrando o progresso em tempo real — quantos ja foram enviados, quantos faltam, tempo decorrido, tempo estimado restante, e opcoes de pausar ou cancelar.

**O que mostra:**
- **Barra de progresso** com porcentagem (ex: "67% — 201 de 300")
- **Grupo atual** — em qual grupo esta enviando (modo grupos)
- **Destinatario atual** — em qual numero esta enviando
- **Tempo decorrido** — quanto tempo ja passou (ex: "23m 15s")
- **Tempo restante** — estimativa de quanto falta (ex: "~11m")
- **Resultados** — lista de grupos/leads com status (sucesso ou erro)

**Controles:**
- **Pausar** — para o envio temporariamente, pode retomar depois
- **Retomar** — continua de onde parou
- **Cancelar** — para definitivamente (o que ja foi enviado nao volta)

**Cenarios:**
1. **Envio grande:** 500 leads com delay 10-20s. Modal mostra progresso, tempo estimado 2h30. Gerente pausa para almoco, retoma depois.
2. **Erro detectado:** Percebe que a mensagem tem erro de digitacao apos enviar 50 de 300. Cancela. 50 ja receberam, 250 nao.

> **Tecnico:** Componente `BroadcastProgressModal.tsx`. Interface `SendProgress` com: currentGroup, totalGroups, currentMember, totalMembers, groupName, status (idle|sending|paused|success|error|cancelled), results[], startedAt. Tempo: elapsed via setInterval(1s), remaining via media de velocidade. Pause/resume: flag no hook `useBroadcastSend`. Cancel: seta status='cancelled' e para o loop. Resultados: array de `{groupName, success, error?}`.

---

## 6.8 Templates de Mensagem (Modelos Reutilizaveis)

**O que e:** Salvar mensagens prontas para reutilizar em broadcasts futuros. Em vez de digitar a mesma promocao todo mes, salva como template e aplica com 1 clique.

**Tipos de template suportados:**
- Texto puro
- Midia (imagem/video/audio/documento com legenda)
- Carrossel (cards completos com fotos e botoes)
- Enquete (pergunta + opcoes)

**Como funciona:**
- Escreveu a mensagem → clica "Salvar como Template" → da um nome → salvo
- Proximo broadcast → clica "Selecionar Template" → escolhe na lista → campos preenchidos automaticamente
- Busca por nome no seletor de templates

**Cenario:** Loja tem template "Promocao Mensal" com carrossel de 5 produtos. Todo mes, seleciona o template, troca as fotos e precos, e envia. Em 5 minutos em vez de 30.

> **Tecnico:** Componente `TemplateSelector.tsx`. Tabela `message_templates` (name, content, message_type, media_url, filename, carousel_data JSONB). CRUD completo. Salvar: valida e faz upload de midia se necessario. Aplicar: preenche todos os campos do formulario. Busca: filtro client-side por nome. Icones por tipo de template.

---

## 6.9 Selecao de Instancia (Qual Numero Enviar)

**O que e:** Se a empresa tem varios numeros de WhatsApp (ex: "Vendas", "Suporte", "Marketing"), voce escolhe de qual numero o broadcast sera enviado.

**Cenario:** Empresa tem 3 numeros: "Vendas" (Eletropiso), "Marketing" (Wsmart), "Suporte". Broadcast de promocao → seleciona "Marketing". Aviso interno → seleciona "Vendas".

> **Tecnico:** Componente `InstanceSelector.tsx`. Primeiro passo no workflow de broadcast. `BroadcasterHeader.tsx` mostra instancia selecionada. Instancia define quais grupos aparecem no `GroupSelector` e qual token UAZAPI e usado para envio.

---

## 6.10 Historico de Broadcasts

**O que e:** Registro completo de todos os broadcasts ja enviados. Funciona como um "diario" de tudo que foi disparado, com filtros, busca e opcao de reenviar.

**O que cada registro mostra:**
- Tipo da mensagem (texto/midia/carrossel/enquete)
- Conteudo (preview da mensagem)
- Data e hora de inicio e fim
- Duracao total do envio
- Quantidade de destinatarios: alvos, sucesso, falha
- Status: concluido, cancelado, erro
- Nome dos grupos ou listas de leads
- Instancia usada

**Filtros disponiveis:**
- Por status (concluido / cancelado / erro)
- Por tipo de mensagem (texto / midia / carrossel / enquete)
- Por destino (grupos / leads)
- Por instancia
- Por periodo (data inicio → data fim)
- Busca por conteudo

**Acoes:**
- **Reenviar** — reaproveita a mensagem e envia novamente (pode mudar destinatarios)
- **Excluir** — remove o registro (individual ou em lote)
- **Expandir** — ver detalhes completos do envio

**Cenario:** Gerente quer saber "quantos broadcasts fizemos em marco?". Filtra por periodo → ve 12 broadcasts. Clica em cada um para ver quantos leads receberam e quantos falharam.

> **Tecnico:** Componente `BroadcastHistory.tsx`, pagina `BroadcastHistoryPage.tsx`. Tabela `broadcast_logs` (user_id, instance_id, instance_name, message_type, content, media_url, carousel_data JSONB, groups_targeted, recipients_targeted, recipients_success, recipients_failed, exclude_admins, random_delay, status, started_at, completed_at, duration_seconds, error_message, group_names TEXT[]). Filtros: `BroadcastHistoryFilters.tsx`. Cards: `BroadcastLogCard.tsx`. Preview: `HistoryMessagePreview.tsx` + `HistoryCarouselPreview.tsx`. Delete: `BroadcastDeleteDialogs.tsx`. Resend: dialog com opcao grupos/leads, armazena dados em sessionStorage. Paginacao: 100 por pagina, sorted by created_at DESC. RLS: users veem proprios, super_admins veem todos.

---

## 6.11 Verificacao de Numeros

**O que e:** Antes de enviar para uma lista de leads, o sistema pode **verificar quais numeros sao validos** no WhatsApp. Numeros invalidos (desativados, nao existem) sao marcados e podem ser removidos da lista.

**Status possiveis:**
- **Valido** (verde) — numero ativo no WhatsApp, pode receber mensagem
- **Invalido** (vermelho) — numero nao existe ou nao tem WhatsApp
- **Pendente** — ainda nao verificado
- **Erro** — falha na verificacao

**Acoes pos-verificacao:**
- "Selecionar so validos" — remove invalidos automaticamente
- "Remover invalidos" — limpa a lista

**Cenario:** Lista de 500 numeros importados de planilha antiga. Roda verificacao → 420 validos, 65 invalidos, 15 erros. Remove invalidos → envia para 420.

> **Tecnico:** Funcao `verifyNumbers()` com progress tracking. Estado: verification_status ENUM (pending|valid|invalid|error). Campo verified_name: nome confirmado pelo WhatsApp. Verificacao via UAZAPI endpoint de check number. Componente `ContactsStep.tsx` mostra contagem por status. Filtros: validos/invalidos. Batch verification com progress bar.

---

## 6.12 Construtor de Carrossel

**O que e:** Editor visual para montar carrosseis card por card. Cada card tem texto, imagem e botoes configuraveis. Preview em tempo real mostra como vai ficar no WhatsApp.

**Como funciona:**
- **Adicionar card** — botao "+" cria novo card (minimo 2, maximo 10)
- **Editar texto** — campo de texto com emoji picker para cada card
- **Adicionar imagem** — upload de arquivo ou colar URL. Preview na hora
- **Configurar botoes** — ate 3 por card. Cada botao com tipo (URL/Ligar/Resposta) e label
- **Reordenar** — botoes subir/descer para mudar a ordem dos cards
- **Remover card** — botao de lixeira (mantem minimo de 2)
- **Mensagem principal** — texto opcional que aparece antes do carrossel
- **Preview** — visualizacao completa do carrossel como vai aparecer no WhatsApp

**Compressao de imagem:** Ao fazer upload, a imagem e automaticamente comprimida para thumbnail (max 200px de largura, qualidade 60%) para envio rapido.

**Cenario:** Gerente monta carrossel de 5 produtos em promocao. Card 1: "Tinta Coral 18L — R$ 259" + foto + botao "Comprar" (URL). Card 2: "Verniz 3.6L — R$ 89" + foto + botao "Ver mais". Em 5 minutos, carrossel pronto para enviar a 300 leads.

> **Tecnico:** Componentes: `CarouselEditor.tsx` (orquestrador), `CarouselCardEditor.tsx` (editor por card), `CarouselButtonEditor.tsx` (editor de botoes), `CarouselPreview.tsx` (preview visual). Cards: min `MIN_CARDS=2`, max `MAX_CARDS=10`. Botoes: ate 3 por card, tipos URL (com campo url), CALL (com campo phone), REPLY (resposta rapida). Imagem: upload file + URL input. Thumbnail: compress max 200px width, quality 0.6, base64. Reorder: move up/down. Validacao: texto + imagem obrigatorios por card.

---

## Arvore de Componentes

```
Broadcaster.tsx (modo grupos — /dashboard/broadcast)
+-- InstanceSelector.tsx (passo 1: escolher numero)
+-- GroupSelector.tsx (passo 2: escolher grupos)
|   +-- ParticipantSelector.tsx (excluir admins)
+-- BroadcastMessageForm.tsx (passo 3: compor mensagem)
|   +-- Tab Texto (textarea + emoji)
|   +-- Tab Midia (BroadcastMediaTab — upload/URL + preview)
|   +-- Tab Carrossel (CarouselEditor)
|   |   +-- CarouselCardEditor.tsx (por card)
|   |   +-- CarouselButtonEditor.tsx (botoes)
|   |   +-- CarouselPreview.tsx (preview visual)
|   +-- Tab Enquete (PollEditor)
+-- BroadcastSendControls.tsx (delay + enviar/agendar)
+-- BroadcastProgressModal.tsx (progresso tempo real)
+-- TemplateSelector.tsx (salvar/carregar templates)

LeadsBroadcaster.tsx (modo leads — /dashboard/broadcast/leads)
+-- LeadImporter.tsx (montar lista)
|   +-- PasteTab.tsx (colar numeros)
|   +-- CsvTab.tsx (importar planilha)
|   +-- GroupsTab.tsx (extrair de grupos)
|   +-- ManualTab.tsx (adicionar um a um)
+-- LeadDatabaseSelector.tsx (selecionar listas salvas)
+-- ContactsStep.tsx (verificacao + filtros)
+-- LeadMessageForm.tsx (compor mensagem — mesmas 4 tabs)
+-- BroadcastProgressModal.tsx (progresso)

BroadcastHistoryPage.tsx (historico — /dashboard/broadcast/history)
+-- BroadcastHistory.tsx
    +-- BroadcastHistoryFilters.tsx (filtros)
    +-- BroadcastLogCard.tsx (cada registro)
    +-- HistoryMessagePreview.tsx (preview texto/midia)
    +-- HistoryCarouselPreview.tsx (preview carrossel)
    +-- BroadcastDeleteDialogs.tsx (confirmacao)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `broadcast_logs` | Historico de broadcasts (tipo, conteudo, destinatarios, sucesso/falha, duracao, status) |
| `lead_databases` | Listas salvas de leads (nome, descricao, contagem) |
| `lead_database_entries` | Contatos dentro das listas (phone, name, jid, verificacao, fonte) |
| `message_templates` | Templates reutilizaveis (texto, midia, carrossel, enquete) |
| `poll_messages` | Enquetes enviadas (pergunta, opcoes, auto_tags, image_url) |
| `poll_responses` | Votos recebidos (voter_jid, selected_options[], voted_at) |

---

## Links Relacionados

- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA responde quando lead reage ao broadcast
- [[wiki/casos-de-uso/leads-detalhado]] — Base de leads usada como destinatario
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Respostas ao broadcast aparecem no helpdesk
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/uazapi-polls-interativos]] — Endpoints UAZAPI para enquetes

---

*Documentado em: 2026-04-10 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
