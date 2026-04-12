---
title: Log Arquivo — Fluxos v3 S6-S11 (2026-04-12)
tags: [log, arquivo, fluxos-v3]
---

# Log Arquivo — Fluxos v3 S6-S11

> Entradas arquivadas de `log.md` em 2026-04-12.

---

### fix(greeting): saudação dupla para leads migrados do ai-agent antigo (commit 460ddd5)

**Sintoma:** Lead "Eduardo" (nome salvo no ai-agent antigo em 01/abr) recebeu "Olá! Bem-vindo a Eletropiso, com quem eu falo?" novamente ao enviar mensagem hoje.

**Causa raiz:**
- ai-agent antigo salvou `lead_profiles.full_name = "Eduardo"` mas NUNCA escreveu `long_memory`
- Orchestrator via Case C: `sessionsCount = 0` (long_memory vazia) + `lead.lead_name = "Eduardo"` → enviava `greeting_message` (template configurado: "Olá! Bem-vindo a Eletropiso, com quem eu falo?") mesmo com nome conhecido

**Fix (greeting.ts):** Cases B e C unificados — se `lead.lead_name` existe (qualquer origem), sempre usa `known_lead_message`. Evita que `greeting_message` (que pode ter "com quem eu falo?") seja enviado a lead já identificado.

**Deploy:** orchestrator ✅

---

### BUG-1+BUG-3+BUG-5 corrigidos + deploy orchestrator + guided-flow-builder

**Commit 46a0a3e — 5 arquivos**

**BUG-1 (validator.ts) — name_frequency_ok não aplicava correção:**
- `checkNameFrequency` calculava `corrected` mas não propagava → retornava issue sem texto corrigido
- Fix: add `corrected_text?: string` em `ValidatorIssue`, `checkNameFrequency` armazena `corrected_text`, `applyCorrection` usa `issue.corrected_text ?? text`

**BUG-3 (process-flow-followups:179) — next_step por posição exata:**
- Buscava `position = currentPosition + 1` → falha silenciosa com gaps
- Fix: `.gt('position', currentPosition).order('position', ascending).limit(1)` → próximo step real

**BUG-5 (guided-flow-builder:88) — .single() em sessão expirada:**
- Fix: `.maybeSingle()` → sessão não encontrada cai no branch "criar nova"

**Deploy:** orchestrator ✅ | guided-flow-builder ✅ | tsc 0 erros ✅

---

### Auditoria S9-S11 + 2 bugs críticos corrigidos

**5 bugs encontrados (2 críticos, 2 médios, 1 baixo):**

**BUG-2 CRÍTICO — `survey.ts`: schema mismatch UI vs backend**
- `StepConfigForm.tsx` salva `{title, options[]}` (flat); `survey.ts` esperava `{questions: SurveyQuestion[]}` → normalizeQuestions() sempre retornava [] → survey completava sem perguntas
- Fix: `normalizeQuestions(config)` converte formato flat para SurveyQuestion[]

**BUG-4 CRÍTICO — `FlowIntelPanel`: top intents e validator stats sempre vazios**
- Buscava `event_type === 'intent_detected'` (nunca logado) e `validator_corrected`/`validator_blocked` (não existem)
- Fix 1: orchestrator loga `intent_detected` após ter o `state.id`
- Fix 2: FlowIntelPanel lê de `validator_flagged` + classifica `issues[].action`

**Arquivos: 3 editados. tsc 0 erros ✅**

---

### S10 COMPLETO — Templates instaláveis + Survey + Followup + Handoff (commit 0d3f228)

**Subagentes backend (3 novos):**
- `subagents/survey.ts`: enquetes /send/menu, fuzzy match, NPS tag, retry/skip, 2 tipos (poll/text)
- `subagents/followup.ts`: agenda follow-up em step_data, escalation levels, farewell imediato
- `subagents/handoff.ts`: 3 níveis briefing (minimal/standard/full), dept/user assign, tags handoff:X

**Cron + Orchestrator:**
- `process-flow-followups`: cron horário, busca flow_states com followup pendente, envia /send/text, executa post_action
- `orchestrator/index.ts`: `sendMenuToLead()` + `sendPollToLead()`; handleMediaSend expandido

**Templates instaláveis:**
- `src/data/flowTemplates.ts`: FlowInstallDefinition + 4 FLOW_INSTALL_DEFINITIONS (vitrine/sdr-bant/suporte/pos-venda)
- `src/hooks/useInstallTemplate.ts`: mutation RPC install_flow_template → UUID do flow
- `FlowTemplatesPage.tsx`: badge verde + botão Instalar + navegação /flows/:id

**Migrations:** `install_flow_template.sql` (RPC atômica) + `20260415000004` (cron registration)

**3 bugs corrigidos na auditoria (S10):** poll duplicado, followup status, migration cron faltando

**Arquivos: 9 novos + 3 editados = 12. tsc 0 erros ✅**

---

### S9 COMPLETO — Validator + Metrics + Shadow

**`services/validator.ts` (NOVO — ~230 linhas):**
- 10 checks sem LLM: size, language, prompt_leak, price, repetition, greeting, name_freq, emoji, markdown, pii
- 3 ações: pass, correct (envia texto corrigido), block (não envia + loga validator_flagged)
- 3 falhas consecutivas → auto handoff

**`services/metrics.ts` (NOVO — ~55 linhas):**
- `createTimer()` → `mark(label)` → `finalize()` → TimerBreakdown + CostBreakdown
- 6 marks no pipeline: intent, resolve, context, subagent, validator, send

**Shadow Mode:** `flows.mode === 'shadow'` → bloqueia sendToLead mas roda pipeline completo

**E2E validado:** normal ✅ | shadow (message_sent=false) ✅ | timing_breakdown no DB ✅

---

### S8 COMPLETO — Sales + Support Subagents (commit 943caff)

**`subagents/sales.ts` (NOVO — 358 linhas):**
- Pipeline 3 camadas: ILIKE → word-by-word AND → fuzzy RPC
- 1 produto + 1 foto → send/media | 1 + 2+ fotos → carousel multi-foto | 2+ → carousel multi-produto
- `products_shown[]` no step_data — não repete produtos já exibidos
- Follow-up LLM leve (~200 tokens); exit rules: max_messages, search_fail >= N → handoff

**`subagents/support.ts` (NOVO — 227 linhas):**
- Word overlap scoring sem pgvector; 3 faixas confiança (>=0.80/0.50/<0.50)
- `unanswered_count` no step_data — 2x sem resposta → handoff

**tsc 0 erros ✅**

---

### S7 COMPLETO — Intent Detector 3 Camadas

**`services/intentDetector.ts` (NOVO — 290 linhas):**
- L1 Normalização (~5ms): 50+ abreviações BR, dedup letras, emoji→sinal
- L2 Fuzzy Match (~12ms): Levenshtein, Soundex PT, dicionário 13 intents × ~15 sinônimos
- L3 LLM Semântico (~200ms): só se L2 confidence < 70, timeout 3s + fallback L2
- 13 intents por prioridade; bypass cancelamento (LGPD opt-out)

**E2E 10 cenários validados: 100% resolvidos em L2 (2-6ms), 0 chamadas LLM ✅**

---

### Fix polls+cors + S6 Qualification Subagent (commits 5f171ea + 18149e0)

**Fix polls:** `/send/poll` → `/send/menu` + renomear campos em 4 arquivos (automationEngine, ai-agent, form-bot, uazapi-proxy)

**S6 Qualification Subagent:**
- `qualification.ts`: 4 tipos MVP (text/boolean/currency_brl/select), smart_fill, retry logic, exit rules
- Salva: `long_memory.profile`, `lead_profiles.custom_fields`, `step_data.qualification_answers`
- `subagents/index.ts`: stub → handler real (S6 ✅)

**Deploy:** orchestrator, ai-agent, form-bot, uazapi-proxy, whatsapp-webhook ✅
