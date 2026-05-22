---
title: Activity Log Archive — 2026-05-21 (sprints anteriores ao 2c-ii)
type: log-archive
updated: 2026-05-21
---

# Activity Log — Arquivo (2026-05-21)

> Entradas movidas do log.md ativo em 2026-05-21 quando log ultrapassou 300 lin (hard limit). Contém Onda 0+1, 2a, B3, B2, B1.5, B1 e ponteiros pra incidentes arquivados (R124-R136, D36).

---

## 2026-05-21 (noite II) — Sprint B5 Onda 0+1 shipped (v7.40.4) — extrai loadContextDocuments

**Trigger:** user pediu pra prosseguir Sprint B5 (split index.ts) wave-based, escopo desta sessão = Ondas 0+1. Pré-requisito real do Sprint C (orquestrador + specialists) — sem split, extrair specialist do monolito 4.4k lin é diff de 1000+.

**Diagnóstico do terreno antes de codar:**
- index.ts cresceu pra **4544 lin** (137 lin a mais que o plano original).
- Tool execution switch sozinho tem **1753 lin** (>3× as outras fases) — Onda 3 vai subdividir.
- Closure `runQueueAssignment` capturada em 6 paths de handoff diferentes — refator vai precisar de context object.
- Mapeado 9 blocos com tamanhos reais (linhas exatas no resumo do CHANGELOG).

**Re-escopo Onda 1:** o plano original dizia ~360 lin extraídas (campaign + form + bio + funnel context). Após leitura real, esses 4 blocos são só 105 linhas (1066-1170). Shadow mode (1171-1370) é outra fase, fica pra Onda futura.

**Execução (cirúrgica):**
1. Pasta nova `_shared/agent/` criada.
2. `context.ts` — tipos compartilhados (Logger, FunnelData, ProfileData, ConversationTagsCarrier). Crescerá em ondas futuras.
3. `contextDocuments.ts` — 5 funções puras: `loadCampaignContext`, `loadFormContext`, `loadBioContext`, `buildFunnelSections`, `buildContextDocuments` (orquestrador).
4. `contextDocuments.test.ts` — 22 testes mockando supabase com builder fluent. Cobre todos os caminhos condicionais (sem tag, DB vazio, profile prioritário sobre funnel_prompt, erro DB capturado, etc.).
5. `ai-agent/index.ts:1066-1170` (105 lin) → substituídas por chamada única `buildContextDocuments(supabase, {conversation, instanceId, contactId, funnelData, profileData}, log)`. Saldo: index.ts 4544 → 4454 (-90 lin, parte recuperada pela chamada).

**Pipeline:** tsc 0 erros · vitest **980 pass (+22 novos)** / 9 fail pré-existentes idênticos. Deploy ai-agent v78→v79 ACTIVE via CLI (sha novo confirmado).

**Equivalência semântica garantida:** strings de output idênticas char-a-char ao código original. Caminhos condicionais cobertos por teste com `expect.toContain` nos blocos XML-like (`<campaign_context>`, `<form_data>`, `<bio_context>`, `<funnel_context>`, `<profile_instructions>`, `<funnel_instructions>`).

**Onda 0 colapsada na Onda 1:** decidi não fazer Onda 0 isolada (criar context.ts vazio) — em vez disso o context.ts nasce já com tipos QUE SÃO USADOS no contextDocuments. Evita PR meaningless.

**Sprint B5 status:** Onda 0+1 ✅. Próximas: Onda 2 buildSystemPrompt (~600 lin, médio risco), Onda 3 toolExecution (~1500 lin, alto risco — provavelmente vai subdividir em 2-3), Onda 4 llmCallLoop, Onda 5 dispatchResponse.

**Frase de retomada:** *"executar B5 Onda 2 buildSystemPrompt 2026-05-21"* (ou data futura).

---

## 2026-05-21 (noite) — Sprint B3 shipped (v7.40.3) — reader sub_agents → agent_profiles

**Trigger:** user pediu pra prosseguir Sprint B3 ("executar Sprint B3 sub_agents reader 2026-05-21"). Pré-requisito Sprint C — cada specialist precisa de 1 ponto de leitura de perfil.

**Diagnóstico via MCP antes do plano (decisivo):**
- 3 agentes em prod: **EletropisoV2 + Sandbox** (ativos, ambos com `sub_agents` 4 modos enabled MAS 0 rows em `agent_profiles`) + Eletropiso antiga (disabled, com 4 rows). Migration M17 F3 só rodou na antiga.
- Conteúdo do `sub_agents` é template idêntico dos 2 ativos (vem do `nicheTemplates.ts`, não customizado por cliente).
- Implicação: cortar reader cru = regressão silenciosa nos 2 ativos.

**Plano formato discussão + AskUserQuestion (3 perguntas):** user aprovou todas as recomendações:
1. Backfill só nos 2 ativos via migration idempotente
2. Trigger DB cria default profile no INSERT (cobre agentes futuros)
3. Manter UI `SubAgentsConfig.tsx` + helper `buildSubAgentInstruction` por 1 sprint (cleanup deferred pra B5)

**Execução (sequencial, 6 tasks):**
1. Migration `20260521000001_sprint_b3_backfill_agent_profiles.sql` — INSERT...SELECT idempotente (ON CONFLICT DO NOTHING, clone da M17 F3) + trigger `ensure_default_agent_profile()` AFTER INSERT em `ai_agents`. Aplicada via MCP. Verificado: 3 agentes têm 4 rows × 1 default cada.
2. `_shared/profileReader.ts` (novo): `loadActiveProfile(supabase, {agentId, funnelProfileId})` cascade funnel→default. 9 testes mocking builders fluent.
3. `ai-agent/index.ts`: -24 lin do load manual (666-688), -29 lin do reader legado DEPRECATED (1532-1560), +1 chamada `loadActiveProfile`. Telemetria `sub_agent` em `response_sent` log agora grava ID do profile ou `no_profile`. `subAgentInstruction = ''` permanente (prompt do perfil já injetado em `funnelInstructionsSection`).
4. `ai-agent-playground/index.ts:67`: usa helper compartilhado. Backward compat — playground continua super_admin only.
5. tsc 0 erros · vitest 958 pass (+9 novos do profileReader) / 9 fail pré-existentes (excludedProducts/FormBuilder/useForms — idênticos B2). Deploy CLI: ai-agent v77→v78 + ai-agent-playground v2→v3, ambos verify_jwt=false.
6. Documentação: CHANGELOG v7.40.3 entry, esta entrada, plano-orquestrador B3✅, memory.

**Sprint B status:** B1 ✅, B1.5 ✅, B2 ✅, B3 ✅. Restante: B4 (varredura R134 idempotência), B5 (split index.ts <300 lin — pré-req Sprint C).

**Frase de retomada:** *"executar Sprint B4 varredura curto-circuitos R134 2026-05-21"* (1-2 dias, baixo risco — só inventário + classificação de chamadas idempotentes vs não).

---

## 2026-05-21 (tarde III) — Sprint B2 shipped (v7.40.2) — strict mode 9 tool schemas

**Trigger:** user pediu pra atacar Sprint B2 (strict mode) logo após B1.5. Esperado: alucinação args 3% → <0,1%.

**Execução (cirúrgica, sequencial):**
1. `_shared/llmProvider.ts` — `LLMToolDef` ganha `strict?: boolean`. `callOpenAI` injeta `strict:true` + `additionalProperties:false` quando flag setada. Opt-in seguro (outras edge fns inalteradas).
2. `ai-agent/index.ts:2097-2186` — refator das 9 toolDefs:
   - Todas ganham `strict: true`
   - 5 desalinhadas (search_products, send_carousel, send_media, update_lead_profile, send_poll): opcionais → type union `["TIPO","null"]` + todos args em `required[]`
   - 4 já alinhadas (assign_label, set_tags, move_kanban, handoff_to_human): só ganham `strict: true`
3. Handlers verificados defensivos contra null: cases `search_products`, `send_carousel`, `send_media`, `send_poll`, `update_lead_profile` JÁ usam `if (args.X)` ou `X || default`. Sem ajuste.

**Pipeline:** tsc 0 erros, vitest 949 pass / 9 fail pré-existentes. Deploy ai-agent v76→v77 ACTIVE.

**Sprint B status:** B1 ✅, B1.5 ✅, B2 ✅. Restante: B3 (sub_agents reader), B4 (varredura R134), B5 (split index.ts).

**Frase de retomada:** *"executar Sprint B3 sub_agents reader 2026-05-21"* (1-2 dias, médio risco).

---

## 2026-05-21 (tarde II) — R135 + R136 em prod (paz + Paloma) — Sprint B1.5 fix tático

**Trigger:** user mandou 2 prints de prod — caso 1 (paz/558791319539): IA repetiu LITERAL "Qual material? (granito, mármore, inox ou sintético)" depois do lead responder "Mas simples mesmo". Caso 2 (Paloma/558182563943): IA ignorou lista "1 massa PVA / 1 Latão de tinta branco neve / 15 lixas d'água N° 150" e perguntou "para qual produto?" depois do lead já ter mandado. User pediu "por que erraram + como corrigir definitivamente + onde documentar".

**Investigação via MCP (ai_agent_logs):**
- R135 (paz, conv 691b0017): `auto_field_extracted` em msg2 "E sintético" salvou `material_pia:sintético` MAS o `response_sent` anterior já tinha repetido a phrasing literal (LLM transcreveu o "FRASE EXATA SUGERIDA" do qualificationContext). `buildQualificationContext` não detecta "lead respondeu mas não casou — re-injetar evento de qualif sem mudança = loop".
- R136 (Paloma, conv 0740250f): `matchAllCategoriesBySearchText` só casou `tintas` (massa PVA e lixa não têm categoria cadastrada). Sistema seguiu qualif rígida de tinta (ambiente, tipo), ignorou os 2 outros itens. Lead repetiu lista, IA estourou 8/8 msgs sem orçamento útil. Handoff implícito.

**Regra do user (capturada pra B1.5):**
> Lista multi-item mista (cadastrado + não-cadastrado) → qualificação **horizontal** (1 pergunta abrangente sobre ambiente/marca/qualidade) → handoff rico com lista preservada. Vale também pra single-item-fora-catálogo.

**Docs atualizadas:**
- `wiki/erros-e-licoes.md` (top): R135+R136 com sequência + causa + fix v7.40.1
- `wiki/erros/regras-preventivas.md` (entradas 135 + 136)
- `log.md` (esta entrada)

**B1.5 tasks criadas (em progresso):**
- B1.5-a `_shared/multiItemDetector.ts` (novo, helper paralelo)
- B1.5-b `_shared/horizontalQualif.ts` (novo, helper paralelo)
- B1.5-c wire em `ai-agent/index.ts` (eu, sequencial)
- B1.5-d fix R135 em `serviceCategories.ts.buildQualificationContext` (eu ou agente)
- B1.5-e testes + deploy v7.40.1

**Pipeline + deploy:** tsc 0 erros, vitest 949 pass / 9 fail pré-existentes (+36 testes novos B1.5 todos pass). Deploy ai-agent v75→v76 ACTIVE via CLI (token novo).

**Particionamento do vault:** erros-e-licoes 312→215 (R124-R134 movido pra novo `wiki/erros/historico-2026-05-part3.md`). CHANGELOG.md 322→279 (v7.40.0 B1 detalhado movido pra `wiki/changelog/2026-05-part8.md`).

**Frase de retomada:** *"executar Sprint B2 strict mode 2026-05-21"* (B1.5 fechado; B2 strict mode 9 tools é próximo natural).

---

## 2026-05-21 (manhã) — Sprint B1 shipped (v7.40.0) — extração hardcodedRules

5 agentes paralelos + auditor. **-89,98% no prompt** (9.348→937 chars). 10 arquivos, 4 helpers novos, +50 testes. Detalhe em [[wiki/changelog/2026-05-part8]].

---

## 2026-05-21 (madrugada I → manhã) — Auditoria + Sprint A + Plano Orquestrador (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-21-am.md]] em 2026-05-21 (hard limit log.md). Conteúdo: Auditoria 360° 5 ondas (nota 5.9/10), Sprint A v7.39.0 (7 P0s fechados + I2/I3 shipped), Plano Orquestrador parte 1+2 documentado (Sprint B/C/D, 6 semanas).

---

## 2026-05-21 (tarde) — R133+R134 arquivado

Regex overlap tintas↔impermeabilizantes + loop R129 (caso Branca, v7.38.8). Detalhe em [[wiki/changelog/2026-05-part8]] · [[wiki/erros/historico-2026-05-part3]].

---

## 2026-05-21 (manhã II) — R132 arquivado

IA ignorou transcrição áudio (Edson EletropisoV2 v7.38.7). Fix incomingMessagesLoader. Detalhe em [[wiki/changelog/2026-05-part8]] · [[wiki/erros-e-licoes#R132]].

---

## 2026-05-21 (manhã+madrugada) — R127/R128/R129/R130/R131 arquivado

R131 phrasing curto + sessão E2E sandbox R127-R130 (9/10 PASS). Detalhe em [[wiki/log-arquivo-2026-05-21-r127-r131]].

---

## 2026-05-20 (noite III) — R126 arquivado

Fix cross-categoria `search_products({query:"material"})` Guttemberg (v7.38.4): `_shared/searchGuard.ts` recusa query genérica + categoria offline. Camada 3 (debounce gap) backlog. Detalhe em [[wiki/changelog/2026-05-part8]] · [[wiki/erros/historico-2026-05-part3]].

---

## 2026-05-20 (noite II → tarde) — R124, R125, D36, prefixo nome — arquivado

> Movido para [[wiki/log-arquivo-2026-05-20-full]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: R125 badge fila OFF (v7.38.3), R124 handoff search_fail (v7.38.2), D36 permissões granulares + redesign Categorias (v7.38.0), prefixo `*Nome*` em msgs humanas (v7.37.21).


---

## 2026-05-19 — Migração Eletropiso v2 + DB Reset (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-19-eletropiso-reset]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: criação instância +558781592373 (aditiva, fila OFF, Lucas único assignee), clone integral do ai_agent (56 colunas), TRUNCATE 32 tabelas pré-migração com 0 erros.

---

## Histórico arquivado

- [[wiki/log-arquivo-2026-05-17-a-18-bugs]] — 2026-05-17 (noite) a 2026-05-18 (tarde): Bug 24 v4/v5, Bug 26+27, Bugs 29-32 handoff, R115/R116 fila.

---

## 2026-05-17 — Bugs 19, 21+22, 24 — arquivados

- [[wiki/log-arquivo-2026-05-17-bug19]] · [[wiki/log-arquivo-2026-05-17-bug21-22]] · [[wiki/log-arquivo-2026-05-17-bug24-exit-action]]

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

[[wiki/log-arquivo-2026-05-11-dashboard]]

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |

## 2026-05-17 (tarde + fim tarde) — v7.37.0 a v7.37.4 — arquivado

D34 reabertura, Bug 13 auto-extract, Bug 15b out_of_hours, Bug 16 paths handoff, Bugs 17+18 venda fechada + anti-recumprimento, validação E2E bugs 17+18. Detalhe completo em [[wiki/log-arquivo-2026-05-17-tarde-bugs]].

---
