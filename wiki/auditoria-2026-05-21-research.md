---
title: Auditoria 2026-05-21 — Research de melhores práticas para o AI Agent
tags: [auditoria, research, ai-agent, llm, openai, gpt-5, guardrails, rag]
sources:
  - https://openai.com/index/introducing-gpt-5-5/
  - https://platform.openai.com/docs/guides/function-calling
  - https://platform.openai.com/docs/guides/structured-outputs
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
  - https://arxiv.org/pdf/2505.19591
  - https://developer.nvidia.com/nemo-guardrails
updated: 2026-05-21
audited_at: 2026-05-21
---

# Auditoria 2026-05-21 — Research de melhores práticas

Pesquisa orientada a 6 temas pra avaliar gaps do AI Agent do WhatsPRO (hoje: `gpt-4.1-mini`, 1 mega-prompt, 9 tools, guards em TS). Incidentes recorrentes: prompt ignorado, args alucinados (R125), debounce race, fuzzy cross-categoria (R126/R133).

---

## 1. Modelo OpenAI atual (2025–2026)

O nome canônico citado pelo usuário como "GPT 5.4" existe (GPT-5.4 lançado em 2026-04-18 com mini/nano), mas **o flagship atual é GPT-5.5** (API desde 2026-04-24) e **GPT-5.5 Instant** é o default do ChatGPT desde 2026-05-05.

- **gpt-4.1-mini** (atual WhatsPRO): $0.40 / $1.60 por 1M tok, ctx 128k, tool calling ok.
- **gpt-5-mini**: $0.25 / $2.00 por 1M tok, ctx 200k, structured outputs nativos + reasoning.
- **gpt-5.4-mini**: $0.75 / $4.50 por 1M tok, melhor em SWE-Bench (54%) e tool agents.
- **gpt-5.5**: $5 / $30 por 1M, ctx 1M — overkill pro caso WhatsPRO.

**Estimativa custo 10k msgs/mês** (≈800 input + 200 output tok/msg = 8M in + 2M out):
- gpt-4.1-mini: $3.20 + $3.20 = **$6.40/mês**
- gpt-5-mini: $2.00 + $4.00 = **$6.00/mês** ← migração praticamente neutra
- gpt-5.4-mini: $6.00 + $9.00 = **$15.00/mês**

**Recomendação:** migrar pra **gpt-5-mini** (instruction following melhor, structured outputs garantidos, custo igual). Manter gpt-4.1-mini como fallback. **Não** migrar pra 5.4-mini sem A/B test — 2.3x mais caro.

Fontes:
- [Introducing GPT-5.5 — OpenAI](https://openai.com/index/introducing-gpt-5-5/) (2026-04-24)
- [GPT-4.1 mini vs GPT-5 mini pricing — LangCopilot](https://langcopilot.com/gpt-4.1-mini-vs-gpt-5-mini-pricing) (2026)
- [GPT-5.4 mini & nano benchmarks — DataCamp](https://www.datacamp.com/blog/gpt-5-4-mini-nano) (2026)

**Aplicabilidade WhatsPRO:** mudança de 1 linha em `_shared/openai.ts`, ROI imediato em qualidade de tool calling.

---

## 2. Arquitetura: monolítico vs subagentes

Monolítico (estado atual): 1 chamada LLM, latência 1–3s, simples de auditar, mas degrada em fluxos com >9 tools e contextos longos (greeting + qualif + handoff + busca + recusa). Padrão 2025–2026 dominante em produção é **orchestrator-worker** (router central + specialists).

- **Router pattern** (recomendado pra WhatsPRO): 1 LLM classifica intent → roteia pra agente especialista (greeting, qualif, search, handoff). Cada specialist tem prompt menor + tools subset.
- **Hierarchical**: só vale com >7 specialists; cada nível adiciona ~2s — Toucan Toco recomenda **começar com 2 níveis**.
- **Swarm/Mesh**: descentralizado, alta latência — não recomendado pra chat real-time.

**Tradeoffs reais:**
- Multi-call adiciona 1–3s **por hop** vs 1 chamada do monolítico.
- Specialists com prompts menores reduzem alucinação e custam menos tokens.
- Handoff loops (A→B→A) são o failure mode #1 — exige guard de hop count.

**Recomendação pra WhatsPRO:** introduzir **router leve** (gpt-5-nano ou gpt-4.1-nano para classificar intent em <300ms) → 3 specialists: `qualif`, `product_search`, `handoff`. Manter guards TS hoje como camada determinística sobre o output.

Fontes:
- [From Monolith to Multi-Agent — Toucan Toco](https://www.toucantoco.com/en/blog/monolithic-llm-multi-agent) (2025)
- [Agent Orchestration Patterns — Gurusup](https://gurusup.com/blog/agent-orchestration-patterns) (2026)
- [AI Agent Delegation Patterns — Fastio](https://fast.io/resources/ai-agent-delegation-patterns/) (2026)

**Aplicabilidade WhatsPRO:** sprint de 2 semanas pra extrair router + 1 specialist (product_search) como POC. Mede latência E2E vs hoje.

---

## 3. Prompt engineering 2026

Consenso 2026: **XML tags ainda valem, mas não em prompts curtos**. Em prompts longos (>1k tok, várias seções, instruções + dados + few-shots), XML reduz ambiguidade. Em prompts curtos, markdown chega no mesmo resultado.

- **Section ordering**: instruções vão **antes** do contexto longo em modelos legacy; em GPT-5/Claude 4 a ordem importa menos, mas instruções no **fim** funcionam melhor pra prompts >10k tok (efeito recency).
- **Híbrido recomendado**: XML pra semântica (`<task>`, `<context>`, `<rules>`, `<examples>`), markdown dentro dos blocos pra legibilidade.
- **Chain-of-thought**: ainda vale pra reasoning, mas em GPT-5 já vem "embutido" via reasoning_effort. Em gpt-5-mini, CoT explícito adiciona ~30% latência e melhora <5% — geralmente não vale.
- **Few-shot**: 3–5 exemplos é o sweet spot; >10 vira ruído.

**Anti-padrões observados no prompt WhatsPRO atual:**
- Mega-prompt único de >2k linhas mistura regras + few-shots + tool docs.
- Sem delimitadores semânticos claros — tudo markdown.
- Regras críticas (saudação única, não repetir nome) no meio do prompt — efeito serial position degrada compliance.

Fontes:
- [Anthropic — Use XML tags](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) (2025)
- [XML Tags Don't Help Short Prompts — DEV](https://dev.to/manishramavat/xml-tags-dont-help-short-prompts-heres-when-they-actually-matter-2026-25gf) (2026)
- [Mastering Prompt Engineering 2026 — Medium](https://medium.com/@ivanescribano1998/mastering-prompt-engineering-complete-2026-guide-a639b42120e9) (2026)

**Aplicabilidade WhatsPRO:** refatorar prompt em blocos XML (`<persona>`, `<rules>`, `<tools_usage>`, `<examples>`). Mover regras críticas (R115, R124, R125) pro **fim** do prompt.

---

## 4. Tool calling / Function calling

GPT-4.1-mini hoje **não roda em strict mode** no WhatsPRO (verificar `_shared/openai.ts`). Strict mode reduz taxa de erro pra <0.1%; sem ele, é "best effort".

**Best practices 2026:**
- **`strict: true` SEMPRE** + `additionalProperties: false` em todo objeto + todo campo em `required` (use `null` em type pra opcionais).
- **<100 tools, <20 args/tool**: in-distribution. WhatsPRO com 9 tools está bem.
- **Descrições concisas e ortogonais**: tools com descrições sobrepostas fazem o LLM hesitar ou escolher errado (origem R126 cross-categoria).
- **Parallel tool calls**: vale quando ações são independentes (ex: `search_products` + `get_lead_history`). Sequencial pra tools com dependência.
- **Anti-alucinação de args**: forçar enums no schema sempre que possível (origem R125 — `interesse:` deveria ser enum derivada de `service_categories`, não free text). Validar args server-side **antes** de executar.
- **Não prometer**: incluir no system prompt "Do NOT promise to call a function later. If a function call is required, emit it now; otherwise respond normally."

Fontes:
- [Function calling — OpenAI docs](https://platform.openai.com/docs/guides/function-calling) (2025–2026)
- [Structured Outputs — OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/) (2024–2025)
- [Prompting Best Practices for Tool Use — OpenAI Community](https://community.openai.com/t/prompting-best-practices-for-tool-use-function-calling/1123036) (2025)

**Aplicabilidade WhatsPRO:** auditar `_shared/openai.ts` pra ligar strict mode em todas as 9 tools. Transformar `set_tags.interesse` em enum dinâmica baseada em `service_categories` (resolve bug 12). Validar args server-side antes de aplicar.

---

## 5. Guardrails determinísticos

Padrão 2026: **defense in depth** — combina prompt rules + code rules + frameworks dedicados. WhatsPRO já tem código (`handoffGuard.ts`, `filterProductsByExpectedCategory`), mas falta camada padronizada.

- **NeMo Guardrails** (NVIDIA, open-source, v0.20 jan/2026): 5 rail types (input, dialog, retrieval, execution, output). Latência 100–300ms (50–150ms otimizado). YAML declarativo.
- **Guardrails AI** (Python): validators declarativos. Bom pra structured output validation.
- **Llama Guard**: content classification (toxic/PII/jailbreak).
- **Hybrid recomendado**: NeMo pra conversation flow + Guardrails AI pra output validation + regex/Pydantic pra atalhos rápidos.

**Prompt rule vs code rule:**
- Regra crítica de negócio (não vazar dados, não prometer prazo) → **code rule** (verifica output antes de mandar pra WhatsApp).
- Regra de tom/persona → **prompt rule**.
- Regra que mistura (handoff fora horário com flag) → **híbrida**: prompt sugere, code valida e cancela.

**Auditoria de compliance**: logar `tools_called`, `tags_applied`, `rules_triggered` em cada turno. Permite dashboard "LLM seguiu vs ignorou".

Fontes:
- [NeMo Guardrails — NVIDIA](https://developer.nvidia.com/nemo-guardrails) (2026)
- [Guardrails AI vs NeMo Guardrails comparison 2026 — is4.ai](https://is4.ai/blog/our-blog-1/guardrails-ai-vs-nemo-guardrails-comparison-2026-352)
- [LLM Guardrails Setup Guide 2026 — AI Workflow Lab](https://aiworkflowlab.dev/article/llm-guardrails-production-defense-in-depth-safety-systems-nemo-guardrails-ai-openai)

**Aplicabilidade WhatsPRO:** adotar Guardrails AI (TypeScript port ou via edge worker) pra validar tool args + output. Tabela `ai_agent_audit_log` com `rules_triggered`.

---

## 6. RAG / Memória / Contexto

WhatsPRO hoje injeta `last_n_messages` no prompt (sliding window simples). Padrão 2026 evoluiu pra **memória hierárquica em 3 tiers**.

- **Short-term**: últimas 6–10 msgs verbatim (já feito).
- **Medium-term**: summary rolling das msgs anteriores (compressão LLM).
- **Long-term**: facts extraídos por sessão (nome, interesse, marca preferida, objeção) → tabela `lead_memory` com embeddings opcional.

**ConversationSummaryBufferMemory** (LangChain pattern): mantém buffer verbatim até X tokens, daí summariza e empurra pro slot "context summary". É o melhor custo-benefício em chat WhatsApp (sessões duram dias/semanas, não há ctx infinito viável).

**RAG vale a pena?** Só se o catálogo de produtos crescer >500 SKUs ou se houver KB textual (manuais, política). Hoje o `search_products` direto em SQL com filtros categoria + brand é melhor que embedding search (precisão > recall em e-commerce nichado).

**Sliding window vs rolling summary:** sliding window <10 msgs perde contexto em sessões longas (lead volta 3 dias depois). Rolling summary resolve, mas exige 1 chamada LLM extra pra resumir (custo: ~$0.001/turno).

Fontes:
- [LLM Chat History Summarization — Mem0](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) (out/2025)
- [Design Patterns for Long-Term Memory — Serokell](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures) (2025–2026)
- [How Should I Manage Memory for my LLM Chatbot — Vellum](https://www.vellum.ai/blog/how-should-i-manage-memory-for-my-llm-chatbot) (2025)

**Aplicabilidade WhatsPRO:** criar `lead_memory` (facts JSONB) e `conversation_summary` (rolling). Atualizar a cada 10 msgs. Manter SQL search direto pros produtos.

---

## TOP 10 práticas que WhatsPRO ainda NÃO usa — priorizado

1. **`strict: true` + enums em tool schemas** — elimina R125 (args alucinados), praticamente gratuito. Sprint de 2 dias.
2. **Migrar pra gpt-5-mini** — instruction following melhor, structured outputs garantidos, custo igual ao 4.1-mini. 1 linha + smoke test.
3. **Refatorar mega-prompt em blocos XML** (`<persona>`, `<rules>`, `<tools_usage>`, `<examples>`) com regras críticas no fim. Reduz prompt ignorado.
4. **Audit log `ai_agent_audit_log`** com `rules_triggered`, `tools_called`, `tags_applied` — base pra dashboard de compliance e debug de bugs futuros.
5. **Rolling summary `conversation_summary`** atualizado a cada 10 msgs — resolve sessões longas (lead volta dias depois) sem inchar prompt.
6. **Tabela `lead_memory` (facts JSONB)** — nome, interesse, marca, objeção persistidos fora do prompt; reduz tokens e melhora consistência.
7. **Router pattern POC** — gpt-5-nano classifica intent (greeting/qualif/search/handoff) → especialista. Reduz prompt size por specialist e melhora tool selection.
8. **Validação server-side de tool args** (Pydantic-style em TS) **antes** de executar a tool — pega cross-categoria (R126/R133) e args fora de enum.
9. **Guardrails AI / NeMo (camada output)** — substitui guards ad-hoc por declaração YAML, latência aceitável (~100–300ms).
10. **Few-shot examples curados (3–5)** pros cenários mais difíceis (handoff fora horário, recusa marca, cross-categoria). Adicionados no bloco `<examples>` do prompt.

**Bonus:** parallel tool calls onde aplicável (`search_products` + `get_lead_history` simultâneos) — corta ~1s de latência em ~30% dos turnos.
