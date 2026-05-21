---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

## 2026-05-20 (noite II) — Fix R125: badge "Em fila" no Modo OFF (v7.38.3)

**Bug reportado pelo user via screenshot.** Modo Fila do dept Vendas desligado no QueueConfig, mas helpdesk mostrava `⏱ Em fila — Lucas (2:10)` na conversa do dinho. "Se desliguei a fila, por que aparece?"

**Causa raiz.** `_shared/handoffQueue.ts` criava `handoff_queue_events` ativo em **todo** handoff, mesmo com `queue_mode_enabled=false`. Hook `useActiveQueueEvents` renderiza badge sempre que existe row ativa — sem olhar o flag.

**Fix em 2 frentes:**
1. **Backend (`_shared/handoffQueue.ts`)** — bloco INSERT/UPDATE de queue_event agora roda só quando `dept.queue_mode_enabled === true`. No Modo OFF, faz UPDATE só em `conversations.assigned_to` + cancela qualquer event ativo herdado da transição ON→OFF.
2. **UI (`QueueConfig.tsx`)** — `handleSave` cancela events ativos do dept quando toggle salva OFF (não depende de novo handoff acontecer).

**Limpeza imediata em prod.** SQL via MCP: `UPDATE handoff_queue_events SET status='cancelled' WHERE id='693eb2a2...'` → badge sumiu imediato via postgres_changes.

**Pipeline:**
- 21/21 testes PASS em `handoffQueue.test.ts` (1 novo: `R125 — Modo OFF não chama insert`)
- typecheck 0 erros
- npm test: 802 pass / 9 falhas pré-existentes (intocadas)
- Deploy `ai-agent v176` + `assign-handoff v2` ✓ via scoop CLI

**Docs:**
- CHANGELOG v7.38.3
- erros-e-licoes — R125 (Top recente)
- regras-preventivas — entrada R125
- memory — `feedback_ui_must_respect_feature_toggle.md` + `project_bug_queue_badge_off.md`

**Nota 0-10: 9/10.**
- Conteúdo: 10 (causa raiz precisa, fix em 2 camadas, limpeza prod, teste novo)
- Orquestração: 9 (fix backend + UI defense-in-depth)
- Estado: 8 (E2E real validado com queue=0 ativo no DB; UX em browser depende de ter um handoff novo pra confirmar — coberto por unit)

**Frase de retorno**: "abrir bug R125 badge fila OFF 2026-05-20".

---

## 2026-05-20 (noite) — Fix R124: handoff bloqueado eternamente após search_fail (v7.38.2)

**Bug em prod (Eletropiso 558781592373, conv Carla `04baffce`).** Lead pediu valor de arandela → IA buscou 0 resultados → setou tag `search_fail:1` + `produto:arandela` → pediu refinamento → lead voltou pedindo valor → IA tentou `handoff_to_human` 2x mas guard "REGRA BUSCA OBRIGATÓRIA" bloqueou. Conversa ficou **não atribuída**, **IA Ativa**, sem mensagem de transbordo, **sem atribuir Lucas (default_assignee)**. Loop infinito.

**Investigação (logs `ai_agent_logs`):**
- 20:17:04 `search_products(arandela)` → 0 results
- 20:18:27 `handoff_to_human` → guard bloqueou (msg "REGRA BUSCA OBRIGATÓRIA")
- 20:18:41 `handoff_to_human` de novo → guard bloqueou de novo

**Causa raiz** (`ai-agent/index.ts:3562-3575`): guard checava `toolCallsLog.some(t => t.name === 'search_products')` — `toolCallsLog` reseta a cada invocação da edge function. Busca foi no turn 1; turn 4 já tinha esquecido. Tag `produto:arandela` permanente → bloqueio eterno.

**Fix v7.38.2:**
- Extraído pra `_shared/handoffGuard.ts` (44 lin) — `evaluateHandoffGuard()` testável
- `_shared/handoffGuard.test.ts` (69 lin) — 8 cenários, incluindo repro EXATO da Carla
- `index.ts` consome helper (importa do shared)
- Nova condição: libera handoff se `tags.some(t => t.startsWith('search_fail:'))`

**Pipeline:**
- 8/8 testes PASS
- typecheck 0 erros
- npm test: 801 pass / 9 falhas pré-existentes (não tocadas)
- Deploy `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ (via scoop CLI; npx falhou com SmartScreen)

**Docs:**
- CHANGELOG v7.38.2 — release com diagnóstico + lição
- erros-e-licoes — R124 (Top recente)
- regras-preventivas — entrada R124 acima da #116
- memory — `feedback_guard_must_check_durable_tags.md` + `project_bug_handoff_search_fail.md`

**Nota 0-10: 9/10.**
- Conteúdo: 10 (causa raiz precisa, fix mínimo, 8 testes incluindo repro)
- Orquestração: 9 (refactor pra `_shared` + helper testável, índices do vault atualizados)
- Estado: 8 (E2E real via WhatsApp na sandbox não foi feito — coberto por unit + repro de prod logs; ficou opcional pro user)

**Frase de retorno**: "abrir bug R124 handoff search_fail 2026-05-20".

---

## 2026-05-20 (tarde) — D36 Permissões granulares + redesign Categorias/Excluded (v7.38.0)

**Sprint completo.** Redesign UX Categorias/Excluded + sistema de permissões granulares (F1) shipado.

**Redesign Categorias + Excluded (3 iterações):**
1. Grid 2-3 col responsivo + Sheet drawer pro editor de categoria
2. Toolbar (busca + sort + paginação 12/pg) + stats bar 4-cards + tiles com avatar colorido determinístico
3. Mobile compacto: 4 cols sempre nos stats, avatares 32px mobile, padding p-3, labels abreviadas

**Permissões granulares (D36 — feedback do user "alguns atendentes precisam gerenciar catálogo"):**
- Migration `user_feature_permissions` + função `has_feature_permission` SECURITY DEFINER aplicada em prod via MCP
- types.ts regen via MCP
- Hook `useFeaturePermission(feature)` + components `<FeatureRoute>` + `<AnyFeatureRoute>`
- `UserPermissionsDialog` (botão Shield no UsersTab) com 5 toggles + reset pro padrão
- Gerente agora acessa `/dashboard/admin/users` (era só super_admin)
- AIAgentTab: 5 guards de tab (Categorias, Excluded, Catálogo, Conhecimento, Bloqueados)
- Sidebar "Agente IA" aparece pra atendente com qualquer feature

**Bugs próprios corrigidos na auditoria intermediária:**
- **Bug A**: Gerente não acessava `/admin/users` — AdminRoute → CrmRoute
- **Bug B**: 3 guards `isSuperAdmin` duplicados em AIAgentConfig/Catalog/Knowledge — removidos
- **Bug C**: Migration não aplicada — aplicada via MCP

**Backlog próxima sessão (Task #20):**
- Esconder ações destrutivas do gerente em UsersTab (delete + role select pra super_admin) — gap de privilege escalation
- Testes vitest pra useFeaturePermission/FeatureRoute/UserPermissionsDialog
- Validar UX `BlockedNumbersConfig` (já existe na tab Segurança)

**Lição:** sempre auditar guards internos duplicados ao adicionar route guards — múltiplas camadas viram bug silencioso (página redireciona mesmo passando o guard de rota). Pattern: route guard único, página interna confia.

**Validação:** tsc 0 erros, vitest 793 ✅ (9 falhas pré-existentes confirmadas via git stash).

---

## 2026-05-20 — Prefixo nome atendente em mensagens humanas (v7.37.21)

**Feature UX simples** do helpdesk. Atendente humano envia "Oi Maria" → lead recebe `*Lucas*\nOi Maria` no WhatsApp. Negrito + linha separada deixa explícito quem está falando, principalmente em fluxos onde atendente troca ou IA volta a assumir.

**Decisões do usuário (via AskUserQuestion):**
1. **Frequência:** toda mensagem outgoing (não só primeira do turno). Trade-off avaliado: +verbose, mas evita confusão em conversas longas.
2. **Formato:** `*Nome*` em negrito (WhatsApp renderiza), só primeiro nome.
3. **Escopo:** só texto. Áudio/imagem/documento mantêm fluxo atual.

**Onde mexeu:** `src/components/helpdesk/ChatInput.tsx`
- L100-119: novo state `agentName` + useEffect carrega `user_profiles.full_name` no mount → primeiro nome (fallback email).
- L354-360: handleSend monta `quoted` (com citação opcional do replyTo) e adiciona prefixo `*${agentName}*\n` quando NÃO é nota privada e há nome carregado. Prefixo vai pro UAZAPI E pro DB → card outgoing no helpdesk mostra exatamente o que o lead viu.

**Notas privadas excluídas** (direction='private_note' não passa por send-chat e é uso interno). **Mídia excluída** (escopo escolhido).

**TS check:** ✅ 0 erros. Build local não rodado (mudança contida, 1 arquivo). Deploy: CI builda + Portainer webhook após push.

**Lição:** features de UX de helpdesk pequenas como essa não precisam de migration nem edge function — todo o estado relevante (nome do atendente) já existe em `user_profiles`. Lookup 1x no mount via useEffect, sem refetch a cada send. Mantém p99 do handleSend igual ao anterior.

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
