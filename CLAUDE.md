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
| **D6 aposentar monolito** — caminho monolith removido do index.ts (**3.440 → 2.964 linhas, −476**) + routerPipeline sem gate + fallback GRACIOSO (erro → transbordo digno, nunca mais o LLM antigo) + UI/default DB. Evidência: 30d prod, 1.796 runs 100% router, 0 fallbacks. E2E: fluxo feliz + fallback forçado (modelo inválido → transbordo real) validados ao vivo | ✅ Shipped (v7.109.0, ai-agent v277) | 2% | **100%** 🏁 |
| B4 — Varredura R134 idempotência | ⏳ **ABERTO** (hardening, não-bloqueador; fora do plano-base) | 5% | — |
| Sprint E — Memória longa + proatividade + RAG | 🟡 **PARCIAL** — E.1 memória longa ✅ (v7.46.0) e E.2 parte 1 handoff por abandono ✅ (v7.56.0); **E.2 (resto) proatividade/follow-ups e E.3 RAG seguem ABERTOS** | 10% | — |

> **Como ler a tabela:** o **100%** é do plano-base (monolito → router + 5 specialists), fechado no D6 em 2026-07-25. Sprints **C** (v7.42.0→v7.44.0) e **D** (v7.45.0) já estão contabilizados nas linhas granulares acima. As duas linhas **abaixo** do D6 são extras fora desse escopo e continuam abertas.

**Hoje (2026-07-27):** 📷 **v7.111.0 (commit `2b0e54d`) — envio de imagem no Helpdesk CONSERTADO** (os 4 fixes da auditoria de 26/07, dono deu OK): (1) downscale client-side pré-upload (JPEG/PNG >1MB → ≤2048px q0.85, best-effort "nunca pior"; HEIC pós-conversão também; PNG→JPEG fundo branco); (2) upload-timeout ≠ sessão-zumbi (`uploadTimeoutPolicy.ts`: sonda decide — sessão válida = falha limpa SEM reload, retry vivo; `unknown` = recover; `dead` = signOut declarativo); (3) AVIF/BMP nos magic bytes (AVIF não vira mais DOCUMENTO mudo); (4) telemetria de SUCESSO (`done/success` + duração + tamanho) + `sendBeacon`; migration CHECKs + edge fn `log-send-failure` v2. **E2E real na PROD via Playwright:** JPEG 7,4MB 4000×3000 → enviado 6,6s, Storage 2048×1536/1,45MB (−80%), telemetria `success (downscaled)`, UAZAPI confirmou. tsc 0 · vitest **2026/0** · build ✓ · deno 0. **Achados:** `.git/index.lock` órfão (26/07 21:42) tinha abortado o commit de docs da v7.110.0 — vault estava staged sem commit, fechado em `1b88fd1`; `deploy.yml` CONFIRMADO com redeploy automático via webhook Portainer (caveat removido da tabela de deploy). **Monitorar:** taxa success×falha por plataforma na `media_send_telemetry` (agora tem denominador). Detalhe: memória `project_helpdesk_image_fixes_v7111`.

**(histórico) 2026-07-26:** 📚 **v7.110.0 (ai-agent v278, commit `ad77ab9`) — os 2 débitos prioritários do D6 FECHADOS** + auditoria do envio de imagem no Helpdesk via Android. (1) **R150 FECHADA — FAQ religada:** load do `ai_agent_knowledge` de volta no `index.ts` (cache 48h + sonda v7.103) e bloco `<knowledge_base>` injetado nos **5 specialists** via `specialistBase.knowledgeInstruction` — as 26 FAQs reais valem de novo. `specialistBase.test.ts` novo asserta o CONTEÚDO do prompt final (o buraco que escondeu a regressão por ~2 meses). E2E real: FAQ-sentinela "7x sem juros" no Sandbox → injeção direta no webhook → router `pagamento` → objection specialist respondeu com o fato da FAQ (prompt 6.001 chars); cenário 100% restaurado depois. (2) **R152 FECHADA — falha transitória não sela mais shadow:** `llmErrorClassifier.ts` puro (408/429/5xx/timeout/breaker = transitório; demais 4xx/lógica = permanente), `llmCallLoop` propaga `errorMessage` cru, `routerPipeline` devolve `failure{transient,reason}`. Transitório **1º strike = silêncio + tag `router_transient_fail:1`** (próxima msg reprocessa; NÃO transborda nem sela shadow — incidente de minutos da OpenAI não converte mais leads em massa); **2º strike consecutivo = transbordo gracioso**; permanente transborda direto. Strike limpa no turno OK; telemetria `transient/second_strike/failure_reason` no `implicit_handoff`. vitest **2012/0** (+17) · deno 0 · tsc 0. (3) **Auditoria imagem Android (SÓ diagnóstico, fix aguarda OK):** telemetria tem 2 falhas/45d e a de 14/07 é o caso relatado (Alberto, Android, JPEG 4,8 MB, `upload→hang_timeout`); causa-raiz mais provável = foto de câmera sobe INTEGRAL (sem downscale) → teto 120s estoura em rede móvel → `recoverStuckSession()` dá **`window.location.reload()`** → File e bolha de retry morrem ("a tela piscou"). Agravantes: magic-bytes `unknown` (AVIF fora de `HEIC_BRANDS`) manda foto como DOCUMENTO com toast de sucesso; heic2any OOM em mobile sem fallback real fora do Safari; telemetria cega (sem evento de sucesso, beacon morre no reload). Bucket é público e imagens saem 20–222/dia (falha é por dispositivo, não geral). Fixes recomendados: downscale client-side (~2048px), timeout≠zumbi (não reload em upload lento), AVIF nos magic bytes, telemetria de sucesso+sendBeacon. **Saúde verificada hoje:** zero `router_fallback` real · cron relatório 2ª execução OK (200 `sent:1`) · 4 gestores seguem sem `personal_whatsapp`. Detalhe: memória `project_faq_transient_v7110_media_audit`.

**(histórico) 2026-07-25:** 🏁 **D6 — monolito do AI Agent APOSENTADO (plano orquestrador 100%)** + 3 releases de relatório do gestor (v7.106.0 diário → v7.107.0 marcas reais → v7.108.0 formato rico + cron). (1) **D6 EXECUTADO (v7.109.0, ai-agent v277)** — monolito APOSENTADO: index.ts **3.440 → 2.964 linhas (−476)**, `contextDocuments.ts` deletado, routerPipeline sem gate/shadow. **O ÚNICO cérebro agora é o router pipeline** (`_shared/agent/routerPipeline.ts`, tabela DISPATCH de 7 intents: `fora_escopo`→greeting, `pagamento`→objection); falha do **router LLM** (parse/intent inválida/confiança <0.6) NÃO transborda — cai em fallback determinístico pra intent `qualificacao` (`_shared/agent/router.ts`); falha de **specialist**/hop guard/exceção do pipeline aciona o **fallback GRACIOSO** no `ai-agent/index.ts` (handoff_message configurada + fila + `status_ia=shadow` + nota interna + log `implicit_handoff` com `reason=router_fallback`) — nunca mais o LLM antigo; provado ao vivo com modelo inválido → transbordo real. UI sem seletor e default do DB = `router`: a coluna `ai_agents.routing_mode` virou **INERTE** (nenhum código lê; **não existe mais modo shadow de ROTEAMENTO** — não confundir com `conversations.status_ia='shadow'`, que é humano assumindo o atendimento). Load do knowledge removido (−1 query/turno). **Rollback não é mais flag:** é redeploy do ai-agent a partir do commit `36f0555` (pai, último com monolito) via CLI scoop — versão anterior em prod = v276, atual = v277. E2E fluxo feliz no EletropisoV2 (router produto 0.95 → qualification specialist, dedup external_id segurou entrega dupla do n8n). vitest 1995/0 · deno ai-agent 0 · tsc 0. **Verificação 2026-07-26 (40h pós-deploy):** router 40 turnos — qualification 16, greeting 6, product 3, handoff 1; os 14 turnos com router e sem specialist entregaram resposta ao lead (curto-circuitos determinísticos) e houve **ZERO `router_fallback` em tráfego real** (o único é o teste proposital de 25/07). **Achados D6:** FAQ/knowledge SÓ alimentava o monolito → specialists nunca receberam (religar = follow-up); n8n com lag ~3min na ingestão (sáb à noite); número do Sandbox hospeda outro bot ("Tamandaré") → E2E via sandbox-emissor gera loop bot×bot, usar injeção direta no webhook; deno debt pré-existente playground/debounce (TS2589, provado no HEAD); órfãos parciais em _shared (preLLMShortCircuits/exitActionDispatcher/promptSections/buildPromptRulesString) pra varrer depois. (2) **v7.106.0 — Resumo do dia pros gestores** (RPC `get_daily_manager_report` jsonb 1-chamada janela SP + formatter puro `_shared/dailyReport.ts` + edge fn `daily-manager-report` verifyCronOrService; contrato de consistência — números FECHAM entre si; E2E 2 amostras ao dono). (3) Dono pediu e recebeu **resumo SEMANAL 20–25/07** (one-off: RPC 6× + agregação; 230 atendimentos, 956 msgs, 45 transbordos mediana 30min ⚠️ 9 sem resposta, 3 vendas; seg 20/07 mediana ~3h52 = pior dia). (4) Questionou "só 1 marca?" → **auditoria profunda**: top_brands contava só `set_tags` do LLM (**1 de ~27 menções reais, 4%** — o detector R115 grava em `conversations.tags`, lugar que a RPC nem lia); **11% das msgs vivem em `transcription`** (áudio/foto; foto = 1/3 das menções de marca, describe-image lê embalagem); dicionário sem NENHUMA cerâmica; e causa de fundo comportamental: ~10% das conversas citam marca (estável 4 semanas) — cliente compra por categoria+cor+preço. (5) **v7.107.0 fix:** RPC v3 varre `content`+`transcription` com `p_brands` (fonte única `DEFAULT_BRANDS` TS; fallback legado null-safe), lista +25 marcas (cerâmicas+regionais; SEM Elizabeth/Karina — nome de pessoa), `brandDisplay`, limit 10; smoke 6 dias (27 vs 1) + E2E real ao dono ("Brasilit (2) · Incenor (2)…"). (6) **v7.108.0 — formato RICO aprovado como padrão diário + cron AGENDADO**: dono aprovou o semanal rico ("esse será o padrão relatório diário, pro meu número") → RPC v4 (`prev` mesmo-dia-semana-anterior, `category_mentions` via `p_categories`, `human_panel_msgs`, `nps_sent`) + formatter rico (deltas ▲/▼, ↳, ⚠️ 5 regras de atenção determinísticas; campos opcionais = layout legado preservado) + `to_phone` fixo na edge fn + **cron dom-sex 18h30 SP e sáb 12h30 SP** (`daily-manager-report-eletropisov2[-sab]`, to_phone 5581993856099). E2E idêntico ao cron: relatório de hoje entregue ("24 ▲20% (sáb ant.: 20)"). tsc/deno 0 · vitest **2017/0** · types regen. Deploy: 5 migrations + edge fn (scoop). **Pendências:** gestores sem `personal_whatsapp` (aí remover `to_phone` do cron → lista de gestores); config/UI toggle+horário por agente; monitorar falsos-positivos da lista de marcas no gatilho R137; brand-filter na qualificação (backlog); rotacionar senha+PAT. Detalhe: memória `project_daily_manager_report_v7106`.

**(histórico anterior):** blocos de sessão de 2026-07-09 e anteriores em [[wiki/claude-historico-sessoes]]

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
| Deploy frontend | `git push origin master` → GitHub Actions (`deploy.yml`: quality-gate tsc+vitest → build GHCR → **step "Redeploy via Portainer webhook" AUTOMÁTICO**, secret `PORTAINER_WEBHOOK_URL`; confirmado no YAML em 2026-07-27) → stack "whatspro" (Portainer, Hetzner CX42). Webhook manual NÃO é mais necessário; pra confirmar deploy, verificar marker no bundle live (chunks lazy: código do Helpdesk vive em `HelpDesk-*.js`, não no `index-*.js`) |
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
