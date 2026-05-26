# WhatsPRO — CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automação. React + Supabase + UAZAPI. Produção: `crm.wsmart.com.br`.

Este arquivo é o **orquestrador** da documentação: lista o que ler em função da tarefa em mãos. Não contém conteúdo — só ponteiros.

---

## 🎯 Andamento do Plano Orquestrador — **~88% concluído** (Sprint D completo + E.1 memória longa; EletropisoV2 em router PROD; 36 erros TS zerados)

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
| **Sprint C parcial 1/3** — C1 ai_agent_runs + C3 routing_mode flag + C2 router LLM (gpt-5-nano, 7 intents, defesa 4 níveis) | ✅ Shipped (v7.42.0) | 3% | **63%** |
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
| Sprint E.2 (resto) proatividade/follow-ups + E.3 RAG | ⏳ | — | — |
| D6 aposentar monolito (após 30d router estável) | ⏳ STAGED | — | — |
| B4 — Varredura R134 idempotência | ⏳ (hardening, não-bloqueador) | 5% | — |
| **Sprint C** — Router + product_specialist POC | ⏳ MARCO | 15% | — |
| **Sprint D** — 5 specialists + migração 100% | ⏳ | 15% | — |
| Sprint E — Memória longa + proatividade + RAG | ⏳ Inteligência avançada | 10% | — |

**Hoje (2026-05-26, noite):** **Sprint E.2 parte 1 — handoff por ABANDONO (v7.56.0)** — fecha o último buraco funcional do transbordo. No fluxo offline/sem-resultado a IA grava `seller_handoff_pending`, faz 1 pergunta (marca) e espera o PRÓXIMO turno pra forçar o handoff; se o lead some, a conversa pendurava pra sempre. Solução em **2 estágios** (cron dedicado `handoff-abandoned-leads`, 2min): (1) cutucada após N min sem resposta (*"{Nome}, ainda tá por aí? 😊…"*, marca `abandon_nudged:{ms}`); (2) transbordo após M min da cutucada (fila + nota interna com resumo). Lead responde a qualquer hora → pré-router existente resolve. **Zero gambiarra:** reusa as MESMAS primitivas do `dispatchResponse` step 22, NÃO toca `ai-agent/index.ts`. Decisão pura em `_shared/agent/abandonHandoff.ts` (19 testes); scan num RPC; 4 cols config default OFF + UI `AbandonHandoffConfig` + SYNC RULE. **E2E real sandbox:** RPC inclusão=1 + 5 guards zeram; estágio 2 disparado ao vivo → `status_ia=shadow` + tags limpas + nota interna + log `{abandoned:true}` (sem mensagear vendedor). tsc/deno 0, PROD intocada (feature OFF). Antes disso, na mesma sessão: humanizei o `handoff_message` do EletropisoV2 (config). Detalhe: [[project_sprint_e2_abandon_handoff]]. **Pendência: ligar a feature no EletropisoV2 (config, com OK do dono) + monitorar.**

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
