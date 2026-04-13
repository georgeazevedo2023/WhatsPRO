---
title: Log Arquivo — 2026-04-12 Agent + Métricas
tags: [log, arquivo, ai-agent, metricas, clear-context]
updated: 2026-04-13
---

# Log Arquivo — 2026-04-12 (Agent + Métricas)

> Entradas arquivadas de log.md em 2026-04-13 para manter o log principal abaixo de 200 linhas.

---

## 2026-04-12

### fix(ai-agent): ia_cleared usa contagem de msgs desde sessionStartDt — self-healing

**Problema:** mesmo com `lead_msg_count: 0` no frontend, o counter podia estar desatualizado (race condition, cache, código antigo). A primeira mensagem após ia_cleared disparava handoff imediato.

**Fix server-side (deploy):** quando `clearedTags.length > 0`, o ai-agent agora conta mensagens incoming desde `sessionStartDt` em vez do counter acumulado. Isso é auto-corretivo: funciona mesmo que o frontend não tenha resetado o counter. Counter ainda é incrementado (fire-and-forget) para manter rastreamento. R55 documentada.

### fix(leads): clear context não resetava lead_msg_count → handoff imediato na 1ª msg

**Causa raiz real:** `conversations.lead_msg_count` não era resetado pelo clear context. A migration tem comentário "Reset on ia_cleared" mas o reset nunca foi implementado. A primeira mensagem após ia_cleared incrementava o counter que já estava no limite → `increment_lead_msg_count` RPC retornava valor ≥ MAX_LEAD_MESSAGES → handoff disparava antes mesmo do greeting.

**Correção:** adicionado `lead_msg_count: 0` no `conversations.update()` em Leads.tsx e LeadDetail.tsx. R54 documentada.

### fix(leads): clear context não limpava flow_states → greeting skip + handoff duplicado

**Bugs reportados:** após ia_cleared, agente não enviava saudação e disparava handoff duplicado.

**Causa raiz:** `clearContextMutation` não finalizava `flow_states`. Se o lead tinha um estado ativo no orchestrator, a próxima mensagem continuava do passo anterior (já após o greeting), e poderia re-disparar o handoff.

**Correção:** adicionado `UPDATE flow_states SET status='abandoned' WHERE lead_id=X AND status IN ('active','handoff')` em dois locais:
- `src/pages/dashboard/Leads.tsx` (clearContextMutation)
- `src/pages/dashboard/LeadDetail.tsx` (handleClearContext)

Bonus: `Leads.tsx` também não incluía `custom_fields: {}` no upsert do lead_profile (agora incluído, alinhando com LeadDetail.tsx).

**R53 criada:** `clearContextMutation` DEVE finalizar flow_states ao limpar contexto.

### Auditoria do vault + feat inbox_id no FlowWizard

**Auditoria (commits ef466b9 + 64bcfef):**

Gaps detectados e corrigidos:
- `index.md` footer: dizia "S1-S9, próximo S10" → corrigido para "M18 completo 12/12"
- `index.md` seção Fluxos: "design em andamento" → "✅ Shipped 2026-04-12"
- `wiki/modulos.md`: faltavam M14 (Bio Link) e M18 (Fluxos v3.0) — ambos adicionados completos
- `wiki/roadmap.md`: "17 módulos" → "18 módulos"
- `wiki/casos-de-uso/fluxos-detalhado.md`: criado do zero — 18 sub-funcionalidades, fluxo técnico, 12 tabelas, links
- `wiki/fluxos-visao-arquitetura.md`: updated date corrigido para 2026-04-12
- Nota vault antes: 7.7/10 → depois: 9.0/10

**feat: inbox_id no FlowWizard (commit 0a824ba):**

- Migration `20260416000003_add_inbox_id_to_flows.sql`: `ALTER TABLE flows ADD COLUMN inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL`
- `types.ts`: Row/Insert/Update + FK relationship adicionados manualmente
- `FlowWizard.tsx` etapa 1 (Identidade): Select "Caixa de entrada" filtrado pela instância selecionada
- `handleCreate`: passa `inbox_id` (null se "all" ou vazio)
- Resumo etapa 4: exibe inbox selecionada
- `tsc --noEmit = 0 erros ✅`

### discuss: Métricas de Leads — visão, gaps e roadmap

Discussão estruturada sobre coleta de dados do lead em modo IA ligada e shadow. Documentado em `wiki/metricas-leads-visao.md`. Pontos-chave:
- Shadow deve ser "ouvidos abertos, boca fechada" — extrair objeções, concorrentes, intenção de compra, dados pessoais
- Gaps identificados: objeções, concorrentes, ticket médio, horários preferidos, score persistido, motivo de perda
- Plano de implementação: 7 sprints, 55 tasks. Auditado por agente independente → FLAG → corrigido (v2)
- Correções pós-auditoria: FK seller_id, S5 dividido em S5+S6+S7, HIGH RISK+SYNC RULE em S1, cobertura de 22 gaps
- Wikis: `metricas-leads-visao.md` + `metricas-vendedor-visao.md` + `metricas-agente-ia-visao.md` + `metricas-transbordo-visao.md` + `metricas-origem-leads-visao.md` + `metricas-plano-implementacao.md`

### fix(ai-agent): 500 persistente + handoff sem busca + BUSCA IMEDIATA (deploy v159-v161)

**Bug crítico: 500 em TODAS as respostas não-greeting desde que agent_profiles foi ativado.**

**Causa raiz:** `const activeSub` declarado dentro de `if (!profileData)` mas referenciado fora em `response_sent` log → ReferenceError → 500. Catch block tentava logar com `agent_id: null` mas coluna é NOT NULL → INSERT falhava → erro desaparecia sem rastro.

**4 fixes:** Hoist `activeSub` + hoist `_agentId/_convId` + guard `handoff_to_human` + try-catch steps 17-19.

**R58+R59+R60 documentadas. Deploy v159→v161. Testado E2E ✅**

### fix(ai-agent): carrossel não enviado após marca mencionada + tipo_cliente não salvo (commit 9806cde)

**Problema 1 — Carrossel:** handoff_to_human sem chamar search_products quando marca já dada.
**Fix:** 3 regras hardcoded — MARCA JÁ INFORMADA → BUSCA RÁPIDA (máx 2 perguntas) + BUSCA OBRIGATÓRIA ANTES DE HANDOFF + PROFISSÃO DO LEAD → set_tags imediato.

**Problema 2 — tipo_cliente:** não estava em `VALID_KEYS` → tag rejeitada silenciosamente.
**Fix:** `tipo_cliente` adicionado ao `VALID_KEYS`. R56+R57 documentadas. Deploy ai-agent ✅
