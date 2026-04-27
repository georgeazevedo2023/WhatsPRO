---
title: AI Agent — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [ai-agent, funcionalidades, tools, sdr, handoff, validator, tts, shadow, profiles, service-categories, detalhado]
sources: [supabase/functions/ai-agent/, src/components/ai-agent/]
updated: 2026-04-27
---

# AI Agent — Vendedor Robo Inteligente (15 Sub-Funcionalidades)

> O AI Agent e um **vendedor robo** que atende os clientes pelo WhatsApp automaticamente, 24 horas por dia, 7 dias por semana. Ele nao e um chatbot burro que responde com respostas fixas — ele e um agente inteligente que **pensa**, **decide** e **age**: le o que o cliente mandou, entende a intencao, busca produtos no catalogo, envia fotos, monta carrosseis, qualifica o lead, extrai dados, e quando nao consegue resolver, transfere para um humano.
>
> Pense nele como um funcionario junior que trabalha sem parar: recebe o cliente, pergunta o que precisa, mostra os produtos, responde preco, e quando o assunto fica complexo ("quero desconto", "quero falar com o gerente"), chama o vendedor senior.
>
> Sem IA, a empresa precisa de atendentes 24h para nao perder vendas. Um lead que manda mensagem as 22h no sabado e nao recebe resposta ate segunda-feira provavelmente ja comprou no concorrente. O AI Agent resolve isso: **responde em segundos, a qualquer hora, com informacoes reais do catalogo**.
>
> Ver tambem: [[wiki/ai-agent]] (referencia tecnica), [[wiki/casos-de-uso/helpdesk-detalhado]] (central de atendimento), [[wiki/modulos]] (todos os modulos)
>
> Gerada em sessao com George Azevedo em 2026-04-09.

---

## 2.1 Cerebro — O Modelo de Inteligencia Artificial (LLM)

**O que e:** O "cerebro" do agente e um modelo de IA da OpenAI chamado **gpt-4.1-mini**. E ele que le as mensagens do lead, entende o que a pessoa quer, e decide como responder — se vai mandar texto, buscar um produto, enviar fotos ou transferir para um humano.

**Como funciona:** O agente recebe um conjunto de **instrucoes de comportamento** (chamadas de "prompt de sistema") + o **historico da conversa** + os **dados do lead** + o **catalogo de produtos**. O modelo de IA processa tudo isso em milissegundos e decide a melhor acao.

**Protecao contra falhas — cadeia de provedores substitutos:**

Se o provedor principal sair do ar, o sistema automaticamente muda para o proximo. O lead nunca percebe.

| Prioridade | Provedor | Quando usa |
|------------|----------|------------|
| 1o | OpenAI gpt-4.1-mini | Sempre (principal) |
| 2o | Gemini 2.5 Flash (Google) | Se OpenAI falhar |
| 3o | Mistral Small | Se OpenAI E Gemini falharem |
| 4o | Respostas prontas | Se TODOS falharem (ultimo recurso) |

**Disjuntor de protecao (Circuit Breaker):** Se um provedor falhar 3 vezes seguidas, o sistema para de chama-lo por 30 segundos e usa o proximo. Depois de 30 segundos, tenta de novo. Se funcionar, volta ao normal. Isso evita ficar tentando chamar um servidor que esta fora do ar, desperdicando tempo e deixando o lead esperando.

**Cenario real:** Servidor da OpenAI sofre instabilidade as 15h numa sexta-feira. O agente automaticamente muda para Gemini e continua respondendo os 200 leads que estao conversando. Nenhum percebe a mudanca. Quando a OpenAI volta, o sistema retoma normalmente.

> **Tecnico:** LLM primario configurado em `ai_agents` table (campo `model`). Fallback chain em `_shared/llmProvider.ts`. Circuit breaker: `_shared/circuitBreaker.ts` — `geminiBreaker/groqBreaker/mistralBreaker`, 3 falhas → OPEN 30s → HALF_OPEN probe → CLOSED. Function calling nativo do OpenAI (tools array). Edge function principal: `supabase/functions/ai-agent/index.ts` (~2600 linhas). Debounce entry: `supabase/functions/ai-agent-debounce/index.ts`. Rate limit: `_shared/rateLimit.ts` com RPC atomico `check_rate_limit()`.

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

> **Tecnico:** Tool `handoff_to_human` envia 1 msg + breaks Gemini function calling loop (no duplicate text). Texto LLM descartado quando handoff executado. Todos os tipos (tool, trigger, implicit, max_lead_messages) setam `status_ia='shadow'` (nao 'desligada'). Final conversation update SKIPS status_ia quando handoff happened. Empatia: `sendTextMsg()` com mensagem empatica ANTES do handoff msg quando sentiment negativo. Question-aware triggers: INFO_TERMS (horario, preco, endereco, desconto, parcelar, frete) NAO matcham como handoff quando lead perguntando ("Qual o horario?"). Pure triggers ("atendente", "humano", "gerente") SEMPRE matcham. Batch rule: frustracao + handoff trigger no mesmo batch = handoff direto (skip LLM). Prioridade handoff_message: `profileData > funnelData > agent`. Business hours: weekly JSONB format `{"mon":{"open":true,"start":"08:00","end":"18:00"}}`. Outside hours: `handoff_message_outside_hours`.

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

> **Tecnico:** Tool `set_tags` usa `mergeTags()` de `_shared/agentHelpers.ts`. Tags = TEXT[] em `conversations.tags` formato "key:value". Enforcement: `VALID_KEYS` whitelist, `VALID_MOTIVOS` set, `VALID_OBJECOES` set no ai-agent/index.ts. Auto-interesse: categoria detectada de keywords (tinta→tintas, verniz→seladores_e_vernizes, manta→impermeabilizantes) mesmo com 0 resultados de busca. Enrichment tags: acabamento, marca_preferida, quantidade, area, aplicacao, enrich_count, qualificacao_completa. Brand tracking: `marca_indisponivel:X` auto-set quando marca nao esta no catalogo.

---

### Ferramenta 7: `move_kanban` — Mover Card no CRM

**O que faz:** Move o cartao do lead de uma coluna para outra no quadro Kanban (painel visual de vendas — ver Funcionalidade 5: CRM Kanban).

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

## 2.3 Fluxo SDR (Pre-Vendedor — Qualificacao Inteligente)

**O que e:** SDR significa "Sales Development Representative" — e o pre-vendedor que qualifica o lead antes de passar para o vendedor. O agente segue um fluxo inteligente em 4 etapas:

**Etapa 1 — Lead fala algo generico ("quero tinta")**
O agente faz perguntas de qualificacao primeiro: "Para qual ambiente?" → "Qual cor?" → "Prefere alguma marca?" — ate o limite configuravel (padrao: 3 perguntas antes de buscar).

**Etapa 2 — Lead fala algo especifico ("quero tinta coral branco 18L")**
O agente busca imediatamente no catalogo, sem perguntar nada. O lead ja disse tudo que precisa.

**Etapa 3 — Busca falhou (nao encontrou o produto)**
O agente entra em fase de "enriquecimento": faz perguntas contextuais como "Qual o tipo de acabamento?" ou "Para que area voce precisa?" (ate 2 perguntas extras). Depois, transfere para humano com todo o contexto coletado.

**Etapa 4 — Limite de mensagens atingido (padrao: 8)**
Se apos 8 mensagens a conversa nao foi resolvida, o agente transfere automaticamente para humano. Evita loops infinitos.

**Service Categories — funil de qualificação por nicho com stages + score (M19-S10 v2):** Em vez de regras hardcoded, cada agente tem categorias com **etapas (stages)** e **score progressivo** em `ai_agents.service_categories JSONB`. Editáveis pelo admin via tab dedicada **"Qualificação"** (9ª tab). Cada categoria tem regex de match, fields com `score_value` (pontos), e stages com `min_score`/`max_score`/`exit_action` (`search_products` | `enrichment` | `handoff` | `continue`). Conforme o lead responde, soma score → progride entre stages → ao atingir o teto do stage, dispara `exit_action`.

**4 cenários multi-tenant — mesmo agente, funis diferentes:**

- **Home Center (tintas, 3 stages):**
  - Stage 1 — *Identificação* (0→30, `search_products`): `ambiente` (15pt) + `cor` (15pt). Atingiu 30 → busca produtos.
  - Stage 2 — *Detalhamento* (30→70, `enrichment`): `acabamento` (20pt) + `marca` (20pt). Atingiu 70 → continua perguntando.
  - Stage 3 — *Pronto para Handoff* (70→100, `handoff`): `quantidade` (15pt) + `area` (15pt). Atingiu 100 → handoff com contexto rico.
- **Clínica médica (consultas, 2 stages):**
  - Stage 1 — *Triagem* (0→50, `enrichment`): `especialidade` (cardiologia, ortopedia — 30pt) + `urgencia` (urgente, eletivo — 20pt).
  - Stage 2 — *Agendamento* (50→100, `handoff`): `preferencia_dia` (30pt) + `convenio` (20pt).
- **Imobiliária (3 stages):**
  - Stage 1 — *Briefing* (0→30, `search_products`): `tipo_imovel` + `bairro`.
  - Stage 2 — *Refinamento* (30→70, `enrichment`): `quartos` + `faixa_preco`.
  - Stage 3 — *Visita* (70→100, `handoff`): `disponibilidade` + `urgencia`.
- **Lead frio (default, 1 stage):**
  - *Qualificação básica* (0→100, `handoff`): `especificacao` (25pt) + `marca_preferida` (25pt) + `quantidade` (25pt). Sem categoria match → fallback para handoff direto.

**Cenário completo Home Center com score:** Lead: "Oi, quero tinta" → Agente identifica categoria `tintas` (regex match) → score 0 → Stage Identificação. Pergunta `ambiente` (phrasing: "Para encontrar a melhor opção, qual ambiente? interno ou externo") → Lead: "Externo" → set_tags `['ambiente:externo']` → score +15 = 15. Pergunta `cor` → Lead: "Branca" → score +15 = 30 → atinge `max_score` → `exit_action: search_products` dispara. Encontra produtos → envia carrossel. Score persistido na tag `lead_score:30` + row em `lead_score_history`.

> **Tecnico:** Config: `max_pre_search_questions` (default 3), `max_enrichment_questions` (default 2), `max_lead_messages` (default 8), `max_qualification_retries` (default 2). Contador atomico: `increment_lead_msg_count` RPC. Service Categories v2: `ai_agents.service_categories JSONB` carregado via `getCategoriesOrDefault()` em `_shared/serviceCategories.ts`. Tipos: `Stage`, `ExitAction`, `QualificationField` (com `score_value`). Match: `matchCategory(interesse, config)` testa regex. Stage atual: `getCurrentStage(score, category)` lê `min_score`/`max_score`. Próxima pergunta: `getNextField(stage, currentTags)` ordena por `priority` e exclui fields já respondidos. Score helpers: `getScoreFromTags(tags)` lê `lead_score:N`; `calculateScoreDelta(beforeTags, afterTags, stages)` soma `score_value` dos fields recém-respondidos. Persistência: handler de `set_tags` em `ai-agent/index.ts` chama RPC `add_lead_score_event` que insere em `lead_score_history` (M19 S2). Score reseta apenas em `ia_cleared:` (R79). **Tab dedicada:** `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` (UI 3 níveis com drag-drop, slider de score, preview de funil). **Backward compat:** migration v2 remapeia agentes em produção do schema plano para 3 stages padrão automaticamente.

---

## 2.4 Modo Sombra (Shadow Mode) — IA Ouvindo em Silencio

**O que e:** Apos a IA transferir a conversa para um atendente humano (handoff), ela nao desliga completamente — entra em **modo sombra**. Nesse modo, a IA le TODAS as mensagens da conversa (do lead e do atendente) e **extrai dados automaticamente**, mas **nao envia nenhuma mensagem** ao lead. E como um assistente invisivel tomando notas.

**O que a IA extrai em modo sombra:**
- Nome completo do lead
- Cidade
- Interesses (produtos, categorias)
- Motivo do contato
- Valor medio de compra (ticket medio)
- Objecoes (o que o lead nao gostou)
- Notas livres (resumo da conversa)
- Tags: `cidade:campinas`, `quantidade:10`, `orcamento:alto`

**Protecao de nome:** Se o lead ja tem nome registrado, a IA em Shadow NUNCA sobrescreve. Isso evita o problema de o vendedor dizer "Obrigado, Pedro!" e a IA achar que "Pedro" e o nome do lead (quando Pedro e o nome do vendedor).

**Cenario real:** IA faz handoff apos 6 mensagens. Vendedor assume e conversa por 20 minutos: negocia preco, fala de parcelamento, descobre que o lead e de Campinas e quer reformar 3 quartos. Enquanto isso, o Shadow extrai silenciosamente: `cidade:campinas`, `quantidade:grande`, `orcamento:medio`, `interesse:tintas+ferramentas`. Quando o vendedor abre o perfil do lead, todas essas informacoes ja estao la — sem ter digitado nada.

> **Tecnico:** Ativacao: todos os handoff types setam `status_ia = STATUS_IA.SHADOW`. Prompt shadow: instrui LLM a extrair via `update_lead_profile` (full_name, city, interests, reason, average_ticket, objections, notes) + `set_tags` (cidade:X, quantidade:Y, orcamento:Z). Protecao nome: shadow prompt diz "ignore non-lead names quando full_name ja existe" — previne "Obrigado Pedro!" (vendedor) sobrescrever nome do lead. Shadow NUNCA envia mensagem ao lead (return silencioso). Debounce continua ativo em shadow (agrupa msgs).

---

## 2.5 Validator Agent — Supervisor de Qualidade das Respostas

**O que e:** Um segundo modelo de IA que funciona como **supervisor de qualidade**. Antes de cada resposta ser enviada ao lead, esse supervisor analisa o texto e da uma nota de 0 a 10. Dependendo da nota, a resposta e aprovada, reescrita ou bloqueada.

**Os 3 vereditos:**
- **PASS** (Aprovado) — Nota acima do limite. Resposta enviada normalmente.
- **REWRITE** (Reescrito) — Nota abaixo do limite. O supervisor reescreve a resposta para ficar melhor, e envia a versao corrigida.
- **BLOCK** (Bloqueado) — Nota muito baixa. Resposta nao e enviada (agente fica em silencio — e melhor nao responder do que responder errado).

**O que o supervisor verifica:**
- **Frases proibidas** — Se a resposta menciona concorrentes, informacoes sensiveis, etc.
- **Topicos bloqueados** — Se entrou em assunto que nao deveria (politica, religiao, etc.)
- **Limite de desconto** — Se o agente prometeu desconto maior que o permitido
- **Multiplas perguntas** — Se fez mais de 1 pergunta na mesma mensagem (confunde o lead)
- **Informacao inventada** — Se citou produto, preco ou dados que nao existem no catalogo
- **Excesso de nome** — Se repete o nome do lead em toda mensagem (soa robotico). Regra: maximo 1 vez a cada 3-4 mensagens.

**Niveis de rigor (configuravel pelo admin):**
- **Moderado** — Nota 8 ou mais passa. Deixa passar a maioria das respostas.
- **Rigoroso** — Nota 9 ou mais passa. So respostas muito boas passam.
- **Maximo** — So nota 10 passa. Praticamente tudo e reescrito.

**Rede de seguranca extra no codigo:** Apos o Validator, o sistema conta quantas perguntas (simbolo "?") tem na resposta. Se mais de 1, corta e mantem so a primeira. Isso porque o modelo de IA do Validator as vezes erra a contagem — entao o codigo garante por seguranca.

**Cenario real:** Agente gera resposta "Ola Pedro! Temos a tinta Coral e tambem a Suvinil que e mais barata. O que prefere? Quer que eu envie fotos? E de onde voce e?" → Validator detecta: (1) citou concorrente Suvinil, (2) fez 3 perguntas. Score: 4. Veredito: REWRITE → Nova resposta: "Temos a tinta Coral disponivel. Gostaria de ver as opcoes?"

> **Tecnico:** Modulo `_shared/validatorAgent.ts`. Tabela `ai_agent_validations` (conversation_id, score, action, original_text, rewritten_text, violations). Config: `ai_agents.validator_enabled` (bool), `validator_model` (string), `validator_rigor` ('moderado'|'rigoroso'|'maximo'). Threshold: moderado>=8, rigoroso>=9, maximo==10. Checks: leadQuestions (count), catalogPrices (verify), forbidden phrases (array), blocked topics (array), discount limit (max_discount_percent), name frequency (max 1 per 3-4 msgs). Safety net pos-validator: codigo conta "?" — se >1, trunca para 1a pergunta (LLM validator miscounts). Componente: `ValidatorMetrics.tsx` (score avg, PASS/REWRITE/BLOCK rates, score distribution chart, top violations com severity, AI suggestions).

---

## 2.6 TTS — Resposta por Voz (Text-to-Speech)

**O que e:** O agente pode responder com **audio** em vez de (ou alem de) texto. Isso e especialmente util no Brasil, onde muitas pessoas preferem mandar e receber audios pelo WhatsApp.

**Cadeia de provedores de voz (se um falhar, usa o proximo):**
1. **Gemini** (Google) — voz sintetizada de alta qualidade
2. **Cartesia** — provedor alternativo
3. **Murf** — outro alternativo
4. **Speechify** — outro alternativo
5. **Texto** — se TODOS os provedores de voz falharem, envia como texto normal

**6 vozes configuraveis:** O admin escolhe entre 6 vozes diferentes (masculinas e femininas) na tela de configuracao.

**Divisao para respostas longas:** Se a resposta e longa (mais de X caracteres) e o lead mandou audio:
- **Primeiro:** Envia a primeira frase como audio (rapido, para o lead ouvir algo logo)
- **Depois:** Envia o texto completo como mensagem de texto (para referencia)

**Cenario real:** Lead grava audio de 30 segundos perguntando sobre precos. Agente responde com audio de 15 segundos: "Ola! A tinta Coral Branco 18L custa R$ 289,90 e temos pronta entrega!" + mensagem de texto com todos os detalhes e link do produto.

> **Tecnico:** Modulo `_shared/ttsProviders.ts`. Chain configuravel via `ai_agents.tts_fallback_providers` JSONB. Env vars: GEMINI_API_KEY (system_settings para admin preview), CARTESIA_API_KEY, MURF_API_KEY, SPEECHIFY_API_KEY. Audio split: `splitAudioAndText()` — 1a frase como TTS audio + full text como follow-up (quando response > `voice_max_text_length` e lead enviou audio). 6 vozes em `ai_agents.voice_id`. Componente admin: `VoiceConfig.tsx`. Preview no admin: funciona quando GEMINI_API_KEY esta em system_settings (SecretsTab).

---

## 2.7 Prompt Studio — Personalizacao do Comportamento

**O que e:** Uma tela no painel administrativo onde o dono da empresa pode customizar **como o agente se comporta**, sem precisar saber programar. Funciona como um editor de "personalidade" do robo.

**As 9 secoes editaveis:**
1. **Identidade** — Nome do agente, personalidade (ex: "amigavel e profissional", "formal e objetivo")
2. **Fluxo de Qualificacao** — Como perguntar o que o lead precisa antes de buscar produtos
3. **Regras de Produto** — O que pode e nao pode falar sobre produtos (ex: "nunca compare com concorrentes")
4. **Regras de Transferencia** — Quando transferir para humano (ex: "sempre transferir se pedir gerente")
5. **Tags e Etiquetas** — Quais tags aplicar em cada situacao
6. **Regras Absolutas** — Regras inviolaveis (ex: "NUNCA diga que nao temos o produto")
7. **Objecoes** — Como lidar quando o lead diz "ta caro", "vou pensar", "no concorrente e mais barato"
8. **Instrucoes Adicionais** — Qualquer instrucao extra livre
9. **Contexto do Negocio** — Gerado automaticamente: nome da empresa, endereco, horario de funcionamento, formas de pagamento

**Variaveis dinamicas:** O admin pode usar codigos como `{agent_name}` (substitui pelo nome do agente) ou `{max_discount_percent}` (substitui pelo desconto maximo permitido). Isso permite mudar valores sem reescrever todo o texto.

**Cenario real:** Dono da loja entra no Prompt Studio → na secao "Objecoes" escreve: "Quando o lead disser que esta caro, oferecer parcelamento em ate 3x sem juros e frete gratis acima de R$ 500". → Na proxima conversa, quando lead diz "achei caro", o agente ja sabe responder com a oferta certa.

> **Tecnico:** Tabela: `ai_agents.prompt_sections` JSONB com 9 keys (identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional, business_context — auto-generated). Template vars: `{agent_name}`, `{personality}`, `{max_pre_search_questions}`, `{max_qualification_retries}`, `{max_discount_percent}`. Defaults: `system_settings.default_prompt_sections`. Componente: `PromptStudio.tsx`. Secoes montadas no ai-agent/index.ts e concatenadas no system prompt antes de enviar ao LLM. business_context gerado automaticamente a partir de `ai_agents.business_info` JSONB.

---

## 2.8 Perfis de Atendimento (Agent Profiles)

**O que e:** Em vez de ter 1 agente que atende todo mundo da mesma forma, voce cria **perfis diferentes** para contextos diferentes. Cada perfil e um pacote completo de "como se comportar" — qual tom usar, o que responder, quando transferir.

**Analogia:** Imagine que o agente e um ator. Os perfis sao os "roteiros" diferentes que ele pode seguir. Quando esta num funil de vendas, segue o roteiro de vendedor. Quando esta num funil de RH, segue o roteiro de recrutador. Mesmo agente, comportamento diferente.

**Exemplos de perfis:**
- **Perfil "Vendas"** — Tom animado e persuasivo, foca em fechar venda, so transfere se o lead insistir
- **Perfil "Suporte"** — Tom calmo e empatico, foca em resolver o problema, transfere se nao souber a resposta
- **Perfil "RH"** — Tom formal e acolhedor, coleta dados do candidato, move no Kanban de vagas

**Como funciona:**
- O admin cria perfis na tela de configuracao (tab "Inteligencia")
- Cada funil pode apontar para um perfil (ex: Funil "Vaga Motorista" usa Perfil "RH")
- Conversas que nao vem de nenhum funil usam o perfil marcado como "padrao"
- O perfil tem prioridade maxima sobre todas as outras configuracoes

**Cenario real:** Empresa tem Funil de Vendas (perfil vendedor animado) e Funil de Vagas (perfil recrutador formal). Lead que clica no link da vaga recebe atendimento formal e coleta de curriculo. Lead que clica na campanha de produtos recebe atendimento animado com carrossel. Mesmo agente IA, 2 comportamentos completamente diferentes.

> **Tecnico:** Tabela `agent_profiles` (id, agent_id, name, slug, prompt, handoff_rule enum 'so_se_pedir'|'apos_n_msgs'|'nunca', handoff_max_messages, handoff_department_id FK, handoff_message, is_default bool). Roteamento no ai-agent: `funnels.profile_id` → carrega perfil. Sem funil → `WHERE is_default = true AND agent_id = X`. Prioridade cascata: `profileData > funnelData > agent` em handoff_message, handoff_department, handoff_max_messages. Injecao: `<profile_instructions>` como ULTIMA secao do system prompt (prioridade maxima). Backward compat: sub-agents JSONB (TAG_TO_MODE) so rodam quando `!profileData`. Componente: `ProfilesConfig.tsx` (tab Inteligencia). FunnelDetail tab IA: Select dropdown de profile_id.

---

## 2.9 NPS Automatico — Pesquisa de Satisfacao

**O que e:** Apos o atendente resolver um ticket (finalizar atendimento), o sistema pode enviar automaticamente uma **enquete de satisfacao** (NPS) para o lead pelo WhatsApp, depois de um tempo configuravel.

**O que o admin configura:**
- **Ligado/desligado** — se quer enviar NPS ou nao
- **Tempo de espera** — quantos minutos depois de resolver (ex: 30 minutos)
- **Pergunta** — texto da enquete (ex: "Como foi seu atendimento conosco?")
- **Opcoes** — as alternativas (ex: "Excelente", "Bom", "Regular", "Ruim", "Pessimo")
- **Notificar gerente** — se nota ruim, avisa os gerentes automaticamente

**Protecao:** Se o lead saiu da conversa com sentimento negativo (tag `sentimento:negativo`), o sistema NAO envia NPS. Nao faz sentido pedir avaliacao de alguem que ja estava irritado.

**Se a nota for ruim:** O sistema cria uma notificacao automatica para os gerentes da inbox (tabela de notificacoes). Assim o gerente sabe que tem um cliente insatisfeito e pode agir.

**Cenario real:** Atendente fecha venda de R$ 2.800 → clica "Finalizar" → 30 minutos depois, lead recebe enquete "Como foi seu atendimento?" com opcoes clicaveis → Lead clica "Excelente" → nota registrada no dashboard. / Outro lead: atendente resolve suporte → 30 min depois, lead recebe NPS → clica "Ruim" → gerente recebe notificacao → liga pro cliente para entender o problema.

> **Tecnico:** 5 campos em `ai_agents`: poll_nps_enabled (bool), poll_nps_delay_minutes (int), poll_nps_question (text), poll_nps_options (text[]), poll_nps_notify_on_bad (bool). `is_nps` flag em `poll_messages`. Trigger: `triggerNpsIfEnabled()` em `_shared/automationEngine.ts`. TicketResolutionDrawer agenda NPS via `job_queue` (claimed by process-jobs worker). Guard: tag `sentimento:negativo` → skip. Nota ruim (Ruim/Pessimo) → INSERT em `notifications` table → gerentes da inbox. Componentes: `PollConfigSection.tsx` (admin tab Metricas), `PollMetricsCard.tsx` (4 KPIs), `PollNpsChart.tsx` (distribuicao). Hook: `usePollMetrics` (totalPolls, totalVotes, responseRate, npsAvg, distribution).

---

## 2.10 Knowledge Base — Base de Conhecimento (FAQ)

**O que e:** Um banco de perguntas e respostas frequentes que o admin cadastra. O agente consulta essa base **antes** de inventar uma resposta — se encontrar a resposta la, usa ela.

**Para que serve:** Quando o modelo de IA erra repetidamente a mesma resposta (ex: sempre erra o horario de funcionamento), o admin cadastra a resposta certa na base de conhecimento. Na proxima vez, o agente consulta e responde corretamente.

**Cenario real:** IA responde "Nosso horario e de 9h as 17h" (errado, o correto e 8h as 18h). Admin cadastra na Knowledge Base: "Pergunta: Qual o horario? Resposta: De segunda a sexta, das 8h as 18h. Sabado das 8h ao meio-dia." → Proxima vez que alguem perguntar, agente responde certo.

> **Tecnico:** Tabela `ai_agent_knowledge` (agent_id, question, answer, category). LLM consulta antes de gerar resposta (injetado no context). Posicao na sequencia de correcao: nivel 3 (apos codigo/prompt e validator). Componente admin: `KnowledgeConfig.tsx` (tab Conhecimento). CRUD com busca por categoria.

---

## 2.11 Debounce — Agrupamento de Mensagens Rapidas

**O que e:** Quando o lead manda varias mensagens rapidas em sequencia ("Oi" + "Quero tinta" + "Branca" + "18 litros"), o sistema **aguarda 10 segundos** e agrupa tudo numa unica chamada ao agente.

**Por que isso e importante:** Sem agrupamento, o agente receberia "Oi" e responderia "Ola! Como posso ajudar?". Depois receberia "Quero tinta" e responderia "Que tipo de tinta?". O lead ja tinha dito tudo — mas o agente nao esperou. Com o debounce, ele espera 10 segundos, junta as 4 mensagens, e responde tudo de uma vez.

**Formato das mensagens agrupadas:**
```
[Mensagem 1]: Oi
[Mensagem 2]: Quero tinta
[Mensagem 3]: Branca
[Mensagem 4]: 18 litros
```

O agente le tudo e responde: "Ola! Temos a tinta Coral Branco 18L por R$ 289,90. Quer ver a foto?"

> **Tecnico:** Edge function `supabase/functions/ai-agent-debounce/index.ts`. Delay 10s. Atomico: `UPDATE conversation_messages SET processed=true WHERE conversation_id=X AND processed=false RETURNING *` (elimina race condition). Formato: `[Mensagem 1]: texto\n[Mensagem 2]: texto`. Dedup: remove incoming msgs ja presentes em contextMessages. NO RETRY em 500: gateway timeout (Supabase ~25s limit) = funcao ainda roda em background. Retry criava duplicacao — removido.

---

## 2.12 Saudacao Automatica (Greeting)

**O que e:** Quando um lead envia a primeira mensagem, o agente envia uma saudacao personalizada **instantaneamente** — antes mesmo de processar a pergunta. Isso da uma sensacao de atendimento rapido.

**Regras inteligentes:**
- **Lead conhecido (voltando):** Usa o nome — "Ola, Pedro! Que bom te ver de volta!"
- **Lead novo:** Saudacao generica — "Ola! Bem-vindo a [Loja]. Como posso ajudar?"
- **Lead mandou so "oi":** Envia saudacao e para. Espera o lead dizer o que quer.
- **Lead mandou "oi" + pergunta real:** Envia saudacao E continua para responder a pergunta. Ex: "Oi, quanto custa a tinta coral?" → saudacao + resposta sobre preco.
- **Protecao contra duplicidade:** Se 2 mensagens chegaram quase ao mesmo tempo, verifica se ja enviou saudacao nos ultimos 30 segundos para nao duplicar.
- **Normalizacao:** "oiiiiii", "oieee", "ooiii" — tudo e normalizado para "oi" (remove letras repetidas).

> **Tecnico:** Greeting enviado diretamente antes do Gemini function calling loop (nao e instrucao no prompt). Save-first lock previne duplicatas. Guard: verifica se greeting_sent foi logado nos ultimos 30s por chamada concorrente (race condition com debounce). Pergunta real: detecta se content alem de saudacao (nao e so "oi/bom dia") → envia greeting E continua pro LLM. Saudacao pura: return apos greeting. Normalizacao: regex dedup letras repetidas. Strip re-greet: remove "Ola, [Nome]!" do inicio da resposta LLM (LLM tende a re-greet quando lead da nome). Prompt hardcoded: "NUNCA cumprimente novamente". Playground: greeting injetado como model message em geminiContents (nao system prompt).

---

## 2.13 Memoria do Lead (Context Long)

**O que e:** Quando ativado, o agente carrega no seu "cerebro" todo o historico do lead: nome, cidade, interesses, ultimo produto comprado, objecoes, resumos de conversas anteriores. Assim, quando o lead volta meses depois, o agente ja sabe quem ele e.

**Cenario real:** Pedro comprou tinta Coral em janeiro. Em abril, manda "Oi, preciso de mais tinta". O agente ja sabe: "Pedro, de Recife, comprou Coral Branco 18L da ultima vez, achou o frete caro. Responde: "Ola, Pedro! Quer a mesma Coral Branco 18L? Dessa vez temos frete gratis acima de R$ 300!""

> **Tecnico:** Config: `ai_agents.context_long_enabled` (bool). Quando true, carrega `lead_profiles` (full_name, city, interests, average_ticket, objections, conversation_summaries) e injeta no system prompt como contexto. leadName source: `lead_profiles.full_name` ONLY (nunca contact.name = WhatsApp pushName). leadFullName = `leadProfile?.full_name || null`.

---

## 2.14 Contexto de Canal (Campanha / Funil / Formulario / Bio)

**O que e:** Quando o lead chega por um canal especifico (campanha do Instagram, Bio Link, formulario, ou funil de vendas), o agente recebe automaticamente o **contexto daquele canal**. Assim, nao faz perguntas que o lead ja respondeu.

**Os 4 tipos de contexto:**
1. **Campanha** — Lead veio do link da campanha "Promo Agosto" → agente sabe e pode mencionar a promocao
2. **Formulario** — Lead preencheu formulario com nome, CPF, interesse → agente ja sabe tudo, nao repete perguntas
3. **Bio Link** — Lead clicou no botao "Orcamento" do Bio Link → agente sabe que quer orcamento
4. **Funil** — Lead esta no funil "Captacao de Leads" → agente segue o script especifico daquele funil

**Cenario real:** Lead preenche formulario com nome "Maria", cidade "Salvador", interesse "pintura de fachada". Depois abre o WhatsApp. O agente ja sabe tudo: "Ola, Maria! Vi que voce tem interesse em pintura de fachada em Salvador. Temos tintas especiais para area externa. Quer que eu mostre as opcoes?"

> **Tecnico:** Contexto injetado no system prompt do ai-agent/index.ts como blocos XML:
> - `campanha:NOME` → carrega `utm_campaigns.ai_template` + `ai_custom_text` → `<campaign_context>`
> - `formulario:SLUG` → carrega `form_submissions` dados → `<form_data>` + instrui LLM "NAO repergunta dados coletados"
> - `bio_page:SLUG` → carrega `bio_pages` → `<bio_context>`
> - `funil:SLUG` → carrega `funnels.funnel_prompt` → `<funnel_instructions>` + handoff priority funil > agent
> - `agent_profiles.prompt` → `<profile_instructions>` (ULTIMA secao, prioridade maxima)
>
> Deteccao: verifica tags da conversa para cada tipo. Queries com early return se tag nao presente.

---

## Sequencia Obrigatoria de Correcao de Erros

Quando um teste detectar que o agente respondeu errado, a correcao segue esta ordem rigorosa:

1. **Codigo + Regra no prompt** — Se e bug no fluxo ou logica errada. Corrige no codigo-fonte.
2. **Regra no Validator** — Se o Validator deveria ter pego mas nao pegou. Adiciona nova regra de verificacao.
3. **FAQ na Knowledge Base** — Se e uma resposta que o modelo de IA erra repetidamente. Cadastra a resposta certa.
4. **Fallback: Transferir para humano** — ULTIMO recurso. Quando nenhuma das 3 camadas resolve, o agente transfere para humano. O lead NUNCA fica sem resposta.

**NUNCA pular etapas.** Se o erro e de codigo, nao resolve com FAQ. Se o Validator deveria ter pegado, corrige o Validator ANTES de criar FAQ.

---

## Painel Administrativo do AI Agent

**8 abas de configuracao:**
1. **Setup** — Nome do agente, informacoes da empresa (horario, endereco, telefone)
2. **Prompt Studio** — As 9 secoes de comportamento (personalidade, regras, objecoes)
3. **Inteligencia** — Modelo de IA, perfis de atendimento, configuracao de extracao de dados
4. **Catalogo** — Produtos (adicionar, importar CSV, importar por URL, busca)
5. **Conhecimento** — Base de FAQs (perguntas e respostas)
6. **Seguranca** — Regras de bloqueio, guardrails, numeros bloqueados
7. **Canais** — Voz (TTS), follow-up automatico
8. **Metricas** — Desempenho do agente, metricas do Validator, configuracao de NPS

---

## Links Relacionados

- [[wiki/ai-agent]] — Referencia tecnica completa do AI Agent
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento (25 sub-funcionalidades)
- [[wiki/modulos]] — Todos os 17 modulos do sistema
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rapido de todas as funcionalidades
- [[wiki/plano-enquetes-polls]] — Plano de enquetes e polls (M17)
- [[wiki/decisoes-chave]] — Decisoes arquiteturais (D10: Agent Profiles)

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Rev 1: Termos tecnicos traduzidos, cenarios enriquecidos, wikilinks adicionados, analogias para leigos*
*Rev 2: Camada tecnica adicionada em cada secao (componentes, tabelas, queries, hooks, config fields, edge functions)*
