---
title: AI Agent — Documentação Detalhada (Índice)
tags: [ai-agent, indice, funcionalidades, detalhado, router, specialists, d6]
sources:
  - supabase/functions/_shared/agent/router.ts
  - supabase/functions/_shared/agent/routerPipeline.ts
  - supabase/functions/_shared/agent/specialistBase.ts
  - supabase/functions/_shared/agent/hopGuard.ts
  - supabase/functions/_shared/agent/qualificationGate.ts
  - supabase/functions/_shared/agent/responseSanitizer.ts
  - supabase/functions/ai-agent/index.ts
  - supabase/functions/_shared/constants.ts
updated: 2026-07-26
audited_at: 2026-07-26
---

# AI Agent — Vendedor Robô Inteligente (Índice)

> **Didático.** O AI Agent é um **vendedor robô** que atende clientes pelo WhatsApp 24/7. Não é um chatbot de respostas fixas — ele lê a mensagem, entende a intenção, busca produtos no catálogo, manda fotos, monta carrosséis, qualifica o lead, lembra de conversas antigas, e quando trava ("quero desconto", "quero falar com o gerente"), transfere pro vendedor humano.
>
> Na Eletropiso: o cliente manda "bom dia, vcs têm tinta?" — o robô cumprimenta, pergunta o ambiente, descobre que é parede de cozinha, mostra um carrossel de tintas laváveis e, quando o lead pede pra fechar, passa pro vendedor já com o pedido anotado.

> **Técnico.** Em vez de **um** LLM gigante decidindo tudo (o "monolito", prompt de ~17 KB, **aposentado em 2026-07-25**), a arquitetura atual separa **quem decide** de **quem responde**: um **router LLM tiny** classifica a intenção e despacha pra um de **5 specialists dedicados**, com uma **camada determinística** por cima e **memória longa por lead**. Desde o **D6** (v7.109.0, `ai-agent` v277) esse é o **único cérebro** — não há mais caminho alternativo.

---

## A arquitetura ATUAL em 1 minuto

> **Didático.** Pense numa loja: na porta tem um **recepcionista rápido** (router) que ouve o cliente e diz "isso é com o vendedor de tintas" ou "isso é com quem fecha pedido". Cada **especialista** (specialist) só sabe fazer bem a SUA parte. E existe um **gerente de regras** (camada determinística) que age antes e depois, sem depender de IA, pra garantir que ninguém invente preço nem negue produto.

> **Técnico.** O fluxo por turno (`routerPipeline.ts`):

1. **Router LLM** (`classifyIntent`, `router.ts`) — modelo `gpt-4.1-mini` (`DEFAULT_ROUTER_MODEL`, `constants.ts`; o `gpt-5-nano` original falhava 100% no parse JSON em prod). `temperature 0.1`, `maxTokens 150`, sem tools, prompt `ROUTER_SYSTEM_PROMPT` (~936 chars). Devolve **1 de 7 intents**: `saudacao`, `qualificacao`, `produto`, `handoff`, `objecao`, `pagamento`, `fora_escopo`. Prioridade quando há várias: `handoff > produto > pagamento > objecao > qualificacao > saudacao > fora_escopo`. **Defesa 4 níveis** — qualquer falha (parse, intent inválida, `confidence < 0.6` fora de qualificação, ou exceção) cai em `qualificacao` (conf 0.5, `fallback: true`).
2. **Dispatch (intent → specialist)** — 7 intents mapeiam pra **5 builders distintos**: `saudacao`/`fora_escopo` → greeting; `qualificacao` → qualification; `produto` → product; `objecao`/`pagamento` → objection; `handoff` → handoff. Greeting roda no barato `gpt-4.1-mini`; os outros 4 no `specialist_model` (default `gpt-4.1`).
3. **Overrides determinísticos** — a intent do router **nem sempre é honrada**: o `qualificationGate` (fonte única "buscar vs qualificar"), o loop de enriquecimento (offline / catálogo vazio), pós-nome com interesse premium, e `exit_action=handoff` podem trocar o specialist ou devolver uma resposta determinística direto (próxima pergunta de qualificação, "quer mais?" offline, handoff forçado).
4. **Hop guard** (`hopGuard.ts`) — máx **2 hops** por `turn_id` (hop 0 router, hop 1 specialist); ≥2 linhas em `ai_agent_runs` → bloqueia, loga `loop_detected` e o pipeline devolve `null` → transbordo gracioso (seção abaixo).
5. **Specialist responde** (`runSpecialist`, `specialistBase.ts`) → resposta passa pelo **sanitizador determinístico** (`sanitizeAgentResponse`, `responseSanitizer.ts`) → dispatch.

---

## D6 — o monolito foi aposentado (2026-07-25)

> **Didático.** Durante meses o sistema teve dois cérebros: o novo (recepcionista + especialistas) e o antigo (um vendedor sabe-tudo), com uma chave escolhendo qual atendia. A chave acabou: **o antigo foi aposentado**. E a rede de segurança deixou de ser "chama o vendedor antigo" — virou **passar o lead pra um atendente humano com elegância**, sem o cliente perceber que houve pane.

> **Técnico.** O D6 (v7.109.0, commit `5245eab`, `ai-agent` **v277**) removeu o mega-prompt do `ai-agent/index.ts`: **3.440 → 2.964 linhas (-476)**. Evidência pré-remoção: 30 dias de prod com 100% dos turnos em router+specialists, zero fallback. As 3 camadas de segurança de hoje:

1. **Router LLM falha → NÃO transborda.** Parse quebrado, intent inválida ou `confidence < 0.6` caem em fallback determinístico pra `qualificacao` (conf 0.5, `fallback: true`, `router.ts`). O turno segue normal com o qualification specialist.
2. **Specialist falha / hop guard / exceção → transbordo gracioso.** `runRouterPipeline` devolve `null` e o `index.ts` manda a `handoff_message` configurada + põe na **fila** (`runQueueAssignment`) + `status_ia = SHADOW` + **nota interna** + log em `ai_agent_logs` (`event='implicit_handoff'`, `metadata.reason='router_fallback'`). O lead **nunca** vê erro interno. Em 40h de prod (verificação 2026-07-26): **zero `router_fallback`** em tráfego real.
3. **Rollback não é flag** — é redeploy do `ai-agent` a partir do commit `36f0555` (pai do D6, último com monolito) via CLI scoop; prod anterior = v276.

A coluna `ai_agents.routing_mode` continua no DB mas está **INERTE**: nenhum código a lê, o default virou `router` e o seletor saiu da UI (`AIAgentTab.tsx`). Também sumiu o **modo `shadow` de roteamento** — não confundir com `conversations.status_ia = 'shadow'`, que segue vivo e significa outra coisa (humano assumiu o atendimento). Com o monolito, foram removidos os short-circuits que só ele usava (R129/R136 e a pré-busca inline R121); a desambiguação multi-categoria hoje é semeada pelo `preLLMAutoExtract` (`multi_interesse_pending`, v7.105.0). O sanitizador determinístico (`sanitizeAgentResponse`) continua obrigatório em toda resposta, agora com um único consumidor: o `specialistBase`.

---

## Índice — 4 sub-wikis

> Cada sub-wiki abre **didático** (o quê / por quê) e desce pro **técnico** (arquivos, funções, fluxo).

| Sub-wiki | Cobre | Quando ler |
|---|---|---|
| [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] | **Cérebro** (router + specialistBase + dispatch) · **fallback gracioso** (§7) · **as ferramentas** (defs em `specialistTools.ts` + `productSpecialist.ts`, subset por specialist, `set_cart`) · **memória longa por lead** (`leadMemory.ts`, structured-facts) · **cart engine** (`cart.ts`) · **captura de nome** (`nameCapture.ts`) | Pra entender o que o agente FAZ |
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

*Atualizado em 2026-07-26 pós-D6 — arquitetura atual: router LLM tiny + 5 specialists + camada determinística + memória longa, com **fallback gracioso** (transbordo) no lugar do monolito, aposentado em 2026-07-25. Reescrito em 2026-06-20; substitui o snapshot de 2026-04-30 (monolito + Validator LLM).*
