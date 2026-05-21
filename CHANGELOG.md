---
title: Changelog
type: changelog
updated: 2026-05-20
audited_at: 2026-05-20
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.38.4 (2026-05-20) — Fix R126: `search_products({query:"material"})` cross-categoria

**Bug em prod (Guttemberg, Eletropiso 558781592373, conv `529f51f8`).** Lead pediu "Porta em alumínio e janela em alumínio, só uma de 139" → IA enviou **carrossel de Telha de PVC** R$62. Categoria errada absoluta (lead pediu porta/janela, recebeu telha).

**Causa raiz — 3 falhas em cascata:**
1. **Gap debounce.** Msg1 "Olá gostaria de saber mais informações sobre um material" entrou na queue, processou greeting, e nesse meio tempo a msg2 "Porta alumínio…" chegou e entrou em queue SEPARADA. LLM viu só msg1.
2. **Query genérica escapa do guard de categoria.** LLM chamou `search_products({query: "material"})`. Bug 27 fix tenta deduzir categoria via `matchCategoryBySearchText("material")` mas nenhuma das 24 regex casa "material" → `expectedCategory=null` → `filterProductsByExpectedCategory` vira no-op.
3. **Catálogo embrionário.** EletropisoV2 tem só 1 produto digital cadastrado (Telha PVC) com "material" na descrição. ILIKE `%material%` → carrossel cross-categoria. Categorias `portas`/`janelas` estão configuradas como `catalog_status:offline` mas LLM-driven search nunca checa isso.

**Fix v7.38.4 (Camadas 1+2):**
- **Novo `_shared/searchGuard.ts`** com `evaluateSearchGuard()` — guard determinístico ANTES da query DB:
  - Recusa query genérica (`material|produto|item|coisa|preço|valor`, accent/case-insensitive) sem `expectedCategoryId` → devolve instrução pro LLM pedir categoria.
  - Recusa quando `expectedCategoryStatus === 'offline'` → devolve instrução pra qualificar + handoff (mesma rota do auto-extract `r121_auto_extract_inline`).
- **`ai-agent/index.ts`** integra o helper logo após o cálculo de `expectedCategory` (linha ~2204) com log estruturado `search_guard_blocked`.
- **Migration `20260520210000_ai_agent_logs_search_guard_blocked_event`** adiciona event ao CHECK constraint pra evitar R88 (silent INSERT fail).

**Arquivos:**
- `supabase/functions/_shared/searchGuard.ts` (helper testável, 96 lin)
- `supabase/functions/_shared/searchGuard.test.ts` (15 cenários incluindo repro Guttemberg)
- `supabase/functions/ai-agent/index.ts` (import + integração, ~25 lin)
- `supabase/migrations/20260520210000_ai_agent_logs_search_guard_blocked_event.sql`

**Camada 3 — backlog.** Gap debounce real (msgs novas chegando entre greeting e LLM) tracked como sprint separado. Frase: *"continuar Camada 3 R126 — merge msgs queue antes LLM 2026-05-20"*.

**Lição R126.** Tool call do LLM com payload genérico DEVE ser recusado pelo backend quando não há categoria semântica derivável — LLM em input ambíguo "chuta", defesa é determinística no handler, não no prompt. Catálogo embrionário (<5 produtos digitais) é alto risco de cross-categoria; admin deveria marcar agente como "handoff-first" até atingir threshold (D27 sugere).

**Testes.** 15/15 PASS em `searchGuard.test.ts`. Suite geral: 817 pass / 9 falhas pré-existentes (FormBuilder, mesmo padrão R124/R125 — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ → v62 ACTIVE, `verify_jwt:false`.

---

### v7.38.3 (2026-05-20) — Fix R125: badge "Em fila" aparecia com Modo Fila OFF

**Bug em prod (Eletropiso 558781592373, conv `5227cd44` do dinho).** Departamento Vendas com `queue_mode_enabled=false` (gestor-de-chão Lucas como default_assignee), mas helpdesk mostrava badge `⏱ Em fila — Lucas (2:10)` na conversa. Atendente confuso — "se desliguei a fila, por que aparece fila?".

**Causa raiz.** `_shared/handoffQueue.ts` criava registro em `handoff_queue_events` com `status='active'` e `expires_at = now() + 5min` em **todo** handoff, mesmo no Modo OFF. O hook `useActiveQueueEvents.ts:69` renderiza o badge sempre que existe row ativa — sem olhar `dept.queue_mode_enabled`. Resultado: countdown aparecia mesmo em dept onde fila não roda.

**Fix.**
- `_shared/handoffQueue.ts`: bloco INSERT/UPDATE de queue_event agora roda só se `dept.queue_mode_enabled === true`. No Modo OFF, faz UPDATE só em `conversations.assigned_to` (comportamento esperado: gestor recebe direto, sem countdown). Adicionalmente, no Modo OFF cancela qualquer event ativo herdado (transição ON→OFF deixava órfãos).
- `src/components/admin/queue/QueueConfig.tsx`: `handleSave` cancela events ativos do dept quando toggle salva OFF — defense-in-depth, não depende de novo handoff acontecer pra limpar UI.

**Arquivos:**
- `supabase/functions/_shared/handoffQueue.ts` — bloco event sob `if (dept.queue_mode_enabled)`
- `supabase/functions/_shared/__tests__/handoffQueue.test.ts` — `queue_event_id` agora `null` em OFF + novo teste `R125 — Modo OFF não chama insert`
- `src/components/admin/queue/QueueConfig.tsx` — cancela events ativos ao salvar OFF

**Limpeza em prod.** 1 queue_event órfão do dinho cancelado via SQL (`UPDATE handoff_queue_events SET status='cancelled' WHERE id='693eb2a2...'`). Badge sumiu imediato via postgres_changes do hook.

**Lição R125.** UI que sinaliza "feature ativa" não pode renderizar com base só no shape do dado (row existe) — precisa olhar a configuração que governa a feature (`queue_mode_enabled` do dept). Backend que cria row em código compartilhado deve respeitar o flag do contexto. **Regra preventiva**: toda feature toggleável precisa testar "se flag=OFF, o usuário vê algum vestígio?". Se sim, é vazamento de estado.

**Testes.** 21/21 PASS em `handoffQueue.test.ts`. Suite geral: 802 pass / 9 falhas pré-existentes (FormBuilder/useForms/excludedProducts/detection ESM — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent && deploy assign-handoff --project-ref prfcbfumyrrycsrcrvms` ✓.

---

### v7.38.2 (2026-05-20) — Fix R124: handoff_to_human bloqueado eternamente após search_fail

**Bug (prod Eletropiso 558781592373, conv `04baffce`).** Lead Carla pediu valor de arandela → IA buscou (0 resultados → tag `search_fail:1`) → pediu refinamento → lead disse "Quero saber os valores" → IA tentou `handoff_to_human` **2 vezes** mas guard "REGRA BUSCA OBRIGATÓRIA" bloqueou as duas. Conversa ficou "Não atribuída", IA Ativa, sem mensagem de transbordo, sem atribuir Lucas (default_assignee). Loop infinito até gerar atrito manual.

**Causa raiz** (`supabase/functions/ai-agent/index.ts:3562-3575` antigo). O guard checava `toolCallsLog.some(t => t.name === 'search_products')` — mas `toolCallsLog` é resetado a cada invocação da edge function. A busca da Carla foi feita no turn 1, gravou `search_fail:1` na tag, mas no turn 4 (quando ela voltou pedindo valor) o `toolCallsLog` voltou vazio. Como ela tinha `produto:arandela` nas tags, o guard bloqueava **pra sempre**.

**Fix.** Extraído pra `_shared/handoffGuard.ts` (testável). Nova condição: `hasSearched = thisRound OR tags contém search_fail:N`. Se busca prévia já falhou, libera handoff (faz sentido: agente já tentou, não há porque insistir em search).

**Arquivos:**
- `supabase/functions/_shared/handoffGuard.ts` (44 lin, novo) — `evaluateHandoffGuard()` + const da msg
- `supabase/functions/_shared/handoffGuard.test.ts` (69 lin, novo) — 8 testes (inclui repro EXATO da Carla)
- `supabase/functions/ai-agent/index.ts:3562-3575` — usa helper

**Lição R124.** Quando guardrail depende de estado da rodada atual (`toolCallsLog`), mas o estado durável vive na tag (`search_fail:N`), o guard precisa olhar **ambos**. Cada invocação do ai-agent é stateless — tags são a única memória persistente entre turnos. Antes de bloquear via guard, sempre checar: "se isso disparar 1000 vezes em loop, o lead consegue sair?" Se a única forma de destravar é uma ação que o LLM já tentou e falhou, é bug.

**Testes.** 8/8 PASS no `handoffGuard.test.ts`. Suite geral: 801 pass / 9 falhas pré-existentes (excludedProducts text, useForms mocks, FormBuilder, *Detection — nenhuma tocada por este fix).

**Deploy.** `supabase functions deploy ai-agent --project-ref prfcbfumyrrycsrcrvms` ✓ via scoop CLI (npx falhou com SmartScreen ApplicationFailedException).

---

### v7.38.1 (2026-05-20) — Fix R123: toggle IA na lista de leads falhava silencioso pra gerente/atendente

**Bug.** Televendas (`gerente`) clicou "desativar IA" pra Slone → ícone seguia verde. Causa: policy de UPDATE em `contacts` só permite `is_super_admin` — UPDATE direto via `supabase.from('contacts').update()` cai em RLS silent filter (0 rows affected, sem erro), refetch traz estado antigo.

**Fix — migration `set_contact_ia_blocked_rpc`:** RPC SECURITY DEFINER `set_contact_ia_blocked(p_contact_id, p_blocked)` valida `has_inbox_access` em alguma inbox do contato (super_admin bypassa), atualiza só a coluna `ia_blocked_instances`. GRANT EXECUTE pra `authenticated`. RAISE `forbidden_no_inbox_access` quando bloqueado.

**Frontend `src/pages/dashboard/Leads.tsx:183-215`:** mutationFn agora chama `supabase.rpc('set_contact_ia_blocked', ...)`. Adicionado `onMutate` optimistic (cancel inflight + snapshot + setQueryData → ícone responde na hora) + `onError` rollback do snapshot + `onSettled` invalidate.

**Lição R123:** UPDATE direto em tabela com RLS-só-super_admin falha silencioso. Pra toggles single-column em tabela protegida, usar RPC SECURITY DEFINER validando relação (ex: `has_inbox_access`). Optimistic update mascara latência.

---

### v7.38.0 (2026-05-20) — Permissões granulares por feature + redesign Categorias/Excluded

**Feature D36 — Sistema de permissões granulares (F1).** Atendentes e gerentes podem receber acesso a features específicas do AI Agent. Migration `user_feature_permissions` + função `has_feature_permission(user, feature)` SECURITY DEFINER no DB resolve a permissão (super_admin sempre true, gerente true por padrão, atendente false por padrão). 5 features iniciais: `manage_catalog`, `manage_faq`, `manage_qualification`, `manage_excluded_products`, `manage_blocked_numbers`.

**UI/UX.** Botão Shield no card de usuário (UsersTab) abre `UserPermissionsDialog` com 5 toggles + reset pro padrão do role. Gerentes agora acessam `/dashboard/admin/users` (era só super_admin). Hooks `useFeaturePermission` + componentes `<FeatureRoute>` e `<AnyFeatureRoute>` guardam rotas e tabs internas. Tabs Categorias/Excluded/Catálogo/Conhecimento/Bloqueados do AIAgentTab mostram empty state "Sem permissão" se atendente sem acesso. Sidebar "Agente IA" agora aparece pra quem tem qualquer feature AI.

**Fixed.** 3 guards `isSuperAdmin` internos duplicados em AIAgentConfig/AIAgentCatalog/AIAgentKnowledge removidos (controle agora vive 100% nos route guards).

**Redesign Categorias de atendimento + Produtos NÃO vendemos.** Grid responsivo 1/2/3 cols (sm/md/xl), toolbar com busca/sort/paginação 12-por-página, stats bar 4-cards compactos, tiles com avatar colorido (paleta determinística por hash do label), mini funil visual por exit_action, click abre editor em Sheet lateral. Mobile-first (avatares 32px / padding p-3 mobile). Badge "Sem catalogo digital" removida.

**Arquivos:**
- Migration `20260520120000_user_feature_permissions.sql` (aplicada em prod via MCP)
- `src/hooks/useFeaturePermission.ts` (90 lin) — hook + FEATURE_KEYS + FEATURE_LABELS
- `src/components/routes/FeatureRoute.tsx` + `AnyFeatureRoute.tsx`
- `src/components/admin/UserPermissionsDialog.tsx` (233 lin)
- `src/components/admin/UsersTab.tsx` — botão Shield no card
- `src/components/admin/AIAgentTab.tsx` — 5 guards de tab
- `src/components/dashboard/Sidebar.tsx` — Agente IA visível pra atendentes com features
- `src/App.tsx` — rotas catalog/knowledge via FeatureRoute, ai-agent via AnyFeatureRoute, admin/users via CrmRoute (gerente acessa)
- `src/pages/dashboard/AIAgentConfig.tsx` + `AIAgentCatalog.tsx` + `AIAgentKnowledge.tsx` — guards internos removidos
- `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` (+~250 lin) e `ExcludedProductsConfig.tsx` (redesign completo)
- `src/integrations/supabase/types.ts` — regen

**Backlog próxima sessão:** F2 (BlockedNumbersConfig já existe — só validar UX) + ações destrutivas do gerente no UsersTab (esconder delete/role select).

---

### v7.37.21 (2026-05-20) — Prefixo `*Nome*` do atendente em msgs humanas (helpdesk)

**UX.** Atendente envia texto pelo helpdesk → lead recebe `*Lucas*\nOi Maria...` no WhatsApp. Aplicado em **toda** msg outgoing (decisão validada via AskUserQuestion — evita confusão de identidade em conversas longas com troca humano↔IA↔humano).

**`src/components/helpdesk/ChatInput.tsx`:**
- State `agentName` carregado 1x no mount via `user_profiles.full_name` (primeiro nome; fallback `user.email`).
- `handleSend` prefixa `*${agentName}*\n` antes do `quoted` (citação do replyTo segue após o nome). Prefixo vai pro UAZAPI **E** pro INSERT em `conversation_messages` → card outgoing no helpdesk mostra exatamente o que o lead recebeu.
- Notas privadas (`private_note`) e mídia (imagem/áudio/doc) **não** recebem prefixo — escopo intencional.

---

## 📦 Histórico arquivado

Releases anteriores foram movidas para [[wiki/changelog/]] para manter este arquivo dentro do hard limit de 300 linhas (D31). Arquivos mais recentes:

- [[wiki/changelog/2026-05-part6]] — v7.37.20 a v7.36.5 (release 2026-05-19 → 2026-05-17)
- [[wiki/changelog/2026-05-part5]] — v7.36.4 a v7.35.1 (release 2026-05-17 → 2026-05-11)
- [[wiki/changelog/]] — diretório completo (partes mais antigas)
