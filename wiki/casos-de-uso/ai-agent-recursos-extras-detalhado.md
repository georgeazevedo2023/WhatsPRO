---
title: AI Agent — Recursos Extras (Profiles, NPS, KB, Greeting, Memória)
tags: [ai-agent, profiles, nps, knowledge-base, debounce, greeting, memoria, contexto-canal]
sources: [supabase/functions/ai-agent/, src/components/admin/ai-agent/]
updated: 2026-04-30
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Recursos Extras

> Sub-wiki extraído de `ai-agent-detalhado.md` em 2026-04-30. Cobre 7 recursos auxiliares: Perfis de Atendimento, NPS, Knowledge Base, Debounce, Greeting, Memória do Lead, Contexto de Canal.

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

> **Tecnico:** Edge function `supabase/functions/ai-agent-debounce/index.ts`. Delay 10s. Atomico: `UPDATE conversation_messages SET processed=true WHERE conversation_id=X AND processed=false RETURNING *` (elimina race condition). Formato: `[Mensagem 1]: texto\n[Mensagem 2]: texto`. Dedup: remove incoming msgs ja presentes em contextMessages. NO RETRY em 500: gateway timeout (Supabase ~25s limit) = funcao ainda roda em background. Retry criava duplicacao — removido (R6).

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

**9 abas de configuracao (após M19-S10 v2):**
1. **Setup** — Nome do agente, informacoes da empresa (horario, endereco, telefone)
2. **Prompt Studio** — As 9 secoes de comportamento (personalidade, regras, objecoes)
3. **Inteligencia** — Modelo de IA, perfis de atendimento, configuracao de extracao de dados
4. **Qualificacao** — Service Categories (stages + score) + Excluded Products (D28)
5. **Catalogo** — Produtos (adicionar, importar CSV, importar por URL, busca)
6. **Conhecimento** — Base de FAQs (perguntas e respostas)
7. **Seguranca** — Regras de bloqueio, guardrails, numeros bloqueados, BusinessHoursEditor
8. **Canais** — Voz (TTS), follow-up automatico
9. **Metricas** — Desempenho do agente, metricas do Validator, configuracao de NPS

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — LLM + 9 ferramentas
- [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] — SDR + Shadow Mode
- [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] — Validator + TTS + Prompt Studio
- [[wiki/casos-de-uso/excluded-products-detalhado]] — D28 (produtos NÃO vendidos)
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Polls/NPS detalhado
- [[wiki/decisoes-chave]] — D10 (Agent Profiles), D26 (Service Categories), D28 (Excluded)
