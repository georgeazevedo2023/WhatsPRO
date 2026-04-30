---
title: AI Agent — Validator, TTS e Prompt Studio
tags: [ai-agent, validator, guardrail, tts, voice, prompt-studio, qualidade]
sources: [supabase/functions/_shared/validatorAgent.ts, supabase/functions/_shared/ttsProviders.ts]
updated: 2026-04-30
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Qualidade (Validator + TTS + Prompt Studio)

> Sub-wiki extraído de `ai-agent-detalhado.md` em 2026-04-30. Cobre as camadas de qualidade do agente: supervisor de respostas, voz sintetizada, e personalização de comportamento.

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

> **Tecnico:** Modulo `_shared/validatorAgent.ts`. Tabela `ai_agent_validations` (conversation_id, score, action, original_text, rewritten_text, violations). Config: `ai_agents.validator_enabled` (bool), `validator_model` (string), `validator_rigor` ('moderado'|'rigoroso'|'maximo'). Threshold: moderado>=8, rigoroso>=9, maximo==10. Checks: leadQuestions (count), catalogPrices (verify), forbidden phrases (array), blocked topics (array), discount limit (max_discount_percent), name frequency (max 1 per 3-4 msgs). Safety net pos-validator: codigo conta "?" — se >1, trunca para 1a pergunta (LLM validator miscounts). Componente: `ValidatorMetrics.tsx` (score avg, PASS/REWRITE/BLOCK rates, score distribution chart, top violations com severity, AI suggestions). Validator BLOCK também reseta `lead_msg_count: 0` (R86).

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

**R82 (lição importante):** quando agente ignora regras dinâmicas (`service_categories`) e segue lógica fixa, **suspeitar primeiro do `prompt_sections.sdr_flow`** — texto custom no banco tem precedência comportamental sobre regras hardcoded em runtime. Auditoria de prompt sections antes de mexer em código de 2700 linhas.

> **Tecnico:** Tabela: `ai_agents.prompt_sections` JSONB com 9 keys (identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional, business_context — auto-generated). Template vars: `{agent_name}`, `{personality}`, `{max_pre_search_questions}`, `{max_qualification_retries}`, `{max_discount_percent}`. Defaults: `system_settings.default_prompt_sections`. Componente: `PromptStudio.tsx`. Secoes montadas no ai-agent/index.ts e concatenadas no system prompt antes de enviar ao LLM. business_context gerado automaticamente a partir de `ai_agents.business_info` JSONB.

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — LLM + 9 ferramentas
- [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] — SDR + Shadow Mode
- [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] — Profiles, NPS, etc.
- [[wiki/erros-e-licoes]] — R82 (prompt_sections precedência)
