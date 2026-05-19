---
title: Log Arquivo 2026-05-17 a 18 — bugs fila + handoff
type: log-arquivo
tags: [log, fila, handoff, bug-17, bug-24, R115, R116]
updated: 2026-05-19
---

# Log Arquivo — 2026-05-17 a 2026-05-18

> Sessões dos dias 17-18 de maio (bugs de fila + handoff + R115/R116). Removidas do log.md ativo em 2026-05-19 pra manter limite 300 linhas. Continuação em `log.md` (ativo).

---

## 2026-05-18 (tarde) — R116 detectResponded: bot/IA marcava evento como `responded` erradamente

**Bug crítico (segunda iteração — R115 era parcial).** Após R96 (publication realtime), user voltou reportando que rotação NÃO acontecia mesmo natural: handoff → Lucas → 5min sem resposta → evento sumia, não rotacionava. Investigação direta no DB encontrou padrão claro nos eventos do George:

| created_at | expires_at | resolved_at | reason |
|---|---|---|---|
| 11:33:05 | 11:38:04 | 11:38:57 | **outgoing_after_assignment** |
| 12:09:54 | 12:14:54 | 12:14:57 | **outgoing_after_assignment** |

Todos `responded` ~3s após `expires_at`. Lucas nunca respondeu. A msg "Vou conectar você com nosso consultor..." do IA foi inserida +7.06s após criar o evento — bate o `RESPONDED_GRACE_SECONDS=5`. `detectResponded` linha 140-153 não filtrava `sender_id` → contava msg do bot como "atendente respondeu".

**Distinção crítica:** atendente humano via helpdesk preenche `conversation_messages.sender_id` com o user_id. IA/bot deixa NULL. Filtro `sender_id IS NOT NULL` discrimina perfeitamente.

**Fix shipado:**
1. `requeue-conversations/index.ts` `detectResponded` — `.not('sender_id', 'is', null)` adicionado, ignora msgs do bot.
2. `RESPONDED_GRACE_SECONDS` 5 → 15s (defense in depth para outras race conditions).
3. Deploy via CLI (PAT `eletropiso.wsmart@gmail.com`, project `prfcbfumyrrycsrcrvms`).

**Validação 5 cenários E2E paralelos:**
- **A** (George, handoff natural 5min30s real) ✅ — Lucas timed_out + rotacionou pra Jussara
- **B** (Maria, 3 msgs bot pós-handoff) ✅ — Lucas timed_out + Alberto rot 1 active
- **C** (Bug 11, wrap Slone qp50 → Lucas qp10) ✅ — wrap funcionou pulando Josafá (gerente sem opt-in)
- **D** (Wsmart, humano responde com sender_id=Lucas) ✅ — fechou como responded, fila parou corretamente
- **E** (ciclo completo 6 rotações) ⏳ rodando

**Lição (R116):** queries de "atendente respondeu" SEMPRE devem distinguir bot do humano via `sender_id IS NOT NULL`. Vai pra `wiki/erros/regras-preventivas.md` como regra dura.

---

## 2026-05-18 — R115 Fila Inteligente UI stale (badge não revalidava após rotação)

User reportou: badge "Em fila — Lucas (0:00)" travado, deveria ir pra Alberto mas pulou pra Slone/Djavan; depois badge sumiu de algumas conversas. 3 agentes em paralelo (audit código + dados prod + Playwright) confirmaram:

- **Backend correto.** Maria rotacionou Jussara→Djavan→Slone→Lucas→Alberto→Jussara→Djavan→Slone→Lucas 8x. `pick_next_assignee` com FOR UPDATE + cursor `last_assignee_position` funcionou. Pool real = 5 (Josafá é gerente fora da fila por design).
- **Bug é frontend.** `handoff_queue_events` NUNCA foi adicionado ao `supabase_realtime` publication (`20260320011406_enable_realtime_publications.sql` listou 10 tabelas, fila ficou de fora). Hook `useActiveQueueEvents` dependia 100% de broadcast HTTP `fireAndForget` do cron — sem retry, sem visibility. Quando broadcast falhava silente (DNS, throttling, etc), UI ficava stale eternamente.

**Fix (defense in depth):**
1. Migration `20260518000000_handoff_queue_events_realtime_publication.sql` — ADD TABLE idempotente. Aplicada em prod via MCP.
2. `src/hooks/useActiveQueueEvents.ts` — postgres_changes event='*' canônico + broadcast legacy + poll de segurança 3s quando há evento ativo expirado.

**Validação Playwright nota 10/10:**
- UPDATE forçado em `expires_at` → cron rotacionou em 60s → badge UI atualizou em ~1.5s sem F5 (Alberto rot 9 → jussara rot 10).
- Network requests confirmam: postgres_changes → GET handoff_queue_events → GET user_profiles → re-render badge.
- Console clean (0 errors). Screenshots `bug_fila_BEFORE.png` + `bug_fila_FIXED.png`.

TypeScript 0 erros. Hook só, sem alteração de edge fn (broadcast legacy continua funcionando como camada extra).

---

## 2026-05-17 (noite) — Bugs 29-32 handoff outside_hours sem horários FIXADOS (v7.37.18)

User reportou: IA atendeu fora horário OK mas transbordo enviou msg genérica sem horários. Diagnóstico: `handoff_message_outside_hours` do Eletropiso estava genérico; LEGADO `out_of_hours_message` (texto detalhado) não é mais lido desde D32. Fixes:

- **B29**: UPDATE Eletropiso `handoff_message_outside_hours` com horários completos (Seg-Sex 8h-18h, Sáb 8h-12h) no DB prod.
- **B30**: removido `out_of_hours_message` do `ALLOWED_FIELDS` (AIAgentTab.tsx).
- **B31**: `enrichOutsideHoursMessage` + `formatBusinessHours` em `_shared/businessHours.ts`. Injeta prefix com horários quando msg não menciona (regex `/\d{1,2}h\b|horário|seg-/i`). 13 testes Vitest novos.
- **B32**: placeholder admin UI com exemplo + hint sobre injeção automática.

**Acidente:** deploy MCP `deploy_edge_function` com content="" derrubou ai-agent prod (verify_jwt:true vazio). Recuperado 1min via `npx supabase functions deploy ai-agent`. Regra preventiva em [[wiki/erros-e-licoes]] + memory `feedback_deploy_edge_use_cli_not_mcp`. v7.37.18 = version 56.

**E2E 5/5 PASS** (Sandbox→Eletropiso prod, dom 20:50 BRT fora horário): C1 trena+profissional → handoff COM horários ✅ · C2 trigger "vendedor" → handoff COM horários ✅ · C3 cama box (excluded) → resposta educada ✅ · C4 tinta acrílica fosco branco Suvinil → max_score → handoff COM horários ✅ · C5 reabertura D34 (resolvida 2d) → IA usou "George" sem reperguntar nome ✅.

**Frase de retomada:** *"validar handoff outside_hours em prod com lead real 2026-05-18"*.

---

## 2026-05-17 (madrugada+) — Bug 17 v2 + Bug 24 v5 search_products FIXADOS (v7.37.15)

Bug 17 v2: regex multiline expandida cobre olá/oi/bom dia/etc + nome + qualquer linha. Bug 24 v5: mirror v4 handoff, flag pendingExitActionSearch, executeToolSafe inline. E2E PASS: TI Pedro tinta (carrossel, sem "Olá"), TII Sandra 7 turnos (sem "Olá Sandra!", 2 carrosseis, score 80). Screenshot: `wiki/validacoes/bug17_24sp_validados.png`.

---

## 2026-05-17 (madrugada) — Bug 26+27 FIXADOS + 5 testes pós-fix (v7.37.11→v7.37.14)

Bug 27 (v7.37.11): handler search_products seed `interesse:` via `matchCategoryBySearchText` + auto-extract fields se LLM pular set_tags. Bug 26 v3 (v7.37.14, 3 iters): dispara SEMPRE que LLM cravou interesse:* inválido E conv sem interesse: setado → backend remapeia pra ID correto automaticamente. **E2E 5 testes: 4 PASS limpos + 1 parcial** (T1 Sofia lampada · T2 Felipe disjuntor parcial score · T3 Beatriz vaso · T4 Lucas torneira · T5 Rafael cano). Combinado com Bug 24 v4, as 23 categorias podem ser handoff-completas via 3 camadas de defesa em código (LLM vira passageiro). Screenshot: `wiki/validacoes/5testes_pos_bug26_27.png`.

---

## 2026-05-17 (noite tardíssima) — Bug 24 v4 FIXADO: RPC fantasma escondia o inline handler (v7.37.10)

User pediu "continuar até nota 10". Foco: Bug 24 v3 (handoff via set_tags) que não disparava.

**Debug via breadcrumbs**: adicionei inserts em `ai_agent_logs` no handler set_tags como breadcrumbs. Reteste J4 chuveiro:
- Breadcrumb `bug24_flag_set` apareceu (com `newScore=30, max_score=30, pendingExitActionHandoff_setado=true`) ✅
- Breadcrumb `bug24_checkpoint_pre_inline` **NÃO apareceu** ❌

Isso prova que o handler RETORNOU antes do meu bloco inline. Auditei o código → linha 2950 era um path de fallback com `return` precoce.

**Root cause**: o handler set_tags chamava `supabase.rpc('merge_conversation_tags', ...)`. Esse RPC **NÃO EXISTE no projeto novo** (provavelmente foi removido na migração ou nunca foi criado). RPC retornava error → caía no fallback path → fazia merge in-memory → **return PRECOCE** antes do meu bloco inline.

```ts
// ANTES (Bug 24 v3 não funcionava):
if (error) {
  // fallback in-memory merge
  return `Tags atualizadas...`  ← retorno aqui pulava o handoff inline!
}
const merged = updatedConv?.tags || [...]
// bloco inline aqui (nunca alcançado em prod novo)
```

**Fix v7.37.10 (Bug 24 v4)**: unifiquei os 2 paths (RPC + fallback). Ambos resolvem `merged` numa variável só, e depois o fluxo continua linearmente até o bloco inline. Não há mais `return` precoce.

**Validação E2E (mesma conv chuveiro/220v):**
- T4 "220v" → IA enviou EXATAMENTE `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis."*
- Log `event=implicit_handoff, reason=exit_action_set_tags_inline, exit_reason=chuveiros > voltagem chuveiro:220v, outside_hours=true, queue.assignee_name=Djavan`
- `status_ia=shadow`, tag `ia:shadow`, `lead_score:30` ✅

**Impacto:** Bug 24 v4 corrige o caminho CRÍTICO que afetava 90% das jornadas (toda categoria de 2 fields × 15 score = max 30 com exit_action=handoff). Agora chuveiros, ferramentas, torneiras (se LLM tagueasse interesse), canos (idem), portas (se score chegasse), fechaduras (se IDs corretos), etc. — todos disparam handoff automático correto.

**Bugs ainda em backlog** (não bloqueantes pra usabilidade básica — mas degradam UX):
- **17 regressão** (LLM recumprimenta — investigar `prompt_sections`)
- **24 search_products** (categoria tinta — estender helper)
- **26 LLM repete `interesse:hidraulica`** (sugerir categoria correta no retorno do guard)
- **27 LLM pula `set_tags interesse`** (lampada/disjuntor/vaso vão direto pra search)

**Lição preventiva (regra nova):** quando uma fn chama `supabase.rpc('X', ...)` E tem um fallback path com `return`, SEMPRE conferir se a RPC existe no DB do ambiente atual. RPC missing causa fallback silencioso + return precoce, mascarando bugs em código novo que vem depois.

**Validação que estou rodando agora:** 3 PASS limpos (J2 porta + J4 chuveiro Bug24v4 + J10 excluded) confirmam Bug 24 v4 funcionando. Bugs 17, 26, 27 ficam pra próxima sessão.

Screenshot: `wiki/validacoes/bug24_v4_chuveiro_validado.png`. Frase de retomada: *"fixar Bug 27 LLM set_tags antes search 2026-05-18"*.

---

## 2026-05-17 (noite tarde) — Sessão 10 jornadas E2E reais + Bug 25 fix + 4 bugs catalogados (v7.37.8/v7.37.9)

User pediu 10 testes E2E completos (greeting → nome → produto → qualif → transbordo) e correção dos erros. Resultado: 2 PASS + 1 parcial + 7 FAIL — 5 bugs novos catalogados.

**Sumário:**
- J1 tinta → Bug 17 regressão + Bug 24 não cobre exit_action=search_products
- J2 porta → ✅ PASS handoff outside_hours
- J3 torneira → LLM crava `interesse:hidraulica` (categoria inexistente) — Bug 25 identificado
- J4 chuveiro → score=max+exit_action=handoff mas IA vazia (Bug 24 v2/v3 não dispara)
- J5 cano → Bug 25 fix FUNCIONOU (log `interesse_hallucination_blocked` × 2) mas LLM persiste cravando hidraulica (Bug 26)
- J6 lâmpada, J7 disjuntor, J9 vaso → LLM não tageia interesse, vai direto search → enrich loop (Bug 27)
- J8 fechadura → LLM usa singular (`fechadura` vs `fechaduras`) → score parcial sem handoff
- J10 cama (excluded) → ✅ PASS reply correto

**Fix shipados nesta sub-sessão:**

1. **Bug 25 (v7.37.8)**: `interesse:CAT` agora é rejeitado também quando a categoria **NÃO EXISTE** em service_categories. Antes o guard Bug 19 só atuava quando categoria existia + regex não batia. Agora cobre ambos os casos. Log `interesse_hallucination_blocked, reason=category_not_in_schema`. **VALIDADO PROD** em J5.

2. **Bug 24 v2 / v3 (v7.37.9)**: tentativa de disparar handoff direto no `set_tags` handler quando `score>=max_score && exit_action=handoff` (mirror do Bug 18). **NÃO FUNCIONOU em prod** — 2 abordagens (flag pós-loop + inline no handler) não dispararam. Suspeita: problema de closure entre o handler `set_tags` (dentro de `executeTool` na linha 2011) e a flag `pendingExitActionHandoff` (declarada na linha 452). Precisa de debug adicional com `console.error` explícito + análise via `get_logs`.

**Bugs em aberto pra próxima sessão:**

| Bug | Severidade | Sintoma | Hipótese fix |
|---|---|---|---|
| 17 regressão | Médio | LLM recumprimenta "Olá NOME!" mid-conv apesar da regra hardcoded | Investigar `prompt_sections.sdr_flow` do agente Eletropiso — pode estar sobrescrevendo a regra global |
| 24 v2 inline | **CRÍTICO** | Score atinge max via set_tags + exit_action=handoff → IA gera vazio → silêncio (90% das jornadas falham por isso) | Debug com `console.error` explícito + `get_logs` pra confirmar se bloco roda |
| 24 search_products | Alto | Categoria tinta score 60≥40 nunca dispara search direto | Estender o helper Bug 24 também pra `exit_action=search_products` (chamar `search_products` direto no código) |
| 26 LLM repetindo categoria inválida | Alto | Após Bug 25 rejeitar, LLM tenta de novo `interesse:hidraulica` sem se ajustar | No retorno do handler: sugerir categoria correta ("use `torneiras` ou `canos` em vez de `hidraulica`") |
| 27 LLM pula set_tags interesse | Alto | Em lampada/disjuntor/vaso, LLM vai direto pra search sem tageiar interesse — score nunca sobe | Reforçar prompt: "SEMPRE set_tags interesse:CAT ANTES de search_products" |

**Causa-raiz dominante:** os fixes determinísticos (handlers, guards) funcionam, mas o **LLM em si** continua não respeitando regras hardcoded do prompt. Precisamos mais defesa em código, menos confiança no LLM.

**Frase de retomada:** *"debugar Bug 24 v3 inline + Bug 26 sugestao categoria 2026-05-18"*. Screenshot: `wiki/validacoes/10jornadas_helpdesk.png`.

---

