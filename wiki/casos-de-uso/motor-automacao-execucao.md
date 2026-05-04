---
title: Motor de Automacao — Execucao, NPS e Tratamento de Erros
tags: [automacao, execucao, nps, logging, erros, engine, detalhado]
sources: [supabase/functions/_shared/automationEngine.ts, supabase/functions/form-bot/index.ts, supabase/functions/whatsapp-webhook/index.ts]
updated: 2026-05-04
---

# Motor de Automacao — Execucao, NPS e Erros (4 Sub-Funcionalidades)

> Esta sub-wiki cobre como o motor **roda na pratica**: o fluxo de processamento das regras, onde os gatilhos sao chamados nas edge functions, o caso especial do NPS (que usa funcao dedicada) e o tratamento robusto de erros e logging.
>
> Voltar ao indice: [[wiki/casos-de-uso/motor-automacao-detalhado]]

---

## 9.4 Fluxo de Execucao (Como o Motor Processa)

**O que acontece quando um evento dispara:**

```
1. Evento acontece (ex: formulario concluido)
   ↓
2. Edge function chama executeAutomationRules(funnelId, trigger, data, conversationId)
   ↓
3. Motor carrega TODAS as regras do funil (enabled=true, ordenadas por position)
   ↓
4. Para CADA regra (em ordem):
   ↓
   a) O gatilho bate com o evento?
      Se NAO → pula para proxima regra
      Se SIM ↓
   ↓
   b) A condicao e verdadeira?
      Se NAO → pula para proxima regra
      Se SIM ↓
   ↓
   c) Executa a acao
      → Resultado registrado no log
   ↓
   d) Se deu erro, captura e continua
      → Erro de uma regra NAO para as outras
   ↓
5. Retorna array de logs (1 entrada por regra avaliada)
```

**Regras importantes:**
- Regras executam em **ordem de posicao** (position 0 primeiro, depois 1, 2, etc.)
- Erro em uma regra **nao para** as outras — isolamento total
- Execucao e **fire-and-forget** — nao bloqueia o webhook
- Resultado de cada regra e registrado num log interno

> **Tecnico:** Funcao `executeAutomationRules()` em automationEngine.ts (linhas 87-192). Query: `automation_rules WHERE funnel_id AND enabled=true AND trigger_type ORDER BY position ASC`. Loop for-of com try-catch por regra. Return: `AutomationExecutionLog[]` com {rule_id, rule_name, triggered, condition_passed, action_executed, action_result, error}. Logger: `createLogger('automationEngine', 'engine')` com structured JSON.

---

## 9.7 Onde os Gatilhos Sao Chamados (Edge Functions)

**O que e:** Mapeamento de QUAL edge function chama QUAL gatilho.

| Gatilho | Edge Function | Arquivo | Linha | Status |
|---------|--------------|---------|-------|--------|
| form_completed | form-bot | form-bot/index.ts | 443-463 | ✅ Ativo |
| poll_answered | whatsapp-webhook | whatsapp-webhook/index.ts | 330-344 | ✅ Ativo |
| card_moved | — | — | — | Pendente |
| lead_created | — | — | — | Pendente |
| conversation_resolved | — | — | — | Pendente (NPS usa triggerNpsIfEnabled separado) |
| tag_added | — | — | — | Pendente |
| label_applied | — | — | — | Pendente |

**Nota:** 5 dos 7 gatilhos estao definidos no schema mas ainda sem hook de chamada nas edge functions. Quando implementados, basta adicionar a chamada `executeAutomationRules()` no ponto correto.

> **Tecnico:** form-bot: apos form completion, busca funnel vinculado ao form (`funnels WHERE form_id`), se existe chama engine com fire-and-forget `.catch(() => {})`. webhook poll_update: se `pollMsg.funnel_id` existe, import dinamico do automationEngine e chama com dados do poll.

---

## 9.8 NPS via Motor (triggerNpsIfEnabled)

**O que e:** O NPS (pesquisa de satisfacao pos-atendimento) usa o motor de automacao como infraestrutura mas tem sua propria funcao dedicada `triggerNpsIfEnabled()`.

**Fluxo:**
1. Atendente finaliza ticket (TicketResolutionDrawer)
2. Chama `triggerNpsIfEnabled(conversationId, instanceId)`
3. Funcao verifica: NPS habilitado? Sentimento negativo?
4. Se OK, agenda envio da enquete com delay configuravel (ex: 30 minutos)
5. Apos delay, envia via UAZAPI `/send/menu` com is_nps=true
6. Resposta do lead chega via webhook poll_update
7. Se nota ruim (Ruim/Pessimo), notifica gerentes via tabela notifications

**Guard:** Se conversa tem tag `sentimento:negativo`, NPS NAO e enviado.

> **Tecnico:** Funcao `triggerNpsIfEnabled()` em automationEngine.ts (linhas 565-657). Config: 5 campos em ai_agents (poll_nps_enabled, poll_nps_delay_minutes default 5, poll_nps_question, poll_nps_options JSONB, poll_nps_notify_on_bad). Guard: `tags.some(t => t.includes('sentimento:negativo'))`. Delay: `setTimeout(async () => { ... }, delayMs)`. Poll enviada com `is_nps: true` em poll_messages. Nota ruim: webhook checa `BAD_OPTIONS = ['Ruim','Pessimo','Péssimo']`, se match e notify_on_bad=true, INSERT em notifications para cada gerente da inbox.

---

## 9.9 Tratamento de Erros e Logging

**O que e:** O motor e projetado para **nunca quebrar** — erros em uma regra nao afetam as outras, e nenhum erro bloqueia o webhook.

**3 niveis de protecao:**
1. **Nivel top** — se o motor inteiro falhar ao carregar regras, retorna array vazio e loga erro
2. **Nivel por regra** — cada regra tem try-catch proprio. Erro capturado no log, proxima regra continua
3. **Nivel por acao** — erros de rede (UAZAPI fora) e banco (update falhou) sao logados mas nao propagados

**Principio fail-open:** Se o motor nao entende uma condicao (tipo desconhecido), considera como "verdadeira" e executa a acao. Melhor fazer algo a mais do que perder a acao.

> **Tecnico:** Logger: `createLogger('automationEngine', 'engine')`. Logs structured JSON: level, fn, req, msg, ts + metadata. Top-level: `log.error('executeAutomationRules top-level error')`. Per-rule: `log.error('Rule execution error', {rule_id, rule_name, error})`. Per-action: UAZAPI errors → `log.warn('send_message action: UAZAPI returned error')`, DB errors → `log.warn('move_card action: update failed')`. Testes: 6 testes vitest (empty rules, supabase error, form_completed+always, non-matching config, condition always, multiple rules).

---

## Links Relacionados

- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Indice das 9 sub-funcionalidades
- [[wiki/casos-de-uso/motor-automacao-componentes]] — Gatilhos, condicoes, acoes
- [[wiki/casos-de-uso/motor-automacao-editor]] — Editor visual e CRUD
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Enquetes e NPS em profundidade
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios que disparam form_completed

---

*Rev 1 (2026-05-04): Sub-wiki tematica criada a partir do particionamento de motor-automacao-detalhado.md (regra 14, max 200 linhas).*
