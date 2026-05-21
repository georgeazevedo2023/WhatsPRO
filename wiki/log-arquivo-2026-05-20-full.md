---
title: Log arquivo — Sessão 2026-05-20 (R124/R125/D36 + prefixo nome atendente)
type: log-archive
updated: 2026-05-21
description: Arquivado de log.md em 2026-05-21 para respeitar 300-line limit. Detalhes completos de R125 (badge fila OFF), R124 (handoff search_fail), D36 (permissões granulares), prefixo nome em msgs humanas.
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
