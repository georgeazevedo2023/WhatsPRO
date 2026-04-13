---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-13

### feat(m19-s1): Shadow Bilateral — Coleta de Dados do Vendedor (commit 2db9299)

**M19 Sprint 1 — Shadow Inteligente (Coleta)** — 8 tasks, 4 agentes paralelos.

**T1 — shouldTriggerShadowFromWebhook + routing (webhook)**
- Nova função em `aiRuntime.ts`: `fromMe:true` + `status_ia='shadow'` + não-audio + conteúdo ≥5 chars → `true`
- Webhook: após bloco principal, if shadow vendor → chama `ai-agent` diretamente com `shadow_only:true` (sem debounce)

**T2 — Shadow bilateral (ai-agent)**
- Extrai `shadow_only`, `vendor_message` do body. `isShadowVendor = shadow_only === true`
- Contexto das últimas 5 msgs para melhor extração

**T3 — Tags lead expandidas**: `concorrente:*`, `intencao:*`, `motivo_perda:*`, `conversao:*`, `dado_pessoal:*`

**T4 — Tags vendedor**: `vendedor_tom`, `vendedor_desconto`, `vendedor_upsell`, `vendedor_followup`, `vendedor_alternativa`, `venda_status`, `pagamento`

**T5 — extract_shadow_data**: INSERT INTO shadow_extractions (7 dimensões, batch_id por run)

**T6 — isTrivialMessage**: pré-filtro len<5/emoji/trivial → pula LLM + loga shadow_skipped_trivial

**T7 — Logging**: shadow_extraction_lead vs shadow_extraction_vendor com tags_set/is_vendor metadata

**T8 — 22 testes** (7 novos + 15 regressão ✅)

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
  - Desabilitado se nenhuma instância selecionada
  - Limpa automaticamente ao trocar instância
  - Placeholder contextual por estado
  - Padrão = "Todas as caixas" (salva null)
- `handleCreate`: passa `inbox_id` (null se "all" ou vazio)
- Resumo etapa 4: exibe inbox selecionada
- `tsc --noEmit = 0 erros ✅`

**Artefatos pendentes comitados (commit ef466b9):**
- `supabase/migrations/20260415000004_s10_register_flow_followups_cron.sql`
- `supabase/functions/test_e2e_agent.sh`
- `.planning/` (codebase, phases M2, prereqs, research)
- `.claude/skills/ui-ux-pro-max/`
- `wiki/erros-e-licoes.md` R45+R46

---

> KPI fixes, orchestrator fixes, S12 arquivados em:
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`

---

## 2026-04-12

### discuss: Métricas de Leads — visão, gaps e roadmap de apresentação ao gestor

Discussão estruturada sobre coleta de dados do lead em modo IA ligada e shadow. Documentado em `wiki/metricas-leads-visao.md`. Pontos-chave:
- Shadow deve ser "ouvidos abertos, boca fechada" — extrair objeções, concorrentes, intenção de compra, dados pessoais
- Gaps identificados: objeções, concorrentes, ticket médio, horários preferidos, score persistido, motivo de perda
- Conversão: dual — intenção do lead (shadow detecta) + confirmação do vendedor (Kanban/shadow)
- Apresentação: Fase 1 dashboard interno, Fase 2 IA generativa conversacional ("quantos leads do bairro X?")
- Métricas do vendedor documentadas: performance, comercial, qualidade, NPS, ficha individual, dashboard gestor
- Métricas do agente IA documentadas: eficiência, qualidade, follow-up, custo, comparativo IA vs vendedor
- Follow-up adicionado nos 3 lados: lead (onde trava), vendedor (fez ou abandonou?), IA (reativação, cadência)
- Métricas de transbordo e origem documentadas
- Plano de implementação: 7 sprints, 55 tasks. Auditado por agente independente → FLAG → corrigido (v2)
- Correções pós-auditoria: FK seller_id, S5 dividido em S5+S6+S7, HIGH RISK+SYNC RULE em S1, funil de conversão, comparativo IA vs vendedor, metas configuráveis, cobertura de 22 gaps
- Wikis: `metricas-leads-visao.md` + `metricas-vendedor-visao.md` + `metricas-agente-ia-visao.md` + `metricas-transbordo-visao.md` + `metricas-origem-leads-visao.md` + `metricas-plano-implementacao.md`

---

### fix(ai-agent): 500 persistente + handoff sem busca + BUSCA IMEDIATA (deploy v159-v161)

**Bug crítico: 500 em TODAS as respostas não-greeting desde que agent_profiles foi ativado.**

**Causa raiz:** `const activeSub` declarado dentro de `if (!profileData)` (L959) mas referenciado fora em `response_sent` log (L2622). Com profile ativo → ReferenceError → 500. O catch block tentava logar com `agent_id: null` mas coluna é NOT NULL → INSERT falhava → erro desaparecia sem rastro.

**Evidência:** edge function logs: greeting=200, follow-up=500 (100% das vezes). Zero error events no DB (catch silencioso).

**4 fixes implementados:**
1. **Hoist `activeSub`** — `let activeSub: any = null` fora do `if` (L952), atribuição dentro (L965). Elimina ReferenceError
2. **Hoist `_agentId/_convId`** — declarados antes do try (L44-45), catch block usa IDs reais. Erros agora logam no DB
3. **Guard `handoff_to_human`** — verifica se `search_products` foi chamado antes quando há tags `produto:/interesse:/marca_preferida:` (L2280-2290)
4. **Try-catch steps 17-19** — save/update/broadcast wrapped. `response_sent` sempre loga mesmo se DB ops falharem (L2592-2632)

**Regra BUSCA IMEDIATA reescrita (v161):** qualificação de tintas agora PULA para `search_products` quando marca é mencionada. Removida contradição entre "qualifique ambiente primeiro" vs "busca imediata com marca". Regra tem PRIORIDADE ABSOLUTA.

**R58+R59+R60 documentadas. Deploy v159→v161. Testado E2E: greeting ✅, response_sent ✅, search_products com marca ✅**

---

### fix(ai-agent): carrossel não enviado após marca mencionada + tipo_cliente não salvo (commit 9806cde)

**Problema 1 — Carrossel:** lead disse "Tem acrílica da coral?" (marca específica) + respondeu 4 qualificações (ambiente, cor, quantidade, aplicação). Agente fez handoff_to_human **sem chamar search_products**.

**Causa raiz dupla:**
- Regra de qualificação de tintas ("qualifique ambiente → cor → marca") sobrepõe a regra "COM MARCA → busca imediata" — LLM segue o fluxo completo de 4 perguntas mesmo com marca já dada
- handoff_rules default "Lead confirma interesse → handoff" dispara quando lead responde a última pergunta de qualificação, antes da busca

**Fix:** 3 regras hardcoded adicionadas (`index.ts:1054-1056`):
- MARCA JÁ INFORMADA → BUSCA RÁPIDA: máx 2 perguntas → `search_products` imediato
- BUSCA OBRIGATÓRIA ANTES DE HANDOFF: dados suficientes → `search_products` obrigatório antes de handoff
- PROFISSÃO DO LEAD: profissão mencionada → `set_tags(['tipo_cliente:PROFISSAO'])` imediatamente

**Problema 2 — tipo_cliente:** `tipo_cliente` não estava em `VALID_KEYS` do `set_tags` handler → tag rejeitada silenciosamente mesmo que o LLM tentasse salvá-la.

**Fix:** `tipo_cliente` adicionado ao `VALID_KEYS` (`index.ts:1936`). Instrução no prompt garante que a extração ocorra.

**R56+R57 documentadas em erros-e-licoes.md. tsc 0 erros ✅ | 427 testes passando ✅**

**Deploy:** ai-agent ✅ (2026-04-12 — 14 assets, project euljumeflwtljegknawy)

---

> Entradas de sprints S6-S11 (fix greeting, BUG-1/3/5, auditoria S9-S11) arquivadas em:
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`


---

---
---

> Entradas S1-S5 + notas arquivadas em:
> - `wiki/log-arquivo-2026-04-12-fluxos-s4s5.md` (S4/S5/notas)
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md` (S1/S2/S3/G1-G5/DTs)
> - `wiki/log-arquivo-2026-04-11-fluxos-design-b.md` (design anterior)
