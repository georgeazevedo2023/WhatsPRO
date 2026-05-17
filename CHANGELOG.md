---
title: Changelog
type: changelog
updated: 2026-05-17
audited_at: 2026-05-17
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.37.2 (2026-05-17) — Bug 15b: out_of_hours_message nunca enviada (contact_id ausente no select)

**Problema:** quando lead manda msg fora do horário comercial e há `handoff_queue_event` ativo, o cron `requeue-conversations` deveria pausar o evento E enviar a `out_of_hours_message` configurada (ex: *"Olá! Estamos fora do horário..."*). Em prod, os events ficavam `out_of_hours_msg_sent=false` indefinidamente e o lead nunca recebia o aviso. Reproduzido com domingo (Eletropiso fechada): 2 events ativos (George + Bug 11 Test) pausados há 1h45 sem mensagem.

**Causa raiz:** `requeue-conversations/index.ts:101` fazia `select('id, inbox_id, assigned_to')` na conversa — **`contact_id` faltava**. Depois, linha 211 tentava `from('contacts').select('jid').eq('id', conv.contact_id ?? '')` → `eq('id', '')` → nunca achava o contato → `if (contact?.jid)` retornava false → `/send/text` UAZAPI nunca era chamado → `oofMessageSent` permanecia false → `out_of_hours_msg_sent` nunca virava true. Bug silencioso: `handoff_queue_events.paused_at` era setado normalmente (pausa funcionava), só a mensagem ficava perdida.

**Fix:** adicionar `contact_id` no select da `loadAgentForConversation`. 1 linha mudada.

**Validação E2E prod:**
- UPDATE forçou os 2 events a reentrar no Case B (paused_at=null + expires_at < now + out_of_hours_msg_sent=false).
- Próximo tick do cron (~1min): 2 INSERTs em `conversation_messages` com `external_id=queue_oof_*` + conteúdo da out_of_hours_message; `out_of_hours_msg_sent=true` em ambos events.
- Playwright confirmou visualmente a mensagem na conv George.

**Regra preventiva:** ao construir queries Supabase, lembrar SEMPRE de selecionar colunas usadas downstream no mesmo handler. PostgREST não levanta erro quando você acessa coluna não-selecionada — vira `undefined` silente. Especialmente perigoso em pipelines fire-and-forget (Case B aqui só logaria via `log.warn` se UAZAPI fetch desse erro; como o fetch nunca era disparado, sem log algum).

Arquivos: `requeue-conversations/index.ts` (+1 linha select). tsc=0. Deploy via Supabase CLI.

**Cruza com:** D30 Sprint C (cron 1min + Case B), v7.36.5 (idempotência e retention de notifs que também tocaram esse cron).

---

### v7.37.1 (2026-05-17) — Bug 13: auto-extract de fields na 1ª msg do lead + categoria mesas

**Problema:** lead George mandou *"vcs tem mesa de plastico pra cozinha?"* na 1ª msg. IA respondeu *"Você tem preferência por algum material, como madeira, plástico ou alumínio?"* — ignorou o "plástico" que o lead já tinha mencionado.

**Causa raiz (auditada):** o auto-extract de fields (`ai-agent/index.ts:1531`) só rodava quando a conversa já tinha tag `interesse:` — projetado pra msgs do meio da conversa (turno 3+). Na 1ª msg, conv ainda não tem `interesse:` porque a tag só é setada pelo LLM DEPOIS do auto-extract rodar (mesma execução). Auto-extract ficava cego pra justamente a 1a msg, que é a que mais traz info.

Pior: além desse bug sistêmico, **categoria `mesas` não existia** nas 23 da Eletropiso → LLM cravava `interesse:mesa` (singular inválido), `matchCategory` retornava null, conversa caía em `default` (3 fields genéricos sem `material`).

**Fix duplo:**
1. **Categoria `mesas` cadastrada** no `service_categories` do agente Eletropiso (UPDATE SQL, +1 categoria: 23→24). Fields: `material_mesa`, `lugares_mesa`, `ambiente_mesa`. `exit_action=handoff` (D27 — qualif-then-handoff sem catálogo). `interesse_match: 'mesa|mesas'`.
2. **Helper novo `matchCategoryBySearchText`** em `_shared/serviceCategories.ts` — testa o regex `interesse_match` de cada categoria contra o **texto da mensagem do lead** (não contra a tag). Permite o auto-extract resolver a categoria diretamente do incomingText quando a tag ainda não foi setada.
3. **Patch em `ai-agent/index.ts:1531`** (HIGH RISK aprovado): fallback chain `matchCategory(interesseValue) || matchCategoryBySearchText(incomingText)`. Quando categoria foi resolvida via searchText (sem tag `interesse:` ainda), o auto-extract também **seeda** `interesse:<categoria.id>` — corrige Bug 12 colateralmente (LLM não consegue mais cravar `interesse:mesa` singular inválido porque o sistema já preencheu com `interesse:mesas` antes).

**Validação E2E (Eletropiso prod, conv 828e45b2…):**
- POST "vcs tem mesa de plastico pra cozinha?" com conv resetada.
- Auto-extract via searchText: categoria detectada=`mesas` (resolved_via=`search_text`).
- Tags pós-auto-extract: `[interesse:mesas, material_mesa:plástico, ambiente_mesa:cozinha]` (seedadas ANTES do LLM rodar).
- IA respondeu: *"Pra te ajudar com a mesa certa, quantos lugares? (2, 4, 6 ou 8 lugares)"* — pulou material+ambiente (já dito) e foi direto pro field faltante (`lugares_mesa`).

**Casos resolvidos sistemicamente** (toda 1ª msg rica):
- "Tem tinta acrílica fosco branco?" → seeda interesse:tintas + extrai tipo+acabamento+cor.
- "Preciso de chuveiro elétrico 220v" → seeda interesse:chuveiros + extrai tipo+voltagem.
- "Quero furadeira 220v Bosch" → seeda interesse:furadeiras + extrai voltagem+marca.

**Arquivos:** `_shared/serviceCategories.ts` (+30 helper), `_shared/serviceCategories.test.ts` (+87, 7 testes novos), `ai-agent/index.ts` (block reescrito), SQL: 1 categoria cadastrada via service_categories JSONB.

**SYNC RULE:** itens 1 (banco, via UPDATE em JSONB do agente) + 5 (backend) + 8 (docs) cumpridos. 2/3/4/6/7 N/A. Helper testado.

tsc=0. Vitest 116/116 em serviceCategories. Deploy `ai-agent` em prod (Supabase CLI).

**Cruza com:** D27 (handoff-first em catálogo embrionário — mesas usa esse padrão), D33 (filterProductsByExpectedCategory — mesma fallback chain de categoria), Bug 12 (mitigado via seed `interesse:` determinístico antes do LLM).

---

### v7.37.0 (2026-05-17) — D34: Reabertura de conversa resolvida em janela 60d

**Problema:** quando atendente clicava "Finalizar Atendimento" e o lead voltava a falar depois, o webhook criava **conv NOVA** em vez de reusar a anterior. Consequências: (a) Alberto continuava aparentemente "dono" do histórico velho enquanto IA atendia o lead de novo numa conv separada; (b) tags `interesse:tintas`/`motivo:compra` ficavam congeladas na conv velha — IA reiniciava qualificação do zero; (c) métricas do gestor não conseguiam ligar "Alberto resolveu" → "lead voltou 3 dias depois"; (d) greeting "Olá! Bem-vindo a Eletropiso" mesmo conhecendo o lead.

**Solução D34** (3 mudanças em sinergia):

1. **Migration `conversations_add_resolved_at`** — nova coluna `resolved_at TIMESTAMPTZ` + backfill via `updated_at` para rows históricas + index parcial `(contact_id, resolved_at DESC) WHERE status='resolvida'` para query O(log n).
2. **`TicketResolutionDrawer.handleSubmit`** — passa a setar `resolved_at = new Date().toISOString()` no update de Finalizar.
3. **`whatsapp-webhook`** (linha 822+) — antes de criar conv nova, busca última `resolvida` do mesmo `inbox+contact`. Função pura `shouldReopenConversation` (em `_shared/conversationReopen.ts`) decide: dentro da janela 60d + não tageada como spam → REABRE a mesma row (`status='aberta'`, `status_ia='ligada'`, `assigned_to=null`, append tag `reaberta:YYYY-MM-DD`, preserva todas tags antigas).

**Comportamento pós-fix:**
- Alberto desatribui automaticamente ao lead voltar (assigned_to=null) — não recebe duplicado no Minhas.
- IA reassume com **greeting personalizado** via `returning_greeting_message` (que já existia, dispara via `hasEverInteracted` por conta dos `ai_agent_logs` antigos da mesma conv).
- Tags preservadas → IA pula qualificação já feita E continua tageando trocas de interesse via `set_tags` normal.
- Métrica nova: `tags && ARRAY['reaberta:%']` permite ao gestor contar reaberturas no período.
- Spam continua criando conv nova (não polui métrica de retorno legítimo).
- Janela > 60d cria conv nova (lead frio merece reset).

**Validação E2E (Eletropiso prod):** Bug11 Test (conv `67bb8561…`) resolvida há 0.05 dias. POST webhook 1: "oi voltei, ainda tem aquele chuveiro?" → reabriu MESMA conv id, assigned_to=null, tags `[motivo:compra, interesse:hidraulica, resultado:perdido, reaberta:2026-05-17]`, IA mandou *"Olá Bug 11 Test! Que bom te ver de novo 😊"* + qualif chuveiro. POST 2: "na verdade desisti do chuveiro. quero uma furadeira pra concreto" → `set_tags` substituiu `interesse:hidraulica` por `interesse:furadeira` (mergeTags por chave) + IA perguntou "220v com fio ou 12v a bateria?" (categoria correta). Playwright confirmou na UI: conv no topo da lista, status "Atendendo", sem atendente atribuído.

**Arquivos:** migration `conversations_add_resolved_at`, `_shared/conversationReopen.ts` (+58), `_shared/conversationReopen.test.ts` (+103, 10 testes), `whatsapp-webhook/index.ts` (+43 / -16), `TicketResolutionDrawer.tsx` (1 linha update), `types.ts` (3 inserções de campo). tsc=0. Vitest novos 10/10.

**Cruza com:** D32 (IA 24/7), D33 (post-filter categoria). Não conflita com D30 (fila volta a ser acionada quando IA atinge handoff trigger na conv reaberta).

---

### v7.36.6 (2026-05-14) — Fix bugs 8+11 do AI Agent: cross-category leak + fallback genérico

Bugs descobertos em simulação prod 2026-05-13 ("produto fora do catálogo"). Confirmados E2E + fixados em prod.

**Bug 8** (alto): `search_products` retornava produto de categoria errada (lead pedia chuveiro → carrossel de tinta). Root cause: fuzzy `pg_trgm` casa "chuv" em "Sol e Chuva" tinta, bypassando filtros. Auto-tag `interesse:` sobrescrevia o correto silente via `mergeTags`.

**Fix Bug 8:** helper novo `filterProductsByExpectedCategory(products, expectedCategory)` em `_shared/serviceCategories.ts`. `expectedCategory` via fallback chain `args.category → interesse: tag → searchText`. Filtro aplicado 2x: antes E depois do fuzzy. Guard contra overwrite no auto-tag.

**Bug 11** (médio): após search falhar, IA respondia genérico "(exemplos: sala, cozinha, quarto ou banheiro)" mesmo pra chuveiro. Root causes: (a) `buildEnrichmentInstructions:1797` tinha exemplo literal hardcoded que LLM copiava como dado real; (b) quando LLM cravava `interesse:` inválido (ex: `hidraulica` não existe), `matchCategory` caía no `default` category.

**Fix Bug 11:** `phrasingDiscipline` sem exemplos cross-category. Fallback chain `interesse: → produto: → searchText` em `buildEnrichmentInstructions`.

**Bugs 9+10 validados sem fix:** alucinação cross-category (Bug 9) era consequência do Bug 8 — sumiu junto. Greeting "Olá!" (Bug 10) não reproduzível — `agent.greeting_message` intacto.

**Bug bonus tracked:** LLM crava `interesse:hidraulica` pra chuveiro. Mitigado pelo fallback chain. Backlog: validar `interesse:` ∈ category IDs.

**Arquivos:** `_shared/serviceCategories.ts` (+38), `_shared/serviceCategories.test.ts` (+103, 11 testes novos), `ai-agent/index.ts` (+69).

**Validação E2E (Eletropiso prod):** 2 leads via webhook POST. Lead 2 (1 turn "tem chuveiro lorenzetti 220v") — search 0 → "Pra te ajudar com o chuveiro certo, qual o tipo você prefere?" (antes: fallback genérico). Deploy via Supabase CLI. tsc=0. Vitest 109/109.

---

### v7.36.5 (2026-05-14) — Fix do loop de fila + retention de notifications (banco 116→35 MB)

**Incidente:** banco saltou de ~50 MB → 116 MB em 9h. Causa: 1 conversa sandbox com 22.682 `handoff_queue_events` ativos (cada ciclo do cron `requeue-conversations` criava event novo sem fechar o anterior quando a conversa ficava "presa" pausada fora do horário e era reativada via reset `status_ia=active`). Cada full_rotation gerava 6 notifications (1 por gestor/atendente) → 136.521 notifications acumuladas em 9h. Tabelas inchadas: `notifications` 60 MB, `handoff_queue_events` 22 MB.

**Fix em 3 camadas:**

1. **DB Constraint (defesa física):** `EXCLUDE USING gist (conversation_id WITH =) WHERE (status='active')` na tabela `handoff_queue_events`. Postgres recusa 2+ events ativos na mesma conversa. Migration `d30_one_active_event_per_conversation`. Requer `btree_gist`.

2. **Código idempotente (`_shared/handoffQueue.ts`):** antes do INSERT, `assignHandoff` checa se já há event active na conversa — se sim, **atualiza** o existente (assigned_user_id + expires_at + paused_at=null) em vez de criar. Evita falha do constraint e preserva continuidade.

3. **Dedup de alertas (`requeue-conversations/index.ts`):** `notifyGestores` agora não cria notification do mesmo tipo+conversa se já há uma <6h. Bloqueia spam do sino.

**Retention nova:** migration `notifications_retention_policy` cria `purge_notifications_older()` SECURITY DEFINER + pg_cron job `purge_notifications_hourly` (`5 * * * *`):
- `handoff_queue_full_rotation`: TTL 6h (alerta operacional transitório)
- Notifications lidas: 7d
- Notifications não-lidas: 30d

Smoke test OK. Cron ativo em prod (jobid 36).

**Limpeza imediata aplicada:** DELETE 68.892 events zumbis + 136.519 notifications + VACUUM FULL nas duas tabelas. **DB voltou de 116 MB → 35 MB.**

**Lição registrada** em [[wiki/erros-e-licoes]]: "feature que insere com base em estado externo (reset de `status_ia`) precisa de constraint DB-level + handler idempotente. Confiar só na lógica de aplicação leva a explosão silenciosa."

**Arquivos:**
- 2 migrations DB (constraint + retention)
- `supabase/functions/_shared/handoffQueue.ts` (idempotência)
- `supabase/functions/requeue-conversations/index.ts` (dedup notifyGestores)

**Deploys:** `requeue-conversations` + `ai-agent` + `assign-handoff` (todos usam `handoffQueue.ts`).

---

## Releases anteriores

- [[wiki/changelog/2026-05-part5]] — v7.35.1 a v7.36.4 (2026-05-12 a 13: dashboard pendências, retention logs, RPC uuid, IA 24/7, carrossel, auto-extract, button reply UAZAPI, upsell)
- [[wiki/changelog/2026-05-part4]] — v7.33.0 a v7.35.0 (Dashboard do Gestor 3 fases)
- [[wiki/changelog/2026-05-part3]] — v7.32.0 a v7.32.6 (Notif handoff WhatsApp + helpdesk polish + áudios)
- [[wiki/changelog/2026-05-part2b]] — v7.21.0 a v7.24.0 (D30 Sprints A+B+C+D)
- [[wiki/changelog/2026-05-part2a]] e [[wiki/changelog/2026-05-part1]] — outras entradas de maio
- [[wiki/changelog/2026-04-part2b]] e anteriores — abril 2026
- [[wiki/changelog/2026-pre-04-part3b]] e anteriores — pré-abril
