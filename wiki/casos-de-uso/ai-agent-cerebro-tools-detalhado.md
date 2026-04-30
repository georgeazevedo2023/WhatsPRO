---
title: AI Agent — Cérebro (LLM) e 9 Ferramentas
tags: [ai-agent, llm, openai, gpt-4-mini, tools, search, carousel, handoff, kanban, polls]
sources: [supabase/functions/ai-agent/, supabase/functions/_shared/]
updated: 2026-04-30
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Cérebro (LLM) e 9 Ferramentas

> Sub-wiki extraído de `ai-agent-detalhado.md` em 2026-04-30 (particionamento — débito de 3 sessões resolvido). Cobre o "como pensa" e "como age" do agente.

## 2.1 Cerebro — O Modelo de Inteligencia Artificial (LLM)

**O que e:** O "cerebro" do agente e um modelo de IA da OpenAI chamado **gpt-4.1-mini**. E ele que le as mensagens do lead, entende o que a pessoa quer, e decide como responder — se vai mandar texto, buscar um produto, enviar fotos ou transferir para um humano.

**Como funciona:** O agente recebe um conjunto de **instrucoes de comportamento** (chamadas de "prompt de sistema") + o **historico da conversa** + os **dados do lead** + o **catalogo de produtos**. O modelo de IA processa tudo isso em milissegundos e decide a melhor acao.

**Protecao contra falhas — cadeia de provedores substitutos:**

Se o provedor principal sair do ar, o sistema automaticamente muda para o proximo. O lead nunca percebe.

1. **OpenAI gpt-4.1-mini** (provedor principal — mais inteligente)
2. **Gemini 2.5 Flash** (substituto 1 — Google)
3. **Mistral Small** (substituto 2 — europeu)
4. **Templates estaticos** (ultimo recurso — respostas pre-prontas)

**Limites de seguranca:**
- **8.192 tokens** = tamanho maximo de contexto. Se a conversa fica muito longa, o sistema corta as mensagens mais antigas e mantem so as ultimas 6 mensagens (para nao estourar o limite e nem perder o contexto recente).
- **Circuit breaker** = se um provedor falhar 5 vezes seguidas, o sistema para de tentar e ja vai direto pro proximo.

> **Tecnico:** Modulo `_shared/llmProvider.ts`, `callLLM()` com cadeia OpenAI → Gemini → Mistral → templates. Circuit breaker em `_shared/circuitBreaker.ts` por provedor (geminiBreaker, groqBreaker, mistralBreaker, uazapiBreaker). Token ceiling: `MAX_ACCUMULATED_INPUT_TOKENS=8192` com trimming (mantem ultimas 6 mensagens). Native function calling no OpenAI; Gemini usa fallback de tools custom.

---

## 2.2 As 9 Ferramentas (Tools) do Agente

**O que e:** O agente nao so conversa — ele tem **9 ferramentas** que pode usar a qualquer momento durante a conversa, como um vendedor que tem acesso ao estoque, ao sistema de etiquetas, ao CRM, etc. O modelo de IA decide sozinho qual ferramenta usar e quando.

---

### Ferramenta 1: `search_products` — Buscar Produtos no Catalogo

**O que faz:** Quando o lead pede um produto ("tem tinta branca?"), o agente busca no catalogo da empresa.

**O diferencial — busca inteligente que corrige erros de digitacao:**

O sistema usa uma tecnologia chamada busca "fuzzy" (difusa) que entende o que a pessoa quis dizer mesmo quando erra a grafia. Funciona em 4 etapas:

1. **Busca exata** — procura a frase inteira ("tinta coral branca 18L")
2. **Busca palavra por palavra** — se nao achou exata, busca cada palavra separadamente ("tinta" E "coral" E "branca" E "18L")
3. **Busca por semelhanca** — se ainda nao achou, busca palavras parecidas ("cooral" → "coral", com 78% de semelhanca)
4. **Filtro final** — dos resultados, mantem so os que batem com TODAS as palavras importantes. Se o lead pediu "tinta Suvinil branca", nao vai aparecer "tinta Coral branca" (marca errada)

**Cenarios reais:**
1. Lead digita "cooral fosco brnco 18l" (cheio de erros) → sistema encontra "Coral Fosco Branco 18L" (78% de semelhanca) → envia foto e preco.
2. Lead pede "tinta iquine branco" → sistema busca e filtra: so mostra produtos da Iquine, nunca Coral ou Suvinil.
3. Lead pede "verniz para madeira" → sistema identifica a categoria "seladores e vernizes" automaticamente.

> **Tecnico:** RPC `search_products_fuzzy()` com extensao pg_trgm (word-level similarity, threshold 0.3). Pipeline: (1) ILIKE exact phrase, (2) word-by-word AND, (3) fuzzy pg_trgm, (4) post-filter AND em ALL results. Post-filter: remove produtos que nao matcham TODAS as palavras-chave (evita "tinta iquine branco" retornar Coral). Tabela `ai_agent_products` (agent_id, name, price, description, images JSONB, category). Tool return inclui resultText com precos para LLM citar valores exatos.

---

### Ferramenta 2: `send_carousel` — Enviar Carrossel de Produtos

**O que faz:** Envia ate 5 produtos num formato de "cartoes deslizaveis" pelo WhatsApp. Cada cartao tem foto, titulo, preco e botoes clicaveis.

**Como funciona:**
- O agente busca os produtos e monta o carrossel automaticamente
- Cada cartao tem: **foto do produto** + **texto de vendas** (gerado pela IA com linguagem persuasiva) + **2 botoes** (ex: "Ver detalhes" e "Comprar")
- O texto de vendas do primeiro cartao e simples (titulo + preco). Os demais recebem textos criativos escritos pela IA
- Se o envio do carrossel falhar por problema tecnico, o sistema faz fallback: envia ate 3 fotos individuais, e se isso tambem falhar, envia so texto

**Cenario real:** Lead: "Mostra as tintas brancas que voces tem" → Agente busca → encontra 4 tintas brancas → monta carrossel com 4 cartoes → cada um com foto, nome, preco e botao "Ver mais" → lead desliza e escolhe.

> **Tecnico:** Envio via UAZAPI (4 variantes de payload tentadas). Copy IA: `generateCarouselCopies()` com chain Groq (Llama 3.3) → Gemini 2.5 Flash → Mistral Small, 3s AbortController timeout por provedor. Card 1 = code-generated (cleanProductTitle + price). Cards 2-5 = AI copy. Config: `ai_agents.carousel_text` + `carousel_button_1` + `carousel_button_2` (segundo botao opcional). Fallback: ate 3 send_media individuais → texto. Modulo: `_shared/carousel.ts`. Apos INSERT de carousel em conversation_messages, DEVE chamar `broadcastEvent()` — sem isso helpdesk Realtime nao exibe.

---

### Ferramenta 3: `send_media` — Enviar Foto, Video ou Documento

**O que faz:** Envia um unico arquivo de midia — foto, video, audio ou documento (PDF, etc.).

**Regra importante:** Quando o lead pede **1 produto**, o agente envia uma **foto individual** (send_media). Quando pede **2 ou mais**, envia um **carrossel** (send_carousel). Isso garante que 1 produto nao vem num carrossel sozinho (ficaria estranho).

**Cenario real:** Lead: "Manda a foto da tinta Coral Branco 18L" → Agente envia foto individual com nome e preco no texto.

---

### Ferramenta 4: `handoff_to_human` — Transferir para Atendente Humano

**O que faz:** Quando o agente nao consegue resolver ou o lead pede explicitamente, transfere a conversa para um atendente humano.

**Quando a IA transfere (faz handoff):**
- Lead pede explicitamente: "quero falar com vendedor", "chama atendente", "quero o gerente"
- Lead esta frustrado e persistente: "isso e um absurdo!", "que demora!", "pessimo atendimento"
- A IA nao consegue responder (pergunta que nao esta no catalogo nem nas informacoes da empresa)
- Atingiu o limite de mensagens sem resolver (padrao: 8 mensagens)
- Buscas no catalogo falharam varias vezes seguidas (padrao: 2 falhas)

**Quando a IA NAO transfere (responde ela mesma):**
- Perguntas sobre preco, desconto, pagamento, frete, parcela — a IA responde com dados reais
- Perguntas sobre horario, endereco, formas de pagamento — a IA responde
- Lead perguntando "Faz desconto no PIX?" ou "Qual o horario?" NAO e motivo de handoff

**Regra especial de frustracao:** Se o lead manda varias mensagens rapidas e uma delas contem frustracao ("absurdo", "demora") E outra pede handoff ("gerente", "atendente"), o sistema faz handoff **direto** — nao tenta responder com empatia + produto. Transfere imediatamente.

**O que acontece apos o handoff:**
1. Lead recebe uma mensagem configuravel (ex: "Um atendente vai te atender em instantes!")
2. O texto que a IA ia mandar e **descartado** — lead recebe so a mensagem de handoff
3. A IA entra em **modo Shadow** (sombra) — continua extraindo dados sem responder
4. Se for fora do horario comercial, envia mensagem diferente (ex: "Nosso horario e de 8h as 18h. Um atendente vai te responder amanha!")
5. Se o lead estava frustrado, envia mensagem de **empatia** ANTES da mensagem de handoff ("Entendo sua frustracao e lamento pelo inconveniente...")

**Cenario real:** Lead: "Esse preco ta absurdo, quero falar com o gerente agora!" → Agente detecta frustracao + pedido de gerente → envia "Entendo sua frustracao, vou transferir voce para nosso gerente." → conversa transferida para departamento de vendas → atendente humano assume → enquanto isso, Shadow extrai: `sentimento:negativo`, `objecoes:preco`, `motivo:reclamacao`.

> **Tecnico:** Tool `handoff_to_human` envia 1 msg + breaks Gemini function calling loop (no duplicate text). Texto LLM descartado quando handoff executado. Todos os tipos (tool, trigger, implicit, max_lead_messages) setam `status_ia='shadow'` (nao 'desligada'). Reset `lead_msg_count: 0` em todos os 5 paths SHADOW (R86, 2026-04-30). Auto-handoff por message limit pula se ja em SHADOW (R85). Final conversation update SKIPS status_ia quando handoff happened. Empatia: `sendTextMsg()` com mensagem empatica ANTES do handoff msg quando sentiment negativo. Question-aware triggers: INFO_TERMS (horario, preco, endereco, desconto, parcelar, frete) NAO matcham como handoff quando lead perguntando ("Qual o horario?"). Pure triggers ("atendente", "humano", "gerente") SEMPRE matcham. Batch rule: frustracao + handoff trigger no mesmo batch = handoff direto (skip LLM). Prioridade handoff_message: `profileData > funnelData > agent`. Business hours: weekly JSONB format `{"mon":{"open":true,"start":"08:00","end":"18:00"}}`. Outside hours: `handoff_message_outside_hours`.

---

### Ferramenta 5: `assign_label` — Aplicar Etiqueta na Conversa

**O que faz:** O agente aplica automaticamente uma etiqueta visual na conversa (as mesmas etiquetas coloridas do Helpdesk — ver [[wiki/casos-de-uso/helpdesk-detalhado]] secao 1.2).

**Cenario:** Lead concluiu agendamento → agente aplica etiqueta "Agendado" (verde). Atendente ve na lista e sabe que nao precisa responder.

---

### Ferramenta 6: `set_tags` — Aplicar Tags Automaticas

**O que faz:** Aplica tags estruturadas (no formato `chave:valor`) na conversa, automaticamente, conforme entende o que o lead quer.

**Os 3 niveis de tags:**
1. **Motivo** (intencao) — `motivo:compra`, `motivo:suporte`, `motivo:orcamento`, `motivo:informacao`
2. **Interesse** (categoria) — `interesse:tintas`, `interesse:ferramentas`, `interesse:eletrica`
3. **Produto** (especifico) — `produto:coral-branco-18L`, `produto:furadeira-bosch-650w`

**Tags extras que o agente coleta:** `cidade:recife`, `quantidade:4`, `orcamento:alto`, `acabamento:fosco`, `marca_preferida:coral`

**Cenario real:** Lead diz "Quero comprar 4 galoes de tinta coral branca pra minha casa em Recife, acabamento fosco" → Tags aplicadas automaticamente: `motivo:compra`, `interesse:tintas`, `produto:coral-branco`, `cidade:recife`, `quantidade:4`, `acabamento:fosco`, `marca_preferida:coral`. Tudo sem o atendente fazer nada.

> **Tecnico:** Tool `set_tags` usa `mergeTags()` de `_shared/agentHelpers.ts`. Tags = TEXT[] em `conversations.tags` formato "key:value". Enforcement: `VALID_KEYS` whitelist (60+ keys após Sprint Eletropiso 2026-04-29), `VALID_MOTIVOS` set, `VALID_OBJECOES` set no ai-agent/index.ts. Aliasing automático (R83): se categoria ativa tem keys sufixadas (ex: `material_porta`), handler aceita key genérica (`material:`) e remapeia. Exit action enforcement (R83): atinge max_score → injeta instrução [INTERNO] obrigatória pro LLM. Auto-interesse: categoria detectada de keywords (tinta→tintas, verniz→seladores_e_vernizes, manta→impermeabilizantes) mesmo com 0 resultados de busca. Brand tracking: `marca_indisponivel:X` auto-set quando marca nao esta no catalogo.

---

### Ferramenta 7: `move_kanban` — Mover Card no CRM

**O que faz:** Move o cartao do lead de uma coluna para outra no quadro Kanban (painel visual de vendas).

**Cenario:** Lead qualificado → agente move card de "Novo" para "Qualificado". Lead fechou compra → move para "Fechado Ganho". Tudo automatico.

---

### Ferramenta 8: `update_lead_profile` — Atualizar Dados do Lead

**O que faz:** Salva informacoes que o agente descobriu durante a conversa no perfil permanente do lead.

**Campos que pode atualizar:** nome completo, cidade, interesses, motivo do contato, ticket medio (valor medio de compras), objecoes (o que o lead achou ruim), e notas livres.

**Cenario:** Lead diz "Meu nome e Pedro, sou de Recife, to reformando a casa toda" → Agente salva: nome="Pedro", cidade="Recife", interesses="reforma completa". Na proxima conversa (mesmo meses depois), o agente ja sabe tudo isso.

---

### Ferramenta 9: `send_poll` — Enviar Enquete no WhatsApp

**O que faz:** Envia uma enquete nativa do WhatsApp — aquelas com botoes clicaveis onde o lead escolhe uma opcao. O agente decide sozinho quando faz sentido enviar uma enquete em vez de perguntar por texto.

**Regras:**
- De 2 a 12 opcoes por enquete
- Maximo 255 caracteres na pergunta
- Maximo 100 caracteres por opcao
- NUNCA envia opcoes numeradas ("1-Casa, 2-Apartamento") — sempre nomes limpos ("Casa", "Apartamento")

**Cenario real:** Agente quer saber o tipo de ambiente → envia enquete: "Para qual ambiente e a tinta?" com opcoes clicaveis: "Quarto", "Sala", "Cozinha", "Banheiro", "Fachada", "Garagem". Lead clica em "Fachada" → agente ja sabe e busca tintas para area externa.

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral (visão de todas as 15 sub-funcionalidades)
- [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] — Fluxo SDR + Shadow Mode
- [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] — Validator + TTS + Prompt Studio
- [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] — Profiles, NPS, Knowledge Base, Greeting, Memória
- [[wiki/casos-de-uso/excluded-products-detalhado]] — D28 (produtos NÃO vendidos)
- [[wiki/ai-agent]] — Referência técnica do AI Agent
