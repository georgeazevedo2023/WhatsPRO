---
title: Broadcast — Conteudo e Composicao
tags: [broadcast, conteudo, carrossel, enquete, templates, midia, detalhado]
sources: [src/components/broadcast/BroadcastMessageForm.tsx, src/components/broadcast/CarouselEditor.tsx, src/components/broadcast/PollEditor.tsx, src/components/broadcast/TemplateSelector.tsx]
updated: 2026-05-04
---

# Broadcast — Conteudo e Composicao

> Esta sub-wiki cobre **o que voce envia** num broadcast: os 4 tipos de conteudo suportados, o construtor visual de carrosseis e os templates reutilizaveis. Para **quem recebe** ver [[wiki/casos-de-uso/broadcast-audiencia]]; para **quando/como dispara** ver [[wiki/casos-de-uso/broadcast-execucao]].

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

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Indice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/broadcast-audiencia]] — Para quem enviar (grupos, leads, listas, verificacao)
- [[wiki/casos-de-uso/broadcast-execucao]] — Quando e como disparar (agendamento, delay, progresso, historico)
- [[wiki/uazapi-polls-interativos]] — Endpoints UAZAPI para enquetes
