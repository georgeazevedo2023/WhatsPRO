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

### v7.36.4 (2026-05-13) — Fluxo upsell determinístico pós button reply + encoding fix

**Bug 6 — encoding "Tinta Acr�lica":** o `id` do botão do carrossel ia com acento. UAZAPI/Baileys serializa entre UTF-8/Latin-1 → mojibake ao retornar via `buttonOrListid`.
**Fix:** helper `safeBtnId(s)` aplica `stripAccents` em todos os 4 lugares onde o id é montado (`ai-agent/index.ts:1959+`). Lead ainda vê o `text` original (com acento) na UI do botão.

**Bug 7 — IA fazia nova busca em vez de fechar pedido:** quando lead clicava "Eu quero!" do carrossel, o LLM via "Tinta Acrílica Eggshell..." na mensagem e disparava `search_products` de novo, enviando outro carrossel inválido. Comportamento esperado: confirmar item, perguntar upsell, fazer handoff quando lead fechasse.
**Fix:** handler determinístico em `ai-agent/index.ts:269+` ANTES da chamada LLM:
- Detecta padrão `(Eu quero!|Mais informações) (Produto X)` com `matchAll` (suporta múltiplos cliques em 1 turno)
- Acumula `produto_escolhido:X` em `conversation.tags`
- Envia mensagem de upsell formal+simpática com lista de produtos
- Quando lead responde com closing (`obrigado/é só isso/finalizar/nada mais/...`), faz handoff direto com mensagem formal listando produtos
- Quando lead responde com novo item (descrição livre), limpa tag `aguardando_upsell:true` e deixa LLM rodar normalmente

**Defaults Eletropiso atualizados** (SQL):
- `handoff_message`: *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno. Foi um prazer atender! 😊"*
- `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis. Foi um prazer atender! 😊"*

**Validação E2E:** simulação via POST direto no webhook com 2 cliques + closing ("obrigado, é só isso"). IA respondeu corretamente em todos os 3 turnos. Dados de teste limpos do DB após validação.

**Logs novos em `ai_agent_logs`:** `upsell_prompt_sent`, `upsell_closed_handoff` (com metadata.produtos[]).

**Arquivos:**
- `supabase/functions/ai-agent/index.ts` — helper `safeBtnId` + handler upsell determinístico
- DB — UPDATE de `handoff_message` e `handoff_message_outside_hours` da Eletropiso

**Deploy:** `ai-agent` v32 via MCP.

---

### v7.36.3 (2026-05-13) — Button reply capturado via campo canônico UAZAPI

**Fix definitivo do Bug 3** descoberto pelo gestor durante teste sandbox: as 8 variantes Baileys/legacy adicionadas em v7.36.1 não capturavam button reply de carrossel porque UAZAPI v2 **normaliza tudo para um único campo**: `message.buttonOrListid`.

**Descoberta:** OpenAPI spec da UAZAPI v2 (`docs.uazapi.com/openapi-bundled.json`, schema `Message`):
> `buttonOrListid`: "ID do botão ou item de lista selecionado"
> `convertOptions`: "Conversão de opções da mensagem, lista, enquete e botões"

UAZAPI já desfaz o aninhamento do Baileys e devolve um campo flat. As variantes Baileys (`buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage`) que adicionei antes eram irrelevantes — UAZAPI nunca manda nesse formato. Mantidas como fallback defensivo.

**Validação:** POST simulado direto no webhook com payload UAZAPI v2 (`buttonOrListid` + `convertOptions`) gravou `content = "Eu quero! (Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva - Coral)"` na primeira tentativa.

**Arquivos:**
- `supabase/functions/whatsapp-webhook/index.ts` — variante V0 prioritária `buttonOrListid` + parse de `convertOptions` (JSON-serializado) pra `displayText`. Debug log temporário removido.

**Deploy:** `whatsapp-webhook` v7 via MCP.

**Lição:** [[wiki/erros-e-licoes]] — atualizada com "UAZAPI normaliza Baileys → buttonOrListid" como causa raiz real.

---

### v7.36.2 (2026-05-13) — Auto-extração de fields + carrossel bonito

**Bug 4 (qualificação):** IA repetia perguntas que o lead já havia respondido na 1ª mensagem.
- Lead: *"Tem tinta acrílica fosco?"* (trazia `tipo_tinta=acrílica` + `acabamento=fosco`)
- IA depois perguntou *"qual tipo de tinta? (acrílica, esmalte, epóxi)"* — violação direta de regra hardcoded `1339`.
- **Causa:** LLM nunca chamava `set_tags` na 1ª resposta — o `qualificationContext` computava "próxima pergunta = X" antes do LLM extrair os fields. Problema de **timing**, não de prompt.
- **Fix (defesa em camada):**
  - **Código:** novo `_shared/fieldAutoExtractor.ts` scaneia `incomingText` cruzando com `examples` dos fields da categoria detectada. Word boundary + normalização de acento + detecção de negação ("não", "sem", "exceto" + até 4 palavras). Pré-popula `conversation.tags` ANTES de `buildQualificationContext`.
  - **Prompt:** reforço em `hardcodedRules` com exemplo concreto da falha do George.
- **Defesa em profundidade:** mesmo se LLM ignorar a regra, o código já preencheu. 20 testes vitest cobrem positivos, negação, word boundary, falso positivo, fields numéricos pulados.

**Bug 5 (UI):** carrossel do helpdesk com botões "Eu quero!" / "Mais informações" exibidos como texto cinza minúsculo.
- **Fix:** botões agora têm fundo colorido por tipo — verde (REPLY), azul (URL), âmbar (CALL) — com ícone CornerDownLeft. Card maior (w-52), shadow leve, layout flex pra botões ficarem sempre no rodapé.

**Arquivos:**
- `supabase/functions/_shared/fieldAutoExtractor.ts` (novo)
- `supabase/functions/_shared/__tests__/fieldAutoExtractor.test.ts` (novo, 20 testes)
- `supabase/functions/ai-agent/index.ts` — import + bloco auto-extract antes de qualificationContext + reforço hardcodedRules
- `src/components/helpdesk/MessageBubble.tsx` — estilo carrossel + CornerDownLeft

**Deploys:** `ai-agent` v30 via MCP. Frontend: refresh.

**Logging:** novo evento `auto_field_extracted` em `ai_agent_logs` com payload do que foi extraído — debugável via SQL.

**Limites do MVP:**
- Fields numéricos (quantidade, voltagem, bitola, etc.) **não** são auto-extraídos — requerem regex específica que entenda unidades.
- Detecção de interesse (criação da tag `interesse:tinta`) continua dependendo do LLM/search_products — auto-extract só roda quando categoria já está identificada.

**Validação E2E:** pendente — gestor refazendo teste de tinta.

---

### v7.36.1 (2026-05-13) — Carrossel: botões + button-reply + anti-eco

**3 fixes E2E descobertos no teste sandbox de tinta:**

1. **🐛 IA parava após clique em botão REPLY do carrossel** (crítico — perda de venda).
   - Webhook gravava `content=""` porque só extraía `selectedButtonId` (formato legacy UAZAPI).
   - Ai-agent fazia early-return em `index.ts:253` por `no_text`.
   - **Fix:** webhook agora tenta 8 variantes UAZAPI/Baileys: `selectedButtonId`, `buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage.nativeFlowResponseMessage`, `buttonReply`, `selectedId/selectedDisplayText`, `listResponseMessage`, `listResponse`. Grava como `"${displayText} (${id})"` pra LLM saber QUAL produto o lead escolheu.

2. **🎨 Helpdesk não mostrava botões do carrossel** (UX admin).
   - `MessageBubble.tsx:396` lia `btn.label`, mas ai-agent salva `btn.text`.
   - **Fix:** `btn.label || btn.text` + tipo TS atualizado.

3. **💬 IA ecoava resposta do lead antes de perguntar** ("Anotado, ambiente interno para o quarto da sua filha. Você tem preferência por marca?").
   - Sem regra explícita anti-eco no `hardcodedRules`.
   - **Fix:** nova regra absoluta proíbe "Anotado/Entendi/Perfeito/Certo/Ok/Show/Beleza" + parafrasear. Confirmação só em fechamento de pedido.

**Arquivos:**
- `supabase/functions/whatsapp-webhook/index.ts` — 8 variantes de button reply
- `supabase/functions/ai-agent/index.ts:1339` — regra anti-eco em `hardcodedRules`
- `src/components/helpdesk/MessageBubble.tsx:396` — `btn.label || btn.text`

**Deploys:** `whatsapp-webhook` (versão 6) + `ai-agent` (versão 29). Frontend: refresh.

**Validação E2E:** pendente — gestor testando agora no sandbox.

---

### v7.36.0 (2026-05-13) — AI Agent atende 24/7 + toggle "Avisar fora do horário"

**Mudança de comportamento:** AI Agent **deixa de silenciar fora do horário comercial**. O agente qualifica leads em qualquer dia/hora; o horário só decide a mensagem usada no momento do transbordo.

**Novo toggle por agente** (`ai_agents.notify_outside_hours_on_handoff`, default `true`):
- **ON (default)** — atendentes só dentro do horário. Transbordo fora do horário envia `handoff_message_outside_hours` ("estamos fora do horário, consultor dará continuidade quando voltar").
- **OFF** — atendentes 24/7. Transbordo sempre usa `handoff_message` normal, sem aviso de horário.

**Migração silenciosa:** todos os tenants sobem com toggle ON (comportamento novo = desejável na maioria dos casos). Quem tinha atendentes 24/7 só precisa desligar o toggle uma vez no admin (`/dashboard/ai-agent → Segurança → Horário Comercial`).

**Texto default atualizado** para `handoff_message_outside_hours`: *"No momento estamos fora do horário de atendimento, mas assim que disponível nosso consultor de vendas vai dar prosseguimento ao seu atendimento. Deseja algo mais? 😊"* (aplicado só em configs novas).

**Campos**:
- ➕ `ai_agents.notify_outside_hours_on_handoff` (boolean, NOT NULL, default true)
- 🔇 `ai_agents.out_of_hours_message` — coluna preservada, deixou de ser lida pelo backend e removida do admin UI.

**Modo Estendido (D30 Sprint E)** inalterado — funciona como antes, com a nova lógica respeitando `extended_hours_until`.

**Hint LLM:** quando lead chega fora do horário com toggle ON, system prompt injeta contexto pra IA não prometer retorno imediato ("te ligo em 5min").

**Arquivos:**
- DB migration `add_notify_outside_hours_on_handoff`
- `src/integrations/supabase/types.ts`
- `src/components/admin/ai-agent/BusinessHoursEditor.tsx` — Switch + tooltip
- `src/components/admin/ai-agent/RulesConfig.tsx` — props novas
- `src/components/admin/AIAgentTab.tsx` — ALLOWED_FIELDS
- `supabase/functions/ai-agent/index.ts` — bloco skip removido + handoff respeita toggle + hint contextual
- Testes: 4 novos em `BusinessHoursEditor.test.tsx` (13/13 ✓)

---

### v7.35.3 (2026-05-12) — Fix: RPC `append_ai_debounce_message` quebrada por tipo errado

RPC declarava `p_instance_id uuid`, mas `instances.id` é `text` (IDs UAZAPI tipo `r466a98889b5809` não são UUID). Toda chamada explodia com `22P02 invalid input syntax for type uuid`. Erro silenciado em 3 camadas de fire-and-forget. Migration `fix_append_ai_debounce_message_instance_id_text` faz DROP + recria com tipo correto. Smoke test OK; pipeline destravado. Lição em [[wiki/erros-e-licoes]].

---

### v7.35.2 (2026-05-12) — Retention 24h dos logs do Supabase (-30 MB)

Logs internos do Supabase (`net._http_response` 21 MB + `cron.job_run_details` 8 MB) cresciam sem cleanup. `TRUNCATE` + função `purge_system_logs_older_than_24h()` SECURITY DEFINER + pg_cron `0 * * * *`. Banco 52→23 MB estável.

---

### v7.35.1 (2026-05-12) — Dashboard do Gestor: botão limpar pendências

2 RPCs `SECURITY DEFINER` (`dispense_conversation_from_dashboard` / `restore_…`) tag `dashboard:dispensed`. 3 RPCs de pendência filtram esta tag. `PendingConversationsCard` ganha botão X com toast "Desfazer". Helpdesk inalterado. Detalhe em commit `fda01ea`.

---

## Releases anteriores

- [[wiki/changelog/2026-05-part4]] — v7.33.0 a v7.35.0 (Dashboard do Gestor 3 fases)
- [[wiki/changelog/2026-05-part3]] — v7.32.0 a v7.32.6 (Notif handoff WhatsApp + helpdesk polish + áudios)
- [[wiki/changelog/2026-05-part2b]] — v7.21.0 a v7.24.0 (D30 Sprints A+B+C+D)
- [[wiki/changelog/2026-05-part2a]] e [[wiki/changelog/2026-05-part1]] — outras entradas de maio
- [[wiki/changelog/2026-04-part2b]] e anteriores — abril 2026
- [[wiki/changelog/2026-pre-04-part3b]] e anteriores — pré-abril
