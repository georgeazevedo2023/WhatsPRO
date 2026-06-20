---
title: AI Agent — Qualidade (Sanitização determinística + TTS + Prompt Studio)
tags: [ai-agent, sanitizer, guardrail, tts, voice, prompt-studio, qualidade]
sources: [supabase/functions/_shared/agent/responseSanitizer.ts, supabase/functions/_shared/responseValidator.ts, supabase/functions/_shared/agent/greetingPolicy.ts, supabase/functions/_shared/ttsProviders.ts, src/components/admin/ai-agent/VoiceConfig.tsx, src/components/admin/ai-agent/PromptStudio.tsx, supabase/functions/_shared/agent/promptSections.ts]
updated: 2026-06-20
audited_at: 2026-06-20
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Qualidade (Sanitização determinística + TTS + Prompt Studio)

> Cobre as camadas de **qualidade** do agente: a sanitização determinística que checa cada resposta antes de enviar ao lead, a resposta por voz (TTS) e o Prompt Studio (editor de comportamento).
>
> **Importante (v7.89.0, auditoria 2026-06-12):** o antigo **Validator Agent (um 2º LLM supervisor)** foi **APOSENTADO do hot path**. Não existe mais um "agente que dá nota 0-10" e decide PASS/REWRITE/BLOCK em produção. A validação hoje é **determinística** (regras/regex, sem chamada de LLM) em `responseSanitizer.ts`. O arquivo `validatorAgent.ts` ainda existe no repo, mas só para auditoria offline e para a função utilitária `countMsgsSinceNameUse` — **nenhum turno de produção paga a latência/custo dele**.

---

## 1. Sanitização determinística — o guarda-costas da resposta

**O que é (didático):** imagine um revisor que lê toda mensagem do robô **antes de ela sair** e, se vir algo proibido, ou conserta a frase ou troca por uma versão segura. A diferença pro modelo antigo é que esse revisor **não é uma IA** — é um conjunto fixo de regras (como um corretor ortográfico inteligente). Por isso é instantâneo, barato e dá sempre o mesmo veredito.

**Cenário real (Eletropiso):** o LLM gera *"Infelizmente não temos a caixa-d'água de 1000L no nosso catálogo."* — mas a regra de negócio diz que **o catálogo é a minoria; a maioria do estoque é físico**. O sanitizador detecta a negação de produto (`anti_negative_phrases`) e **substitui o texto inteiro** por uma ponte propositiva (e, se o handoff já foi disparado, mantém o transbordo). O lead nunca ouve "não temos".

**Por que mudou:** sob o router (produção), a validação já era determinística (`sanitizeSpecialistResponse`, v7.55.0); o monolito (fallback) ainda usava o validador LLM com vereditos BLOCK→handoff próprios. **A mesma resposta passava num caminho e era bloqueada no outro.** A Onda 2 da auditoria extraiu a lógica determinística para um contrato neutro (`SanitizerCtx`) consumido pelos **dois** caminhos — router (via `geminiContents`) e monolito (via `contextMessages`).

### Técnico

- **Arquivo:** `_shared/agent/responseSanitizer.ts`. Função principal `sanitizeAgentResponse(responseText, ctx)` → `{ text, enforced, rules }`. **NUNCA lança** (em erro interno devolve o texto original — degradação graciosa).
- **Fonte única:** chamada por router e monolito. No specialist via `sanitizeSpecialistResponse` (Step 3.5 do `specialistBase.ts`); no monolito via `sanitizeAgentResponse` (`ai-agent/index.ts:3170`). Loga `response_sanitized` em `ai_agent_logs`.
- **Nuance importante:** apesar do nome, o motor real de validação é `validateLLMResponse` (importado de `_shared/responseValidator.ts`) — e ele é **determinístico (regras/regex), NÃO uma chamada de LLM**. "LLM" está só no nome da função; "aposentar o Validator LLM" = aposentar o `validatorAgent.validateResponse` baseado em chamada de modelo.
- **Pré-passo:** `keepLastQuestionWhenStacked` colapsa várias perguntas empilhadas e mantém só a última. Retorna inalterado se o texto tiver < 15 caracteres.
- **Três níveis de enforcement** (política inalterada desde v7.55.0/v7.57.3):
  - `SAFE_TEXT_RULES` = `anti_negative_phrases`, `anti_stock_confirmation`, `anti_internal_error`, `anti_internal_leak` → **SUBSTITUI o texto inteiro** por uma ponte segura (preservando handoff já disparado).
  - `AUTO_FIX_RULES` = `anti_lead_echo`, `anti_jargon_paraphrase`, `anti_anotei` → **reescrita cirúrgica** via `autoFixHumanizationViolations` (remove só a frase ofensora, mantém o resto), depois re-valida.
  - **Regras cosméticas** (eco de abertura, re-saudação, excesso de nome, preço) → **só telemetria**, NÃO reescritas (para não distorcer a resposta).
  - `ENFORCED_BLOCK_RULES` = união de SAFE_TEXT + AUTO_FIX.
- **O que ele realmente protege:**
  - Negação de produto ("não temos / não está no catálogo").
  - Confirmação indevida de estoque.
  - Vazamento de erro interno ao lead ("Desculpe, ocorreu um erro…").
  - Vazamento de tool-call como texto (ex.: `functions.handoff_to_human({...})`).
  - Eco do lead, jargão e "anotei" indevidos.
- **Veredito de qualificação premium:** roda `evaluateProductQualificationFlow` / `readProductQualificationState`. Se há `nextRequiredField` e a resposta parece um handoff prematuro ou pergunta algo que não corresponde àquele campo, substitui por uma "próxima pergunta" determinística (`buildSafeQualificationFallback`, fixa por chave de campo: `ambiente_torneira`, `formato`, `cor`, `area`).
- **SAFE_TEXT nocivo + handoff já chamado** → devolve a ponte fixa *"vou te conectar com nosso vendedor"*.
- **Anti-repetição de nome (determinístico):** `buildNameUsageDirective(geminiContents, fullName)` em `greetingPolicy.ts` varre as 2 últimas mensagens do bot (`role==='model'`) com regex de fronteira de palavra; se o primeiro nome do lead foi usado recentemente, injeta uma diretiva de supressão no prompt do specialist. Foi feito determinístico justamente porque a regra de prompt "máx 1x por mensagem" não bastava — o LLM repetia o nome em **toda** mensagem.

> **Não confundir:** `validatorAgent.ts` **não foi deletado** — re-exporta `countMsgsSinceNameUse` (na verdade definida em `_shared/responseValidator.ts`, de onde o sanitizer a importa direto) e mantém `validateResponse` para auditoria **offline** (fora do hot path). As antigas configs `validator_enabled` / `validator_model` / `validator_rigor` **não têm leitor** no backend; foram removidas da UI (decisões de config do dono, v7.90.0).

---

## 2. TTS — Resposta por voz (Text-to-Speech)

**O que é (didático):** o agente pode responder em **áudio** em vez de só texto — algo natural no WhatsApp brasileiro, onde muita gente prefere ouvir do que ler. Se o lead manda um áudio, o robô tende a responder em áudio também.

**Cenário real (Eletropiso):** o lead grava um áudio perguntando preço. O agente responde com um áudio curto *"Oi! A tinta Coral Branco 18L sai por R$ 289,90, com pronta entrega!"* e, se a resposta for longa, complementa com o texto completo logo em seguida.

### Técnico

- **Cadeia de provedores** (`_shared/ttsProviders.ts`, `ttsWithFallback`): tenta em ordem **Gemini → Cartesia → Murf → Speechify**; cada um retorna áudio base64 ou `null`; o primeiro sucesso vence. **Gemini é o primário.** Timeout de **8 s por provedor**.
  - **Gemini:** modelo `gemini-2.5-flash-preview-tts`, env `GEMINI_API_KEY`, saída PCM 24 kHz → WAV. O `voice_name` é repassado (default `Kore`). **Só o Gemini é afetado por `voice_name`.**
  - **Cartesia:** `sonic-3`, voz PT-BR fixa (`2f4d204f-...`), env `CARTESIA_API_KEY`, WAV 44.1 kHz.
  - **Murf:** voz `pt-BR-francisca`, env `MURF_API_KEY`.
  - **Speechify:** voz `george`, env `SPEECHIFY_API_KEY`.
- **Resposta longa:** `splitAudioAndText()` divide em resumo em áudio + texto completo (acima de `voice_max_text_length` é enviado como texto).
- **UI:** `src/components/admin/ai-agent/VoiceConfig.tsx` (em AIAgentTab). Configs:
  - `voice_enabled` (default `false`)
  - `voice_reply_to_audio` (default `true` — responde em áudio quando o lead manda áudio, mesmo com TTS global off)
  - `voice_name` (default `Kore`)
  - `voice_max_text_length` (default 150, faixa 10-500; acima disso vai como texto)
- **6 vozes na UI (só Gemini):** Kore (Feminina BR), Aoede (Feminina), Charon (Masculina), Fenrir (Masculina), Puck (Masculina), Leda (Feminina).
- **Preview "Ouvir Amostra":** chama o Gemini direto do navegador, puxando `GEMINI_API_KEY` da tabela `system_settings` (não usa a cadeia de provedores).

---

## 3. Prompt Studio — Personalização do comportamento

**O que é (didático):** uma tela no painel admin onde o dono da loja customiza **como o agente se comporta**, sem programar — um editor da "personalidade" do robô, dividido em seções.

**Cenário real (Eletropiso):** o dono entra no Prompt Studio → seção "Objeções" e escreve *"Quando o lead disser que está caro, oferecer parcelamento em até 3x sem juros e frete grátis acima de R$ 500."* Na conversa seguinte, ao ouvir "achei caro", o agente já responde com a oferta certa.

### Técnico

- **UI:** `src/components/admin/ai-agent/PromptStudio.tsx`. Edita `config.prompt_sections` (JSONB).
- **9 seções:** `identity`, `business_context` (auto-gerada e read-only a partir de `config.business_info`), `sdr_flow`, `product_rules`, `handoff_rules`, `tags_labels`, `absolute_rules`, `objections`, `additional`.
- **Defaults:** carregados de `system_settings`, chave `default_prompt_sections`. Badge "Editado" por seção, restaurar-para-default, estimativa de tokens (≈ 4 chars/token) e medidor de limite vs 4096.
- **Runtime (genuinamente ligado):** `ai-agent/index.ts:48` importa `buildAgentPromptSections` de `_shared/agent/promptSections.ts` (comentário em `index.ts:2431` confirma que substituiu ~85 linhas inline por helpers puros). Também referenciado em `ai-agent-playground/index.ts`.
- **Cópia stale na UI:** a descrição da seção `absolute_rules` ainda menciona "Validated pelo Validator Agent" — texto desatualizado, pois o Validator foi **aposentado** (v7.89.0); a sanitização hoje é determinística (ver Seção 1).

**Lição importante (precedência das prompt sections):** quando o agente ignora regras dinâmicas (`service_categories`) e segue lógica fixa, **suspeitar primeiro do `prompt_sections.sdr_flow`** — texto custom no banco tem precedência comportamental sobre regras hardcoded em runtime. Auditar as prompt sections **antes** de mexer no código do `ai-agent/index.ts`.

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — LLM + ferramentas
- [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] — SDR + Shadow Mode
- [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] — Profiles, Knowledge Base, NPS
- [[wiki/erros-e-licoes]] — lições e regras preventivas do agente
