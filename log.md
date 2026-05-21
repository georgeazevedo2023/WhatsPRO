---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

**Trigger:** user pediu "executar Sprint B do orquestrador 2026-05-21". Escolheu: B1 sozinho, 5 agentes paralelos, HIGH RISK aprovado em ai-agent/index.ts, categorização 5/7/6/5 aceita.

**5 agentes paralelos Wave 1:**
- Agent 1 → `_shared/promptRules.ts` (NOVO): 937 chars / 5 regras de tom (vs 9.348 / 24 bullets do hardcodedRules). 3/3 tests pass.
- Agent 2 → `_shared/responseValidator.ts` (NOVO): 7 checks determinísticos (anti-negative/internal-error/leak/eco/recumprimento/name-overuse/hallucinated-price). 185 lin. 19/19 tests pass. Modo telemetria nesta sprint.
- Agent 3 → `_shared/searchGuard.ts` (estendido): nova `detectIncomingSearchSignal` cobre R121 + brand→search. +91 lin. 28/28 tests. **NÃO wirado** (Edit 3 ALTO RISCO, defer Sprint B5).
- Agent 4 → `_shared/handoffGuard.ts` (estendido): `shouldBlockHandoffForPayment` + `mentionsPaymentTopic`. +87 lin. 23/23 tests. **Wirado** no case handoff_to_human.
- Agent 5 → wire plan `/tmp/B1_WIRE_PLAN.md` (4 edits + 7 riscos mapeados).

**Wave 2 (orquestrador):** apliquei 4 edits no `ai-agent/index.ts`:
1. Imports dos 4 helpers (linhas 19-25)
2. Declaração `hardcodedRules` removida (era linhas 1644-1668)
3. `systemPrompt` array usa `buildPromptRulesString()` (linha ~2008)
4. `case 'handoff_to_human'` chama `shouldBlockHandoffForPayment` (linha ~3676)
5. `responseValidator.validateLLMResponse` chamado em telemetria antes do validator LLM (linha ~3997)
6. `validatorAgent.ts` prompt estendido com 4 regras órfãs (INTERNO/erro-interno/eco/recumprimento)

**Wave 3 (auditor — general-purpose agent):**
- 10 arquivos exatos esperados ✅
- 5 destinos verificados com evidência por linha ✅
- 5 wire points OK ✅
- Impacto medido: **-89,98% no prompt** (9.348 → 937 chars / ~-2.100 tokens por turno)
- **Veredito: PASS COM RESSALVAS** (ressalvas esperadas pelo plano)

**Pipeline:** tsc 0 erros ✅. Vitest 913 pass / 9 fail pré-existentes (idêntico Sprint A — FormBuilder + useForms + excludedProducts não-relacionados). **+50 testes novos B1 todos pass.**

**Deploy:** PENDENTE de aprovação. Edge fn `ai-agent` v74 ainda em produção (não modificado nesta sessão).

**Follow-up:**
- Edit 3 (searchGuard PRÉ-LLM wire) defer Sprint B5
- responseValidator em telemetria por 1-2 sem antes de enforcement
- B2/B3/B4/B5 pendentes — próxima sessão

**Frase de retomada:** *"executar Sprint B2 strict mode 2026-05-21"* (B2 = strict mode 9 tool schemas, ~2 dias).

---

## 2026-05-21 (madrugada I → manhã) — Auditoria + Sprint A + Plano Orquestrador (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-21-am.md]] em 2026-05-21 (hard limit log.md). Conteúdo: Auditoria 360° 5 ondas (nota 5.9/10), Sprint A v7.39.0 (7 P0s fechados + I2/I3 shipped), Plano Orquestrador parte 1+2 documentado (Sprint B/C/D, 6 semanas).

---

## 2026-05-21 (tarde) — R133+R134: regex overlap tintas + loop R129 (caso Branca, v7.38.8)

**Trigger:** print Branca (558781754008) — IA respondeu "Posso te ajudar com **tintas e vernizes**, impermeabilizantes e mantas e caixas d'água…" mesmo lead nunca pedindo tinta, e repetiu MESMA pergunta 2x.

**Auditoria via SQL (`supabase db query --linked`):**
- Conv 176f7c6f tags: `multi_interesse_pending:tintas,impermeabilizantes,caixas_dagua` (tintas fantasma)
- Logs `ai_agent_logs`: 2 `response_sent` idênticos `source=r129_multi_interesse_ask` confirmando loop
- Único overlap do banco: termo `impermeabilizante` em AMBAS regex `tintas` E `impermeabilizantes` (3 agents Eletropiso)

**R133 (regex DB overlap):** UPDATE jsonb idempotente em `ai_agents.service_categories` removendo `|impermeabilizante` da regex `tintas`. Aplicado nos 3 agents via `db query`. Migration `20260521120000_*.sql` versionada. Seed default em `_shared/serviceCategories.ts:95` também corrigido.

**R134 (loop R129):** guarda `!alreadyHasMultiPending` antes do curto-circuito em `ai-agent/index.ts:1771`. `buildQualificationContext` reforçado com 3 regras pra LLM lidar com resposta do lead: (a) escolha clara → set_tags 1 valor, (b) "ambos" → escolhe 1ª categoria e avisa, (c) vago → primeira da lista.

**Cleanup Branca:** removidas tags `multi_interesse_pending:...`, `interesse:tintas` (errado), `ambiente:interno` (errado). Só restou `marca_citada:fortlev`. Próxima msg re-processa limpo.

**Testes:** 6 novos em `serviceCategories.test.ts` (125/125 PASS). Cobertura: matchCategory, matchCategoryBySearchText, novo describe `matchAllCategoriesBySearchText` com caso Branca realista.

**Deploy:** `npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓

---

## 2026-05-21 (manhã II) — R132: IA ignorou transcrição de áudio (Edson EletropisoV2 v7.38.7)

**Bug ao vivo prod.** Lead Edson (558781302237) mandou "Bom dia" → "Edson" → áudio "Você tem a quartisolite rejunto pra piscina?". IA respondeu pergunta GENÉRICA "Edson, em que tipo de material ou produto…". User mandou print perguntando "pq o agente de ia nao respondeu a transcrição".

**Investigação:**
- Conv `353e5b4d-fe1c-4634-a38d-04ba1e90e912` — auditei `conversation_messages` + `ai_agent_logs`
- Bug: `ai-agent:308-322` lia só `m.content` do queue; áudio com content="" sumia em `.filter(Boolean)`
- 4º incidente família Camada 3 (R126 + C8 + R50 + R132). Causa comum: queue não captura estado real.

**Fix v7.38.7 (opção B re-leitura DB):** `_shared/incomingMessagesLoader.ts` (4 funções puras, 14 testes) + integração no `ai-agent/index.ts:308-340`. Deploy CLI v64. Detalhe completo: `CHANGELOG.md` v7.38.7. Renomeação R131→R132 por colisão com sessão paralela do phrasing.

**Frase de retorno**: "validar R132 áudio em prod 2026-05-21".

---

## 2026-05-21 (manhã) — R131 + (madrugada) R127/R128/R129/R130 — arquivado

> Movido para [[wiki/log-arquivo-2026-05-21-r127-r131]] em 2026-05-21 (hard limit 300 linhas).
> Conteúdo: phrasing curto R131 (v7.38.6) + sessão E2E sandbox 4 bugs descobertos R127-R130 (v7.38.5, 9/10 cenários PASS).

---

## 2026-05-20 (noite III) — Fix R126: cross-categoria `search_products({query:"material"})` (v7.38.4)

**Bug em prod (Guttemberg, Eletropiso 558781592373, conv `529f51f8`).** Lead pediu "Porta em alumínio e janela em alumínio, só uma de 139" → IA respondeu com **carrossel de Telha de PVC R$62**. Cross-categoria absoluta.

**Investigação (logs DB):**
- 21:41:14 msg1 "Olá gostaria…material" → debounce processa → ai-agent envia greeting (21:41:33)
- 21:41:37 msg2 "Porta alumínio…" chega WEBHOOK enquanto ai-agent ainda roda LLM da msg1 → entra em queue separada
- 21:41:45 LLM da msg1 termina → `search_products({query:"material"})` → carrossel Telha PVC (único produto digital cadastrado tem "material" na desc)
- Log `response_sent` mostra `incoming_text="Olá gostaria…material"` + `message_count: 1` — confirma que LLM nunca viu "porta/janela/alumínio"

**Causa raiz tripla:**
1. Gap debounce (msg2 chegou entre greeting e LLM)
2. Query genérica escapa Bug 27 fix — `matchCategoryBySearchText("material")` não casa nenhuma das 24 regex → `expectedCategory=null` → `filterProductsByExpectedCategory` no-op
3. Categorias `portas`/`janelas` estão como `catalog_status:offline` mas LLM-driven search NÃO checa isso (só auto-extract `r121_*` checa)

**Fix v7.38.4 (Camadas 1+2):**
- `_shared/searchGuard.ts` (96 lin) com `evaluateSearchGuard()` — guard determinístico ANTES do query DB: recusa query genérica sem categoria + recusa categoria offline
- `_shared/searchGuard.test.ts` — 15 cenários incluindo repro EXATO Guttemberg
- `ai-agent/index.ts` integra helper após cálculo de `expectedCategory` (linha ~2204) + log estruturado `search_guard_blocked`
- Migration `20260520210000_*` adiciona `search_guard_blocked` ao CHECK constraint (R88: silent INSERT fail)

**Camada 3 (debounce gap) — backlog.** HIGH RISK (mexe em fluxo greeting→LLM), merece sprint próprio. Plano documentado: re-check `ai_debounce_queue` antes do LLM rodar + merge mensagens não-processadas + cancelar timer mergeado.

**Pipeline:**
- 15/15 testes PASS em `searchGuard.test.ts`
- typecheck 0 erros
- npm test: 817 pass / 9 falhas pré-existentes (intocadas, mesmo padrão R124/R125)
- Deploy `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v56 → v62 ACTIVE, `verify_jwt:false`

**Docs:**
- CHANGELOG v7.38.4
- erros-e-licoes — R126 (Top recente, antigas PostgREST/UAZAPI≠Business movidas pra historico)
- regras-preventivas — entrada R126
- log.md (este)

**Nota 0-10: 9/10.**
- Conteúdo: 10 (causa raiz tripla precisa via logs DB + queue + catálogo; helper testável + 15 cenários; doc completa)
- Orquestração: 9 (refactor `_shared/`, migration aplicada antes do código depender dela, vault healthcheck respeitado <300lin)
- Estado: 8 (Camadas 1+2 cobrem 90%; Camada 3 documentada como backlog. E2E real via WhatsApp não foi feito — user vai testar agora)

**Frase de retorno**: "continuar bug R126 Camada 3 debounce 2026-05-20".

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

## 2026-05-17 (noite) — Bug 24 fix exit_action auto-extract (v7.37.7) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug24-exit-action]] em 2026-05-20 (hard limit 300 linhas).

---

## 2026-05-17 (noite-inicio) — Bug 21+22 validator BLOCK (v7.37.6) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug21-22]] em 2026-05-18 (hard limit 300 linhas).

---

## 2026-05-17 (fim tarde) — Bug 19 IA alucina interesse:CAT (v7.37.5) — arquivado

> Movido para [[wiki/log-arquivo-2026-05-17-bug19]] em 2026-05-18 (hard limit 300 linhas).

---


---

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-dashboard]] em 2026-05-14 (hard limit). Inclui Fase 1 (unificado), Fase 2 (métricas avançadas), Fase 3 (pivô comercial).

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
