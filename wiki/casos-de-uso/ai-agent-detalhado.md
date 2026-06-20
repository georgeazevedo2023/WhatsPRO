---
title: AI Agent — Documentação Detalhada (Índice)
tags: [ai-agent, indice, funcionalidades, detalhado, router, specialists]
sources:
  - supabase/functions/_shared/agent/router.ts
  - supabase/functions/_shared/agent/routerPipeline.ts
  - supabase/functions/_shared/agent/specialistBase.ts
  - supabase/functions/_shared/agent/hopGuard.ts
  - supabase/functions/_shared/agent/qualificationGate.ts
  - supabase/functions/_shared/agent/responseSanitizer.ts
  - supabase/functions/ai-agent/index.ts
  - supabase/functions/_shared/constants.ts
updated: 2026-06-20
audited_at: 2026-06-20
---

# AI Agent — Vendedor Robô Inteligente (Índice)

> **Didático.** O AI Agent é um **vendedor robô** que atende clientes pelo WhatsApp 24/7. Não é um chatbot de respostas fixas — ele lê a mensagem, entende a intenção, busca produtos no catálogo, manda fotos, monta carrosséis, qualifica o lead, lembra de conversas antigas, e quando trava ("quero desconto", "quero falar com o gerente"), transfere pro vendedor humano.
>
> Na Eletropiso: o cliente manda "bom dia, vcs têm tinta?" — o robô cumprimenta, pergunta o ambiente, descobre que é parede de cozinha, mostra um carrossel de tintas laváveis e, quando o lead pede pra fechar, passa pro vendedor já com o pedido anotado.

> **Técnico.** Em vez de **um** LLM gigante decidindo tudo (o "monolito", prompt de ~17 KB), a arquitetura atual separa **quem decide** de **quem responde**: um **router LLM tiny** classifica a intenção e despacha pra um de **5 specialists dedicados**, com uma **camada determinística** por cima e **memória longa por lead**. O monolito hoje é só **fallback**.

---

## A arquitetura ATUAL em 1 minuto

> **Didático.** Pense numa loja: na porta tem um **recepcionista rápido** (router) que ouve o cliente e diz "isso é com o vendedor de tintas" ou "isso é com quem fecha pedido". Cada **especialista** (specialist) só sabe fazer bem a SUA parte. E existe um **gerente de regras** (camada determinística) que age antes e depois, sem depender de IA, pra garantir que ninguém invente preço nem negue produto.

> **Técnico.** O fluxo por turno (`routerPipeline.ts`):

1. **Router LLM** (`classifyIntent`, `router.ts`) — modelo `gpt-4.1-mini` (`DEFAULT_ROUTER_MODEL`, `constants.ts`; o `gpt-5-nano` original falhava 100% no parse JSON em prod). `temperature 0.1`, `maxTokens 150`, sem tools, prompt `ROUTER_SYSTEM_PROMPT` (~936 chars). Devolve **1 de 7 intents**: `saudacao`, `qualificacao`, `produto`, `handoff`, `objecao`, `pagamento`, `fora_escopo`. Prioridade quando há várias: `handoff > produto > pagamento > objecao > qualificacao > saudacao > fora_escopo`. **Defesa 4 níveis** — qualquer falha (parse, intent inválida, `confidence < 0.6` fora de qualificação, ou exceção) cai em `qualificacao` (conf 0.5, `fallback: true`).
2. **Dispatch (intent → specialist)** — 7 intents mapeiam pra **5 builders distintos**: `saudacao`/`fora_escopo` → greeting; `qualificacao` → qualification; `produto` → product; `objecao`/`pagamento` → objection; `handoff` → handoff. Greeting roda no barato `gpt-4.1-mini`; os outros 4 no `specialist_model` (default `gpt-4.1`).
3. **Overrides determinísticos** — a intent do router **nem sempre é honrada**: o `qualificationGate` (fonte única "buscar vs qualificar"), o loop de enriquecimento (offline / catálogo vazio), pós-nome com interesse premium, e `exit_action=handoff` podem trocar o specialist ou devolver uma resposta determinística direto (próxima pergunta de qualificação, "quer mais?" offline, handoff forçado).
4. **Hop guard** (`hopGuard.ts`) — máx **2 hops** por `turn_id` (hop 0 router, hop 1 specialist); ≥2 linhas em `ai_agent_runs` → bloqueia, loga `loop_detected` e cai no monolito.
5. **Specialist responde** (`runSpecialist`, `specialistBase.ts`) → resposta passa pelo **sanitizador determinístico** (`sanitizeAgentResponse`, `responseSanitizer.ts`) → dispatch.

---

## O flag `routing_mode` (3 valores) e o papel do monolito

> **Didático.** Cada agente tem um "modo de operação". Por padrão ainda responde o vendedor antigo (monolito). Dá pra ligar o time novo (router), ou rodar o router **em silêncio só pra medir acerto** (shadow) enquanto o antigo continua respondendo o cliente.

> **Técnico.** O pipeline do router só roda se `routing_mode === 'router'` ou `'shadow'` (`index.ts:3107`). Valores:

- **`monolith`** (default) — pipeline pulado; o mega-prompt (`runLlmCallLoop`) responde o lead.
- **`router`** — router classifica e despacha; specialist responde (com os overrides); **cai no monolito** em falha. Sob router, short-circuits só-do-monolito são pulados: R129/R136 (`skipShortCircuits`), R121 pré-busca inline (`skipR121`), e o dispatch eager de exit-action é adiado pro handoff specialist.
- **`shadow`** — router classifica e **só loga** em `ai_agent_runs` (mede acurácia); NÃO roda o specialist (evita efeitos colaterais duplos); o monolito responde o lead.

O monolito hoje é **(a)** o respondedor ativo de qualquer agente em `monolith`, e **(b)** o fallback de segurança pra agentes router/shadow quando `runRouterPipeline` retorna `null` (shadow, hop-guard, intent sem specialist, falha catastrófica do LLM do specialist, ou exceção). Ele **compartilha o mesmo sanitizador** (`sanitizeAgentResponse`) que os specialists — o validador LLM foi aposentado do hot path (Onda 2, 2026-06-12). **D6 (aposentar o monolito) ainda está STAGED** (gate ~23/06); EletropisoV2 já roda em `router`.

---

## Índice — 4 sub-wikis

> Cada sub-wiki abre **didático** (o quê / por quê) e desce pro **técnico** (arquivos, funções, fluxo).

| Sub-wiki | Cobre | Quando ler |
|---|---|---|
| [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] | **Cérebro** (router + specialistBase + dispatch) · **as ferramentas** (9 canônicas do monolito + subset por specialist + `set_cart`) · **memória longa por lead** (`leadMemory.ts`, structured-facts) · **cart engine** (`cart.ts`) · **captura de nome** (`nameCapture.ts`) | Pra entender o que o agente FAZ |
| [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] | **Fluxo SDR / camada determinística** (`qualificationGate`, `greetingPolicy`, `preLLMShortCircuits` R129/R136, `preLLMAutoExtract` R121/R137) · **Shadow Mode** (extração silenciosa) · **handoff** (specialist + summary + caps + abandono) · **trava de atendimento humano** (`human_handling_at`) · **rotação de fila** | Pra entender como o agente PENSA e TRANSBORDA |
| [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] | **Sanitização + TTS + Prompt Studio** — sanitizador determinístico (`responseSanitizer`, substituiu o Validator LLM) · cadeia de voz (Gemini→Cartesia→Murf→Speechify) · Prompt Studio (8 seções, `promptSections.ts`) | Pra entender QUALIDADE e CUSTOMIZAÇÃO |
| [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] | **Recursos auxiliares** — Agent Profiles (`profileReader.ts`, ativo) · Knowledge Base (FAQ/docs, injetada como XML, limite 30) · Debounce (10s, claim atômico) · NPS (config-only, runtime órfão) · Greeting · Contexto de canal · Painel admin | Pros recursos AUXILIARES |

## Sub-wikis relacionados

- [[wiki/casos-de-uso/excluded-products-detalhado]] — lista de produtos que a tenant NÃO vende, configurável via UI

---

## Os 5 specialists (resumo)

> **Didático.** Cada specialist é um vendedor que só faz uma coisa muito bem e nunca invade a área do outro.

> **Técnico.** Todos compartilham o contrato `SpecialistDef` + `runSpecialist` (`specialistBase.ts`). Distinções:

| Specialist | Intent(s) | Modelo default | Papel |
|---|---|---|---|
| **greeting** | `saudacao`, `fora_escopo` | `gpt-4.1-mini` (barato) | Abre a conversa, capta/reconhece nome, redireciona fora-de-escopo. Nunca qualifica/busca/transborda. |
| **qualification** | `qualificacao` | `gpt-4.1` | Descoberta estilo SPIN, **uma pergunta por turno** (reusa `buildQualificationContext`). |
| **product** | `produto` | `gpt-4.1` | Monta o pedido completo. Regra dura: **nunca nega existência de produto** (catálogo é minoria). |
| **objection** | `objecao`, `pagamento` | `gpt-4.1` | Feel-Felt-Found / valor; carrega `business_info` (preços/pagamento). Nunca dá desconto sozinho. |
| **handoff** | `handoff` | `gpt-4.1` | Fecha o ciclo: 1 frase de confirmação + `handoff_to_human` com motivo rico. Foi de mini→`gpt-4.1` porque o mini vazava a tool call como texto. |

---

## Links Relacionados

- [[wiki/ai-agent]] — referência técnica resumida do AI Agent
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento
- [[wiki/modulos]] — todos os módulos do sistema
- [[wiki/decisoes-chave]] — D10 (Agent Profiles), D26 (Service Categories), D28 (Excluded Products)
- [[wiki/erros-e-licoes]] — regras preventivas

---

*Reescrito em 2026-06-20 — arquitetura atual (router LLM tiny + 5 specialists + camada determinística + monolito fallback + memória longa). Substitui o snapshot de 2026-04-30 (monolito + Validator LLM).*
