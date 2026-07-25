# WhatsPRO — CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automação. React + Supabase + UAZAPI. Produção: `crm.wsmart.com.br`.

Este arquivo é o **orquestrador** da documentação: lista o que ler em função da tarefa em mãos. Não contém conteúdo — só ponteiros.

---

## 🎯 Andamento do Plano Orquestrador — **✅ 100% CONCLUÍDO (2026-07-25)** (router + 5 specialists = ÚNICO cérebro; monolito APOSENTADO no D6 v7.109.0; memória longa; auditoria de estrutura fechada)

> Objetivo: monolito (1 LLM mega 17 KB) → **router LLM tiny + 5-6 specialists** + camada determinística + memória longa. Atualizado a cada sprint. Detalhe completo: [[wiki/plano-orquestrador-subagentes]] · [[wiki/plano-orquestrador-subagentes-part2]].

| Sprint | Status | Peso | Acumulado |
|---|---|---|---|
| A — Auditoria + gpt-5-mini + I2/I3 + 6 P0 | ✅ Shipped (v7.39.0) | 5% | 5% |
| B1 — Extrai hardcodedRules (-89% prompt) | ✅ Shipped (v7.40.0) | 6% | 11% |
| B1.5 — R135 anti-loop qualif + R136 multi-item | ✅ Shipped (v7.40.1) | 4% | 15% |
| B2 — Strict mode 9 tool schemas | ✅ Shipped (v7.40.2) | 5% | 20% |
| B3 — Reader sub_agents → agent_profiles | ✅ Shipped (v7.40.3) | 5% | 25% |
| B5 Onda 0+1 — extrai loadContextDocuments | ✅ Shipped (v7.40.4) | 5% | 30% |
| B5 Onda 2a — extrai promptSections (puras) | ✅ Shipped (v7.40.5) | 5% | 35% |
| B5 Onda 2b — extrai buildQualificationContext | ✅ Shipped (v7.40.6) | 3% | 38% |
| B5 Onda 2c-i — extrai R136 + R129 short-circuits | ✅ Shipped (v7.40.7) | 3% | 41% |
| B5 Onda 2c-ii — autoExtract + exit_action handoff + R121 inline search | ✅ Shipped (v7.40.8) | 2% | 43% |
| B5 Onda 3a — extrai media tools (send_carousel + send_media + send_poll) | ✅ Shipped (v7.41.0) | 2% | 45% |
| B5 Onda 3b — crmTools (assign_label + move_kanban + update_lead_profile) | ✅ Shipped (v7.41.1) | 1% | 46% |
| B5 Onda 3c — search_products (product_specialist boundary) | ✅ Shipped (v7.41.2) | 3% | 49% |
| B5 Onda 3d — set_tags + handoff_to_human (qualif+handoff specialists) | ✅ Shipped (v7.41.3) | 2% | 51% |
| R137 v1 — searchGuard wire pré-LLM | ❌ Crashed in prod (v7.41.4) → revertido (v7.41.5) | 0% | 51% |
| R138 + R137 v2 — sanitiza query + 6 integration tests reais | ✅ Shipped (v7.41.6) | 1% | 52% |
| **R140-R145** — stack trace + TDZ + chain rica + seed + auto-correct + dedup + doc cleanup | ✅ Shipped (v7.41.7→v7.41.14) | 1% | 53% |
| **B5 Onda 4** — extrai llmCallLoop (setup + while + post-LLM cleanup, -184 lin) | ✅ Shipped (v7.41.15) | 3% | 56% |
| **B5 Onda 5** — extrai dispatchResponse (steps 15.5-22 + final Response, -188 lin) | ✅ Shipped (v7.41.16) | 4% | 60% |
| **Sprint C parcial 1/3** — C1 ai_agent_runs + C3 routing_mode flag + C2 router LLM (gpt-5-nano na época; HOJE gpt-4.1-mini — nano falhava parse JSON, 7 intents, defesa 4 níveis) | ✅ Shipped (v7.42.0) | 3% | **63%** |
| **Sprint C parcial 2/3** — C4 product_specialist + C5 hop guard + wire-in + migração gpt-5-mini | ✅ Shipped (v7.43.0) | 5% | **68%** |
| **Sprint C parcial 3/3** — C6 E2E 7/7 nota 10 + C7 dashboard Roteamento + 2 bugs raiz (gpt-5-mini vazio + objecao→specialist) + canal controle WhatsApp | ✅ Shipped (v7.44.0) | 4% | **72%** |
| **Sprint D código** — specialistBase + 4 specialists dedicados (greeting/qualif/objection/handoff) + dispatch 7 intents + shadow mode + 6/6 E2E nota 10 + 2 bugs raiz | ✅ Shipped (v7.45.0) | 13% | **~85%** |
| **EletropisoV2 → router PROD** + **36 erros TS zerados** (deno check 36→0, type-only) | ✅ Shipped (v7.45.1) | 2% | **~87%** |
| **Sprint E.1** — memória longa por lead (structured-facts: injeção buildLeadMemoryBlock + consolidação fire-and-forget) + E2E returning lead | ✅ Shipped (v7.46.0) | 1% | **~88%** |
| **Saudação/reconhecimento migrados pro router** (greetingPolicy fonte única + bloco determinístico religado no router + productSpecialist tool compartilhada) — fecha defeito #2 paridade | ✅ Shipped (v7.47.0) | 1% | **~89%** |
| **Latência product specialist** — pré-busca determinística (2 rounds→1) + cleanProductQuery; fecha o único 🔴 crítico da auditoria. E2E 3/3 nota 10 (~6s, era 8-16s) | ✅ Shipped (v7.48.0) | 1% | **~90%** |
| **Carousel batching** — "mais opções"/"nenhuma dessas" → lote novo excluindo vistos (shown_product_ids + cap 5 + esgotado gracioso). Premium gap #1. E2E 3 estados nota 10 + 2 bugs raiz | ✅ Shipped (v7.49.0) | 1% | **~91%** |
| **qualificationGate** — fonte única buscar-vs-qualificar (lê stage/score/exit_action); qualify-first consultivo. + fix so_se_pedir cap 8→40 + handoff gpt-4.1 + stripLeakedToolCalls. **E2E prod 10 cenários nota 10** | ✅ Shipped (v7.50.0) | 1% | **~92%** |
| **Sprint E.2 (parte 1) — handoff por ABANDONO** (cron 2min `handoff-abandoned-leads`, 2 estágios cutucada+transbordo, decisão pura testável, RPC scan, reusa primitivas step 22, default OFF) | ✅ Shipped (v7.56.0) | 1% | **~94%** |
| **Onda 2 da auditoria do agente** — validação unificada monolith×router (responseSanitizer fonte única, validator LLM aposentado) + exit_action honrado sob router + HUMANIZATION/INTERNAL_TAG_KEYS únicas + **router pipeline extraído do index (-810 lin, passo do D6)** | ✅ Shipped (v7.89.0) | 1% | **~95%** |
| **Descomissionamento Fluxos v3.0 (M18)** — runtime `orchestrator` (5,3k lin) + fns irmãs (process-flow-followups+cron jobid 32, guided-flow-builder) + UI `/flows` removidos; nunca ativado em prod, superado pelo router; auditado por workflow adversarial (21 agentes, 0 blockers). **−10,4k lin** | ✅ Shipped (v7.90.0) | 1% | **~96%** |
| **`specialist_model` configurável (decisão #4)** — coluna nova (faltava no DB!) + fiação completa no DISPATCH (qualif/produto/objeção/handoff; greeting fica barato gpt-4.1-mini) + seletor na BrainConfig. Behavior-preserving (default gpt-4.1). E2E prod ai-agent **v268** | ✅ Shipped (v7.91.0) | 1% | **~97%** |
| **Auditoria estrutura (workflow 26 agentes, 6.4/10) + 3 riscos críticos FECHADOS** — CI gate (tsc+vitest duros) + escalate auth + SECURITY DEFINER anon 65→16; todos verificados | ✅ Shipped (v7.92.0) | 1% | **~98%** |
| Sprint E.2 (resto) proatividade/follow-ups + E.3 RAG | ⏳ | — | — |
| **D6 aposentar monolito** — caminho monolith removido do index.ts (−659 lin) + routerPipeline sem gate + fallback GRACIOSO (erro → transbordo digno, nunca mais o LLM antigo) + UI/default DB. Evidência: 30d prod, 1.796 runs 100% router, 0 fallbacks. E2E: fluxo feliz + fallback forçado (modelo inválido → transbordo real) validados ao vivo | ✅ Shipped (v7.109.0, ai-agent v277) | 2% | **100%** 🏁 |
| B4 — Varredura R134 idempotência | ⏳ (hardening, não-bloqueador) | 5% | — |
| **Sprint C** — Router + product_specialist POC | ⏳ MARCO | 15% | — |
| **Sprint D** — 5 specialists + migração 100% | ⏳ | 15% | — |
| Sprint E — Memória longa + proatividade + RAG | ⏳ Inteligência avançada | 10% | — |

**Hoje (2026-07-25):** **Relatórios do gestor: v7.106.0 (diário) + semanal one-off + auditoria de marcas + v7.107.0 (fix de raiz).** (1) **v7.106.0 — Resumo do dia pros gestores** (RPC `get_daily_manager_report` jsonb 1-chamada janela SP + formatter puro `_shared/dailyReport.ts` + edge fn `daily-manager-report` verifyCronOrService; contrato de consistência — números FECHAM entre si; E2E 2 amostras ao dono). (2) Dono pediu e recebeu **resumo SEMANAL 20–25/07** (one-off: RPC 6× + agregação; 230 atendimentos, 956 msgs, 45 transbordos mediana 30min ⚠️ 9 sem resposta, 3 vendas; seg 20/07 mediana ~3h52 = pior dia). (3) Questionou "só 1 marca?" → **auditoria profunda**: top_brands contava só `set_tags` do LLM (**1 de ~27 menções reais, 4%** — o detector R115 grava em `conversations.tags`, lugar que a RPC nem lia); **11% das msgs vivem em `transcription`** (áudio/foto; foto = 1/3 das menções de marca, describe-image lê embalagem); dicionário sem NENHUMA cerâmica; e causa de fundo comportamental: ~10% das conversas citam marca (estável 4 semanas) — cliente compra por categoria+cor+preço. (4) **v7.107.0 fix:** RPC v3 varre `content`+`transcription` com `p_brands` (fonte única `DEFAULT_BRANDS` TS; fallback legado null-safe), lista +25 marcas (cerâmicas+regionais; SEM Elizabeth/Karina — nome de pessoa), `brandDisplay`, limit 10; smoke 6 dias (27 vs 1) + E2E real ao dono ("Brasilit (2) · Incenor (2)…"). (5) **v7.108.0 — formato RICO aprovado como padrão diário + cron AGENDADO**: dono aprovou o semanal rico ("esse será o padrão relatório diário, pro meu número") → RPC v4 (`prev` mesmo-dia-semana-anterior, `category_mentions` via `p_categories`, `human_panel_msgs`, `nps_sent`) + formatter rico (deltas ▲/▼, ↳, ⚠️ 5 regras de atenção determinísticas; campos opcionais = layout legado preservado) + `to_phone` fixo na edge fn + **cron dom-sex 18h30 SP e sáb 12h30 SP** (`daily-manager-report-eletropisov2[-sab]`, to_phone 5581993856099). E2E idêntico ao cron: relatório de hoje entregue ("24 ▲20% (sáb ant.: 20)"). tsc/deno 0 · vitest **2017/0** · types regen. Deploy: 5 migrations + edge fn (scoop). **Pendências:** gestores sem `personal_whatsapp` (aí remover `to_phone` do cron → lista de gestores); config/UI toggle+horário por agente; monitorar falsos-positivos da lista de marcas no gatilho R137; brand-filter na qualificação (backlog); rotacionar senha+PAT. Detalhe: memória `project_daily_manager_report_v7106`. (6) **D6 EXECUTADO (v7.109.0, ai-agent v277)** — monolito APOSENTADO: index.ts 3.440→2.781 lin (−659), `contextDocuments.ts` deletado, routerPipeline sem gate/shadow, **fallback gracioso** (erro do pipeline → msg de handoff + fila + shadow + nota; provado ao vivo com modelo inválido → transbordo real, log `router_fallback`), UI sem seletor, default DB `router`, load do knowledge removido (−1 query/turno). E2E fluxo feliz no EletropisoV2 (router produto 0.95 → qualification specialist, dedup external_id segurou entrega dupla do n8n). vitest 1995/0 · deno ai-agent 0 · tsc 0. **Achados D6:** FAQ/knowledge SÓ alimentava o monolito → specialists nunca receberam (religar = follow-up); n8n com lag ~3min na ingestão (sáb à noite); número do Sandbox hospeda outro bot ("Tamandaré") → E2E via sandbox-emissor gera loop bot×bot, usar injeção direta no webhook; deno debt pré-existente playground/debounce (TS2589, provado no HEAD); órfãos parciais em _shared (preLLMShortCircuits/exitActionDispatcher/promptSections/buildPromptRulesString) pra varrer depois. **PLANO ORQUESTRADOR 100%** 🏁

**(histórico) 2026-07-09:** **2 auditorias com fix de raiz + deploy (v7.104.0 frontend LIVE + v7.105.0 ai-agent v276).** (1) **v7.104.0 — 2 erros de console da Fila (`/dashboard/fila`).** O `ERR_NAME_NOT_RESOLVED` (`...at.desc&limit=20`) era **DNS transitório do cliente** (não-código, recarregou OK), mas expôs o achado grave: a aba "Sem atend." mostrava **"Nenhum lead esperando 🎉"** quando a query FALHAVA (`data=undefined→[]`, nenhum hook lia `isError`) → enganava o gestor. E o `DialogContent requires a DialogTitle` vinha do **`CommandDialog`** (sem título) montado em TODA rota via `GlobalSearchDialog`. **6 fixes frontend** (verificação adversarial por workflow): resiliência da Fila (`isError`+card de erro+retry, badge "!", sem skeleton infinito), **`QueryCache({onError})` global**, `DialogTitle`/`DialogDescription` sr-only no CommandDialog+SendStatusModal, NotificationBell consome `error`, e removido o hack `aria-describedby:undefined` de `dialog.tsx` (quebrava a11y dos 26 dialogs COM Description; dist Radix 1.1.14) + **workflow de 8 agentes cobriu os ~21 sem descrição → 54:54** `DialogContent`↔`DialogDescription`. Bônus: corrigido **flaky de fuso** `dateUtils.test.ts` (quebrou o quality-gate às 01:38 UTC — teste montava "ontem" no fuso do runner; fix `vi.setSystemTime`). Deploy LIVE (commits `a6f5460`+`bbe6a30`+`1384d43`; bundle `index-MiQmLCbH.js` verificado com markers `query-error`/`Falha ao carregar dados`). (2) **v7.105.0 — foto de torneira virava "cano".** Lead (Erika, EletropisoV2 PROD) mandou **foto de torneira gourmet** + "Qual o valor"; IA perguntou *"o cano é para água ou esgoto?"* e insistiu após "não é cano não". A **VISÃO FUNCIONOU** (`describe-image` descreveu "torneira preta para cozinha com cano flexível"; router acertou conf 0.9) — não é falta de transcrição. Causa: sob `routing_mode='router'` o **R129 (desambiguação) é pulado** (`index.ts:2597`) mas o **auto-seed R143 travava a 1ª categoria da ordem** (`matchCategoryBySearchText`) → "cano flexível" fez `canos` (ord 12) ganhar de `torneiras` (ord 13) → field `tipo_cano` (examples "esgoto ou água"). Fix (dono via AskUserQuestion: **confirmar com o lead**): `preLLMAutoExtract.ts` semeia **`multi_interesse_pending`** em multi-match (`matchAllCategoriesBySearchText`≥2) → specialist pergunta "torneira ou cano?" (infra `qualificationContext` R129/R134, já roda sob router). Monolith intocado. +5 testes. Deploy **ai-agent v276** (commit `6597104`, CLI scoop). tsc/deno 0 · vitest **1995/0**. **Pendências:** ⏳ validar E2E ambos (offline na Fila mostra card de erro / foto de torneira pergunta "torneira ou cano?"); ⚠️ monitorar falsos-positivos da desambiguação (EletropisoV2 nunca teve R129 → qualquer texto 2-categoria pergunta, ex. "porta com fechadura"); rotacionar senha+PAT; gestores sem `personal_whatsapp`; D6 monolito LIBERADO. Detalhe: memórias `project_session_2026_07_06_dialog_a11y_queue_resilience` + `project_torneira_cano_multicat_v7105`.

**(histórico) 2026-07-02:** **🔴→🟢 OUTAGE de egress → upgrade PRO → dieta + 2 fixes de raiz + PRD.** (1) Projeto restrito por `exceed_egress_quota` (Free, **8,42/5 GB**; 402 em TUDO de 01/07 19:15 a 02/07 10:57 BRT — msgs de leads perdidas na janela). Dono fez **upgrade PRO** ($25, spend cap ON, ciclo agora dia 2). Breakdown (dashboard logado): dia normal = **PostgREST 73%** + Storage 26%. (2) **v7.101.1** — `escalate-stale-handoffs` quebrado desde 07/05 (`conversations.contact_name` INEXISTENTE): **alerta de lead órfão ao gestor nunca disparou** + 1,3k rows em loop eterno; fix embed+`settle()`+backfill, verificado (run 4s→0,5s). + HIBP ligado. (3) **v7.102.0 dieta**: cache config agente + painel Fila não refaz RPC em background + carrossel sobe 1x; types.ts regen destravou healthcheck vermelho desde 25/06. (4) **v7.103.0**: cache **48h com sonda** `updated_at` (~100 B/turno, config propaga no turno seguinte; trigger novo no knowledge) + **faxineiro cron 48h** `purge_stale_operational_data` (1ª exec: 2.301 logs) + cleanup cobre carousel-images. ai-agent **v275**. (5) **PRD-modelo do Disparador** (`docs/prd-modelo-disparador.md`, com §carrossel). vitest **1990/0**. **Régua volta ao Free: egress <~115 MB/dia por 1 ciclo.** Pendências: rotacionar senha dashboard+PAT; gestores sem `personal_whatsapp` (bloqueia NPS + escalação); **D6 monolito LIBERADO** (gate ~23/06 passou); varredura `.select()`×schema das edge fns. Detalhe: memória `project_session_2026_07_02_handoff`.

**(histórico) 2026-06-26:** **v7.98.0 — contato compartilhado (vCard) → saudação + transbordo.** Queixa do dono (print): lead mandou um CONTATO ("Fernando Amaral Caprice") e a IA tratou o NOME como consulta de produto (*"Esse não é o nosso forte aqui…"*). Causa-raiz: o webhook salva contato como `media_type='contact'` com o **displayName como `content`** → o ai-agent consumia o nome como `incomingText`; não havia tratamento de vCard. Fix (decisões do dono via AskUserQuestion: **GLOBAL** + **sempre que houver contato**): short-circuit determinístico pré-LLM em `_shared/agent/contactShareHandoff.ts` — detecta `media_type==='contact'` no turno → saudação por horário (fuso SP) + *"Obrigado pelo contato. Só um instante que estou te encaminhando para um de nossos atendentes."* + transbordo reusando o caminho do `sale_closed` (`runQueueAssignment`→fila+notify-vendor+SHADOW+tags+nota interna). Roda antes de greeting/produto/excluídos; pula em shadow. +11 testes; tsc 0 · deno 0 · vitest **1976/0**. Deploy: ai-agent **v272**. **⚠️ Pendência:** validar E2E (dono enviar um contato no WhatsApp). Detalhe: memória `project_contact_share_handoff_v798`. **Próximo:** D6 monolito; gestor cadastrar `personal_whatsapp` (NPS); lint debt.

**(histórico) 2026-06-25:** sessão ultracode (workflows) — **4 releases**. (1) **v7.96.0 `except_keywords`** — a mangueira da máquina de lavar parou de ser recusada (queixa do dono): keyword `máquina de lavar` do `excluded_products` casava whole-word DENTRO de "mangueira de saída de água da máquina de lavar" → recusa PRÉ-LLM. Fix: campo `except_keywords[]` suprime a recusa quando o lead cita acessório que vendemos. ai-agent **v270** + config 3 agentes + UI. (2) **v7.96.1 sanitizer hardening** — fecha 2 folgas (texto <15 chars pulava validação; `NEGATIVE_PHRASES` lista finita → camada regex). ai-agent **v271**. (3) **v7.97.0 NPS-on-finalize** (feature grande, workflow 9 agentes) — a infra de NPS estava MORTA (job_queue sem worker); reconstruída: ao Finalizar → enquete ao lead; nota baixa → alerta gestor (WhatsApp+painel, nome/número/atendente/resumo). Novas edge fns `send-nps-poll`+`notify-manager-nps`, webhook **v19** (parseia score, NÃO acorda IA no voto, dispara alerta), dashboard 0-10 + breakdown por atendente (RPC), migration `20260625130000`. (4) **v7.97.1** — teste real no WhatsApp do dono validou + pegou 2 bugs (conversations sem `instance_id`→via inbox; UAZAPI `messageid` curto≠`id` composto), corrigidos; 0-10 era longo → **escala curta "1-Bom/2-Regular/3-Ruim"** com scoring por palavra-chave (Bom→8/Regular→5/Ruim→2), só "Ruim" alerta. tsc 0 · vitest **1965/0** · deno 0. NPS ligado EletropisoV2+Sandbox. **⚠️ Pendência:** nenhum gestor tem `personal_whatsapp` → alerta WhatsApp só cai no painel até cadastrar; falta o dono VOTAR na enquete de teste pra validar E2E. **Próximo:** D6 monolito (>30d do router → liberado pra fechar); lint debt (any/exhaustive-deps); particionar log.md. Detalhe: memória `project_session_2026_06_25_handoff`.

**(histórico) 2026-06-17:** **Trava de atendimento humano (v7.94.0)** + gestor pausa/despausa atendentes (v7.93.0). (A) **v7.94.0** — auditoria por workflow (10 agentes, verificação adversarial em prod) de 2 queixas do dono: lead atendido pela Jussara ia pra Djavan (8 atendentes em ~75min) e a IA seguia respondendo durante atendimento humano. **3 causas-raiz:** `detectResponded` (requeue Case C) só vê resposta com `sender_id` → vendedor responde pelo CELULAR (`sender_id` NULL) = invisível → rotaciona a cada 10min até o teto 22 (filtro R116); sem estado durável "em atendimento"; reabertura stripa tags + religa `'ligada'` → ~150 `ai_agent`/3d durante atendimento humano. **Fix = 1 fonte de verdade durável `conversations.human_handling_at`**, setada no 1º reply do vendedor (celular: webhook `shouldLockHumanHandling`=`fromMe&&!wasSentByApi`, sinal confiável — NÃO `external_id` que colide com eco de API). Enquanto travada: fila NÃO rotaciona (`assignHandoff` early-return + `requeue`/`escalate` selam) e IA fica shadow (gate novo no `ai-agent` antes do tag-gate); só Finalizar/Ativar IA/limpar-contexto liberam (congela indefinidamente, sem rede — decisão do dono). Manager reassign manual bypassa. tsc 0 · vitest **1926/0** · deno 6 fns 0. Deploy: migration `20260617120000` + 6 edge fns scoop (ai-agent v269, webhook v18, requeue v11, assign-handoff v8, escalate v4, abandon v7) + frontend `fa8da44`→CI. Backfill: 11 leads em rotação travados (0 ativos depois). Verificação viva: 0 vazamento RULE 1/RULE 2. Detalhe: memória `project_human_handling_lock_v794`. (B) **v7.93.0** — gestor pausa/despausa por atendente (RPC `set_queue_paused_for_user` escopada por instância) + esconde gestores da lista. **Próximo (backlog auditoria, ver auditoria de pendências 2026-06-17): D6 monolith (gate ~23/06), no-explicit-any/exhaustive-deps (lint), god files. ✅ 06-18/20 fechados: hardening search_path (16 fns), sync doc-drift, auditoria de crons (cron morto 13 desagendado + cadência), **schema órfão Fluxos v3.0 DROPADO** (`20260619110935`) + `types.ts` regen, **RLS anon-read fechado** (`20260619225438`), **imports não usados zerados** (lint 107→47), **5 wikis ai-agent reescritos** (router+specialists, grounded no código).**

**(histórico) 2026-06-14:** **Auditoria de estruturação (workflow 26 agentes, 8 dimensões, nota 6.4/10) + os 3 riscos críticos FECHADOS (v7.92.0).** (1) **Gate de CI** — job `quality-gate` com `needs:` no build: `tsc`+`vitest` DUROS (barra do RULES.md "0 erros TS + 100% testes"); `eslint` informativo (`continue-on-error` — 218 erros src/ pré-existentes = dívida separada; ignora `supabase/functions` Deno). 5 testes stale corrigidos → 1905✓/0. **Bloqueio PROVADO** (run falha→build skipped; run verde→build+deploy). (2) **`escalate-stale-handoffs` sem auth** — add `verifyCronOrService` (era público, disparava WhatsApp a vendedores/gerentes); verificado em prod: cron→200, bogus→401. (3) **65 SECURITY DEFINER anon** — migration cirúrgica `REVOKE EXECUTE FROM PUBLIC` (grupo A 40 dash/dashboard/agente mantém auth+service; grupo B 9 cron só service; **intocados** RLS helpers/triggers/`increment_bio_*`); advisor anon **65→16** + `has_function_privilege` confirma. Achado: `apply_retention_policy` é da UI → grupo A. Relatório: [[wiki/auditoria-estrutura-2026-06-14]]; detalhe: memória `project_audit_3_risks_fixed_v792`. **Próximo (backlog auditoria): lint debt 218, schema órfão Fluxos v3.0, docs 2º nível stale, god files, D6 monolith (gate ~23/06).**

**(histórico) 2026-06-13:** **Descomissionamento do Fluxos v3.0 / `orchestrator` (v7.90.0)** — sessão ultracode. O `orchestrator/` era o runtime INTEIRO dos Fluxos v3.0 (M18, 5,3k lin/19 arq), nunca ativado em prod (`use_orchestrator=false` em tudo + 0 flow_states históricos), superado pelo **router do ai-agent**. Removido por completo (decisão de produto do dono, via AskUserQuestion): backend (`orchestrator/` + roteamento condicional do webhook → sempre `ai-agent-debounce`) + irmãos do M18 pegos no audit (`process-flow-followups`+cron jobid 32, `guided-flow-builder`) + UI dos Fluxos (`/flows`, toggle, hooks, páginas). **−10,4k lin em 3 commits.** **Workflow adversarial (21 agentes, 5 dimensões, 0 blockers)** validou a remoção e MEDIU o carrossel em prod (premissa de backlog "~4s serial" = **misdiagnose**: é 1 chamada HTTP; o delta de ~2,5s/turno é o round do LLM, não o envio → item arquivado). Deploy: migration unschedule (cron jobid 32=0), webhook **v17**, 3 fns deletadas de prod, frontend push→CI→Portainer. tsc/deno/build 0. **Na sequência (mesma sessão):** (a) **faxina de testes** — 8 suítes Deno-native convertidas pra vitest (+66 testes antes cegos) + 14 asserts stale alinhados à humanização v7.57.3 (com verificação de segurança caso a caso) → suíte fails **19→5** (só restam FormBuilder/useForms forms/DOM); (b) **3 das 5 decisões de config do dono executadas** — removidos da UI os campos MORTOS `validator_*` (#1), `extraction_address_enabled` (#3) e `openai_api_key` por agente (#2), todos verificados sem leitor no backend (DB inerte). **Depois (mesma sessão): decisão #4 `specialist_model` FECHADA (v7.91.0)** — achado que a coluna NUNCA existiu no DB (handoff dizia "backend já lê", mas só `produto` recebia o config); criada migration + fiação completa no DISPATCH (qualif/produto/objeção/handoff via `const specialistModel`; greeting fica no gpt-4.1-mini barato) + seletor na BrainConfig; behavior-preserving (default gpt-4.1); E2E prod ai-agent **v268** (qualification specialist coerente, zero erro). **#5 Televendas RESOLVIDA** (dono confirmou via AskUserQuestion: é gestor de verdade → fica `gerente`, fora do rodízio de leads; **sem mudança**). Com isso as 5 decisões de config estão fechadas. **Próximo: monolith D6 (gate ~23/06); follow-up opcional drop do schema inerte; arquivar entrada HEIC do CHANGELOG (292 lin) + particionar log.md (~230 lin).** Detalhe: memória `project_session_2026_06_13_handoff`.

**(histórico) 2026-06-12 (cont.):** **Onda 2 da auditoria EXECUTADA (v7.89.0, ai-agent v267)** — 5 itens em commits atômicos: validação unificada monolith×router (`responseSanitizer.ts` fonte única; validator LLM aposentado do hot path), exit_action=handoff honrado sob router (handoff_specialist forçado + diretiva no prompt + backstop step 22), HUMANIZATION_RULES e INTERNAL_TAG_KEYS fontes únicas, **router pipeline extraído pra `routerPipeline.ts`** (index.ts 4152→3344 lin, passo do D6). Bônus: `productSpecialist.test` desmascarado (não carregava há meses por import https; lição em erros-e-licoes). Smoke E2E real sandbox v267 ✓ (determinístico qualify-first + LLM specialists + handoff rico + fila D-β). **Próximo: Onda 3/D6 (aposentar monolith + deletar orchestrator/ morto + paralelizar carrossel ~4s).** Pendências de DECISÃO do dono: **validator_enabled/validator_model/validator_rigor sem leitor (remover da UI?)**, openai_api_key por agente, extraction_address_enabled, specialist_model na UI, Televendas com role gerente. Sessão anterior (v7.85→v7.88): telefone na lista + fix "Garagem", vaga de emprego, gestores fora do Reatribuir, auditoria 8/10 + Onda 1. Detalhe: memória `project_session_2026_06_12_handoff`.

**(histórico) 2026-05-26 (noite):** **Sprint E.2 parte 1 — handoff por ABANDONO (v7.56.0)** — fecha o último buraco funcional do transbordo. No fluxo offline/sem-resultado a IA grava `seller_handoff_pending`, faz 1 pergunta (marca) e espera o PRÓXIMO turno pra forçar o handoff; se o lead some, a conversa pendurava pra sempre. Solução em **2 estágios** (cron dedicado `handoff-abandoned-leads`, 2min): (1) cutucada após N min sem resposta (*"{Nome}, ainda tá por aí? 😊…"*, marca `abandon_nudged:{ms}`); (2) transbordo após M min da cutucada (fila + nota interna com resumo). Lead responde a qualquer hora → pré-router existente resolve. **Zero gambiarra:** reusa as MESMAS primitivas do `dispatchResponse` step 22, NÃO toca `ai-agent/index.ts`. Decisão pura em `_shared/agent/abandonHandoff.ts` (19 testes); scan num RPC; 4 cols config default OFF + UI `AbandonHandoffConfig` + SYNC RULE. **E2E real sandbox:** RPC inclusão=1 + 5 guards zeram; estágio 2 disparado ao vivo → `status_ia=shadow` + tags limpas + nota interna + log `{abandoned:true}` (sem mensagear vendedor). tsc/deno 0, PROD intocada (feature OFF). Antes disso, na mesma sessão: humanizei o `handoff_message` do EletropisoV2 (config). Detalhe: [[project_sprint_e2_abandon_handoff]]. **Pendência: ligar a feature no EletropisoV2 (config, com OK do dono) + monitorar.**

**(histórico) 2026-05-26 (tarde):** **"Catálogo é minoria" (v7.55.0)** — fecha 2 bugs auditados. (1) IA dizia "não encontrei a caixa-d'água de 1000L" violando regra de negócio (catálogo cadastrado é MINORIA; maioria é estoque físico). 3 causas-raiz: validador determinístico estava telemetria-only; **caminho do router não passava por validador nenhum** (specialist retornava antes do bloco do monolith); PATH C induzia moldura errada. Fix: validador religado+enforcement no `specialistBase` (sanitiza negação/erro/leak) + `NO_DENIAL_RULE` no `searchProducts` + regras 4/7 do product specialist. (2) **Handoff determinístico p/ item ausente** (gap exposto no E2E: sob router a conversa fragmentava entre specialists e nunca transbordava): `seller_handoff_pending` → pré-router força handoff + `pendingHandoffTrigger` → `dispatchResponse` step 22 EXECUTA (fila+shadow+msg). (3) skeleton infinito (sessão zumbi): `ChatPanel` Promise.race + `AuthContext.getSession` timeout. E2E real validado (handoff executa, "não encontrei" eliminado em 8 turnos). deno 0, 423 testes agente, deploy CLI. Detalhe: [[project_catalog_minority_handoff_v755]]. **Pendência: brand-filter na qualificação (busca mostrou Coral p/ pedido Suvinil).**

**(histórico) 2026-05-24 (noite V):** **Transbordo personalizado #4 + anti-repetição de nome (v7.51.0)** — fecha o backlog #4 e o feedback do dono ("o nome repete em toda mensagem"). `personalizeHandoffMessage` prefixa o transbordo com "{Nome}, anotei seu pedido: {item}." (8 paths de handoff, `cleanHandoffItem` extrai só a parte legível do reason). `buildNameUsageDirective` (determinístico): suprime o nome no prompt do specialist se usado nas últimas 2 msgs do bot → nome **7/9 → 1/5**. `stripLeakedToolCalls` agora pega `functions.NOME` bare. **E2E real prod nota 10** (fluxo lâmpada completo no sandbox router + EletropisoV2 validado pelo dono: "George, anotei seu pedido: 1 lâmpada LED amarela 12W…"). 930 testes (4 fails pré-existentes), deno 0, ~6 deploys. Achados anotados: double-ask de nome no 1º turno; 1-produto-multi-imagem vira carrossel. Andamento **~93%**.

**(histórico)** **2026-05-24 (noite III):** **qualificationGate (v7.50.0)** — fecha o último 🔴 arquitetural: "buscar vs qualificar" sai de 4 decisores rivais pra **1 fonte única** (`_shared/agent/qualificationGate.ts`, lê stage/score/exit_action). Wire no dispatch do router: para `produto`/`qualificacao` o gate é autoridade (`qualify`→qualification_specialist, `search`→product_specialist honrando exit_action, `offline`→product+handoff). **Fluxo consultivo qualify-first agora real:** "tem tinta?" → qualifica (ambiente→tipo→cor, 3 perguntas) → score 40 → carrossel. **2 bugs de raiz achados no E2E:** (1) `so_se_pedir` cortava em 8 msgs (contradição do contrato; → 40); (2) handoff specialist gpt-4.1-mini vazava tool call como texto (→ gpt-4.1 + `stripLeakedToolCalls`). **E2E real prod 10 cenários nota 10** (novo/recorrente, dá/não dá nome, catálogo/offline/inexistente, qualif contada, handoff rico, msg transbordo, fila round-robin). 1404 testes verdes, deno 0, 5 deploys CLI. Andamento **~92%**. Backlog premium: #2 cart engine, #3 refino-por-contagem, #4 modo consultivo, #5 busca facetada.

**(histórico)** **2026-05-24 (tarde III):** **Latência do product specialist resolvida na fonte (v7.48.0).** Auditoria profunda dos objetivos (nota AI Agent: antes 5.7 → hoje **~8.3**; arquitetura-alvo atingida em prod). O único 🔴 crítico era a latência do product specialist (~8-16s em turnos com busca). Causa raiz medida nos `ai_agent_runs`: **2 rounds de LLM** (decidir buscar → compor) porque o pré-search inline (R121/R137) foi desligado sob router. **Fix de raiz (sem gambiarra):** re-liga o pré-search só pro product specialist (`deriveProductSearchParams`+`runInlineSearchProducts`+`preSearchContext` → 1 round); anti-duplo-carrossel via `carouselSentInThisCall`; `cleanProductQuery` evita 0-resultados por ruído ("vocês têm"). **E2E real sandbox router 3/3 nota 10** (~6s/turno, 1 search, 1 round, 1 carrossel, respostas consultivas). 362 testes verdes, deno 0, deploy CLI. Andamento **~90%**. Próximo gargalo (futuro, maior risco): paralelizar envio do carrossel UAZAPI (~4s serial).

**(histórico)** **2026-05-24 (tarde):** Auditoria de início de sessão pegou 2 problemas reais. **(1)** `.git/index` corrompido (assinatura `0x00000000`, escrita interrompida no "restart limpo") + `.git/index.lock` órfão → git inoperante; reconstruído do HEAD sem perder árvore de trabalho (backup em `.git/index.corrupt.bak`). **(2)** **v7.47.0 era release fantasma** — codada, deployada na prod (EletropisoV2) e documentada em CHANGELOG/log, mas NUNCA commitada (a corrupção do índice engoliu o commit). Validada commitável (deno check 0 erros) e **commitada agora** + CLAUDE.md atualizado. v7.47.0: saudação/reconhecimento migrados pro router (`greetingPolicy.ts` fonte única `classifyLeadRecency`+`buildOpeningDirective`; bloco de saudação determinístico RELIGADO no router pro 1º contato; productSpecialist usa tool compartilhada ganhando full_name+city) — fecha defeito #2 da auditoria de paridade. **ARQUITETURA ALVO ATINGIDA: orquestrador (router) + 5 subagentes (specialists) + tools com prompts específicos + memória longa + audit log (ai_agent_runs) + dashboard.** Andamento **~89%**. **Próximo: Sprint E.2 (proatividade/follow-ups) OU E.3 (RAG); monitorar EletropisoV2 router em prod; D6 aposentar monolito após 30d.**

**(histórico)** **2026-05-24 (madrugada):** Sessão grande via canal de controle WhatsApp. **(1)** Sprint D fechado (router + 5 specialists dedicados + shadow, 6/6 E2E). **(2)** EletropisoV2 migrado p/ `router` em **PROD** (rollback=monolith). **(3)** **36 erros TS do ai-agent zerados** (deno check 36→0, type-only). **(4)** **Sprint E.1 — memória longa por lead** (v7.46.0): structured-facts (não vector), `buildLeadMemoryBlock` injetado + `consolidateLeadMemory` fire-and-forget; E2E returning lead OK ("Claro que lembro! Você estava vendo tintas, quer continuar?"). Andamento **~88%**.

**(histórico)** **2026-05-24 (noite):** Sprint D código FECHADO (v7.45.0). Router despacha **7 intents pra specialists dedicados** (greeting/qualification/product/objection/handoff); monolito vira fallback de erro. `specialistBase.ts` (contrato único, productSpecialist refatorado) + 4 specialists novos + shadow mode + dispatch table. **E2E real 6/6 nota 10** (sandbox router, via canal de controle WhatsApp): saudacao/nome/produto/objeção/handoff/pagamento, router conf 0.9-1.0. 2 bugs raiz achados no E2E e corrigidos (nome via update_lead_profile; regra universal de texto). 350 testes agent verdes, zero erro TS novo. Tudo atrás de flag — **prod intocada, migração STAGED** (não flipei default). Andamento 72%→**~85%**. **Próxima: shadow mode em agent real alguns dias → migrar EletropisoV2 p/ router (com go-ahead) → D6 aposentar monolito após 30d.** Pendência: 36 erros TS pré-existentes (hardening separado).

**(histórico)** **2026-05-24 (tarde):** Sprint C FECHADO (parcial 3/3, v7.44.0). C6 — 7 cenários E2E reais nota 10 (lead Testador→Eletropiso router, enviados ao operador via WhatsApp). C7 — dashboard "Roteamento" (RPC + AdminRouting.tsx). 2 bugs de raiz: gpt-5-mini devolvia resposta vazia (afeta EletropisoV2 PROD; fix piso 4096 reasoning + monolith→gpt-4.1-mini) e objeção atropelada por qualificação (objecao→specialist + regra 10). Canal de controle WhatsApp criado (e2e-control-webhook + e2e_control_inbox; achado: UAZAPI manda remetente como @lid, real em sender_pn). Andamento 68%→**72%**. **Próxima: Sprint D — qualification/handoff/objection/greeting specialists dedicados + migração routing_mode='router' default.** Pendência PROD: EletropisoV2 deve migrar p/ gpt-4.1-mini.

**(histórico)** Sprint C parcial 2/3 (v7.43.0) — primeiro specialist em prod. Sessão produziu 3 releases: v7.42.0 (foundations DB+router) → v7.42.1 (hardening pós-auditoria: Bug #1 fechado isReasoningModel + UI flag + 2 testes router) → v7.43.0 (product_specialist + hopGuard + wire-in). EletropisoV2 migrado pra gpt-5-mini. ai-agent v101→v102→v103→**v104 ACTIVE**. Wire-in atrás de flag `routing_mode='router'` (default monolith, prod intocada). Apenas intent='produto' tem specialist; outras 6 fazem fallback monolith. Vitest 1282 pass / 9 fails pré-existentes. Andamento: 60% → **68%**. **Próxima sessão: validar E2E ativando routing_mode='router' em 1 agent + C6 sandbox testing + C7 dashboard Roteamento.**

**Métricas-alvo 90 dias:** prompt <8 KB (hoje 17 KB) · incidentes/14d <3 (hoje ~10) · router + 5 specialists · debug claro ("specialist X falhou na intent Y") · memória longa por lead.

---

## 🚦 Roteamento por contexto da tarefa

| Tarefa | Leia ANTES de codar |
|---|---|
| **Qualquer tarefa** (início de sessão) | `index.md` → [[wiki/roadmap]] → [[wiki/erros-e-licoes]] → `log.md` (últimas 5 entradas) → [[wiki/decisoes-chave]] |
| **Bug fix qualquer área** | [[wiki/erros-e-licoes]] PRIMEIRO + [[wiki/erros/regras-preventivas]] |
| **Nova feature do Helpdesk** | [[wiki/modulos]] (seção M2) + [[wiki/audio-pipeline]] + `PATTERNS.md` |
| **Nova feature do AI Agent** | `RULES.md` (sequência correção 4 níveis + SYNC RULE 8 locais) + [[wiki/modulos]] (M10/AI) + [[wiki/decisoes-chave]] |
| **Nova feature do CRM Kanban** | [[wiki/modulos]] (M4) + `PATTERNS.md` |
| **Nova feature de Leads/Campanhas/Funis** | [[wiki/modulos]] (M3, M11-M16) + `PATTERNS.md` |
| **Mexer em Fluxos v3.0 (M18)** | [[wiki/fluxos-visao-arquitetura]] + params (atendimento/inteligência/entrada/biolink) |
| **Edge function nova ou alteração de schema** | `ARCHITECTURE.md` + [[wiki/infraestrutura]] + [[wiki/erros-e-licoes]] (lições de schema mismatch) |
| **Alterar banco (migration)** | [[wiki/banco-de-dados]] + `RULES.md` (regras de migration) |
| **DEPLOY** | [[wiki/deploy-checklist]] OBRIGATÓRIO (pré-deploy 100% antes) |
| **Tarefa grande/não-trivial** | [[wiki/protocolo-subagentes]] (ondas paralelas, regras de conflito) |
| **Consultar release recente** | `CHANGELOG.md` (raiz, últimos ~14 dias) |
| **Consultar release histórico** | [[wiki/changelog/]] (particionado por mês) |
| **Ver roadmap** | [[wiki/roadmap]] (milestones) ou [[wiki/roadmap/planejado-resumo]] (planejado) |

---

## 🚀 Deploy, Supabase & Acesso — coordenadas (LER ANTES de qualquer deploy)

> ⚠️ As wikis antigas tinham ref/comando ERRADOS e me faziam redescobrir tudo toda sessão. Estas são as coordenadas reais (verificadas 2026-06-28). **Mapa completo de credenciais/keys (frontend, edge fns, hosting, n8n, UAZAPI, ponteiros pros segredos): [[wiki/acesso-credenciais]].** Regra de ouro: **valor de segredo NUNCA em arquivo commitado** (bloqueia push por secret scanning) — PAT vive na memória `reference_supabase_token_novo`; senha admin no `.env.local`; keys de edge fn no painel Supabase Secrets.

| Item | Valor |
|---|---|
| **Supabase project ref** | `prfcbfumyrrycsrcrvms` ⚠️ o antigo `euljumeflwtljegknawy` está MORTO |
| Conta / Org | `eletropiso.wsmart@gmail.com` / org `mqebydjkmkvbmvzjfwgl` |
| URL | `https://prfcbfumyrrycsrcrvms.supabase.co` |
| **CLI de deploy** | binário scoop `C:\Users\georg\scoop\shims\supabase.exe` — **`npx supabase` está QUEBRADO** aqui (`uv_spawn`, bin vazio) |
| Comando edge fn | `$env:SUPABASE_ACCESS_TOKEN=<PAT eletropiso>; supabase functions deploy <fn> --project-ref prfcbfumyrrycsrcrvms --use-api` (`--use-api` evita Docker, bundla `_shared`) |
| **403 no deploy** | CLI logado na conta ANTIGA → exportar o PAT eletropiso (memória `reference_supabase_token_novo`) |
| **MCP do DB** | **`mcp__supabase-novo` é o NOSSO** (`prfcbfumyrrycsrcrvms`) → `execute_sql`/`list_tables`/`apply_migration`/`get_advisors`. ⚠️ `mcp__supabase` (sem sufixo) **NÃO é nosso** (outra conta, 403) — não usar. Deploy de edge fn segue só CLI scoop |
| NUNCA | MCP `deploy_edge_function` p/ fns com imports `_shared` (sobe vazio → derruba prod). Só CLI scoop |
| Credenciais/keys | valores → `.env.local` (`VITE_*`/`ADMIN_*`) + Supabase Secrets (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `UAZAPI_*`, `INTERNAL_FUNCTION_KEY`, `ALLOWED_ORIGIN`…) + memória. Inventário: [[wiki/acesso-credenciais]] |
| Ingestão (entrada msgs) | UAZAPI → **n8n** (`fluxwebhook.wsmart.com.br/webhook/<path>`) → `whatsapp-webhook`. Lag de entrada = n8n, não a edge fn |
| UAZAPI | `https://wsmart.uazapi.com` · header `token` (instância) + `admintoken` (env `UAZAPI_ADMIN_TOKEN`) · skill `/uazapi` |
| Deploy frontend | `git push origin master` → GitHub Actions → GHCR → **webhook Portainer MANUAL** (memória `reference_portainer_webhook`) → redeploy (stack "whatspro", Hetzner CX42). CI success ≠ deployado |
| Pós-deploy | `mcp__supabase__list_edge_functions` confere `version`/`verify_jwt`/`ezbr_sha256` mudaram |

---

## 📁 Estrutura da documentação

```
Raiz (ativo, ≤ 300 lin cada):
  CLAUDE.md         — este orquestrador
  CHANGELOG.md      — releases ~14 dias
  PRD.md            — índice (ponteiros)
  ARCHITECTURE.md   — stack, edge fns
  PATTERNS.md       — padrões de código
  RULES.md          — regras obrigatórias
  AGENTS.md         — onboarding agente externo
  log.md            — sessões da semana (max 200)
  index.md          — mapa do vault

wiki/ (ativo + arquivo):
  modulos.md            — tasks por módulo (M1-M9)
  infraestrutura.md     — snapshot stack
  audio-pipeline.md     — fluxo end-to-end áudio
  erros-e-licoes.md     — top-3 + índice
  roadmap.md            — milestones
  decisoes-chave.md     — regras/padrões vigentes
  fluxos-*.md           — Fluxos v3.0 (M18)

wiki/erros/
  regras-preventivas.md — tabela das ~30 regras
  historico-*.md        — incidentes detalhados

wiki/changelog/
  2026-{mês}-part{N}.md — releases arquivadas

wiki/roadmap/
  planejado-resumo.md     — lista resumida
  m{N}-{area}-part{N}.md  — detalhe por módulo

wiki/casos-de-uso/
  *-detalhado.md        — 31 wikis dual didático/técnico
```

---

## 📐 Hard limit 300 linhas

**Todo arquivo .md neste vault tem hard limit de 300 linhas.** Particionar imediatamente ao chegar perto. Convenções:

- **Ativos** (log.md, CHANGELOG.md, erros-e-licoes.md): chegar a 200 → planejar split
- **Arquivos** (`wiki/changelog/*`, `wiki/erros/historico-*`): split por período (quinzena/mês) com ponteiros entre `partN`
- **Detalhes longos** (roadmap módulo, plano shipado): split por sub-tema

Skills/comandos em `.claude/commands/*.md` estão **isentos** (são consumidos via slash command).

---

## 🧠 Vault Obsidian — Cérebro Persistente

### REGRA ZERO

> **NUNCA** terminar uma tarefa sem documentar no vault. Código sem documentação é trabalho incompleto.

### Protocolo de início de sessão (obrigatório)

1. Ler `index.md`
2. Ler [[wiki/roadmap]]
3. Ler [[wiki/erros-e-licoes]]
4. Ler `log.md` (últimas 5 entradas)
5. Ler [[wiki/decisoes-chave]]

Se pular, PARE e volte ao passo 1.

### Protocolo de fim de sessão (obrigatório)

1. Atualizar `log.md` — resumo de TUDO
2. Atualizar wikis afetadas
3. Atualizar [[wiki/roadmap]] se progresso mudou
4. Atualizar [[wiki/erros-e-licoes]] se encontrou/corrigiu bug
5. Atualizar `CHANGELOG.md` se shipou feature (semver)
6. Atualizar `index.md` se criou wiki nova
7. Informar usuário + nota 0-10

### Comandos do usuário

| Diz | Faz |
|---|---|
| "leia o vault" / "contexto" | Protocolo de início → resumo |
| "roadmap" / "status" | [[wiki/roadmap]] + `log.md` → fases/bloqueios |
| "o que falta?" | [[wiki/roadmap/planejado-resumo]] → pendente por área |
| "documentou?" | Auditar vault (300 linhas, refs cruzadas) + corrigir |
| "fim de sessão" | Protocolo de fim (7 passos + nota) |
| "fluxos" / "design" | [[wiki/fluxos-visao-arquitetura]] + params relevantes |

### Quando atualizar

- **Após COMMIT:** `log.md` + [[wiki/roadmap]]
- **Após FEATURE:** wiki relevante + `index.md` + `log.md` + `CHANGELOG.md`
- **Após BUG:** [[wiki/erros-e-licoes]] (causa + correção + regra) + `log.md`
- **Após DECISÃO:** [[wiki/decisoes-chave]] + `log.md`
- **Antes de DEPLOY:** [[wiki/deploy-checklist]] → registrar em `log.md`

### Convenções

- Wikilinks: `[[wiki/pagina]]`
- Frontmatter YAML: `title`, `tags`, `sources`, `updated`, `audited_at` (data da última revisão real)
- `log.md` é append-only. Fontes brutas (`PRD.md`, `docs/`) são read-only
- Datas absolutas: `2026-05-11` (YYYY-MM-DD). Português (Brasil)

### Formato pra discussão de decisões

1. **Contexto** — o que é e por que importa (didático)
2. **Problema** — o que precisa ser decidido
3. **Solução** — como funciona com exemplo concreto
4. **Casos de uso** — 4 exemplos reais
5. **Opções** — alternativas com pros/contras + recomendação destacada
6. **Documentação** — resposta do usuário registrada imediatamente

---

## 📏 Regras de Ouro (resumo — detalhes em `RULES.md`)

### Mentalidade
1. **SEMPRE ser crítico** — questionar premissas, verificar dados
2. **SEMPRE planejar antes de executar** — avaliar paralelização ([[wiki/protocolo-subagentes]])
3. **SEMPRE auto-avaliar** — nota honesta, identificar gaps
4. **SEMPRE didático** — exemplo concreto de caso de uso (Eletropiso/WhatsPRO real)

### Proteção
5. **NUNCA quebrar prod** — testar localmente antes de deploy
6. **NUNCA reportar dados falsos** — só após teste E2E completo
7. **HIGH RISK** — `ai-agent/index.ts`, `types.ts`, `e2e-test/`, `ai-agent-playground/` só com aprovação explícita

### Qualidade
8. **NUNCA pular etapas de entrega** — Implementar → TS (0 erros) → Testes (100%) → Auditoria → Commit → Documentar → Deploy
9. **SYNC RULE AI Agent** — toda alteração sincroniza 8 locais (ver `RULES.md`)

### Técnico
10. **CORS** — `getDynamicCorsHeaders(req)`, `ALLOWED_ORIGIN` obrigatório
11. **Tags** — NUNCA `[]` vazio, NUNCA magic strings, NUNCA opções numeradas
12. **300 linhas hard limit** — particionar imediatamente ao chegar perto

### Documentação
13. **SEMPRE nota 0-10** após documentar (conteúdo + orquestração + estado)
14. **SEMPRE refs cruzadas atualizadas** — `index.md`, `log.md`, `decisoes-chave.md`
15. **Após FEATURE: `CHANGELOG.md`** (novo entry semver) + `wiki/modulos.md` (se tasks novas)

---

## 🔍 Healthcheck

- `bash scripts/check-md-length.sh` — lista `.md` > 300 linhas
- Pre-commit hook bloqueia commit que viole o limite (instalar 1x via `bash scripts/install-hooks.sh`)
- GitHub Actions roda o mesmo check em PRs (`.github/workflows/vault-healthcheck.yml`)
- `/doc-check` — slash command com audit completo (limite + staleness + órfãs)

## Skills/Commands

- `/prd` → `PRD.md` (índice)
- `/uazapi` → `.claude/commands/uazapi.md` (referência API)
- `/doc-check` → `.claude/commands/doc-check.md` (vault healthcheck)
