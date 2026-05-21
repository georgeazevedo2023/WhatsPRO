---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-21 (manhã II) — R132: IA ignorou transcrição de áudio (Edson EletropisoV2 v7.38.7)

**Bug ao vivo prod.** Lead Edson (558781302237) mandou "Bom dia" → "Edson" → áudio "Você tem a quartisolite rejunto pra piscina?". IA respondeu pergunta GENÉRICA "Edson, em que tipo de material ou produto…". User mandou print perguntando "pq o agente de ia nao respondeu a transcrição".

**Investigação:**
- Conv `353e5b4d-fe1c-4634-a38d-04ba1e90e912` — auditei `conversation_messages` (timeline) + `ai_agent_logs` (response_sent payload)
- Log mostrou `incoming_text="Edson"` + `incoming_has_audio=false` quando áudio JÁ tinha chegado (11:24:03) e tinha transcription populada na tabela
- Grep em `ai-agent/index.ts` revelou bug:308-322 lia só `m.content` do queue, áudio com content="" sumia em `.filter(Boolean)`
- Mapeei pipeline: webhook NÃO enfileira áudio (skip explícito linha 1300) → transcribe-audio assíncrono → chama ai-agent-debounce DEPOIS. Race com queue de texto.

**Diagnóstico:** 4º incidente da família Camada 3 (R126 Guttemberg + C8 multi-msg + R50 backlog + R132 áudio Edson). Causa raiz comum: queue não captura estado real.

**Opções propostas A/B/C — user escolheu B** (re-leitura DB antes do LLM).

**Fix implementado (v7.38.7):**
- `_shared/incomingMessagesLoader.ts` — helper testável (4 funções puras: `buildIncomingFromDbRows`, `buildIncomingFromQueue`, `calcLowerBoundTs`, `loadIncomingMessages`)
- `_shared/incomingMessagesLoader.test.ts` — 14 testes (Edson repro, áudio+texto combinados, fallback DB error, empty queue, exceções)
- `ai-agent/index.ts:308-340` — import + integração com log estruturado `R132 db-vs-queue divergence resolved`

**Pipeline:**
- typecheck 0 erros
- vitest: 849 pass / +14 novos / 9 falhas pré-existentes (URL imports Deno + FormBuilder/useForms intocadas)
- deploy CLI: `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` → v64 ACTIVE (1ª passada com label "R131", renomeado pra R132 por colisão com sessão paralela do phrasing)

**Renomeação R131 → R132:** outra sessão paralela já tinha usado R131 pra outro bug (phrasing repetido v7.38.6). Renomeado em CHANGELOG, helpers, comentários, log estruturado.

**Docs:**
- CHANGELOG v7.38.7
- erros-e-licoes — entry R132 no topo (R131 phrasing logo abaixo preservada)
- regras-preventivas — entries 86 e 87
- log.md (este)

**Nota 0-10: 9/10.**
- Conteúdo: 10 (diagnóstico end-to-end via logs DB + grep, helper testável, fix mínimo cirúrgico, 14 testes cobrindo race áudio + fallback + erros)
- Orquestração: 9 (TaskList atualizada, deploy CLI obrigatório respeitado, semver bumpada pra evitar colisão com sessão paralela)
- Estado: 8 (deploy ok, mas E2E real com Edson não foi feito ainda — fix começa a valer da próxima msg dele. Re-deploy menor pra atualizar label "R131"→"R132" no log estruturado em prod pode ser feito junto com próximo deploy)

**Frase de retorno**: "validar R132 áudio em prod 2026-05-21".

---

## 2026-05-21 (manhã) — R131: phrasing curto na 2ª+ pergunta do stage (v7.38.6)

**Trigger:** print do helpdesk Eletropiso — IA repetindo "Para encontrar a melhor opção, qual X?" 3x na qualif de tintas (ambiente, tipo, cor). User: "não gostei do agente ficar repetindo, de onde veio isso?"

**Diagnóstico:**
- Origem em `_shared/serviceCategories.ts:107` (template `phrasing` do stage `identificacao` da categoria `tintas`)
- `formatPhrasing(stage.phrasing, field)` aplica o MESMO template pra cada field não respondido do stage → preâmbulo repete

**Decisão (recomendação minha):** opção híbrida cosmética em vez de "deixar LLM reformular" (opção 4 inicial). Razão: últimos 5 commits (R124-R130) reforçaram determinismo; soltar a abertura agora arriscaria regressão. Cosmético resolve queixa com risco zero.

**Fix:** `formatPhrasing` aceita 3º parâmetro `answeredCountInStage` (default 0, backward compat). `>= 1` → template curto. 3 call sites no `ai-agent/index.ts` passam o count.

**Testes:** +4 testes R131 em `serviceCategories.test.ts` (120/120 PASS). Suite completa: 9 falhas pré-existentes não relacionadas (5 suites Deno-style `import "https://..."` + useForms/excludedProducts/FormBuilder).

**Deploy:** `npx supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✅ (PAT eletropiso.wsmart).

**Observação do user pra próxima sprint:** o caso de hoje também mostra que o agente NÃO detecta quando o lead demonstra desconhecimento técnico ("a melhor que vc tiver", "n sei qual"). Continuou perguntando "qual tipo? (acrílica/esmalte/epóxi)" assumindo vocabulário. Sprint dedicada aberta (memory `project_sprint_agente_consultivo.md`).

---

## 2026-05-21 (madrugada) — R127/R128/R129/R130 + E2E 10 jornadas sandbox (v7.38.5)

**Sessão E2E real de 4 bugs novos descobertos + fixados via sandbox UAZAPI 558185749970 → EletropisoV2 558781592373.**

**Trigger:** user mandou print do helpdesk mostrando loop "Para qual ambiente você precisa da janela?" 3x mesmo lead respondendo "para a cozinha" 3x. Diagnóstico: lead pediu porta+janela alumínio, sistema esqueceu portas silenciosamente (R127), depois LLM inventou field inexistente (R130).

**Bugs descobertos durante a sessão:**
- **R127** (multi → mergeTags REPLACE silencioso) — fix com `_shared/setTagsValidator.ts` (14 testes)
- **R128** (sale_closed false positive em "quero comprar") — removido regex ambíguo em `saleClosedDetection.ts`
- **R129** (auto-extract pega 1ª categoria silenciosamente) — fix `matchAllCategoriesBySearchText` + curto-circuito LLM com pergunta "qual começar primeiro"
- **R130** (LLM improvisa field inválido pós-set_tags) — flag `pendingForcedNextQuestion` + OVERRIDE pós-LLM determinístico

**E2E real validado (10 cenários, 9/10 PASS):**
- C1 bom dia ✅
- C2 porta alumínio ✅ (R126 Camada 2 reconfirmada)
- C3 indireto Maria ✅ (R128 fix funcionando)
- C4 porta+janela ✅ (R127+R129)
- C5 multi+escolha ✅ (R130 override decidiu — LLM tentou send_poll com ambiente, override substituiu pela frase correta)
- C6 tinta acrílica branca ✅
- C7 preço genérico ✅
- C8 saudação + vaso ⚠️ (LLM ignorou 2ª parte — bug Camada 3 debounce, tracked como backlog)
- C9 3 categorias ✅
- C10 greeting+intent fechadura ✅

**Pipeline:**
- typecheck 0 erros
- testes novos: 14 setTagsValidator + 15 searchGuard + 8 handoffGuard = 37 PASS
- ai-agent v62 → v63 ACTIVE (4 deploys: R127, R128, R129, R130 v1 + v2)
- 1 migration aplicada (`set_tags_duplicate_keys_rejected` no CHECK constraint)

**Docs:**
- CHANGELOG v7.38.5
- erros-e-licoes — entry R127/R128/R129/R130 combined
- regras-preventivas — entries 127, 128, 129, 130
- log.md (este)

**Nota 0-10: 9/10.**
- Conteúdo: 10 (4 bugs distintos descobertos via E2E real, fixes determinísticos com helpers testáveis + override pós-LLM, regras preventivas precisas)
- Orquestração: 9 (incremental — descobrir, fix, deploy, retest, próximo. Migration aplicada antes do código depender. Vault healthcheck respeitado)
- Estado: 8 (9/10 cenários PASS; C8 documentado como backlog Camada 3; sessão E2E real custou ~1.5h vs horas de debug em prod se shipasse sem teste)

**Frase de retorno**: "continuar bug C8 multi-msg combined Camada 3 2026-05-21".

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

## 2026-05-19 (tarde) — Migração Eletropiso → nova instância +558781592373

**Migração aditiva.** Nova instância UAZAPI criada com número +558781592373 (id `re662a6d32de7e0`, token `aaae9607-...`). Eletropiso atual (`r466a98889b5809`) preservada e segue operando em paralelo.

**Estrutura criada:**
- inbox `01a9c21d-98c8-4225-805a-18e79e7df719` (nome "Eletropiso 558781592373")
- department `5240c457-762d-4adc-868c-71c1d82b7f57` ("Vendas", is_default=true, **queue_mode_enabled=false**, **default_assignee_id=Lucas**)
- 6 inbox_users (clone integral) — mas SO Lucas em department_members (qp=10)
- 6 user_instance_access
- ai_agent `1062059a-b5b2-49cf-9032-098cf6875d73` (clone integral 56 colunas — service_categories, excluded_products, prompt_sections, business_info, business_hours, handoff_message, etc.)
- 7 ai_agent_products clonados (URLs de imagem compartilhadas, sem duplicação no storage)

**Fila desligada — Opção C** (recomendação do audit em 5 agentes): com `queue_mode_enabled=false` + `default_assignee_id=Lucas`, todo handoff vai direto pra ele (handoffQueue.ts:166-174). Outros 5 atendentes têm acesso à inbox mas não recebem handoff automático.

**Pendências do usuário:**
1. Criar fluxo n8n novo (path único, ex: `eletropiso_558781592373`)
2. Configurar webhook UAZAPI da nova instância → URL n8n
3. Teste E2E

**Doc:** [[wiki/migracao-eletropiso-558781592373]] (procedimento + IDs + rollback).

**Lição:** `instances.id` é gerado pelo UAZAPI, não pelo DB. Buscar via `GET /instance/status` com token quando o painel não mostra. Clone de ai_agent via INSERT...SELECT listando ~56 colunas explicitamente é mais robusto que `SELECT *`.

---

## 2026-05-19 — DB Reset total pré-nova-instância

**Operação destrutiva autorizada.** Usuário vai cadastrar uma nova instância e pediu limpeza completa de dados operacionais para evitar cruzamento com Eletropiso (contacts/leads/conversations/logs).

**Auditoria antes:** 21 contatos, 24 conversas, 1941 msgs, 18 lead_profiles, 551 handoff events, 44 lead_db_entries, 1 lead_database, 47 score_history, 2 lead_memory, 1 poll_message — todos da Eletropiso. Sandbox IA já vazia.

**Decisões do usuário:** (1) escopo TOTAL todas instâncias, (2) apagar lead_databases também, (3) SEM backup.

**Executado:** `TRUNCATE ... RESTART IDENTITY CASCADE` em transação única, listando 32 tabelas explicitamente (contacts/conversations/messages + ~20 FK-dependentes: ai_agent_logs, ai_debounce_queue, flow_states, intent_detections, handoff_queue_events, validator_logs, shadow_extractions, etc.). 0 erros. Validado com COUNT em 19 tabelas — todas em 0.

**Preservado intencionalmente:** instances (2), inboxes (2), departments (2), inbox_users (7), user_roles (7), auth.users (7), whatsapp_forms (6), ai_agent_configs, products, flows, funnels, labels.

**Doc:** [[wiki/db-reset-2026-05-19]] (procedimento + tabelas + comando + lição).

**Lição:** Reset total seguro = TRUNCATE em transação única com lista explícita de todas as filhas + RESTART IDENTITY. Não confiar só no CASCADE da FK — auditar `information_schema.table_constraints` antes pra evitar tabela órfã.

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
