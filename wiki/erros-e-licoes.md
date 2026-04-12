---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-12
---

# Erros e Lições

> Consultado no INÍCIO de cada sessão. Verifique se o erro que você está prestes a cometer já está aqui.

---

## Regras Preventivas (resumo rápido)

| # | Regra | Origem |
|---|-------|--------|
| 1 | NUNCA reportar dados falsos — só confirmar após teste E2E completo | Regra de integridade |
| 2 | NUNCA dar nota/score parcial e depois mudar para pior | Regra de integridade |
| 3 | Token UAZAPI NUNCA no frontend — sempre via uazapi-proxy | Segurança |
| 4 | Não selecionar campo `token` da tabela `instances` no frontend | Segurança |
| 5 | types.ts só via `npx supabase gen types` — NUNCA editar manual | Padrão |
| 6 | Debounce NO RETRY on 500 — é timeout do gateway, não crash | AI Agent |
| 7 | Empty LLM response = silêncio — NUNCA enviar fallback ao lead | AI Agent |
| 8 | NUNCA dizer "não encontrei/não temos" ao lead — usar [INTERNO] | AI Agent |
| 9 | Clear context: tags = ['ia_cleared:TIMESTAMP'] — NUNCA [] (quebra handoff counter) | AI Agent |
| 10 | Shadow mode NUNCA sobrescreve full_name existente | AI Agent |
| 11 | Greeting + question: enviar greeting E continuar para LLM responder | AI Agent |
| 12 | SYNC RULE: alteração em feature do AI Agent deve sincronizar 8 locais | Consistência |
| 13 | Sequência de correção: Código → Validator → FAQ → Handoff (nunca pular) | AI Agent |
| 14 | `?? 0` ao incrementar contadores do DB — undefined/null → NaN silencioso | Forms |
| 15 | NUNCA setState fora de useEffect/handler; guards com return DEPOIS dos hooks | React |
| 16 | Getters NUNCA com side effects — separar leitura de transição de estado | Arquitetura |
| 17 | NUNCA check-then-insert em unique key — usar upsert ON CONFLICT | DB |
| 18 | NUNCA `.reverse()` / `.sort()` em arrays externos — usar `.slice().reverse()` | JS |
| 19 | NUNCA duplicar FIELD_MAP — usar `leadHelper.ts` compartilhado | Integrações |
| 20 | Bio lead captures DEVEM criar contact + lead_profile real — dados isolados são invisíveis | Bio Link |
| 21 | Todo sistema de captação DEVE setar `lead_profiles.origin` e tags `origem:X` | Atribuição |
| 22 | Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false` — gateway sem CORS headers bloqueia localhost e domínios diferentes | CORS |
| 23 | CORS estático (`browserCorsHeaders`) não funciona com múltiplas origens — usar `getDynamicCorsHeaders(req)` que checa Origin vs whitelist + localhost | CORS |
| 24 | `instances.id` é TEXT (não UUID) — FK para instances deve usar TEXT | DB |
| 25 | Endpoint UAZAPI para interativos é `/send/menu` (type=poll/list/quickreply), NÃO `/send/poll` — validar com curl antes de implementar | UAZAPI |
| 26 | `ALLOWED_ORIGIN` DEVE existir nos Secrets do Supabase em produção — sem ele, CORS usa fallback hardcoded errado e bloqueia TODAS as requisições do frontend | Deploy |
| 27 | Edge functions chamadas pelo browser DEVEM usar `getDynamicCorsHeaders(req)` — `browserCorsHeaders` é estático e falha quando o domínio real difere do fallback | CORS |
| 28 | NUNCA usar `now()` ou funções VOLATILE em predicado de índice parcial — PostgreSQL exige IMMUTABLE. Filtro temporal vai na query, não no `CREATE INDEX ... WHERE` | DB |
| 29 | SEMPRE verificar schema real do banco antes de escrever código de insert — nomes de coluna divergentes causam erro silencioso (`.maybeSingle()` retorna null) | Orchestrator |
| 30 | Supabase `flow_events.event_type` tem CHECK constraint — NUNCA inserir tipo fora da lista. Verificar migration antes de logar evento. | Orchestrator |
| 31 | `.single()` lança exceção se 0 ou >1 rows — SEMPRE usar `.maybeSingle()` em edge functions seguido de `if (error)` check explícito | DB |
| 36 | PostgREST `.upsert({ onConflict: 'col_a,col_b,col_c' })` falha — PostgREST não resolve constraint pelo nome das colunas. Usar RPC com `INSERT … ON CONFLICT (col_a, col_b, col_c) DO UPDATE` | Orchestrator |
| 37 | Não passar `step_data: {}` no insert de `flow_states` — sobrescreve o DEFAULT do banco. Omitir o campo para que `message_count: 0` e demais defaults sejam aplicados pelo PostgreSQL | Orchestrator |
| 38 | Sempre usar `?? 0` ao ler `step_data.message_count` — mesmo com DEFAULT, dados antigos podem ter o campo ausente | Orchestrator |

---

## Histórico de Erros

### CORS bloqueava envio de mensagens do Helpdesk (2026-04-09)

**O que:** Atendente não conseguia enviar mensagens pelo Helpdesk. Banner "Failed to fetch" no topo. Console mostrava erro CORS: `Access-Control-Allow-Origin: https://euljumefltljegknaw.s.supabase.co` (Supabase URL) em vez de `https://crm.wsmart.com.br` (domínio real).

**Causa raiz (2 problemas simultâneos):**
1. `uazapi-proxy/index.ts` usava `browserCorsHeaders` (estático) em vez de `getDynamicCorsHeaders(req)` (dinâmico). O header estático sempre retornava o fallback hardcoded.
2. O secret `ALLOWED_ORIGIN` **nunca foi criado** nos Secrets do Supabase. Sem ele, `cors.ts` caía no fallback `https://app.whatspro.com.br` — que não era o domínio real `crm.wsmart.com.br`.

**Correção:**
1. `uazapi-proxy/index.ts` linha 1: trocado `import { browserCorsHeaders as corsHeaders }` por `import { getDynamicCorsHeaders }`. No handler: `const corsHeaders = getDynamicCorsHeaders(req)`.
2. Secret criado: `npx supabase secrets set ALLOWED_ORIGIN=https://crm.wsmart.com.br`
3. Deploy: `npx supabase functions deploy uazapi-proxy`

**Regras preventivas:**
- R26: `ALLOWED_ORIGIN` DEVE existir nos Secrets em produção
- R27: Edge functions browser-facing DEVEM usar `getDynamicCorsHeaders(req)`
- Checklist de deploy: verificar se `ALLOWED_ORIGIN` está configurado

**Nota:** 12 outras edge functions ainda usam `browserCorsHeaders` estático. Funcionam porque o Supabase gateway trata CORS automaticamente para elas. Mas `uazapi-proxy` falhava porque faz fetch externo (UAZAPI) que demora e o gateway pode não aplicar CORS no preflight.

### form-bot retries NaN — bypass silencioso de validação (2026-04-06)

**O que:** Formulário nunca abandonava após máximo de retries — campo com erro podia ser ignorado infinitamente.
**Causa:** `session.retries` vinha `undefined` do DB (coluna sem default no insert). `undefined + 1 = NaN`, `NaN >= 3 = false` → condição de abandono jamais ativada.
**Correção:** `(session.retries ?? 0) + 1` — nullish coalescing garante que undefined/null vira 0.
**Regra:** Sempre usar `?? 0` ao incrementar contadores que vêm do banco — o DB pode retornar null/undefined para colunas sem default.

### setState durante render — freeze/loop de re-render (2026-04-06)

**O que:** `WhatsappFormsPage` chamava `setSelectedAgentId(agents[0].id)` direto no body do componente. React lança warning "Cannot update a component while rendering a different component" e pode entrar em loop infinito.
**Causa:** Auto-select do primeiro agente foi escrito como lógica condicional no render, fora de efeito.
**Correção:** Movido para `useEffect([agents, selectedAgentId])`. Guard de redirect (`if (!isSuperAdmin)`) deve vir DEPOIS de todos os hooks — React exige ordem constante.
**Regra:** NUNCA chamar setState fora de handler ou useEffect. Guards de redirect com `return` devem vir após todos os hooks.

### Circuit breaker getter com side effect — transição de estado inconsistente (2026-04-06)

**O que:** Getter `isOpen` fazia transição OPEN→HALF_OPEN como side effect. Múltiplos acessos ao getter no mesmo tick poderiam transicionar o estado mais de uma vez ou em momento errado.
**Causa:** Getters JavaScript são funções puras por convenção — sem efeitos colaterais. O código misturava leitura de estado com mutação de estado.
**Correção:** `isOpen` tornou-se getter puro (read-only: `state==='OPEN' && elapsed < resetMs`). Criado método privado `checkState()` para a transição, chamado explicitamente em `call()`.
**Regra:** Getters NUNCA devem ter side effects. Separar leitura de estado de transição de estado.

### Race condition na criação de contato — unique constraint em submissões simultâneas (2026-04-06)

**O que:** Dois submits simultâneos do mesmo número em `form-public` causavam erro 500 — o segundo insert violava unique constraint na coluna `jid`.
**Causa:** Padrão check-then-insert: ambas as requisições passam pelo check "existe?" ao mesmo tempo, ambas encontram null, ambas tentam inserir.
**Correção:** `upsert ON CONFLICT jid` — operação atômica no DB. O segundo submits atualiza em vez de inserir, sem erro.
**Regra:** NUNCA usar check-then-insert para entidades identificadas por unique key. Sempre usar `upsert ON CONFLICT`.

### Array mutation no ChatPanel — .reverse() muta o array original (2026-04-06)

**O que:** `.reverse()` chamado direto no array retornado pela query Supabase mutava o array em place. Comportamento indefinido se a referência escapar (cache do React Query, closures).
**Causa:** `Array.prototype.reverse()` muta o array original — não cria uma cópia.
**Correção:** `.slice().reverse()` — `slice()` sem argumentos cria cópia rasa antes de inverter. Aplicado em 3 locais no ChatPanel.
**Regra:** NUNCA chamar `.reverse()` ou `.sort()` direto em arrays externos (results de query, props). Sempre `.slice().reverse()` / `[...arr].sort()`.

---

### Bio lead captures isolados — dados capturados mas invisíveis (2026-04-07)

**O que:** Leads capturados via Bio Link (M14 Fase 3) iam para `bio_lead_captures` e paravam ali. Não criavam contact, não criavam lead_profile, não apareciam no CRM, Kanban, Leads ou AI Agent. Tabela nem tinha migration.
**Causa:** `bio_lead_captures` foi implementada como INSERT simples sem criar entidades downstream. Além disso, a tabela nunca teve migration (funcionava por estar criada diretamente no DB mas sem versionamento).
**Correção:** M15 F1 — bio-public agora chama `upsertContactFromPhone()` + `upsertLeadFromFormData()` (via `leadHelper.ts` compartilhado). Migration criada. `contact_id` FK adicionada.
**Regra 20:** Todo sistema de captação DEVE criar contact + lead_profile real. Dados isolados são invisíveis ao resto do sistema.

### FIELD_MAP duplicado em 2 edge functions (2026-04-07)

**O que:** O mapeamento `nome→full_name, email→email, cpf→cpf...` estava copiado identicamente em `form-public` e `form-bot`. Qualquer alteração num campo precisaria ser feita em 2 lugares.
**Causa:** Cada edge function foi desenvolvida em milestone separado (M12, M13) e copiou o código.
**Correção:** Extraído para `_shared/leadHelper.ts` com `FORM_FIELD_MAP`, `upsertContactFromPhone()` e `upsertLeadFromFormData()`. Ambas as funções agora importam do módulo compartilhado.
**Regra 19:** NUNCA duplicar FIELD_MAP ou lógica de upsert de lead — usar `leadHelper.ts`.

### FK type mismatch — instances.id é TEXT, não UUID (2026-04-09)

**O que:** Migration poll_messages falhava com "Key columns instance_id and id are of incompatible types: uuid and text".
**Causa:** `public.instances.id` é TEXT (não UUID). A migration usava `instance_id UUID REFERENCES instances(id)`.
**Correção:** Alterado para `instance_id TEXT NOT NULL REFERENCES instances(id)`.
**Regra 24:** Sempre verificar o tipo real da coluna referenciada antes de criar FK. `instances.id` é TEXT.

### UAZAPI endpoint errado para polls — /send/poll não existe (2026-04-09)

**O que:** Todas as funcionalidades de poll (proxy, AI Agent, automação, NPS, form-bot) retornavam 405 Method Not Allowed. Polls nunca funcionaram em produção.
**Causa:** O código usava `POST /send/poll` mas esse endpoint não existe no UAZAPI. O endpoint correto é `POST /send/menu` com `type: 'poll'`. Além disso, campos são diferentes: `question`→`text`, `options`→`choices`.
**Correção:** 6 edits em 4 arquivos — alterado endpoint + payload em uazapi-proxy, ai-agent, automationEngine (2x) e form-bot (2x). Testado ao vivo com sucesso.
**Regra 25:** SEMPRE validar endpoints UAZAPI com curl antes de implementar. A documentação interna pode estar desatualizada — conferir em docs.uazapi.com. O endpoint unificado para mensagens interativas é `/send/menu` com campo `type` (poll, list, quickreply).

---

### PostgreSQL IMMUTABLE em índice parcial — `now()` proibido (2026-04-11)

**O que:** Migration `20260415000001` falharia em produção com `ERROR: functions in index predicate must be marked IMMUTABLE`. O índice `idx_lead_memory_lookup` usava `WHERE expires_at IS NULL OR expires_at > now()`.
**Causa:** PostgreSQL exige que funções em predicados de índice parcial sejam IMMUTABLE. `now()` é VOLATILE — muda a cada chamada. O predicado de índice é avaliado na criação, não na query.
**Correção:** Predicado simplificado para `WHERE expires_at IS NULL` (IMMUTABLE). Filtro dinâmico `expires_at > now()` movido para as queries que consultam o índice.
**Regra 28:** NUNCA usar `now()`, `CURRENT_TIMESTAMP` ou qualquer função VOLATILE em predicados de índice parcial (`WHERE` do `CREATE INDEX`). O filtro temporal vai na query, não no índice.

### S2 Orchestrator — 6 bugs críticos encontrados na auditoria (2026-04-11)

**O que:** Após commit 367b4b0 (S2 Orchestrator skeleton), auditoria encontrou 6 bugs que impediriam qualquer insert no banco.

**Bugs encontrados:**
1. `current_step_id` em vez de `flow_step_id` (4 arquivos) — campo não existe na tabela
2. `.single()` em `updateFlowState` → crash se state não encontrado
3. `.single()` em `createFlowState` → pode crashar em race condition
4. `instance_id` NOT NULL ausente no insert de `flow_states`
5. `flow_id` + `instance_id` NOT NULL ausentes no insert de `flow_events`
6. `event_type: 'subagent_called'` violaria CHECK constraint — tipo inválido (correto: `tool_called`)
7. Coluna `event_data` não existe em `flow_events` — campo correto é `input` JSONB

**Causa raiz:** Tipos definidos sem validar contra schema real do banco. Nomes de colunas inventados (`current_step_id`, `event_data`) sem conferir migration. CHECK constraint não consultada.
**Correção:** Commit 7bb2f8e — `flow_step_id` em todos os arquivos, `.maybeSingle()` + error check, campos NOT NULL incluídos, `tool_called` como event_type, `input` JSONB em vez de `event_data`.
**Regras:**
- R29: SEMPRE ler o schema real (migration) antes de escrever código de insert
- R30: CHECK constraints em `event_type` devem ser consultadas antes de logar evento
- R31: `.single()` lança exceção → sempre `.maybeSingle()` em edge functions
- R34: Antes de usar qualquer coluna no código, verificar schema real com `information_schema.columns` — `conversations` usa `contact_id`/`inbox_id`, não `lead_id`/`instance_id`; tabela `leads` não existe, é `lead_profiles`; `flow_steps` usa `subagent_type`, não `step_type`
- R35: FKs em flow_states: `lead_id → lead_profiles.id` (não contacts.id). Para resolver lead de uma conversa: `conversations.contact_id → lead_profiles.contact_id → lead_profiles.id`
- R32: `useState(() => sideEffect())` NÃO é `useEffect` — inicializador roda 1x no mount com estado inicial undefined. Para reagir a dados assíncronos usar `useEffect(() => {}, [dep])`
- R33: Ao criar rotas React Router, SEMPRE verificar App.tsx E sidebar/nav. Código de página sem rota = inacessível (bug silencioso)

---

### S5 Orchestrator — 3 bugs em Memory Service + Greeting (2026-04-12)

**B#1 — `getStepType` lia campo inexistente:** `context.step_config.step_type` (undefined) → sempre despachava para stub 'custom'. Corrigido: `contextBuilder` injeta `subagent_type` no `step_config`; `getStepType` lê `subagent_type`.

**B#2 — PostgREST `.upsert({ onConflict: 'col,col,col' })` falha:** `"there is no unique or exclusion constraint matching"`. PostgREST não resolve constraint por lista de colunas. Solução: criar RPC `upsert_lead_long_memory` com `INSERT … ON CONFLICT (lead_id, memory_type, scope)` — idêntica à `upsert_lead_short_memory` mas sem TTL. R36 preventivo.

**B#3 — `step_data: {}` no insert sobrescreve DEFAULT:** `createFlowState` passava `step_data: {}`, sobrescrevendo o DEFAULT do banco `{message_count: 0, ...}`. Resultado: `message_count = undefined`. Check `isFirstMessage = (message_count === 0)` → false → `upsertLongMemory` nunca chamada. Correção dupla: (1) remover `step_data` do insert; (2) `?? 0` no check. R37+R38 preventivos.

**E2E validado (commit 935fb3f):** Case B (sessions_count++), Case C (greeting+UAZAPI), Case D (pede nome→continue), Case A (extrai nome ASCII→advance, salva full_name + long_memory).
