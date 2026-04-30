---
title: AI Agent — Fluxo SDR e Modo Sombra (Shadow)
tags: [ai-agent, sdr, qualificacao, service-categories, shadow-mode, stages, score]
sources: [supabase/functions/ai-agent/, supabase/functions/_shared/serviceCategories.ts]
updated: 2026-04-30
parent: [[wiki/casos-de-uso/ai-agent-detalhado]]
---

# AI Agent — Fluxo SDR e Shadow Mode

> Sub-wiki extraído de `ai-agent-detalhado.md` em 2026-04-30. Cobre como o agente qualifica leads (SDR) e como continua extraindo dados após o handoff (Shadow).

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

**Service Categories — funil de qualificação por nicho com stages + score (M19-S10 v2):** Em vez de regras hardcoded, cada agente tem categorias com **etapas (stages)** e **score progressivo** em `ai_agents.service_categories JSONB`. Editáveis pelo admin via tab dedicada **"Qualificação"** (4ª tab). Cada categoria tem regex de match, fields com `score_value` (pontos), e stages com `min_score`/`max_score`/`exit_action` (`search_products` | `enrichment` | `handoff` | `continue`). Conforme o lead responde, soma score → progride entre stages → ao atingir o teto do stage, dispara `exit_action`.

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

**Produtos NÃO vendidos (D28, 2026-04-30):** complementa o SDR — quando lead pergunta sobre produto fora do portfólio (ex: caixa de correio em home center), o agente responde polidamente sem nem entrar no fluxo de qualificação. Ver [[wiki/casos-de-uso/excluded-products-detalhado]].

> **Tecnico:** Config: `max_pre_search_questions` (default 3), `max_enrichment_questions` (default 2), `max_lead_messages` (default 8), `max_qualification_retries` (default 2). Contador atomico: `increment_lead_msg_count` RPC. Service Categories v2: `ai_agents.service_categories JSONB` carregado via `getCategoriesOrDefault()` em `_shared/serviceCategories.ts`. Tipos: `Stage`, `ExitAction`, `QualificationField` (com `score_value`). Match: `matchCategory(interesse, config)` testa regex. Stage atual: `getCurrentStage(score, category)` lê `min_score`/`max_score`. Próxima pergunta: `getNextField(stage, currentTags)` ordena por `priority` e exclui fields já respondidos. Score helpers: `getScoreFromTags(tags)` lê `lead_score:N`; `calculateScoreDelta(beforeTags, afterTags, stages)` soma `score_value` dos fields recém-respondidos. Persistência: handler de `set_tags` em `ai-agent/index.ts` chama RPC `add_lead_score_event` que insere em `lead_score_history` (M19 S2). Score reseta apenas em `ia_cleared:` (R79). **Tab dedicada:** `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx`. **Backward compat:** migration v2 remapeia agentes em produção do schema plano para 3 stages padrão automaticamente.

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

**Bug histórico R85+R86 (2026-04-30):** antes do fix, conversa em SHADOW continuava recebendo `lead_msg_count` increment a cada nova msg do lead, e o auto-handoff por message limit re-disparava enviando "Vou te encaminhar..." múltiplas vezes. Fix: guard `status_ia !== SHADOW` antes do auto-handoff (R85) + reset `lead_msg_count: 0` em todos os 5 paths SHADOW (R86).

> **Tecnico:** Ativacao: todos os handoff types setam `status_ia = STATUS_IA.SHADOW`. Prompt shadow: instrui LLM a extrair via `update_lead_profile` (full_name, city, interests, reason, average_ticket, objections, notes) + `set_tags` (cidade:X, quantidade:Y, orcamento:Z). Protecao nome: shadow prompt diz "ignore non-lead names quando full_name ja existe" — previne "Obrigado Pedro!" (vendedor) sobrescrever nome do lead. Shadow NUNCA envia mensagem ao lead (return silencioso). Debounce continua ativo em shadow (agrupa msgs).

---

## Links

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Índice geral
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — LLM + 9 ferramentas
- [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] — Validator + TTS + Prompt Studio
- [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] — Profiles, NPS, etc.
- [[wiki/casos-de-uso/excluded-products-detalhado]] — D28 (produtos NÃO vendidos)
- [[wiki/decisoes-chave]] — D26 v2 (Service Categories), D28 (Excluded Products)
- [[wiki/erros-e-licoes]] — R79 (score reset), R85, R86, R87
